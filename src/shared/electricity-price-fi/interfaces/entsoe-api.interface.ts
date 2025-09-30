/**
 * ENTSO-E Transparency Platform API interfaces for electricity market data.
 * Documentation: https://transparency.entsoe.eu/content/static_content/Static%20content/web%20api/Guide.html
 */

/**
 * ENTSO-E API response for publication_marketdocument containing time series data
 */
export interface EntsoeApiResponse {
  Publication_MarketDocument: {
    mRID: string;
    revisionNumber: string;
    type: string;
    'sender_MarketParticipant.mRID': {
      codingScheme: string;
      '#text': string;
    };
    'sender_MarketParticipant.marketRole.type': string;
    'receiver_MarketParticipant.mRID': {
      codingScheme: string;
      '#text': string;
    };
    'receiver_MarketParticipant.marketRole.type': string;
    createdDateTime: string;
    'period.timeInterval': {
      start: string;
      end: string;
    };
    TimeSeries: EntsoeTimeSeries | EntsoeTimeSeries[];
  };
}

/**
 * ENTSO-E TimeSeries containing electricity price data points
 */
export interface EntsoeTimeSeries {
  mRID: string;
  businessType: string;
  'in_Domain.mRID': {
    codingScheme: string;
    '#text': string;
  };
  'out_Domain.mRID': {
    codingScheme: string;
    '#text': string;
  };
  'currency_Unit.name': string;
  'price_Measure_Unit.name': string;
  curveType: string;
  Period: EntsoePeriod | EntsoePeriod[];
}

/**
 * ENTSO-E Period containing time interval and price points
 */
export interface EntsoePeriod {
  timeInterval: {
    start: string;
    end: string;
  };
  resolution: string;
  Point: EntsoePoint | EntsoePoint[];
}

/**
 * ENTSO-E Point containing individual price data
 */
export interface EntsoePoint {
  position: string;
  'price.amount': string;
}

/**
 * Configuration for ENTSO-E API requests
 */
export interface EntsoeApiConfig {
  apiKey: string;
  baseUrl: string;
  documentType: string;
  processType: string;
  inDomain: string; // Finland: 10YFI-1--------U
  outDomain: string; // Finland: 10YFI-1--------U
}

/**
 * Parameters for ENTSO-E API day-ahead price requests
 */
export interface EntsoeDayAheadPriceParams {
  securityToken: string;
  documentType: 'A44'; // Price document type for day-ahead prices
  in_Domain: string;
  out_Domain: string;
  periodStart: string; // Format: YYYYMMDDHHMM
  periodEnd: string; // Format: YYYYMMDDHHMM
  processType?: 'A01'; // Day ahead process type
}
