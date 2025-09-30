import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

async function fixSampleData() {
  console.log('🔧 Fixing sample data format...');

  // Initialize Supabase client
  const configPath = path.join(process.cwd(), 'config', 'api-keys.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const supabase = createClient(config.supabase.url, config.supabase.anonKey);

  try {
    // First, clear existing sample data
    console.log('🗑️ Clearing existing sample data...');
    const { error: deleteError } = await supabase
      .from('electricity_prices')
      .delete()
      .eq('source', 'sample_data');

    if (deleteError) {
      console.error('❌ Error clearing sample data:', deleteError);
      return;
    }

    // Generate data using the same format as ENTSO-E fetcher
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

    console.log('📊 Inserting corrected today\'s prices...');

    // Create today's data using proper date format
    const todayData = todayPrices.map((priceEurMwh, hour) => {
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const priceDate = new Date(startOfDay.getTime() + hour * 60 * 60 * 1000);

      return {
        price_date: priceDate.toISOString(), // Full timestamp
        price_hour: hour,
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

    console.log('📊 Inserting corrected tomorrow\'s prices...');

    // Create tomorrow's data
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const tomorrowData = tomorrowPrices.map((priceEurMwh, hour) => {
      const startOfDay = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
      const priceDate = new Date(startOfDay.getTime() + hour * 60 * 60 * 1000);

      return {
        price_date: priceDate.toISOString(), // Full timestamp
        price_hour: hour,
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

    // Display summary
    const currentHour = today.getUTCHours();
    console.log('\n📈 Corrected Data Summary:');
    console.log(`📅 Today (${today.toISOString().split('T')[0]}):`);
    console.log(`   🕐 Current hour (${currentHour}): €${(todayPrices[currentHour] / 1000).toFixed(4)}/kWh`);
    console.log(`   📉 Lowest price: €${(Math.min(...todayPrices) / 1000).toFixed(4)}/kWh at hour ${todayPrices.indexOf(Math.min(...todayPrices))}`);
    console.log(`   📈 Highest price: €${(Math.max(...todayPrices) / 1000).toFixed(4)}/kWh at hour ${todayPrices.indexOf(Math.max(...todayPrices))}`);

    console.log('\n🎯 Database format has been corrected!');
    console.log('🧪 Test again with: npx ts-node scripts/check-database.ts');

  } catch (error) {
    console.error('❌ Error fixing sample data:', error);
  }
}

fixSampleData();