import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { parseStringPromise } from 'xml2js';
import * as fs from 'fs';
import * as path from 'path';
import {
  EntsoeApiResponse,
  EntsoeDayAheadPriceParams,
} from '../interfaces/entsoe-api.interface';

/**
 * Electricity price record for database storage
 */
export interface ElectricityPriceRecord {
  price_start_at: string;
  price_end_at: string;
  price_eur_mwh: number; // Price without VAT from ENTSO-E
  price_eur_kwh: number; // Consumer price with 25.5% VAT included
  source: string;
}

/**
 * Service for fetching electricity prices from ENTSO-E Transparency Platform API
 * and storing them in Supabase database.
 *
 * Fetches day-ahead electricity prices for Finland and includes 25.5% VAT
 * to provide consumer-ready pricing.
 */
@Injectable()
export class EntsoeDataFetcherService {
  private readonly logger = new Logger(EntsoeDataFetcherService.name);
  private supabase: SupabaseClient;
  private readonly entsoeApiKey: string;
  private readonly baseUrl = 'https://web-api.tp.entsoe.eu/api';
  private readonly finlandDomain = '10YFI-1--------U';
  private readonly VAT_MULTIPLIER = 1.255; // 25.5% VAT in Finland

  constructor() {
    const config = this.loadConfig();
    this.entsoeApiKey = config.entsoe.apiKey;
    this.supabase = createClient(config.supabase.url, config.supabase.anonKey);
  }

