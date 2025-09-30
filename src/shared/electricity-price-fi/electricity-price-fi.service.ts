import { Injectable, Logger } from '@nestjs/common';
import { ElectricityPriceDto } from './dto/electricity-price.dto';
import { IElectricityPriceProvider } from './interfaces/electricity-price-provider.interface';
import { SpotHintaProvider } from './providers/spot-hinta.provider';
import { DatabaseProvider } from './providers/database.provider';

@Injectable()
export class ElectricityPriceFiService {
  private provider: IElectricityPriceProvider;
  private fallbackProvider: IElectricityPriceProvider;
  private readonly logger = new Logger(ElectricityPriceFiService.name);

  constructor(
    private spotHintaProvider: SpotHintaProvider,
    private databaseProvider: DatabaseProvider,
  ) {
    // Use database as primary provider and SpotHinta as fallback
    this.provider = this.databaseProvider;
    this.fallbackProvider = this.spotHintaProvider;
  }

  async getCurrentPrices(): Promise<ElectricityPriceDto[]> {
    const currentPrice = await this.executeWithFallback(() =>
      this.provider.getCurrentPrice(),
    );
    return [currentPrice];
  }

  async getTodayPrices(): Promise<ElectricityPriceDto[]> {
    return this.executeWithFallback(() => this.provider.getTodayPrices());
  }

  async getTomorrowPrices(): Promise<ElectricityPriceDto[]> {
    return this.executeWithFallback(() => this.provider.getTomorrowPrices());
  }

  async getFuturePrices(): Promise<ElectricityPriceDto[]> {
    return this.executeWithFallback(() => this.provider.getFuturePrices());
  }

  private async executeWithFallback<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.logger.warn(
        'Primary provider failed, attempting with fallback provider',
        error,
      );

      // Switch to fallback provider for this operation
      const originalProvider = this.provider;
      this.provider = this.fallbackProvider;

      try {
        const result = await operation();
        this.provider = originalProvider; // Restore primary provider
        return result;
      } catch (fallbackError) {
        this.provider = originalProvider; // Restore primary provider
        this.logger.error('Both providers failed', {
          primaryError: error,
          fallbackError,
        });
        throw error; // Re-throw the original error
      }
    }
  }
}
