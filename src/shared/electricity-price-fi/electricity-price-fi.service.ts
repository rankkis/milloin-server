import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ElectricityPriceDto } from './dto/electricity-price.dto';
import { SpotHintaApiResponse } from './interfaces/spot-hinta-api.interface';

@Injectable()
export class ElectricityPriceFiService {
  private readonly baseUrl = 'https://api.spot-hinta.fi';

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async getCurrentPrices(): Promise<ElectricityPriceDto[]> {
    const cacheKey = 'current-prices';

    const cached = await this.cacheManager.get<ElectricityPriceDto[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`${this.baseUrl}/JustNow`);

      if (!response.ok) {
        throw new HttpException(
          'Failed to fetch current electricity prices',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const data = await response.json();
      const transformedData = this.transformSpotHintaResponse(data);

      const ttl = this.calculateNextUpdateTtl();
      await this.cacheManager.set(cacheKey, transformedData, ttl);

      return transformedData;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error fetching electricity prices',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getTodayPrices(): Promise<ElectricityPriceDto[]> {
    const cacheKey = 'today-prices';

    const cached = await this.cacheManager.get<ElectricityPriceDto[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`${this.baseUrl}/Today`);

      if (!response.ok) {
        throw new HttpException(
          "Failed to fetch today's electricity prices",
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const data = await response.json();
      const transformedData = this.transformSpotHintaResponse(data);

      const ttl = this.calculateNextUpdateTtl();
      await this.cacheManager.set(cacheKey, transformedData, ttl);

      return transformedData;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        "Error fetching today's electricity prices",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getTomorrowPrices(): Promise<ElectricityPriceDto[]> {
    const cacheKey = 'tomorrow-prices';

    const cached = await this.cacheManager.get<ElectricityPriceDto[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`${this.baseUrl}/Tomorrow`);

      if (!response.ok) {
        throw new HttpException(
          "Failed to fetch tomorrow's electricity prices",
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const data = await response.json();
      const transformedData = this.transformSpotHintaResponse(data);

      const ttl = this.calculateNextUpdateTtl();
      await this.cacheManager.set(cacheKey, transformedData, ttl);

      return transformedData;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        "Error fetching tomorrow's electricity prices",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private transformSpotHintaResponse(
    data: SpotHintaApiResponse[],
  ): ElectricityPriceDto[] {
    return data.map((item) => ({
      price: item.PriceWithTax,
      startDate: new Date(item.DateTime).toISOString(),
      endDate: new Date(
        new Date(item.DateTime).getTime() + 60 * 60 * 1000,
      ).toISOString(),
    }));
  }

  private calculateNextUpdateTtl(): number {
    // Electricity prices update every 15 minutes: 09:15, 09:30, 09:45, 10:00, etc.
    const now = new Date();

    // Convert to Finnish time for accurate calculations
    const finnishTime = new Date(
      now.toLocaleString('en-US', { timeZone: 'Europe/Helsinki' }),
    );

    const minutes = finnishTime.getMinutes();

    // Calculate next 15-minute interval
    const nextInterval = Math.ceil((minutes + 1) / 15) * 15;

    // If we're past minute 45, next interval is at the top of next hour
    const nextMinute = nextInterval > 60 ? 0 : nextInterval;
    const nextHour =
      nextInterval > 60 ? finnishTime.getHours() + 1 : finnishTime.getHours();

    // Create target time for next update
    const nextUpdate = new Date(finnishTime);
    nextUpdate.setHours(nextHour, nextMinute, 0, 0);

    // If we rolled over to next day, handle that
    if (nextHour >= 24) {
      nextUpdate.setDate(nextUpdate.getDate() + 1);
      nextUpdate.setHours(0, 0, 0, 0);
    }

    // Calculate TTL in seconds, with minimum of 60 seconds
    const ttlMs = nextUpdate.getTime() - finnishTime.getTime();
    const ttlSeconds = Math.floor(ttlMs / 1000);

    return Math.max(60, ttlSeconds);
  }
}
