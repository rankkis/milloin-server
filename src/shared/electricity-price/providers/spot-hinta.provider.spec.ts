import { SpotHintaProvider } from './spot-hinta.provider';

describe('SpotHintaProvider', () => {
  const provider = new SpotHintaProvider();
  const fetchMock = jest.fn();

  beforeEach(() => {
    global.fetch = fetchMock;
    fetchMock.mockReset();
  });

  const respond = (body: unknown, ok = true) =>
    Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);

  it('splits hourly prices into 15-minute intervals within the range', async () => {
    fetchMock.mockImplementation((url: string) =>
      url.endsWith('/Today')
        ? respond([
            { DateTime: '2026-10-07T10:00:00+03:00', PriceWithTax: 0.1 },
            { DateTime: '2026-10-07T11:00:00+03:00', PriceWithTax: 0.2 },
          ])
        : respond([], false),
    );

    const prices = await provider.fetchPrices(
      new Date('2026-10-07T07:30Z'),
      new Date('2026-10-07T09:00Z'),
    );

    expect(prices.map((p) => [p.startDate, p.price])).toEqual([
      ['2026-10-07T07:30:00.000Z', 0.1],
      ['2026-10-07T07:45:00.000Z', 0.1],
      ['2026-10-07T08:00:00.000Z', 0.2],
      ['2026-10-07T08:15:00.000Z', 0.2],
      ['2026-10-07T08:30:00.000Z', 0.2],
      ['2026-10-07T08:45:00.000Z', 0.2],
    ]);
  });

  it('throws when today prices are unavailable', async () => {
    fetchMock.mockImplementation(() => respond([], false));

    await expect(
      provider.fetchPrices(new Date(0), new Date('2100-01-01')),
    ).rejects.toThrow();
  });
});
