import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

async function checkDatabase() {
  const configPath = path.join(process.cwd(), 'config', 'api-keys.json');
  const configFile = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(configFile);

  const supabase = createClient(config.supabase.url, config.supabase.anonKey);

  const { data, error } = await supabase
    .from('electricity_prices')
    .select('*')
    .gte('price_start_at', '2025-10-03T11:00:00.000Z')
    .lt('price_start_at', '2025-10-03T12:00:00.000Z')
    .order('price_start_at');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`\nFound ${data.length} records for 11:00-12:00 UTC:`);
  data.forEach(record => {
    console.log(`${record.price_start_at} - ${record.price_end_at}: ${record.price_eur_kwh} EUR/kWh (source: ${record.source})`);
  });
}

checkDatabase();
