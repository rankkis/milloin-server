import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

async function populateSampleData() {
  console.log('🚀 Populating database with sample Finnish electricity market data...');

  // Initialize Supabase client
  const configPath = path.join(process.cwd(), 'config', 'api-keys.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const supabase = createClient(config.supabase.url, config.supabase.anonKey);

  // Generate realistic Finnish electricity market prices based on typical patterns
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Typical Finnish electricity price pattern (EUR/MWh) - lower at night, higher during day
  const todayPrices = [
    3.70,   // 00:00 - Night, very low
    2.90,   // 01:00 - Lowest point
    2.80,   // 02:00 - Minimum demand
    3.20,   // 03:00 - Still low
    3.70,   // 04:00 - Early morning
    4.60,   // 05:00 - Starting to rise
    5.60,   // 06:00 - Morning start
    11.60,  // 07:00 - Morning peak begins
    19.50,  // 08:00 - Rush hour
    27.40,  // 09:00 - Business hours
    62.60,  // 10:00 - High demand
    65.20,  // 11:00 - Peak hours
    46.30,  // 12:00 - Lunch time
    39.60,  // 13:00 - Afternoon
    42.80,  // 14:00 - Business continues
    36.00,  // 15:00 - Afternoon dip
    59.30,  // 16:00 - Evening ramp up
    91.20,  // 17:00 - Peak demand
    115.90, // 18:00 - Evening peak
    150.60, // 19:00 - Highest peak (dinner time)
    79.80,  // 20:00 - Post peak
    19.70,  // 21:00 - Evening wind down
    16.30,  // 22:00 - Night rates
    10.10   // 23:00 - Back to low
  ];

  // Tomorrow's prices (often available after 14:00)
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const tomorrowPrices = [
    4.20,   // Similar pattern but slightly different
    3.10,
    2.95,
    3.40,
    4.10,
    5.20,
    6.80,
    13.20,
    21.50,
    29.80,
    58.90,
    71.40,
    52.10,
    44.20,
    48.60,
    41.30,
    67.80,
    95.60,
    122.40,
    145.20,
    82.10,
    22.30,
    18.70,
    12.40
  ];

  try {
    console.log('📊 Inserting today\'s electricity prices...');

    // Insert today's data
    const todayData = todayPrices.map((priceEurMwh, hour) => ({
      price_date: todayStr,
      price_hour: hour,
      price_eur_mwh: priceEurMwh,
      price_eur_kwh: priceEurMwh / 1000, // Convert to EUR/kWh
      source: 'sample_data',
    }));

    const { error: todayError } = await supabase
      .from('electricity_prices')
      .insert(todayData);

    if (todayError) {
      console.error('❌ Error inserting today data:', todayError);
      return;
    }

    console.log('✅ Today\'s prices inserted successfully (24 hours)');

    console.log('📊 Inserting tomorrow\'s electricity prices...');

    // Insert tomorrow's data
    const tomorrowData = tomorrowPrices.map((priceEurMwh, hour) => ({
      price_date: tomorrowStr,
      price_hour: hour,
      price_eur_mwh: priceEurMwh,
      price_eur_kwh: priceEurMwh / 1000,
      source: 'sample_data',
    }));

    const { error: tomorrowError } = await supabase
      .from('electricity_prices')
      .insert(tomorrowData);

    if (tomorrowError) {
      console.error('❌ Error inserting tomorrow data:', tomorrowError);
      return;
    }

    console.log('✅ Tomorrow\'s prices inserted successfully (24 hours)');

    // Display summary
    console.log('\n📈 Sample Data Summary:');
    console.log(`📅 Today (${todayStr}):`)
    console.log(`   🕐 Current hour (~${today.getUTCHours()}): €${(todayPrices[today.getUTCHours()] / 1000).toFixed(4)}/kWh`);
    console.log(`   📉 Lowest price: €${(Math.min(...todayPrices) / 1000).toFixed(4)}/kWh at hour ${todayPrices.indexOf(Math.min(...todayPrices))}`);
    console.log(`   📈 Highest price: €${(Math.max(...todayPrices) / 1000).toFixed(4)}/kWh at hour ${todayPrices.indexOf(Math.max(...todayPrices))}`);

    console.log(`\n📅 Tomorrow (${tomorrowStr}):`);
    console.log(`   📉 Lowest price: €${(Math.min(...tomorrowPrices) / 1000).toFixed(4)}/kWh at hour ${tomorrowPrices.indexOf(Math.min(...tomorrowPrices))}`);
    console.log(`   📈 Highest price: €${(Math.max(...tomorrowPrices) / 1000).toFixed(4)}/kWh at hour ${tomorrowPrices.indexOf(Math.max(...tomorrowPrices))}`);

    console.log('\n🎯 Your database is now populated with realistic Finnish electricity market data!');
    console.log('🔄 The system will automatically replace this with real ENTSO-E data when the API becomes available.');
    console.log('⏰ Scheduled fetch runs daily at 14:15 Finnish time.');

    console.log('\n🧪 Test your electricity price service now with:');
    console.log('   npm run test:e2e -- test/data-population.e2e-spec.ts');

  } catch (error) {
    console.error('❌ Error populating sample data:', error);
  }
}

populateSampleData();