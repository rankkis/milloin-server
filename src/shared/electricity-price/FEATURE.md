# Electricity Price Finland - Feature Documentation

## Overview

Provides Finnish electricity spot prices in 15-minute intervals, including 25.5% VAT. Prices are kept in memory: there is no database.

## Data Flow

```
EntsoeProvider ────┐
                   ├→ PriceCacheService (memory) → ElectricityPriceService → endpoints
SpotHintaProvider ─┘   (tries providers in priority order)
```

## Components

### `ElectricityPriceService`
Serves prices from memory. Days are Finnish days, midnight to midnight Europe/Helsinki time.

- `getCurrentPrices()`: the current 15-minute price
- `getTodayPrices()`: today's prices
- `getTomorrowPrices()`: tomorrow's prices, empty until published
- `getFuturePrices()`: prices starting from now onwards

### `PriceCacheService`
Holds every price from midnight of the current Finnish day up to the last published price.

**When it refreshes**
- On startup, without blocking it
- At 14:00 and 15:00 Finnish time (cron), after ENTSO-E publishes the next day's prices around 13:45. Only runs on long-lived hosts.
- On demand, whenever memory is empty or outdated. The request waits for the fetch, gets the fresh prices and leaves them in memory. Concurrent requests share one fetch.

**Outdated** means memory does not reach the end of the last delivery day that should be published: today's before 14:00 Finnish time, tomorrow's after it. If tomorrow's prices are late, upstream is asked again at most every 10 minutes and requests in between get what is in memory.

**Fallbacks**
1. ENTSO-E
2. spot-hinta.fi
3. Outdated prices from memory, as long as they still cover the current time
4. Otherwise the request fails

**Serverless (Vercel)**: memory lives per function instance and is lost on cold start, and in-process cron does not run while an instance is frozen. A fresh instance first reads the prices other instances left in Vercel's runtime cache (`SHARED_PRICE_CACHE`, shared by all instances and kept across deploys) and only fetches upstream when those are outdated too. ENTSO-E takes 2-4 s to answer, so this keeps the first request after a deploy or an idle period fast. Outside Vercel the shared cache lives in process memory.

### Providers (`IElectricityPriceProvider`)
Each price source implements one method, `fetchPrices(start, end)`, and only fetches. `PriceCacheService` decides when to fetch, tries the providers in the order given by the `ELECTRICITY_PRICE_PROVIDERS` token in `electricity-price.module.ts`, and uses the first non-empty result. To add a source, implement the interface and add it to that list.

#### `EntsoeProvider` (primary)
Day-ahead prices (document type A44, domain `10YFI-1--------U`), converted to EUR/kWh with VAT:

```
Consumer price (EUR/kWh) = ENTSO-E price (EUR/MWh) / 1000 × 1.255
```

#### `SpotHintaProvider` (fallback)
https://api.spot-hinta.fi, hourly prices split into four 15-minute intervals.

## Configuration

ENTSO-E API key from the `ENTSOE_API_KEY` environment variable, or `config/api-keys.json` locally:

```json
{
  "entsoe": {
    "apiKey": "your-entsoe-api-key"
  }
}
```

Without a key, prices come from spot-hinta.fi.

## Testing

- `npm test`: unit tests, including `price-cache.service.spec.ts` for refresh and fallback rules
- `npm run test:e2e`: endpoints with mocked prices
- `npm run test:integration`: real ENTSO-E fetch (needs the API key)

## References

- [ENTSO-E Transparency Platform](https://transparency.entsoe.eu/)
- [ENTSO-E API Documentation](https://transparency.entsoe.eu/content/static_content/Static%20content/web%20api/Guide.html)
- [spot-hinta.fi API](https://api.spot-hinta.fi/)
