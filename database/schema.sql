-- Electricity prices table for storing ENTSO-E data
CREATE TABLE IF NOT EXISTS electricity_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  price_date TIMESTAMPTZ NOT NULL,
  price_hour INTEGER NOT NULL CHECK (price_hour >= 0 AND price_hour <= 23),
  price_eur_mwh DECIMAL(10,4) NOT NULL,
  price_eur_kwh DECIMAL(10,6) NOT NULL,
  source VARCHAR(50) NOT NULL DEFAULT 'entsoe',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint to prevent duplicate entries for same date/hour
  UNIQUE(price_date, price_hour)
);

-- Index for efficient querying by date range
CREATE INDEX IF NOT EXISTS idx_electricity_prices_date_hour ON electricity_prices(price_date, price_hour);

-- Index for efficient querying by source
CREATE INDEX IF NOT EXISTS idx_electricity_prices_source ON electricity_prices(source);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_electricity_prices_updated_at BEFORE UPDATE ON electricity_prices FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- RLS (Row Level Security) policies if needed
-- ALTER TABLE electricity_prices ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow read access to all users" ON electricity_prices FOR SELECT TO authenticated, anon USING (true);
-- CREATE POLICY "Allow insert/update for service role" ON electricity_prices FOR ALL TO service_role USING (true);