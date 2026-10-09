import { Injectable } from '@nestjs/common';
import { EnceCacheService, EnceSnapshot } from './ence-cache.service';
import {
  EnceDto,
  EnceMatchDto,
  EnceStreamDto,
  EnceTeamDto,
} from './dto/ence.dto';
import {
  MatchData,
  StreamData,
  TeamRef,
} from './interfaces/team-data.interface';

/** Only Finnish and English broadcasts are listed */
export const STREAM_LANGUAGES = ['fi', 'en'];
export const MAX_STREAMS = 5;
const MAX_UPCOMING = 3;
const MAX_RESULTS = 3;
const MAX_NEWS = 3;

/**
 * A match that has started but was not yet running when the data was
 * fetched (up to an hour ago) is still shown as the next match for this
 * long after its start.
 */
const MATCH_LENGTH_MS = 4 * 60 * 60 * 1000;

@Injectable()
export class EnceService {
  constructor(private readonly cache: EnceCacheService) {}

  async getEnce(): Promise<EnceDto> {
    return buildEnceDto(await this.cache.getSnapshot(), new Date());
  }
}

export function buildEnceDto(snapshot: EnceSnapshot, now: Date): EnceDto {
  const { data, logos } = snapshot;
  const team = (ref: TeamRef): EnceTeamDto => ({
    name: ref.name,
    ...(ref.logoUrl && logos[ref.logoUrl]
      ? { logo: `ence/logos/${logos[ref.logoUrl]}` }
      : {}),
  });
  const match = (data: MatchData): EnceMatchDto => ({
    startTime: data.startTime,
    live: data.live,
    opponent: team(data.opponent),
    event: data.event,
    ...(data.format ? { format: data.format } : {}),
  });

  const matches = data.matches.filter(
    (m) => m.live || Date.parse(m.startTime) > now.getTime() - MATCH_LENGTH_MS,
  );
  const [next, ...upcoming] = matches;

  return {
    updatedAt: snapshot.fetchedAt,
    source: snapshot.source,
    team: team(data.team),
    ...(next
      ? { nextMatch: { ...match(next), streams: pickStreams(next.streams) } }
      : {}),
    upcoming: upcoming.slice(0, MAX_UPCOMING).map(match),
    results: data.results.slice(0, MAX_RESULTS).map((result) => ({
      startTime: result.startTime,
      opponent: team(result.opponent),
      event: result.event,
      teamScore: result.teamScore,
      opponentScore: result.opponentScore,
    })),
    news: snapshot.news.slice(0, MAX_NEWS),
  };
}

/**
 * The top Finnish and English streams: most viewers first when the source
 * tells, otherwise official broadcasts first, then Finnish ones.
 */
export function pickStreams(streams: StreamData[]): EnceStreamDto[] {
  const rank = (stream: StreamData) =>
    (stream.official ? 0 : 2) + (stream.language === 'fi' ? 0 : 1);
  const seen = new Set<string>();
  return streams
    .filter((stream) => STREAM_LANGUAGES.includes(stream.language))
    .filter((stream) => !seen.has(stream.url) && !!seen.add(stream.url))
    .map((stream, index) => ({ stream, index }))
    .sort(
      (a, b) =>
        (b.stream.viewers ?? -1) - (a.stream.viewers ?? -1) ||
        rank(a.stream) - rank(b.stream) ||
        a.index - b.index,
    )
    .slice(0, MAX_STREAMS)
    .map(({ stream }) => ({
      name: stream.name,
      platform: stream.platform,
      language: stream.language,
      url: stream.url,
      official: stream.official,
      ...(stream.viewers !== undefined ? { viewers: stream.viewers } : {}),
    }));
}
