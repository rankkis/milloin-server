# Electricity Price Finland - Feature Documentation

## Overview

The Electricity Price Finland feature provides real-time and forecasted electricity pricing data for Finland using the ENTSO-E Transparency Platform API. It implements a multi-provider architecture with automatic fallback and scheduled data synchronization.

## Key Features

- ✅ Fetches day-ahead electricity prices from ENTSO-E Transparency Platform
- ✅ Includes 25.5% Finnish VAT for consumer-ready pricing
- ✅ Stores prices in Supabase database with UPSERT to prevent duplicates
- ✅ Multi-provider architecture with automatic fallback to SpotHinta API
- ✅ Intelligent caching with dynamic TTL
- ✅ Scheduled price updates (daily at 14:15 Finnish time)
- ✅ Automatic data fetch on application startup

## Architecture

### Provider Pattern

The feature uses a provider pattern to abstract different data sources:

```
ElectricityPriceFiService (Main Service)
├── DatabaseProvider (Primary)
│   └── Reads from Supabase database
└── SpotHintaProvider (Fallback)
    └── Fetches from spot-hinta.fi API
```

### Data Flow

```
ENTSO-E API → EntsoeDataFetcherService → Supabase Database → DatabaseProvider → ElectricityPriceFiService
                                                               ↓ (on failure)
                                                         SpotHintaProvider → ElectricityPriceFiService
```

## Components

### Core Services

#### `ElectricityPriceFiService`
Main service that orchestrates electricity price retrieval with automatic provider fallback.

**Methods:**
- `getCurrentPrices()`: Returns current hour price
- `getTodayPrices()`: Returns all 24 hours for today
- `getTomorrowPrices()`: Returns all 24 hours for tomorrow (if available)
- `getFuturePrices()`: Returns all future prices from current hour onwards

#### `EntsoeDataFetcherService`
Handles ENTSO-E API integration and data persistence.

**Key Features:**
- Fetches prices from ENTSO-E Transparency Platform API
- Converts EUR/MWh to EUR/kWh
- Adds 25.5% Finnish VAT to all prices
- Stores data in Supabase with UPSERT logic (uses `price_start_at` as conflict key)
- Single API call for today + tomorrow prices

**Methods:**
- `fetchAndStoreAllAvailablePrices()`: Fetches both today and tomorrow in one API call
- `fetchAndStoreTodayPrices()`: Fetches only today's prices
- `fetchAndStoreTomorrowPrices()`: Fetches only tomorrow's prices

**ENTSO-E API Details:**
- Base URL: `https://web-api.tp.entsoe.eu/api`
- Document Type: A44 (Day-ahead prices)
- Domain: 10YFI-1--------U (Finland)
- Date Format: YYYYMMDDHHmm (local timezone)

#### `ElectricityPriceSchedulerService`
Manages automated price updates using cron jobs.

**Schedule:**
- **On startup**: Immediate fetch of all available prices
- **Daily at 14:15 Finnish time**: Fetch all prices (today + tomorrow)
- **Daily at 14:30 Finnish time**: Retry fetch for tomorrow's prices

### Providers

#### `DatabaseProvider` (Primary)
Reads electricity prices from Supabase database.

**Features:**
- Caching with dynamic TTL (expires at next hour)
- Efficient queries with proper date range filtering
- Graceful handling of missing tomorrow data

#### `SpotHintaProvider` (Fallback)
Fetches prices from spot-hinta.fi API as fallback.

**Features:**
- External API integration
- Same interface as DatabaseProvider
- Automatic activation when database fails

### Data Models

#### `ElectricityPriceDto`
Standard DTO for electricity price data across all providers.

```typescript
interface ElectricityPriceDto {
  price: number;      // EUR/kWh including 25.5% VAT
  startDate: string;  // ISO 8601 format (UTC)
  endDate: string;    // ISO 8601 format (UTC)
}
```

#### `ElectricityPriceRecord`
Database record format for Supabase storage.

```typescript
interface ElectricityPriceRecord {
  price_start_at: string;  // ISO 8601, used as unique key
  price_end_at: string;    // ISO 8601
  price_eur_mwh: number;   // Original price from ENTSO-E (no VAT)
  price_eur_kwh: number;   // Consumer price with 25.5% VAT
  source: string;          // 'entsoe'
}
```

### Interfaces

#### `IElectricityPriceProvider`
Contract that all providers must implement.

```typescript
interface IElectricityPriceProvider {
  getCurrentPrice(): Promise<ElectricityPriceDto>;
  getTodayPrices(): Promise<ElectricityPriceDto[]>;
  getTomorrowPrices(): Promise<ElectricityPriceDto[]>;
  getFuturePrices(): Promise<ElectricityPriceDto[]>;
}
```

## Configuration

### Required Configuration
Create `config/api-keys.json`:

```json
{
  "entsoe": {
    "apiKey": "your-entsoe-api-key"
  },
  "supabase": {
    "url": "your-supabase-url",
    "anonKey": "your-supabase-anon-key"
  }
}
```

