import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { EntsoeDataFetcherService } from '../src/shared/electricity-price-fi/services/entsoe-data-fetcher.service';

async function populateDatabase() {
  console.log('🚀 Starting database population with ENTSO-E data...');

  const app = await NestFactory.createApplicationContext(AppModule);
  const entsoeDataFetcher = app.get(EntsoeDataFetcherService);

  try {
    console.log('📡 Fetching today\'s electricity prices from ENTSO-E...');
    await entsoeDataFetcher.fetchAndStoreTodayPrices();
    console.log('✅ Today\'s prices stored successfully');

    console.log('📡 Fetching tomorrow\'s electricity prices from ENTSO-E...');
    await entsoeDataFetcher.fetchAndStoreTomorrowPrices();
    console.log('✅ Tomorrow\'s prices stored successfully (if available)');

    console.log('🎉 Database population completed successfully!');
  } catch (error) {
    console.error('❌ Failed to populate database:', error.message);

    if (error.message.includes('503') || error.message.includes('Service Unavailable')) {
      console.log('ℹ️  ENTSO-E API is temporarily unavailable. This is normal and will retry automatically.');
      console.log('ℹ️  The scheduled job will fetch data daily at 14:15 Finnish time.');
    }
  } finally {
    await app.close();
  }
}

populateDatabase();