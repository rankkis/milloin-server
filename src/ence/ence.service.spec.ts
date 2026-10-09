import { EnceSnapshot } from './ence-cache.service';
import { buildEnceDto, pickStreams } from './ence.service';
import { MatchData, StreamData } from './interfaces/team-data.interface';

const stream = (
  name: string,
  language: string,
  official = false,
  viewers?: number,
): StreamData => ({
  name,
  platform: 'Twitch',
  language,
  url: `https://www.twitch.tv/${name}`,
  official,
  ...(viewers !== undefined ? { viewers } : {}),
});

const match = (id: string, startTime: string, live = false): MatchData => ({
  id,
  startTime,
  live,
  opponent: { name: `Team ${id}`, logoUrl: `https://img/${id}.png` },
  event: 'CCT Europe Series 9',
  format: 'Bo3',
  streams: [],
});

const snapshot = (matches: MatchData[]): EnceSnapshot => ({
  fetchedAt: '2026-10-09T10:12:00.000Z',
  source: 'PandaScore',
  data: {
    team: { name: 'ENCE', logoUrl: 'https://img/ence.png' },
    matches,
    results: [1, 2, 3, 4].map((n) => ({
      id: `r${n}`,
      startTime: `2026-10-0${n}T16:00:00.000Z`,
      opponent: { name: `Old ${n}` },
      event: 'CCT',
      teamScore: 2,
      opponentScore: n % 2,
    })),
  },
  news: [],
  logos: { 'https://img/ence.png': 'aaaaaaaaaaaaaaaa' },
});

describe('pickStreams', () => {
  it('keeps only Finnish and English streams', () => {
    const picked = pickStreams([
      stream('ru', 'ru', true),
      stream('en', 'en'),
      stream('pt', 'pt'),
      stream('fi', 'fi'),
    ]);
    expect(picked.map((s) => s.name)).toEqual(['fi', 'en']);
  });

  it('orders official first, then Finnish, without viewer counts', () => {
    const picked = pickStreams([
      stream('fi-community', 'fi'),
      stream('en-community', 'en'),
      stream('en-official', 'en', true),
      stream('fi-official', 'fi', true),
    ]);
    expect(picked.map((s) => s.name)).toEqual([
      'fi-official',
      'en-official',
      'fi-community',
      'en-community',
    ]);
  });

  it('orders by viewers when known and keeps at most five', () => {
    const picked = pickStreams(
      [10, 50, 30, 20, 40, 60].map((v) => stream(`s${v}`, 'en', false, v)),
    );
    expect(picked.map((s) => s.viewers)).toEqual([60, 50, 40, 30, 20]);
  });

  it('drops duplicate URLs', () => {
    expect(pickStreams([stream('a', 'en'), stream('a', 'en')])).toHaveLength(1);
  });
});

describe('buildEnceDto', () => {
  const now = new Date('2026-10-09T11:00:00.000Z');

  it('gives the next match with streams and up to three after it', () => {
    const dto = buildEnceDto(
      snapshot([
        match('a', '2026-10-10T15:30:00.000Z'),
        match('b', '2026-10-13T13:00:00.000Z'),
        match('c', '2026-10-15T16:00:00.000Z'),
        match('d', '2026-10-16T16:00:00.000Z'),
        match('e', '2026-10-17T16:00:00.000Z'),
      ]),
      now,
    );
    expect(dto.nextMatch?.opponent.name).toBe('Team a');
    expect(dto.nextMatch?.streams).toEqual([]);
    expect(dto.upcoming.map((m) => m.opponent.name)).toEqual([
      'Team b',
      'Team c',
      'Team d',
    ]);
    expect(dto.results).toHaveLength(3);
  });

  it('keeps a match that started within four hours as the next one', () => {
    const dto = buildEnceDto(
      snapshot([
        match('old', '2026-10-09T05:00:00.000Z'),
        match('started', '2026-10-09T10:30:00.000Z'),
      ]),
      now,
    );
    expect(dto.nextMatch?.opponent.name).toBe('Team started');
  });

  it('has no next match when none is scheduled', () => {
    const dto = buildEnceDto(snapshot([]), now);
    expect(dto.nextMatch).toBeUndefined();
    expect(dto.upcoming).toEqual([]);
  });

  it('gives logo paths only for copied logos', () => {
    const dto = buildEnceDto(
      snapshot([match('a', '2026-10-10T15:30:00.000Z')]),
      now,
    );
    expect(dto.team.logo).toBe('ence/logos/aaaaaaaaaaaaaaaa');
    expect(dto.nextMatch?.opponent.logo).toBeUndefined();
  });
});
