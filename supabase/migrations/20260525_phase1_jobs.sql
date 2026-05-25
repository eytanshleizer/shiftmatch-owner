-- Phase 1: Jobs management on restaurants table
-- Adds mandatory shifts, weekly shift commitment range, per-position open/close,
-- and explicit urgent pricing/expiry.
--
-- Run this in Supabase SQL Editor.

BEGIN;

-- Per-position open/close flag.  Format: { "מלצר/ית": true, "ברמן/ית": false }
-- Positions missing from the jsonb default to OPEN (true).
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS position_open JSONB DEFAULT '{}'::jsonb;

-- Mandatory shifts the worker MUST be available for (filters non-matching candidates).
-- Values: 'weekend' | 'nights' | 'holidays' | 'early_morning'
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS mandatory_shifts TEXT[] DEFAULT '{}';

-- Weekly shift commitment range (e.g. min=3, max=5 → "3–5 משמרות בשבוע").
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS shift_commitment_min INT,
  ADD COLUMN IF NOT EXISTS shift_commitment_max INT;

-- Urgent listing pricing & expiry.  Default ₪79, expires after 7 days.
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS urgent_price INT DEFAULT 79,
  ADD COLUMN IF NOT EXISTS urgent_until TIMESTAMPTZ;

-- Helpful index for filtering urgent listings still active.
CREATE INDEX IF NOT EXISTS restaurants_urgent_until_idx
  ON restaurants (urgent_until)
  WHERE urgent_until IS NOT NULL;

COMMIT;
