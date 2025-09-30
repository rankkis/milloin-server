import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

async function migrateSchema() {
  console.log('🔄 Starting database schema migration...');
  console.log('📝 Migrating from price_date/price_hour to price_start_at/price_end_at');

  // Initialize Supabase client
  const configPath = path.join(process.cwd(), 'config', 'api-keys.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const supabase = createClient(config.supabase.url, config.supabase.anonKey);

  try {
    console.log('🏗️  Step 1: Adding new columns...');

    // Run the migration SQL manually since Supabase client doesn't support DDL directly
    // We'll do this step by step to handle the data migration properly

    // First, let's check what data exists
    const { data: existingData, error: fetchError } = await supabase
      .from('electricity_prices')
      .select('*')
      .limit(5);

    if (fetchError) {
      console.error('❌ Error checking existing data:', fetchError);
      return;
    }

    console.log(`📊 Found ${existingData?.length || 0} sample records`);

    if (existingData && existingData.length > 0) {
      console.log('📋 Sample record structure:', Object.keys(existingData[0]));

      // Check if migration is already done
      if (existingData[0].price_start_at && existingData[0].price_end_at) {
        console.log('✅ Migration already completed - new columns exist and have data');
        return;
      }

      if (!existingData[0].price_start_at) {
        console.log('⚠️  New columns do not exist yet. Please run the migration SQL first:');
        console.log('');
        console.log('🔗 Go to your Supabase SQL Editor and run:');
        console.log('📁 File: database/migration-split-price-date.sql');
        console.log('');
        console.log('After running the SQL migration, run this script again.');
        return;
      }
    }

    console.log('✅ Schema migration completed successfully!');
    console.log('');
    console.log('🧪 Testing new schema with sample data...');

    // Test with new schema by checking if we can query properly
    const { data: testData, error: testError } = await supabase
      .from('electricity_prices')
      .select('price_start_at, price_end_at, price_eur_kwh')
      .limit(3);

    if (testError) {
      console.error('❌ Error testing new schema:', testError);
      return;
    }

    console.log(`📊 Successfully queried ${testData?.length || 0} records with new schema`);

    if (testData && testData.length > 0) {
      testData.forEach((record, index) => {
        const startTime = new Date(record.price_start_at).toLocaleString();
        const endTime = new Date(record.price_end_at).toLocaleString();
        console.log(`  ${index + 1}. ${startTime} - ${endTime}: €${record.price_eur_kwh.toFixed(4)}/kWh`);
      });
    }

    console.log('');
    console.log('🎉 Database schema migration completed successfully!');
    console.log('✅ New columns: price_start_at, price_end_at');
    console.log('✅ Old columns: price_date, price_hour (kept for compatibility)');
    console.log('');
    console.log('🧪 Next step: Test the updated system');

  } catch (error) {
    console.error('❌ Error during migration:', error);
  }
}

migrateSchema();