import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { ElectricityPriceDto } from '../dto/electricity-price.dto';
import { IElectricityPriceProvider } from '../interfaces/electricity-price-provider.interface';

interface DatabaseQueryResult {
  price_start_at: string;
  price_end_at: string;
  price_eur_kwh: number;
}

@Injectable()
export class DatabaseProvider implements IElectricityPriceProvider {
  private readonly logger = new Logger(DatabaseProvider.name);
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = this.initializeSupabase();
  }

  private initializeSupabase(): SupabaseClient {
    try {
      let supabaseUrl: string;
      let supabaseAnonKey: string;

      // Check for environment variables first (production/Vercel)
      if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
        supabaseUrl = process.env.SUPABASE_URL;
        supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
        this.logger.log('Using Supabase credentials from environment variables');
      } else {
        // Fallback to config file (local development)
        const configPath = path.join(process.cwd(), 'config', 'api-keys.json');
        const configFile = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configFile);

        if (!config.supabase?.url || !config.supabase?.anonKey) {
          throw new Error('Supabase configuration not found in config file');
        }

        supabaseUrl = config.supabase.url;
        supabaseAnonKey = config.supabase.anonKey;
        this.logger.log('Using Supabase credentials from config file');
      }

      return createClient(supabaseUrl, supabaseAnonKey);
    } catch (error) {
      this.logger.error('Failed to initialize Supabase client', error);
      throw new HttpException(
        'Failed to initialize database connection',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getCurrentPrice(): Promise<ElectricityPriceDto> {
    try {
      const now = new Date();

      this.logger.debug(
        `Fetching current 15-minute price for ${now.toISOString()}`,
      );

      const { data, error } = await this.supabase
        .from('electricity_prices')
        .select('price_start_at, price_end_at, price_eur_kwh')
        .lte('price_start_at', now.toISOString())
        .gt('price_end_at', now.toISOString())
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
          'Current 15-minute price not found in database',
          HttpStatus.NOT_FOUND,
        );
      }

      return this.transformDatabaseRecord(data);
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
    try {
      const today = new Date();
      const startOfToday = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      );
      const startOfTomorrow = new Date(startOfToday);
      startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

      this.logger.debug(
        `Fetching today's prices for ${startOfToday.toISOString().split('T')[0]}`,
      );

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

      return data.map((record) => this.transformDatabaseRecord(record));
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

      this.logger.debug(
        `Fetching tomorrow's prices for ${startOfTomorrow.toISOString().split('T')[0]}`,
      );

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

      return data.map((record) => this.transformDatabaseRecord(record));
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

    try {
      const [todayPrices, tomorrowPrices] = await Promise.all([
        this.getTodayPrices(),
        this.getTomorrowPrices().catch(() => []),
      ]);

      // Filter today's prices to include only current 15-minute interval and future intervals
      const futureTodayPrices = todayPrices.filter((price) => {
        const priceDate = new Date(price.startDate);
        return priceDate >= now;
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
}
