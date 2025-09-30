import {
  Injectable,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { ElectricityPriceDto } from '../dto/electricity-price.dto';
import { IElectricityPriceProvider } from '../interfaces/electricity-price-provider.interface';

interface DatabasePriceRecord {
  price_start_at: string;
  price_end_at: string;
  price_eur_kwh: number;
  created_at?: string;
  updated_at?: string;
}

interface DatabaseQueryResult {
  price_start_at: string;
  price_end_at: string;
  price_eur_kwh: number;
}

@Injectable()
export class DatabaseProvider implements IElectricityPriceProvider {
  private readonly logger = new Logger(DatabaseProvider.name);
  private supabase: SupabaseClient;

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {
    this.supabase = this.initializeSupabase();
  }

  private initializeSupabase(): SupabaseClient {
    try {
      const configPath = path.join(process.cwd(), 'config', 'api-keys.json');
      const configFile = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configFile);

      if (!config.supabase?.url || !config.supabase?.anonKey) {
        throw new Error('Supabase configuration not found');
      }

      return createClient(config.supabase.url, config.supabase.anonKey);
    } catch (error) {
      this.logger.error('Failed to initialize Supabase client', error);
      throw new HttpException(
        'Failed to initialize database connection',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getCurrentPrice(): Promise<ElectricityPriceDto> {
    const cacheKey = 'db-current-price';

    const cached = await this.cacheManager.get<ElectricityPriceDto>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const now = new Date();
      const currentHour = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        0,
        0,
        0,
      );
      const nextHour = new Date(currentHour.getTime() + 60 * 60 * 1000);

      this.logger.debug(
        `Fetching current price for ${currentHour.toISOString()}`,
      );

      const { data, error } = await this.supabase
        .from('electricity_prices')
        .select('price_start_at, price_end_at, price_eur_kwh')
        .lte('price_start_at', currentHour.toISOString())
        .gt('price_end_at', currentHour.toISOString())
        .single();

      if (error) {
        this.logger.error('Database query error for current price:', error);
        throw new HttpException(
          `Failed to fetch current price: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      if (!data) {
        throw new HttpException(
          'Current hour price not found in database',
          HttpStatus.NOT_FOUND,
        );
      }

      const result = this.transformDatabaseRecord(data);

      const ttl = this.calculateNextUpdateTtl();
      await this.cacheManager.set(cacheKey, result, ttl);

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Error fetching current price from database', error);
      throw new HttpException(
        'Error fetching current electricity price',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getTodayPrices(): Promise<ElectricityPriceDto[]> {
    const cacheKey = 'db-today-prices';

    const cached = await this.cacheManager.get<ElectricityPriceDto[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const today = new Date();
      const startOfToday = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      );
      const startOfTomorrow = new Date(startOfToday);
      startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

      this.logger.debug(`Fetching today's prices for ${startOfToday.toISOString().split('T')[0]}`);

      const { data, error } = await this.supabase
        .from('electricity_prices')
        .select('price_start_at, price_end_at, price_eur_kwh')
        .gte('price_start_at', startOfToday.toISOString())
        .lt('price_start_at', startOfTomorrow.toISOString())
        .order('price_start_at', { ascending: true });

      if (error) {
        this.logger.error('Database query error for today prices:', error);
        throw new HttpException(
          `Failed to fetch today's prices: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const result = data.map((record) => this.transformDatabaseRecord(record));

      const ttl = this.calculateNextUpdateTtl();
      await this.cacheManager.set(cacheKey, result, ttl);

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Error fetching today prices from database', error);
      throw new HttpException(
        "Error fetching today's electricity prices",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getTomorrowPrices(): Promise<ElectricityPriceDto[]> {
    const cacheKey = 'db-tomorrow-prices';

    const cached = await this.cacheManager.get<ElectricityPriceDto[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const startOfTomorrow = new Date(
        tomorrow.getFullYear(),
        tomorrow.getMonth(),
        tomorrow.getDate(),
      );
      const startOfDayAfter = new Date(startOfTomorrow);
      startOfDayAfter.setDate(startOfDayAfter.getDate() + 1);

      this.logger.debug(`Fetching tomorrow's prices for ${startOfTomorrow.toISOString().split('T')[0]}`);

      const { data, error } = await this.supabase
        .from('electricity_prices')
        .select('price_start_at, price_end_at, price_eur_kwh')
        .gte('price_start_at', startOfTomorrow.toISOString())
        .lt('price_start_at', startOfDayAfter.toISOString())
        .order('price_start_at', { ascending: true });

      if (error) {
        this.logger.error('Database query error for tomorrow prices:', error);
        // Don't throw error for tomorrow prices, return empty array instead
        return [];
      }

      const result = data.map((record) => this.transformDatabaseRecord(record));

      const ttl = this.calculateNextUpdateTtl();
      await this.cacheManager.set(cacheKey, result, ttl);

      return result;
    } catch (error) {
      this.logger.warn(
        'Error fetching tomorrow prices from database (might not be available)',
        error,
      );
      // Return empty array if tomorrow's prices are not available yet
      return [];
    }
  }

  async getFuturePrices(): Promise<ElectricityPriceDto[]> {
    const now = new Date();
    const currentHour = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      0,
      0,
      0,
    );

    try {
      const [todayPrices, tomorrowPrices] = await Promise.all([
        this.getTodayPrices(),
        this.getTomorrowPrices().catch(() => []),
      ]);

      // Filter today's prices to include only current hour and future hours
      const futureTodayPrices = todayPrices.filter((price) => {
        const priceDate = new Date(price.startDate);
        return priceDate >= currentHour;
      });

      // Combine today's remaining prices with tomorrow's prices
      return [...futureTodayPrices, ...tomorrowPrices];
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Error fetching future prices from database', error);
      throw new HttpException(
        'Error fetching future electricity prices',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private transformDatabaseRecord(
    record: DatabaseQueryResult,
  ): ElectricityPriceDto {
    return {
      price: record.price_eur_kwh,
      startDate: record.price_start_at,
      endDate: record.price_end_at,
    };
  }

  private calculateNextUpdateTtl(): number {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);

    const ttlMs = nextHour.getTime() - now.getTime();
    const ttlSeconds = Math.floor(ttlMs / 1000);

    return Math.max(60, ttlSeconds);
  }
}
