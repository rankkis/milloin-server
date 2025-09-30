-- Migration: Split price_date into price_start_at and price_end_at
-- This migration updates the electricity_prices table to use separate start and end timestamps

-- Step 1: Add new columns
ALTER TABLE electricity_prices
ADD COLUMN price_start_at TIMESTAMPTZ,
ADD COLUMN price_end_at TIMESTAMPTZ;

-- Step 2: Populate new columns from existing data
-- Convert existing price_date (which was storing start time) to both start and end times
UPDATE electricity_prices
SET
  price_start_at = price_date,
  price_end_at = price_date + INTERVAL '1 hour';

-- Step 3: Make new columns NOT NULL
ALTER TABLE electricity_prices
ALTER COLUMN price_start_at SET NOT NULL,
ALTER COLUMN price_end_at SET NOT NULL;

-- Step 4: Update unique constraint to use new columns
-- First drop the old constraint
ALTER TABLE electricity_prices
DROP CONSTRAINT IF EXISTS electricity_prices_price_date_price_hour_key;

-- Add new unique constraint based on start time
ALTER TABLE electricity_prices
ADD CONSTRAINT electricity_prices_price_start_at_unique UNIQUE (price_start_at);

-- Step 5: Update indexes
-- Drop old index
DROP INDEX IF EXISTS idx_electricity_prices_date_hour;

-- Create new indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_electricity_prices_start_time ON electricity_prices(price_start_at);
CREATE INDEX IF NOT EXISTS idx_electricity_prices_time_range ON electricity_prices(price_start_at, price_end_at);

-- Step 6: Drop old columns (optional - uncomment if you want to remove them completely)
ALTER TABLE electricity_prices DROP COLUMN price_date;
ALTER TABLE electricity_prices DROP COLUMN price_hour;

-- Note: We're keeping the old columns for now to ensure backward compatibility during transition
-- You can manually drop them later after confirming everything works correctly