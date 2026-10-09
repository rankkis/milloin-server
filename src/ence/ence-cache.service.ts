import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { createHash } from 'crypto';
import {
  ENCE_SHARED_CACHE,
  INewsProvider,
  ISharedCache,
  ITeamDataProvider,
  NEWS_PROVIDER,
  NewsItem,
  TEAM_DATA_PROVIDERS,
  TeamData,
} from './interfaces/team-data.interface';

/** Matches and news are fetched again when older than this */
export const MAX_AGE_MS = 60 * 60 * 1000;

/** After a failed fetch, upstream is asked again at most this often */
const MIN_RETRY_INTERVAL_MS = 10 * 60 * 1000;

const SHARED_CACHE_KEY = 'ence';
const SHARED_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
const LOGO_KEY_PREFIX = 'ence-logo:';
const LOGO_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_LOGO_BYTES = 512 * 1024;
const LOGO_TIMEOUT_MS = 10_000;

export interface EnceSnapshot {
  /** Zulu time */
  fetchedAt: string;
  source: string;
  data: TeamData;
  news: NewsItem[];
  /** Logo id by source URL, for logos copied successfully */
  logos: Record<string, string>;
}

export interface Logo {
  contentType: string;
  /** Base64 */
  data: string;
}

/**
 * Keeps ENCE's matches, news and team logos in memory, like the electricity
 * prices: a request finds them there, or waits for a fetch when they are
 * missing or over an hour old. Concurrent requests share one fetch. When the
 * sources fail, older data is served. On serverless hosts a fresh instance
 * first reads what other instances left in the shared cache.
 *
 * Logos are copied from the source once, so visitors' browsers load them
 * from this API and never from the source.
 */
@Injectable()
export class EnceCacheService implements OnModuleInit {
  private readonly logger = new Logger(EnceCacheService.name);
  private snapshot?: EnceSnapshot;
  private readonly logos = new Map<string, Logo>();
  private lastAttemptAt = 0;
  private refreshing: Promise<EnceSnapshot> | null = null;

  constructor(
    @Inject(TEAM_DATA_PROVIDERS)
    private readonly providers: ITeamDataProvider[],
    @Inject(NEWS_PROVIDER)
    private readonly newsProvider: INewsProvider,
    @Optional()
    @Inject(ENCE_SHARED_CACHE)
    private readonly sharedCache?: ISharedCache,
  ) {}

  onModuleInit(): void {
    this.refresh().catch((error) =>
      this.logger.warn('Initial ENCE fetch failed', error),
    );
  }

  /** Hourly refresh on long-lived hosts; on serverless getSnapshot() does it */
  @Cron('5 * * * *', { name: 'refresh-ence' })
  async scheduledRefresh(): Promise<void> {
    try {
      await this.refresh();
    } catch (error) {
      this.logger.error('Scheduled ENCE refresh failed', error);
    }
  }

  /** The latest data, fetched first when missing or over an hour old */
  async getSnapshot(): Promise<EnceSnapshot> {
    const now = Date.now();
    if (this.snapshot && this.isFresh(this.snapshot, now)) {
      return this.snapshot;
    }
    if (this.snapshot && now - this.lastAttemptAt < MIN_RETRY_INTERVAL_MS) {
      return this.snapshot;
    }
    try {
      return await this.refresh();
    } catch (error) {
      if (this.snapshot) {
        this.logger.warn('ENCE refresh failed, serving older data');
        return this.snapshot;
      }
      throw error;
    }
  }

  /** A copied logo by id, or undefined */
  async getLogo(id: string): Promise<Logo | undefined> {
    const inMemory = this.logos.get(id);
    if (inMemory) return inMemory;
    const shared = await this.readShared(LOGO_KEY_PREFIX + id);
    if (isLogo(shared)) {
      this.logos.set(id, shared);
      return shared;
    }
    return undefined;
  }

