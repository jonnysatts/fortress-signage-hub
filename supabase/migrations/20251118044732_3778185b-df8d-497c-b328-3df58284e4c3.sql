-- Migration 1: Backfill current_image_url for signage_spots that have photo_history records but null current_image_url
-- This fixes spots that had images uploaded before the trg_photo_upload trigger was created

UPDATE signage_spots
SET
  current_image_url = ph.image_url,
  last_update_date = COALESCE(ph.scheduled_date::date, ph.upload_date::date),
  status = 'current'
FROM (
  SELECT DISTINCT ON (signage_spot_id)
    signage_spot_id,
    image_url,
    upload_date,
    scheduled_date
  FROM photo_history
  WHERE image_type = 'current'
  ORDER BY signage_spot_id, coalesce(scheduled_date::timestamp, upload_date) DESC
) ph
WHERE signage_spots.id = ph.signage_spot_id
  AND signage_spots.current_image_url IS NULL;

-- Migration 2: Add original image dimensions to floor_plans table
-- This provides a stable reference for marker positioning

ALTER TABLE floor_plans
ADD COLUMN IF NOT EXISTS original_width INTEGER,
ADD COLUMN IF NOT EXISTS original_height INTEGER;

COMMENT ON COLUMN floor_plans.original_width IS 'Original width of the floor plan image in pixels - used as reference for marker positioning';
COMMENT ON COLUMN floor_plans.original_height IS 'Original height of the floor plan image in pixels - used as reference for marker positioning';

-- Migration 3: Comprehensive fix for photo history and current_image_url sync issues
-- This addresses: Multiple 'current' images per spot, missing current_image_url, and trigger verification

-- STEP 1: Clean up duplicate 'current' images
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

-- STEP 3: Verify the trigger exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname IN ('trigger_photo_upload', 'trg_photo_upload')
      AND tgrelid = 'photo_history'::regclass
  ) THEN
    RAISE WARNING 'Photo upload trigger is missing! This will cause sync issues.';
  END IF;
END $$;

-- STEP 4: Add documentation
COMMENT ON COLUMN signage_spots.current_image_url IS 'URL of the current content being displayed. Auto-updated by trigger when image_type=current is inserted into photo_history. Should always match the most recent current image in photo_history.';
COMMENT ON COLUMN photo_history.image_type IS 'Type of image: current (displayed now), planned (scheduled future), before (pre-install), after (post-install), reference (archived/reference), location (physical space photo). Only ONE current image should exist per signage_spot_id at any time.';