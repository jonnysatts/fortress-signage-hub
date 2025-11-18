-- Comprehensive fix for photo history and current_image_url sync issues
-- This migration addresses:
-- 1. Multiple 'current' images per spot (should only be 1)
-- 2. Missing current_image_url in signage_spots when photo_history has 'current' images
-- 3. Ensures database trigger is properly set up

-- STEP 1: Clean up duplicate 'current' images
-- For each spot with multiple 'current' images, keep only the most recent one
-- and change older ones to 'reference' type
WITH ranked_current_images AS (
  SELECT
    id,
    signage_spot_id,
    upload_date,
    ROW_NUMBER() OVER (
      PARTITION BY signage_spot_id
      ORDER BY COALESCE(scheduled_date::timestamp, upload_date) DESC
    ) as rn
  FROM photo_history
  WHERE image_type = 'current'
)
UPDATE photo_history
SET
  image_type = 'reference',
  caption = COALESCE(caption || ' ', '') || '(Auto-converted from duplicate current image)'
FROM ranked_current_images r
WHERE photo_history.id = r.id
  AND r.rn > 1;

-- STEP 2: Backfill current_image_url for spots that have 'current' images in photo_history
-- but NULL current_image_url in signage_spots
UPDATE signage_spots
SET
  current_image_url = ph.image_url,
  last_update_date = COALESCE(ph.scheduled_date::date, ph.upload_date::date),
  status = CASE
    WHEN status = 'empty' THEN 'current'
    ELSE status
  END,
  updated_at = NOW()
FROM (
  SELECT DISTINCT ON (signage_spot_id)
    signage_spot_id,
    image_url,
    upload_date,
    scheduled_date
  FROM photo_history
  WHERE image_type = 'current'
  ORDER BY signage_spot_id, COALESCE(scheduled_date::timestamp, upload_date) DESC
) ph
WHERE signage_spots.id = ph.signage_spot_id
  AND signage_spots.current_image_url IS NULL;

-- STEP 3: Verify the trigger exists and is enabled
-- Check trigger on photo_history table
DO $$
BEGIN
  -- Check if trigger exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname IN ('trigger_photo_upload', 'trg_photo_upload')
      AND tgrelid = 'photo_history'::regclass
  ) THEN
    RAISE WARNING 'Photo upload trigger is missing! This will cause sync issues.';
  END IF;
END $$;

-- STEP 4: Add comment explaining the data model
COMMENT ON COLUMN signage_spots.current_image_url IS 'URL of the current content being displayed. Auto-updated by trigger when image_type=current is inserted into photo_history. Should always match the most recent current image in photo_history.';
COMMENT ON COLUMN photo_history.image_type IS 'Type of image: current (displayed now), planned (scheduled future), before (pre-install), after (post-install), reference (archived/reference), location (physical space photo). Only ONE current image should exist per signage_spot_id at any time.';

-- Log results
DO $$
DECLARE
  v_updated_spots int;
  v_converted_images int;
BEGIN
  -- Count how many spots were updated
  SELECT COUNT(*)
  INTO v_updated_spots
  FROM signage_spots ss
  WHERE ss.current_image_url IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM photo_history ph
      WHERE ph.signage_spot_id = ss.id
        AND ph.image_type = 'current'
        AND ph.image_url = ss.current_image_url
    );

  -- Count converted images
  SELECT COUNT(*)
  INTO v_converted_images
  FROM photo_history
  WHERE image_type = 'reference'
    AND caption LIKE '%(Auto-converted from duplicate current image)%';

  RAISE NOTICE 'Migration complete: % spots have current_image_url synced, % duplicate current images converted to reference',
    v_updated_spots, v_converted_images;
END $$;