  refresh(): Promise<EnceSnapshot> {
    if (!this.refreshing) {
      this.refreshing = this.load().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  private async load(): Promise<EnceSnapshot> {
    const shared = await this.readShared(SHARED_CACHE_KEY);
    if (isSnapshot(shared) && this.isFresh(shared, Date.now())) {
      this.snapshot = shared;
      return shared;
    }

    this.lastAttemptAt = Date.now();
    const [{ source, data }, news] = await Promise.all([
      this.fetchTeam(),
      this.fetchNews(isSnapshot(shared) ? shared.news : []),
    ]);
    const snapshot: EnceSnapshot = {
      fetchedAt: new Date().toISOString(),
      source,
      data,
      news,
      logos: await this.copyLogos(data),
    };
    this.snapshot = snapshot;
    await this.writeShared(
      SHARED_CACHE_KEY,
      snapshot,
      SHARED_CACHE_TTL_SECONDS,
    );
    return snapshot;
  }

  private async fetchTeam(): Promise<{ source: string; data: TeamData }> {
    let lastError: unknown = new Error('No ENCE data providers configured');
    for (const provider of this.providers) {
      try {
        const data = await provider.fetchTeam();
        this.logger.log(
          `Fetched ${data.matches.length} ENCE matches from ${provider.name}`,
        );
        return { source: provider.name, data };
      } catch (error) {
        lastError = error;
        this.logger.warn(`${provider.name} fetch failed`, error);
      }
    }
    throw lastError;
  }

  /** News is extra: on failure the previous news is kept */
  private async fetchNews(previous: NewsItem[]): Promise<NewsItem[]> {
    try {
      return await this.newsProvider.fetchNews();
    } catch (error) {
      this.logger.warn(`${this.newsProvider.name} fetch failed`, error);
      return this.snapshot?.news ?? previous;
    }
  }

  /** Copies every logo not copied yet; a logo that fails is left out */
  private async copyLogos(data: TeamData): Promise<Record<string, string>> {
    const urls = new Set(
      [
        data.team,
        ...data.matches.map((match) => match.opponent),
        ...data.results.map((result) => result.opponent),
      ]
        .map((team) => team.logoUrl)
        .filter((url): url is string => !!url),
    );
    const logos: Record<string, string> = {};
    await Promise.all(
      [...urls].map(async (url) => {
        const id = logoId(url);
        if ((await this.getLogo(id)) || (await this.copyLogo(id, url))) {
          logos[url] = id;
        }
      }),
    );
    return logos;
  }

  private async copyLogo(id: string, url: string): Promise<boolean> {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(LOGO_TIMEOUT_MS),
      });
      const contentType = response.headers.get('content-type') ?? '';
      if (!response.ok || !contentType.startsWith('image/')) {
        throw new Error(`answered ${response.status} ${contentType}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > MAX_LOGO_BYTES) {
        throw new Error(`is ${bytes.length} bytes`);
      }
      const logo: Logo = { contentType, data: bytes.toString('base64') };
      this.logos.set(id, logo);
      await this.writeShared(LOGO_KEY_PREFIX + id, logo, LOGO_TTL_SECONDS);
      return true;
    } catch (error) {
      this.logger.warn(`Copying logo ${url} failed: ${error}`);
      return false;
    }
  }

  private isFresh(snapshot: EnceSnapshot, now: number): boolean {
    return now - Date.parse(snapshot.fetchedAt) < MAX_AGE_MS;
  }

  private async readShared(key: string): Promise<unknown> {
    if (!this.sharedCache) return null;
    try {
      return await this.sharedCache.get(key);
    } catch (error) {
      this.logger.warn(`Reading shared cache ${key} failed`, error);
      return null;
    }
  }

  private async writeShared(
    key: string,
    value: unknown,
    ttl: number,
  ): Promise<void> {
    if (!this.sharedCache) return;
    try {
      await this.sharedCache.set(key, value, { ttl });
    } catch (error) {
      this.logger.warn(`Writing shared cache ${key} failed`, error);
    }
  }
}

/** A short, stable id for a logo's source URL */
export const logoId = (url: string): string =>
  createHash('sha256').update(url).digest('hex').slice(0, 16);

const isSnapshot = (value: unknown): value is EnceSnapshot =>
  !!value &&
  typeof (value as EnceSnapshot).fetchedAt === 'string' &&
  !!(value as EnceSnapshot).data;

const isLogo = (value: unknown): value is Logo =>
  !!value &&
  typeof (value as Logo).contentType === 'string' &&
  typeof (value as Logo).data === 'string';
