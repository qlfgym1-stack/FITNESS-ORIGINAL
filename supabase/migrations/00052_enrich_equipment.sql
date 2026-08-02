-- Add brand, location, next_maintenance, notes to equipment table
ALTER TABLE equipment
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS next_maintenance date,
  ADD COLUMN IF NOT EXISTS notes text;

-- Update existing categories to richer gym-specific ones
-- Keep old values working, just add new options via the frontend
