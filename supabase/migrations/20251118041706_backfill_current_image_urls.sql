-- Backfill current_image_url for signage_spots that have photo_history records but null current_image_url
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
