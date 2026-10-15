/**
 * Forecasts of electricity-price-forecaster, served as it answers them.
 * Its OpenAPI document has the full description.
 */
export const FORECAST_HORIZONS = [
  '72h',
  'week',
  '30d',
  'calendar-month',
] as const;

export type ForecastHorizon = (typeof FORECAST_HORIZONS)[number];

export interface ForecastInterval {
  /** c/kWh including VAT */
  low: number;
  high: number;
  /** EUR/MWh without VAT */
  lowEurMwh: number;
  highEurMwh: number;
}

export interface ForecastPoint {
  startTime: string;
  endTime: string;
  /** c/kWh including VAT */
  price: number;
  /** EUR/MWh without VAT */
  priceEurMwh: number;
  /** The real day-ahead price, already published at the issue time */
  published: boolean;
  interval80?: ForecastInterval;
  interval95?: ForecastInterval;
}

export interface Forecast {
  horizon: ForecastHorizon;
  resolution: 'hour' | 'day';
  issuedAt: string;
  modelVersion: string;
  change: string;
  points: ForecastPoint[];
}