### Database Schema
Table: `electricity_prices`

```sql
CREATE TABLE electricity_prices (
  price_start_at TIMESTAMPTZ PRIMARY KEY,
  price_end_at TIMESTAMPTZ NOT NULL,
  price_eur_mwh NUMERIC NOT NULL,
  price_eur_kwh NUMERIC NOT NULL,
  source VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Usage Examples

### Get Current Price
```typescript
const prices = await electricityPriceService.getCurrentPrices();
// Returns: [{ price: 0.0522, startDate: "2024-...", endDate: "2024-..." }]
```

### Get Today's Prices
```typescript
const prices = await electricityPriceService.getTodayPrices();
// Returns: Array of 24 ElectricityPriceDto objects
```

### Get Future Prices
```typescript
const prices = await electricityPriceService.getFuturePrices();
// Returns: Array of remaining today + tomorrow prices (if available)
```

## Pricing Information

### VAT Calculation
All prices include 25.5% Finnish VAT:

```
Consumer Price (EUR/kWh) = (ENTSO-E Price (EUR/MWh) / 1000) × 1.255
```

**Example:**
- ENTSO-E price: 41.57 EUR/MWh
- Conversion: 41.57 / 1000 = 0.04157 EUR/kWh
- With VAT: 0.04157 × 1.255 = 0.0522 EUR/kWh (5.22 cents/kWh)

### Price Availability
- **Today's prices**: Always available
- **Tomorrow's prices**: Published around 14:00 Finnish time
- **Data updates**: Scheduled at 14:15 daily to capture new prices

## Error Handling

### Provider Fallback
When DatabaseProvider fails, the system automatically falls back to SpotHintaProvider:

```typescript
try {
  return await databaseProvider.getCurrentPrice();
} catch (error) {
  logger.warn('Primary provider failed, using fallback');
  return await spotHintaProvider.getCurrentPrice();
}
```

### Duplicate Prevention
UPSERT logic prevents duplicate records:

```typescript
await supabase
  .from('electricity_prices')
  .upsert(prices, {
    onConflict: 'price_start_at',
    ignoreDuplicates: false,
  });
```

### Graceful Degradation
- Tomorrow's prices failures are logged as warnings (not errors)
- Application startup continues even if initial price fetch fails
- Scheduled jobs retry automatically

## Caching Strategy

### Cache Keys
- `db-current-price`: Current hour price
- `db-today-prices`: All today's prices
- `db-tomorrow-prices`: All tomorrow's prices

### Cache TTL
Dynamic TTL that expires at the next hour boundary:

```typescript
const now = new Date();
const nextHour = new Date(now);
nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
const ttlMs = nextHour.getTime() - now.getTime();
```

## Integration Points

### Used By
- `WashingMachineService`: Optimal time calculation for appliances
- Any service requiring Finnish electricity pricing data

### External Dependencies
- **ENTSO-E Transparency Platform API**: Primary data source
- **spot-hinta.fi API**: Fallback data source
- **Supabase**: Data persistence and caching layer

## Monitoring & Logging

### Log Levels
- **INFO**: Successful operations, scheduled tasks
- **WARN**: Fallback activation, tomorrow prices unavailable
- **ERROR**: API failures, database errors, critical issues

### Key Log Events
- Application startup price fetch
- Scheduled price updates
- Provider fallback triggers
- UPSERT results (number of records stored)

## Future Enhancements

### Potential Improvements
- [ ] Add Prometheus metrics for monitoring
- [ ] Implement retry logic with exponential backoff
- [ ] Add webhook notifications for price anomalies
- [ ] Support for multiple Finnish pricing zones
- [ ] Historical price analysis and trends
- [ ] Price prediction using ML models

## Testing

### E2E Tests
- Database connection testing
- Price data population
- Provider fallback scenarios

### Manual Testing
```bash
# Fetch prices manually
npm run start:dev

# Check logs for scheduled tasks
# Verify database records in Supabase
# Test API endpoints via Swagger
```

## Troubleshooting

### Common Issues

**Issue**: Prices don't include VAT
- **Solution**: Check `VAT_MULTIPLIER = 1.255` in EntsoeDataFetcherService

**Issue**: Duplicate records in database
- **Solution**: Verify `price_start_at` is set as PRIMARY KEY in database schema

**Issue**: Tomorrow's prices not available
- **Solution**: Normal behavior before 14:00 Finnish time; check logs for warnings

**Issue**: Date formatting issues
- **Solution**: Ensure `formatDateForApi()` uses local timezone, not UTC conversion

## References

- [ENTSO-E Transparency Platform](https://transparency.entsoe.eu/)
- [ENTSO-E API Documentation](https://transparency.entsoe.eu/content/static_content/Static%20content/web%20api/Guide.html)
- [spot-hinta.fi API](https://api.spot-hinta.fi/)
- [Finnish Electricity Market Info](https://www.energiavirasto.fi/)