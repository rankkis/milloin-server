import { EntsoeProvider } from './entsoe.provider';

describe('EntsoeProvider', () => {
  const fetchMock = jest.fn();
  let provider: EntsoeProvider;

  beforeEach(() => {
    process.env.ENTSOE_API_KEY = 'test-key';
    global.fetch = fetchMock;
    fetchMock.mockReset();
    provider = new EntsoeProvider();
  });

  afterEach(() => {
    delete process.env.ENTSOE_API_KEY;
  });

  const respond = (xml: string) =>
    fetchMock.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(xml),
    } as Response);

  /** One PT15M period of two hours with the given points */
  const document = (points: [number, number][]) => `
    <Publication_MarketDocument>
      <TimeSeries>
        <curveType>A03</curveType>
        <Period>
          <timeInterval>
            <start>2026-10-07T22:00Z</start>
            <end>2026-10-08T00:00Z</end>
          </timeInterval>
          <resolution>PT15M</resolution>
          ${points
            .map(
              ([position, price]) =>
                `<Point><position>${position}</position><price.amount>${price}</price.amount></Point>`,
            )
            .join('')}
        </Period>
      </TimeSeries>
    </Publication_MarketDocument>`;

  it('fills the quarters that curve type A03 leaves out with the previous price', async () => {
    // Positions 2-4 and 6-8 repeat the price before them
    respond(
      document([
        [1, 100],
        [5, 200],
      ]),
    );

    const prices = await provider.fetchPrices(
      new Date('2026-10-07T22:00Z'),
      new Date('2026-10-08T00:00Z'),
    );

    expect(prices).toHaveLength(8);
    expect(prices.map((p) => p.startDate)).toEqual(
      Array.from({ length: 8 }, (_, q) =>
        new Date(
          Date.parse('2026-10-07T22:00Z') + q * 15 * 60 * 1000,
        ).toISOString(),
      ),
    );
    // EUR/MWh to EUR/kWh with 25.5 % VAT
    expect(prices[3].price).toBeCloseTo(0.1255);
    expect(prices[4].price).toBeCloseTo(0.251);
    expect(prices[7].endDate).toBe('2026-10-08T00:00:00.000Z');
  });

  it('keeps every listed point when none are left out', async () => {
    respond(
      document(Array.from({ length: 8 }, (_, i) => [i + 1, 10 * (i + 1)])),
    );

    const prices = await provider.fetchPrices(
      new Date('2026-10-07T22:00Z'),
      new Date('2026-10-08T00:00Z'),
    );

    expect(prices.map((p) => Math.round((p.price / 1.255) * 1000))).toEqual([
      10, 20, 30, 40, 50, 60, 70, 80,
    ]);
  });
});
