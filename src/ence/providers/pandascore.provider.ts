import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  ITeamDataProvider,
  MatchData,
  ResultData,
  StreamData,
  TeamData,
  TeamRef,
} from '../interfaces/team-data.interface';

/** PandaScore's slug for ENCE's Counter-Strike team */
export const ENCE_PANDASCORE_SLUG = 'ence';

const BASE_URL = 'https://api.pandascore.co/csgo';
const TIMEOUT_MS = 10_000;

/** The parts of PandaScore's objects used here */
export interface PandaTeam {
  id: number;
  name: string;
  acronym?: string | null;
  slug?: string;
  image_url?: string | null;
}

export interface PandaStream {
  language?: string | null;
  official?: boolean;
  main?: boolean;
  raw_url?: string | null;
  embed_url?: string | null;
}

export interface PandaMatch {
  id: number;
  status: string;
  begin_at?: string | null;
  scheduled_at?: string | null;
  match_type?: string | null;
  number_of_games?: number | null;
  opponents?: { opponent?: PandaTeam | null }[];
  results?: { team_id: number; score: number }[];
  league?: { name?: string | null } | null;
  serie?: { full_name?: string | null; name?: string | null } | null;
  streams_list?: PandaStream[] | null;
}

/**
 * ENCE's Counter-Strike matches from the PandaScore REST API
 * (https://developers.pandascore.co). Needs a token in PANDASCORE_TOKEN,
 * or in config/api-keys.json as pandascore.token locally; the free plan
 * covers it. Five requests per refresh at most.
 */
@Injectable()
export class PandaScoreProvider implements ITeamDataProvider {
  readonly name = 'PandaScore';
  private readonly logger = new Logger(PandaScoreProvider.name);
  private readonly token = this.loadToken();
  private team?: PandaTeam;

  async fetchTeam(): Promise<TeamData> {
    const team = await this.getTeam();
    const byTeam = { 'filter[opponent_id]': String(team.id) };
    const [running, upcoming, past] = await Promise.all([
      this.get<PandaMatch[]>('/matches/running', byTeam),
      this.get<PandaMatch[]>('/matches/upcoming', {
        ...byTeam,
        sort: 'begin_at',
        per_page: '5',
      }),
      this.get<PandaMatch[]>('/matches/past', {
        ...byTeam,
        sort: '-begin_at',
        per_page: '5',
      }),
    ]);

    return {
      team: toTeamRef(team),
      matches: [...running, ...upcoming]
        .map((match) => toMatch(match, team.id))
        .filter((match): match is MatchData => !!match)
        .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime)),
      results: past
        .map((match) => toResult(match, team.id))
        .filter((result): result is ResultData => !!result),
    };
  }

  /** ENCE's team, looked up once per instance */
  private async getTeam(): Promise<PandaTeam> {
    if (!this.team) {
      const [team] = await this.get<PandaTeam[]>('/teams', {
        'filter[slug]': ENCE_PANDASCORE_SLUG,
      });
      if (!team) {
        throw new Error(`PandaScore has no team ${ENCE_PANDASCORE_SLUG}`);
      }
      this.team = team;
    }
    return this.team;
  }

  private async get<T>(
    endpoint: string,
    query: Record<string, string>,
  ): Promise<T> {
    if (!this.token) {
      throw new Error('PANDASCORE_TOKEN is not set');
    }
    const url = `${BASE_URL}${endpoint}?${new URLSearchParams(query)}`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`PandaScore ${endpoint} answered ${response.status}`);
    }
    return (await response.json()) as T;
  }

  private loadToken(): string | undefined {
    if (process.env.PANDASCORE_TOKEN) {
      return process.env.PANDASCORE_TOKEN;
    }
    try {
      const configPath = path.join(process.cwd(), 'config', 'api-keys.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.pandascore?.token) {
        return config.pandascore.token;
      }
    } catch {
      // No config file
    }
    this.logger.warn('PandaScore token not configured, no ENCE matches');
    return undefined;
  }
}

const toTeamRef = (team?: PandaTeam | null): TeamRef => ({
  name: team?.name ?? 'TBD',
  logoUrl: team?.image_url ?? undefined,
});

const opponentOf = (match: PandaMatch, teamId: number) =>
  match.opponents?.find(({ opponent }) => opponent && opponent.id !== teamId)
    ?.opponent;

const eventOf = (match: PandaMatch): string =>
  [match.league?.name, match.serie?.full_name ?? match.serie?.name]
    .filter(Boolean)
    .join(' ');

const startOf = (match: PandaMatch): string | undefined => {
  const start = match.begin_at ?? match.scheduled_at;
  return start ? new Date(start).toISOString() : undefined;
};

export function toMatch(
  match: PandaMatch,
  teamId: number,
): MatchData | undefined {
  const startTime = startOf(match);
  if (!startTime) return undefined;
  return {
    id: `pandascore-${match.id}`,
    startTime,
    live: match.status === 'running',
    opponent: toTeamRef(opponentOf(match, teamId)),
    event: eventOf(match),
    format:
      match.match_type === 'best_of' && match.number_of_games
        ? `Bo${match.number_of_games}`
        : undefined,
    streams: (match.streams_list ?? [])
      .map(toStream)
      .filter((stream): stream is StreamData => !!stream),
  };
}

export function toResult(
  match: PandaMatch,
  teamId: number,
): ResultData | undefined {
  const startTime = startOf(match);
  const score = (id?: number) =>
    match.results?.find((result) => result.team_id === id)?.score;
  const opponent = opponentOf(match, teamId);
  const teamScore = score(teamId);
  const opponentScore = score(opponent?.id);
  if (!startTime || teamScore === undefined || opponentScore === undefined) {
    return undefined;
  }
  return {
    id: `pandascore-${match.id}`,
    startTime,
    opponent: toTeamRef(opponent),
    event: eventOf(match),
    teamScore,
    opponentScore,
  };
}

const PLATFORMS: Record<string, string> = {
  'twitch.tv': 'Twitch',
  'youtube.com': 'YouTube',
  'youtu.be': 'YouTube',
  'kick.com': 'Kick',
};

export function toStream(stream: PandaStream): StreamData | undefined {
  const raw = stream.raw_url ?? stream.embed_url;
  if (!raw) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  const host = url.hostname.replace(/^(www|m)\./, '');
  const channel = url.pathname.split('/').filter(Boolean)[0];
  return {
    name: channel ? decodeURIComponent(channel).replace(/^@/, '') : host,
    platform: PLATFORMS[host] ?? host,
    language: (stream.language ?? '').toLowerCase().slice(0, 2),
    url: url.toString(),
    official: !!stream.official,
  };
}
