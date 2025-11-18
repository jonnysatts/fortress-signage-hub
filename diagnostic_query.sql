-- Diagnostic query to check the state of signage spots and photo history
-- Run this in your Supabase SQL editor to understand the data mismatch

-- 1. Find spots with NULL current_image_url but have 'current' images in photo_history
SELECT
  ss.id,
  ss.location_name,
  ss.current_image_url,
  ss.last_update_date,
  ss.status,
  COUNT(ph.id) as current_images_in_history,
  MAX(ph.upload_date) as latest_upload_date
FROM signage_spots ss
LEFT JOIN photo_history ph ON ph.signage_spot_id = ss.id AND ph.image_type = 'current'
WHERE ss.current_image_url IS NULL
  AND ph.id IS NOT NULL
GROUP BY ss.id, ss.location_name, ss.current_image_url, ss.last_update_date, ss.status
ORDER BY latest_upload_date DESC;

-- 2. Find specific spot mentioned by user (adjust location_name as needed)
SELECT
  ss.id,
  ss.location_name,
  ss.current_image_url,
  ss.last_update_date,
  ss.status
FROM signage_spots ss
WHERE ss.location_name ILIKE '%Upstairs male hallway to bathroom side wall%';

-- 3. Show all 'current' images for that spot
SELECT
  ph.id,
  ph.image_url,
  ph.image_type,
  ph.upload_date,
  ph.uploaded_by,
  ph.caption
FROM photo_history ph
WHERE ph.signage_spot_id IN (
  SELECT id FROM signage_spots
  WHERE location_name ILIKE '%Upstairs male hallway to bathroom side wall%'
)
AND ph.image_type = 'current'
ORDER BY ph.upload_date DESC;

-- 4. Check if the trigger exists
SELECT
  tgname as trigger_name,
  tgenabled as enabled,
  proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'trigger_photo_upload' OR tgname = 'trg_photo_upload';

-- 5. Check if handle_photo_upload function exists
SELECT
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
WHERE p.proname = 'handle_photo_upload';
