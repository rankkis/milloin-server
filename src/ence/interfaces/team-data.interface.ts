/**
 * What a match data source returns about ENCE. Logo URLs point at the
 * source; EnceCacheService copies the images and serves its own copies.
 */
export interface TeamRef {
  name: string;
  logoUrl?: string;
}

export interface StreamData {
  /** Channel name, e.g. "cct_cs" */
  name: string;
  /** Twitch, YouTube, Kick or the stream's host name */
  platform: string;
  /** ISO 639-1 language code, lower case, e.g. "fi" */
  language: string;
  url: string;
  official: boolean;
  /** Current viewers, when the source tells */
  viewers?: number;
}

export interface MatchData {
  id: string;
  /** Zulu time */
  startTime: string;
  live: boolean;
  opponent: TeamRef;
  /** Tournament, e.g. "CCT Europe Series 9" */
  event: string;
  /** e.g. "Bo3" */
  format?: string;
  streams: StreamData[];
}

export interface ResultData {
  id: string;
  /** Zulu time */
  startTime: string;
  opponent: TeamRef;
  event: string;
  teamScore: number;
  opponentScore: number;
}

export interface TeamData {
  team: TeamRef;
  /** Running and upcoming matches, soonest first */
  matches: MatchData[];
  /** Finished matches, latest first */
  results: ResultData[];
}

export interface NewsItem {
  title: string;
  /** The publisher, e.g. "Dust2.us" */
  source?: string;
  url: string;
  /** Zulu time */
  publishedAt: string;
}

/**
 * Injection token for the match data sources, in priority order.
 */
export const TEAM_DATA_PROVIDERS = Symbol('TEAM_DATA_PROVIDERS');

/**
 * A source of ENCE's matches (PandaScore, ...). A provider only fetches;
 * EnceCacheService decides when, tries providers in order and caches.
 */
export interface ITeamDataProvider {
  /** Source name used in logs and the response */
  readonly name: string;

  /** @throws when the source is unavailable or not configured */
  fetchTeam(): Promise<TeamData>;
}

/** A source of news about ENCE */
export interface INewsProvider {
  readonly name: string;
  fetchNews(): Promise<NewsItem[]>;
}

export const NEWS_PROVIDER = Symbol('NEWS_PROVIDER');

/**
 * Key-value cache shared by every server instance (Vercel runtime cache,
 * process memory elsewhere). Entries may disappear at any time.
 */
export const ENCE_SHARED_CACHE = Symbol('ENCE_SHARED_CACHE');

export interface ISharedCache {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown, options?: { ttl?: number }): Promise<void>;
}
