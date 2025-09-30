import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EntsoeDataFetcherService } from './entsoe-data-fetcher.service';

@Injectable()
export class ElectricityPriceSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(ElectricityPriceSchedulerService.name);

  constructor(private readonly entsoeDataFetcher: EntsoeDataFetcherService) {}

  async onModuleInit() {
    this.logger.log('ElectricityPriceSchedulerService initialized');
    // Fetch data on application startup
    await this.fetchDataOnStartup();
  }

  private async fetchDataOnStartup(): Promise<void> {
    this.logger.log('Fetching electricity prices on application startup');

    try {
      await this.entsoeDataFetcher.fetchAndStoreAllAvailablePrices();
      this.logger.log(
        'Successfully fetched and stored electricity prices on startup',
      );
    } catch (error) {
      this.logger.error('Failed to fetch electricity prices on startup', error);
      // Don't throw error to prevent application startup failure
      // The scheduled job will retry later
    }
  }

  // Schedule job to run every day at 14:15 Finnish time (UTC+2/UTC+3)
  // Using UTC time: 14:15 Finnish Summer Time = 11:15 UTC
  // Using UTC time: 14:15 Finnish Winter Time = 12:15 UTC
  // For simplicity, using 12:15 UTC (covers most of the year when prices are published)
  @Cron('15 12 * * *', {
    name: 'fetch-electricity-prices',
    timeZone: 'Europe/Helsinki', // This handles the timezone conversion automatically
  })
  async scheduledFetchPrices(): Promise<void> {
    this.logger.log(
      'Running scheduled electricity price fetch at 14:15 Finnish time',
    );

    try {
      await this.entsoeDataFetcher.fetchAndStoreAllAvailablePrices();
      this.logger.log(
        'Successfully completed scheduled electricity price fetch',
      );
    } catch (error) {
      this.logger.error('Scheduled electricity price fetch failed', error);
      // Could implement retry logic here if needed
      // or send alerts/notifications
    }
  }

  // Additional method to manually trigger price fetch (useful for debugging/admin)
  async manualFetchPrices(): Promise<void> {
    this.logger.log('Manual electricity price fetch triggered');

    try {
      await this.entsoeDataFetcher.fetchAndStoreAllAvailablePrices();
      this.logger.log('Manual electricity price fetch completed successfully');
    } catch (error) {
      this.logger.error('Manual electricity price fetch failed', error);
      throw error;
    }
  }

  // Method to fetch only tomorrow's prices (useful when they become available)
  @Cron('30 12 * * *', {
    name: 'fetch-tomorrow-prices',
    timeZone: 'Europe/Helsinki',
  })
  async scheduledFetchTomorrowPrices(): Promise<void> {
    this.logger.log('Running scheduled fetch for tomorrow electricity prices');

    try {
      await this.entsoeDataFetcher.fetchAndStoreTomorrowPrices();
      this.logger.log('Successfully completed scheduled tomorrow price fetch');
    } catch (error) {
      this.logger.warn(
        'Scheduled tomorrow price fetch failed (might not be available yet)',
        error,
      );
      // This is expected behavior when tomorrow's prices aren't available yet
    }
  }
}
