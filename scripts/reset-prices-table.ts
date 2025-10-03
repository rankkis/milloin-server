import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Script to reset (truncate) the electricity_prices table.
 * This removes all existing data to prepare for fresh 15-minute interval data.
 */
async function resetPricesTable() {
  try {
    // Load config
    const configPath = path.join(process.cwd(), 'config', 'api-keys.json');
    const configFile = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configFile);

    if (!config.supabase?.url || !config.supabase?.anonKey) {
      throw new Error('Supabase configuration not found');
    }

    // Create Supabase client
    const supabase = createClient(config.supabase.url, config.supabase.anonKey);

    console.log('🗑️  Resetting electricity_prices table...');

    // Delete all records from the table
    const { error } = await supabase
      .from('electricity_prices')
      .delete()
      .neq('price_start_at', '1900-01-01T00:00:00.000Z'); // Delete all records (using always-true condition)

    if (error) {
      console.error('❌ Error resetting table:', error);
      throw error;
    }

    console.log('✅ Table reset successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Run the scheduler to fetch fresh 15-minute data:');
    console.log('   npm run start:dev');
    console.log('   (The scheduler will automatically fetch data)');
    console.log('');
    console.log('Or manually trigger the fetch:');
    console.log('   Call the scheduler service methods from your app');

  } catch (error) {
    console.error('❌ Failed to reset table:', error);
    process.exit(1);
  }
}

resetPricesTable();
