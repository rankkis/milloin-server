import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { EntsoeDataFetcherService } from '../src/shared/electricity-price/services/entsoe-data-fetcher.service';

/**
 * Script to manually fetch and store electricity prices from ENTSO-E.
 * Fetches both today's and tomorrow's prices (if available).
 */
async function fetchPrices() {
  console.log('🚀 Starting price fetch...\n');

  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const fetcherService = app.get(EntsoeDataFetcherService);

    console.log('📡 Fetching all available prices from ENTSO-E...');
    await fetcherService.fetchAndStoreAllAvailablePrices();

    console.log('\n✅ Price fetch completed successfully!');
    console.log('');
    console.log('You can now:');
    console.log('- Start the server: npm run start:dev');
    console.log('- Check the API endpoints for current prices');

  } catch (error) {
    console.error('\n❌ Error fetching prices:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

fetchPrices();
