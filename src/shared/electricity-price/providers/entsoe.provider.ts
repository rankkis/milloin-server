import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { parseStringPromise } from 'xml2js';
import * as fs from 'fs';
import * as path from 'path';
import {
  EntsoeApiResponse,
  EntsoeDayAheadPriceParams,
} from '../interfaces/entsoe-api.interface';
import { ElectricityPriceDto } from '../dto/electricity-price.dto';
import { IElectricityPriceProvider } from '../interfaces/electricity-price-provider.interface';

/**
 * Primary price provider: day-ahead electricity prices for Finland from the
 * ENTSO-E Transparency Platform API.
 *
 * Prices are converted to EUR/kWh and include 25.5% Finnish VAT.
 */
@Injectable()
export class EntsoeProvider implements IElectricityPriceProvider {
  readonly name = 'ENTSO-E';
  private readonly logger = new Logger(EntsoeProvider.name);
  private readonly entsoeApiKey: string | undefined;
  private readonly baseUrl = 'https://web-api.tp.entsoe.eu/api';
  private readonly finlandDomain = '10YFI-1--------U';
  private readonly VAT_MULTIPLIER = 1.255; // 25.5% VAT in Finland

  constructor() {
    this.entsoeApiKey = this.loadApiKey();
  }

  /**
   * Reads the ENTSO-E API key from the ENTSOE_API_KEY environment variable
   * (production/Vercel) or config/api-keys.json (local development).
   * A missing key is not fatal: fetches fail and the caller falls back to
   * another price source.
   */
  private loadApiKey(): string | undefined {
    if (process.env.ENTSOE_API_KEY) {
      return process.env.ENTSOE_API_KEY;
    }

    try {
      const configPath = path.join(process.cwd(), 'config', 'api-keys.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.entsoe?.apiKey) {
        return config.entsoe.apiKey;
      }
    } catch {
      // No config file, handled below
    }

    this.logger.warn(
      'ENTSO-E API key not configured, prices will come from the fallback provider',
    );
    return undefined;
  }

  /**
   * Fetches all published prices between startDate and endDate, sorted by
   * start time. Tomorrow's prices are missing until ENTSO-E publishes them
   * (around 14:00 Finnish time).
   */
  async fetchPrices(
    startDate: Date,
    endDate: Date,
  ): Promise<ElectricityPriceDto[]> {
    if (!this.entsoeApiKey) {
      throw new HttpException(
        'ENTSO-E API key not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return this.fetchPricesFromEntsoe(startDate, endDate);
  }

  private async fetchPricesFromEntsoe(
    startDate: Date,
    endDate: Date,
  ): Promise<ElectricityPriceDto[]> {
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

    this.logger.debug(
      `Fetching from ENTSO-E: ${params.periodStart}-${params.periodEnd}`,
    );

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
   * Formats date for ENTSO-E API (YYYYMMDDHHmm format in UTC)
   */
  private formatDateForApi(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');

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
   * Transforms ENTSO-E XML response into price points.
   * Converts prices from EUR/MWh to EUR/kWh and adds 25.5% VAT.
   * Since October 1, 2025, all data is in 15-minute intervals (PT15M resolution).
   */
  private transformEntsoeResponse(
    response: EntsoeApiResponse,
  ): ElectricityPriceDto[] {
    const document = response.Publication_MarketDocument;
    if (!document || !document.TimeSeries) {
      return [];
    }

    const timeSeries = Array.isArray(document.TimeSeries)
      ? document.TimeSeries
      : [document.TimeSeries];

    // Keyed by start time, so overlapping series can't duplicate a quarter
    const prices = new Map<number, ElectricityPriceDto>();

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

        // Curve type A03 leaves out a point whose price equals the previous
        // one, so every position of the period is filled from the last
        // listed price. Without this the series has gaps.
        const listed = new Map(
          points.map((point) => [
            parseInt(point.position), // ENTSO-E uses 1-based positions
            parseFloat(point['price.amount']),
          ]),
        );
        const positions = Math.round(
          (Date.parse(period.timeInterval.end) - startTime.getTime()) /
            resolutionMs,
        );

        let priceEurMwh: number | undefined;
        for (let position = 1; position <= positions; position++) {
          priceEurMwh = listed.get(position) ?? priceEurMwh;
          if (priceEurMwh === undefined) continue;

          const priceStart =
            startTime.getTime() + (position - 1) * resolutionMs;
          prices.set(priceStart, {
            // EUR/MWh to EUR/kWh with VAT
            price: (priceEurMwh / 1000) * this.VAT_MULTIPLIER,
            startDate: new Date(priceStart).toISOString(),
            endDate: new Date(priceStart + resolutionMs).toISOString(),
          });
        }
      }
    }

    return [...prices.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, price]) => price);
  }
}
