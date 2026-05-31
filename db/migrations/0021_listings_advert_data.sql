-- 0021_listings_advert_data.sql
-- Rich advert composer (Advert tool). Adds a single jsonb column to `listings`
-- holding the AutoTrader/website advert fields that don't warrant their own
-- columns: attention grabber, key selling point, dealer strapline, website
-- subtitle, the 5 website highlights, the selected equipment list, and any
-- AutoTrader taxonomy overrides. Defaults to an empty object so existing rows
-- and inserts that don't set it remain valid.

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS advert_data jsonb NOT NULL DEFAULT '{}'::jsonb;
