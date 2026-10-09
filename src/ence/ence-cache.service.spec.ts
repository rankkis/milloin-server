import { EnceCacheService, logoId } from './ence-cache.service';
import { TeamData } from './interfaces/team-data.interface';

const teamData = (opponent = 'Sashi'): TeamData => ({
  team: { name: 'ENCE', logoUrl: 'https://cdn/ence.png' },
  matches: [
    {
      id: '1',
      startTime: '2026-10-10T15:30:00.000Z',
      live: false,
      opponent: { name: opponent },
      event: 'CCT',
      streams: [],
    },
  ],
  results: [],
});

/** In-memory stand-in for the Vercel runtime cache */
const sharedCache = () => {
  const entries = new Map<string, unknown>();
  return {
    entries,
    get: jest.fn(async (key: string) => entries.get(key) ?? null),
    set: jest.fn(async (key: string, value: unknown) => {
      entries.set(key, JSON.parse(JSON.stringify(value)));
    }),
  };
};

describe('EnceCacheService', () => {
  let primary: { name: string; fetchTeam: jest.Mock };
  let fallback: { name: string; fetchTeam: jest.Mock };
  let news: { name: string; fetchNews: jest.Mock };
  let shared: ReturnType<typeof sharedCache>;
  let cache: EnceCacheService;
  let fetchMock: jest.SpyInstance;

  const setNow = (iso: string) => jest.setSystemTime(new Date(iso));

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    setNow('2026-10-09T10:00:00Z');
    primary = { name: 'Primary', fetchTeam: jest.fn() };
    fallback = { name: 'Fallback', fetchTeam: jest.fn() };
    news = { name: 'News', fetchNews: jest.fn().mockResolvedValue([]) };
    shared = sharedCache();
    cache = new EnceCacheService([primary, fallback], news, shared);
    fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(Buffer.from('png'), {
        headers: { 'content-type': 'image/png' },
      }),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    fetchMock.mockRestore();
  });

  it('fetches once and serves memory for an hour', async () => {
    primary.fetchTeam.mockResolvedValue(teamData());

    const first = await cache.getSnapshot();
    setNow('2026-10-09T10:59:00Z');
    const second = await cache.getSnapshot();

    expect(second).toBe(first);
    expect(first.source).toBe('Primary');
    expect(primary.fetchTeam).toHaveBeenCalledTimes(1);
  });

  it('fetches again after an hour', async () => {
    primary.fetchTeam.mockResolvedValueOnce(teamData('Old'));
    primary.fetchTeam.mockResolvedValueOnce(teamData('New'));

    await cache.getSnapshot();
    setNow('2026-10-09T11:01:00Z');
    const snapshot = await cache.getSnapshot();

    expect(snapshot.data.matches[0].opponent.name).toBe('New');
  });

  it('falls back to the next provider', async () => {
    primary.fetchTeam.mockRejectedValue(new Error('down'));
    fallback.fetchTeam.mockResolvedValue(teamData());

    expect((await cache.getSnapshot()).source).toBe('Fallback');
  });

  it('serves older data when every provider fails', async () => {
    primary.fetchTeam.mockResolvedValueOnce(teamData('Old'));
    await cache.getSnapshot();

    primary.fetchTeam.mockRejectedValue(new Error('down'));
    fallback.fetchTeam.mockRejectedValue(new Error('down'));
    setNow('2026-10-09T11:30:00Z');
    const snapshot = await cache.getSnapshot();

    expect(snapshot.data.matches[0].opponent.name).toBe('Old');
  });

  it('fails when nothing is cached and every provider fails', async () => {
    primary.fetchTeam.mockRejectedValue(new Error('down'));
    fallback.fetchTeam.mockRejectedValue(new Error('down'));

    await expect(cache.getSnapshot()).rejects.toThrow('down');
  });

  it('uses fresh data another instance left in the shared cache', async () => {
    primary.fetchTeam.mockResolvedValue(teamData());
    await cache.getSnapshot();

    const other = new EnceCacheService([primary], news, shared);
    await other.getSnapshot();

    expect(primary.fetchTeam).toHaveBeenCalledTimes(1);
  });

  it('copies logos once and serves the copies', async () => {
    primary.fetchTeam.mockResolvedValue(teamData());

    const snapshot = await cache.getSnapshot();
    const id = logoId('https://cdn/ence.png');

    expect(snapshot.logos).toEqual({ 'https://cdn/ence.png': id });
    expect(await cache.getLogo(id)).toEqual({
      contentType: 'image/png',
      data: Buffer.from('png').toString('base64'),
    });

    setNow('2026-10-09T11:01:00Z');
    await cache.getSnapshot();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('leaves out a logo that is not an image', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>', { headers: { 'content-type': 'text/html' } }),
    );
    primary.fetchTeam.mockResolvedValue(teamData());

    expect((await cache.getSnapshot()).logos).toEqual({});
  });

  it('keeps the previous news when the news fetch fails', async () => {
    const item = {
      title: 'News',
      url: 'https://n',
      publishedAt: '2026-10-08T00:00:00.000Z',
    };
    primary.fetchTeam.mockResolvedValue(teamData());
    news.fetchNews.mockResolvedValueOnce([item]);
    await cache.getSnapshot();

    news.fetchNews.mockRejectedValue(new Error('down'));
    setNow('2026-10-09T11:01:00Z');

    expect((await cache.getSnapshot()).news).toEqual([item]);
  });
});
