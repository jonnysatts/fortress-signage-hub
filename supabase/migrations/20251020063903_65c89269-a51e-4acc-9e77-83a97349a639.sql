-- Add rollback and bulk operations functionality (fixed)

-- 1. Add campaign_batch_id for bulk operations
ALTER TABLE photo_history ADD COLUMN IF NOT EXISTS campaign_batch_id UUID;

-- 2. Add actual_cost for cost tracking
ALTER TABLE photo_history ADD COLUMN IF NOT EXISTS actual_cost NUMERIC(10,2);

-- 3. Create rollback function
CREATE OR REPLACE FUNCTION rollback_to_previous(
  p_spot_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_spot RECORD;
  v_result JSONB;
BEGIN
  -- Get current spot details
  SELECT * INTO v_spot FROM signage_spots WHERE id = p_spot_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Signage spot not found';
  END IF;
  
  IF v_spot.previous_image_url IS NULL THEN
    RAISE EXCEPTION 'No previous image to rollback to';
  END IF;
  
  -- Swap current and previous
  UPDATE signage_spots
  SET 
    current_image_url = v_spot.previous_image_url,
    previous_image_url = v_spot.current_image_url,
    last_update_date = v_spot.previous_update_date,
    previous_update_date = v_spot.last_update_date,
    updated_at = NOW(),
    updated_by = p_user_id
  WHERE id = p_spot_id;
  
  -- Update photo history - mark old current as 'before'
  UPDATE photo_history
  SET image_type = 'before'
  WHERE signage_spot_id = p_spot_id
    AND image_url = v_spot.current_image_url
    AND image_type = 'current';
  
  -- Update photo history - mark previous as 'current'
  UPDATE photo_history
  SET image_type = 'current'
  WHERE signage_spot_id = p_spot_id
    AND image_url = v_spot.previous_image_url;
  
  -- Log activity
  INSERT INTO activity_log (action_type, signage_spot_id, user_id, action_details)
  VALUES (
    'update',
    p_spot_id,
    p_user_id,
    jsonb_build_object(
      'action', 'rollback_to_previous',
      'from_image', v_spot.current_image_url,
      'to_image', v_spot.previous_image_url
    )
  );
  
  v_result := jsonb_build_object(
    'success', true,
    'spot_id', p_spot_id,
    'new_current_url', v_spot.previous_image_url
  );
  
  RETURN v_result;
END;
$$;

-- 4. Create function to check for stale content without replacements
CREATE OR REPLACE FUNCTION get_stale_spots_without_replacements()
RETURNS TABLE (
  spot_id UUID,
  location_name TEXT,
  venue_name TEXT,
  last_update_date DATE,
  days_since_update INTEGER,
  assigned_user_id UUID
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    s.id as spot_id,
    s.location_name,
    v.name as venue_name,
    s.last_update_date,
    (CURRENT_DATE - s.last_update_date)::INTEGER as days_since_update,
    s.assigned_user_id
  FROM signage_spots s
  JOIN venues v ON v.id = s.venue_id
  WHERE 
    s.last_update_date IS NOT NULL
    AND s.last_update_date < CURRENT_DATE - INTERVAL '6 months'
    AND s.next_planned_image_url IS NULL
    AND s.status != 'empty'
  ORDER BY s.last_update_date ASC;
$$;

-- 5. Create bulk promote function
CREATE OR REPLACE FUNCTION bulk_promote_planned_images(
  p_photo_ids UUID[],
  p_promoted_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_photo_id UUID;
  v_promoted_count INTEGER := 0;
  v_errors TEXT[] := ARRAY[]::TEXT[];
  v_result JSONB;
BEGIN
  FOREACH v_photo_id IN ARRAY p_photo_ids
  LOOP
    BEGIN
      -- Call individual promote function
      PERFORM promote_planned_to_current(v_photo_id, p_promoted_by);
      v_promoted_count := v_promoted_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, v_photo_id::TEXT || ': ' || SQLERRM);
    END;
  END LOOP;
  
  v_result := jsonb_build_object(
    'success', true,
    'promoted_count', v_promoted_count,
    'errors', v_errors
  );
  
  RETURN v_result;
END;
$$;