  private loadConfig() {
    try {
      let entsoeApiKey: string;
      let supabaseUrl: string;
      let supabaseAnonKey: string;

      // Check for environment variables first (production/Vercel)
      if (
        process.env.ENTSOE_API_KEY &&
        process.env.SUPABASE_URL &&
        process.env.SUPABASE_ANON_KEY
      ) {
        entsoeApiKey = process.env.ENTSOE_API_KEY;
        supabaseUrl = process.env.SUPABASE_URL;
        supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
        this.logger.log('Using configuration from environment variables');
      } else {
        // Fallback to config file (local development)
        const configPath = path.join(process.cwd(), 'config', 'api-keys.json');
        const configFile = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configFile);

        if (!config.entsoe?.apiKey) {
          throw new Error('ENTSO-E API key not found in config file');
        }

        if (!config.supabase?.url || !config.supabase?.anonKey) {
          throw new Error('Supabase configuration not found in config file');
        }

        entsoeApiKey = config.entsoe.apiKey;
        supabaseUrl = config.supabase.url;
        supabaseAnonKey = config.supabase.anonKey;
        this.logger.log('Using configuration from config file');
      }

      return {
        entsoe: { apiKey: entsoeApiKey },
        supabase: { url: supabaseUrl, anonKey: supabaseAnonKey },
      };
    } catch (error) {
      this.logger.error('Failed to load configuration', error);
      throw new HttpException(
        'Failed to load configuration',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Fetches and stores today's electricity prices from ENTSO-E.
   * Prices include 25.5% Finnish VAT.
   */
  async fetchAndStoreTodayPrices(): Promise<void> {
    this.logger.log('Starting to fetch today electricity prices from ENTSO-E');

    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    try {
      const prices = await this.fetchPricesFromEntsoe(startOfDay, endOfDay);
      await this.storePricesInDatabase(prices);
      this.logger.log(
        `Successfully stored ${prices.length} today price records`,
      );
    } catch (error) {
      this.logger.error('Failed to fetch and store today prices', error);
      throw error;
    }
  }

  /**
   * Fetches and stores tomorrow's electricity prices from ENTSO-E.
   * Prices include 25.5% Finnish VAT.
   * May fail gracefully if tomorrow's prices are not yet available.
   */
  async fetchAndStoreTomorrowPrices(): Promise<void> {
    this.logger.log(
      'Starting to fetch tomorrow electricity prices from ENTSO-E',
    );

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startOfTomorrow = new Date(
      tomorrow.getFullYear(),
      tomorrow.getMonth(),
      tomorrow.getDate(),
    );
    const endOfTomorrow = new Date(startOfTomorrow);
    endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);

    try {
      const prices = await this.fetchPricesFromEntsoe(
        startOfTomorrow,
        endOfTomorrow,
      );
      await this.storePricesInDatabase(prices);
      this.logger.log(
        `Successfully stored ${prices.length} tomorrow price records`,
      );
    } catch (error) {
      this.logger.warn(
        'Failed to fetch tomorrow prices (might not be available yet)',
        error,
      );
      // Don't throw error for tomorrow prices as they might not be available yet
    }
  }

  /**
   * Fetches and stores all available electricity prices (today + tomorrow) in a single API call.
   * Prices include 25.5% Finnish VAT.
   * Uses UPSERT to prevent duplicate records when run multiple times.
   */
  async fetchAndStoreAllAvailablePrices(): Promise<void> {
    this.logger.log(
      'Fetching all available prices (today + tomorrow if available)',
    );

    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const endOfTomorrow = new Date(startOfDay);
    endOfTomorrow.setDate(endOfTomorrow.getDate() + 2);

    try {
      const prices = await this.fetchPricesFromEntsoe(
        startOfDay,
        endOfTomorrow,
      );
      await this.storePricesInDatabase(prices);
      this.logger.log(`Successfully stored ${prices.length} price records`);
    } catch (error) {
      this.logger.error('Failed to fetch and store prices', error);
      throw error;
    }
  }

  private async fetchPricesFromEntsoe(
    startDate: Date,
    endDate: Date,
  ): Promise<ElectricityPriceRecord[]> {
    const params: EntsoeDayAheadPriceParams = {
      securityToken: this.entsoeApiKey,
      documentType: 'A44',
      in_Domain: this.finlandDomain,
      out_Domain: this.finlandDomain,
      periodStart: this.formatDateForApi(startDate),
      periodEnd: this.formatDateForApi(endDate),
      processType: 'A01',
    };

    const queryString = new URLSearchParams(
      Object.entries(params)
        .filter(([, value]) => value !== undefined)
        .reduce(
          (acc, [key, value]) => ({ ...acc, [key]: String(value) }),
          {} as Record<string, string>,
        ),
    );
    const url = `${this.baseUrl}?${queryString}`;

    this.logger.debug(`Fetching from ENTSO-E: ${url}`);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new HttpException(
          `ENTSO-E API error: ${response.status} ${response.statusText}`,
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const xmlData = await response.text();
      const parsedData = await parseStringPromise(xmlData, {
        explicitArray: false,
        mergeAttrs: true,
      });

      return this.transformEntsoeResponse(parsedData as EntsoeApiResponse);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to fetch data from ENTSO-E API',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Formats date for ENTSO-E API (YYYYMMDDHHmm format in local timezone)
   */
  private formatDateForApi(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}`;
  }

  /**
   * Parses ISO 8601 duration format to milliseconds.
   * Since October 1, 2025, all Finnish electricity pricing uses PT15M (15-minute intervals).
   */
  private parseResolutionToMs(resolution: string): number {
    // Match PT15M, PT60M, etc.
    const minutesMatch = resolution.match(/PT(\d+)M/);
    if (minutesMatch) {
      const minutes = parseInt(minutesMatch[1]);
      if (minutes !== 15) {
        this.logger.warn(
          `Unexpected resolution: ${resolution}. Expected PT15M for current pricing.`,
        );
      }
      return minutes * 60 * 1000;
    }

    // Match PT1H, PT2H, etc. (legacy format, should not occur after Oct 1, 2025)
    const hoursMatch = resolution.match(/PT(\d+)H/);
    if (hoursMatch) {
      this.logger.warn(
        `Legacy hourly resolution detected: ${resolution}. Converting to 15-minute intervals may be required.`,
      );
      return parseInt(hoursMatch[1]) * 60 * 60 * 1000;
    }

    // Default to 15 minutes for current pricing standard
    this.logger.error(
      `Unknown resolution format: ${resolution}, defaulting to 15 minutes`,
    );
    return 15 * 60 * 1000;
  }

  /**
   * Transforms ENTSO-E XML response into database records.
   * Converts prices from EUR/MWh to EUR/kWh and adds 25.5% VAT.
   * Since October 1, 2025, all data is in 15-minute intervals (PT15M resolution).
   */
  private transformEntsoeResponse(
    response: EntsoeApiResponse,
  ): ElectricityPriceRecord[] {
    const document = response.Publication_MarketDocument;
    if (!document || !document.TimeSeries) {
      return [];
    }

    const timeSeries = Array.isArray(document.TimeSeries)
      ? document.TimeSeries
      : [document.TimeSeries];

    const prices: ElectricityPriceRecord[] = [];

    for (const series of timeSeries) {
      const periods = Array.isArray(series.Period)
        ? series.Period
        : [series.Period];

      for (const period of periods) {
        const startTime = new Date(period.timeInterval.start);
        const resolutionMs = this.parseResolutionToMs(period.resolution);
        const points = Array.isArray(period.Point)
          ? period.Point
          : [period.Point];

        this.logger.debug(
          `Processing ${points.length} price points with ${period.resolution} resolution`,
        );

        for (const point of points) {
          const position = parseInt(point.position) - 1; // ENTSO-E uses 1-based indexing
          const priceStartTime = new Date(
            startTime.getTime() + position * resolutionMs,
          );
          const priceEndTime = new Date(
            priceStartTime.getTime() + resolutionMs,
          );

          const priceEurMwh = parseFloat(point['price.amount']);
          const priceEurKwh = (priceEurMwh / 1000) * this.VAT_MULTIPLIER; // Convert from EUR/MWh to EUR/kWh and add VAT

          prices.push({
            price_start_at: priceStartTime.toISOString(),
            price_end_at: priceEndTime.toISOString(),
            price_eur_mwh: priceEurMwh,
            price_eur_kwh: priceEurKwh,
            source: 'entsoe',
          });
        }
      }
    }

    return prices.sort((a, b) => {
      const dateA = new Date(a.price_start_at);
      const dateB = new Date(b.price_start_at);
      return dateA.getTime() - dateB.getTime();
    });
  }

  /**
   * Stores electricity prices in Supabase database using UPSERT.
   * Prevents duplicate records by using price_start_at as conflict key.
   */
  private async storePricesInDatabase(
    prices: ElectricityPriceRecord[],
  ): Promise<void> {
    if (prices.length === 0) {
      this.logger.warn('No prices to store');
      return;
    }

    this.logger.debug(`Storing ${prices.length} price records in database`);

    try {
      const { data, error } = await this.supabase
        .from('electricity_prices')
        .upsert(prices, {
          onConflict: 'price_start_at',
          ignoreDuplicates: false,
        })
        .select();

      if (error) {
        this.logger.error('Database upsert error:', error);
        throw new HttpException(
          `Failed to store prices in database: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      this.logger.log(
        `Successfully upserted ${data?.length || 0} price records`,
      );
    } catch (error) {
      this.logger.error('Failed to store prices in database', error);
      throw error;
    }
  }
}
