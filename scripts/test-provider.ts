import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DatabaseProvider } from '../src/shared/electricity-price/providers/database.provider';

async function testProvider() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const provider = app.get(DatabaseProvider);

  const futurePrices = await provider.getFuturePrices();

  console.log('\nTotal future prices:', futurePrices.length);
  console.log('\nFirst 8 prices (should be 8 unique 15-min intervals for 2 hours):');
  futurePrices.slice(0, 8).forEach((p, i) => {
    console.log(`${i+1}. ${p.startDate} to ${p.endDate}: ${(p.price * 100).toFixed(2)} c/kWh`);
  });

  await app.close();
}

testProvider();
