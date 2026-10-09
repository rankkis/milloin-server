import { PandaMatch, toMatch, toResult, toStream } from './pandascore.provider';

const ENCE = { id: 1, name: 'ENCE', image_url: 'https://cdn/ence.png' };
const SASHI = { id: 2, name: 'Sashi', image_url: 'https://cdn/sashi.png' };

const pandaMatch = (overrides: Partial<PandaMatch> = {}): PandaMatch => ({
  id: 99,
  status: 'not_started',
  begin_at: '2026-10-10T15:30:00Z',
  match_type: 'best_of',
  number_of_games: 3,
  opponents: [{ opponent: ENCE }, { opponent: SASHI }],
  league: { name: 'CCT Europe' },
  serie: { full_name: 'Series 9 2026' },
  streams_list: [
    {
      language: 'en',
      official: true,
      raw_url: 'https://www.twitch.tv/cct_cs',
    },
    {
      language: 'fi',
      official: false,
      raw_url: 'https://www.youtube.com/@suomistriimi',
    },
  ],
  ...overrides,
});

describe('PandaScore mapping', () => {
  it('maps an upcoming match', () => {
    expect(toMatch(pandaMatch(), ENCE.id)).toEqual({
      id: 'pandascore-99',
      startTime: '2026-10-10T15:30:00.000Z',
      live: false,
      opponent: { name: 'Sashi', logoUrl: 'https://cdn/sashi.png' },
      event: 'CCT Europe Series 9 2026',
      format: 'Bo3',
      streams: [
        {
          name: 'cct_cs',
          platform: 'Twitch',
          language: 'en',
          url: 'https://www.twitch.tv/cct_cs',
          official: true,
        },
        {
          name: 'suomistriimi',
          platform: 'YouTube',
          language: 'fi',
          url: 'https://www.youtube.com/@suomistriimi',
          official: false,
        },
      ],
    });
  });

  it('marks a running match live and names a missing opponent TBD', () => {
    const match = toMatch(
      pandaMatch({ status: 'running', opponents: [{ opponent: ENCE }] }),
      ENCE.id,
    );
    expect(match?.live).toBe(true);
    expect(match?.opponent).toEqual({ name: 'TBD', logoUrl: undefined });
  });

  it('skips a match without a time', () => {
    expect(
      toMatch(pandaMatch({ begin_at: null, scheduled_at: null }), ENCE.id),
    ).toBeUndefined();
  });

  it("maps a result with ENCE's score first", () => {
    const result = toResult(
      pandaMatch({
        status: 'finished',
        results: [
          { team_id: SASHI.id, score: 1 },
          { team_id: ENCE.id, score: 2 },
        ],
      }),
      ENCE.id,
    );
    expect(result).toMatchObject({ teamScore: 2, opponentScore: 1 });
  });

  it('lower-cases the language and drops a stream without a URL', () => {
    expect(
      toStream({ language: 'FI', raw_url: 'https://kick.com/kanava' }),
    ).toMatchObject({ language: 'fi', platform: 'Kick', name: 'kanava' });
    expect(toStream({ language: 'en' })).toBeUndefined();
  });
});
