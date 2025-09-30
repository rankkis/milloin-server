import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

async function populateNewSchemaData() {
  console.log('🔄 Populating database with new schema format...');

  // Initialize Supabase client
  const configPath = path.join(process.cwd(), 'config', 'api-keys.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const supabase = createClient(config.supabase.url, config.supabase.anonKey);

  try {
    // Clear existing sample data
    console.log('🗑️ Clearing existing sample data...');
    const { error: deleteError } = await supabase
      .from('electricity_prices')
      .delete()
      .eq('source', 'sample_data');

    if (deleteError) {
      console.error('❌ Error clearing data:', deleteError);
      return;
    }

    // Generate data using new schema format
    const today = new Date();

    // Typical Finnish electricity price pattern (EUR/MWh)
    const todayPrices = [
      3.70, 2.90, 2.80, 3.20, 3.70, 4.60, 5.60, 11.60, 19.50, 27.40, 62.60, 65.20,
      46.30, 39.60, 42.80, 36.00, 59.30, 91.20, 115.90, 150.60, 79.80, 19.70, 16.30, 10.10
    ];

    const tomorrowPrices = [
      4.20, 3.10, 2.95, 3.40, 4.10, 5.20, 6.80, 13.20, 21.50, 29.80, 58.90, 71.40,
      52.10, 44.20, 48.60, 41.30, 67.80, 95.60, 122.40, 145.20, 82.10, 22.30, 18.70, 12.40
    ];

    console.log('📊 Inserting today\'s prices with new schema...');

    // Create today's data using new schema format
    const todayData = todayPrices.map((priceEurMwh, hour) => {
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const priceStartAt = new Date(startOfDay.getTime() + hour * 60 * 60 * 1000);
      const priceEndAt = new Date(priceStartAt.getTime() + 60 * 60 * 1000);

      return {
        price_start_at: priceStartAt.toISOString(),
        price_end_at: priceEndAt.toISOString(),
        price_eur_mwh: priceEurMwh,
        price_eur_kwh: priceEurMwh / 1000,
        source: 'sample_data',
      };
    });

    const { error: todayError } = await supabase
      .from('electricity_prices')
      .insert(todayData);

    if (todayError) {
      console.error('❌ Error inserting today data:', todayError);
      return;
    }

    console.log('✅ Today\'s prices inserted successfully (24 hours)');

    console.log('📊 Inserting tomorrow\'s prices with new schema...');

    // Create tomorrow's data
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const tomorrowData = tomorrowPrices.map((priceEurMwh, hour) => {
      const startOfDay = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
      const priceStartAt = new Date(startOfDay.getTime() + hour * 60 * 60 * 1000);
      const priceEndAt = new Date(priceStartAt.getTime() + 60 * 60 * 1000);

      return {
        price_start_at: priceStartAt.toISOString(),
        price_end_at: priceEndAt.toISOString(),
        price_eur_mwh: priceEurMwh,
        price_eur_kwh: priceEurMwh / 1000,
        source: 'sample_data',
      };
    });

    const { error: tomorrowError } = await supabase
      .from('electricity_prices')
      .insert(tomorrowData);

    if (tomorrowError) {
      console.error('❌ Error inserting tomorrow data:', tomorrowError);
      return;
    }

    console.log('✅ Tomorrow\'s prices inserted successfully (24 hours)');

    // Test the new schema
    console.log('🧪 Testing new schema...');

    const { data: testData, error: testError } = await supabase
      .from('electricity_prices')
      .select('price_start_at, price_end_at, price_eur_kwh, source')
      .limit(3)
      .order('price_start_at', { ascending: true });

    if (testError) {
      console.error('❌ Error testing new schema:', testError);
      return;
    }

    console.log('\n📊 Sample records with new schema:');
    testData?.forEach((record, index) => {
      const start = new Date(record.price_start_at);
      const end = new Date(record.price_end_at);
      console.log(`  ${index + 1}. ${start.toISOString()} → ${end.toISOString()}`);
      console.log(`     Price: €${record.price_eur_kwh.toFixed(4)}/kWh (${record.source})`);
    });

    // Display summary
    const currentHour = today.getUTCHours();
    console.log('\n📈 New Schema Summary:');
    console.log(`📅 Today (${today.toISOString().split('T')[0]}):`);
    console.log(`   🕐 Current hour (${currentHour}): €${(todayPrices[currentHour] / 1000).toFixed(4)}/kWh`);
    console.log(`   📉 Lowest price: €${(Math.min(...todayPrices) / 1000).toFixed(4)}/kWh`);
    console.log(`   📈 Highest price: €${(Math.max(...todayPrices) / 1000).toFixed(4)}/kWh`);

    console.log('\n🎯 New schema data population completed!');
    console.log('✅ Using: price_start_at, price_end_at (ISO timestamps)');
    console.log('✅ 48 records inserted (24 today + 24 tomorrow)');
    console.log('🧪 Ready for testing with new schema');

  } catch (error) {
    console.error('❌ Error populating new schema data:', error);
  }
}

populateNewSchemaData();