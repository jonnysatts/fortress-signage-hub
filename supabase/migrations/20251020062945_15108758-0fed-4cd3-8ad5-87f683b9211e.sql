-- Phase 1B: Database Foundation for Content Timeline System

-- 1. Update photo_history table with scheduling and workflow columns
ALTER TABLE photo_history 
  ADD COLUMN IF NOT EXISTS scheduled_date DATE,
  ADD COLUMN IF NOT EXISTS auto_promote BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS promoted_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS print_job_id UUID,
  ADD COLUMN IF NOT EXISTS print_status TEXT CHECK (print_status IN ('not_required', 'pending', 'ordered', 'in_production', 'ready', 'installed')),
  ADD COLUMN IF NOT EXISTS print_vendor TEXT,
  ADD COLUMN IF NOT EXISTS print_cost NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS print_ordered_date DATE,
  ADD COLUMN IF NOT EXISTS print_due_date DATE,
  ADD COLUMN IF NOT EXISTS print_notes TEXT;

-- 2. Update signage_spots table with timeline tracking
ALTER TABLE signage_spots 
  ADD COLUMN IF NOT EXISTS previous_image_url TEXT,
  ADD COLUMN IF NOT EXISTS previous_update_date DATE,
  ADD COLUMN IF NOT EXISTS next_planned_image_url TEXT,
  ADD COLUMN IF NOT EXISTS next_planned_date DATE;

-- 3. Create function to get timeline for a signage spot
CREATE OR REPLACE FUNCTION get_signage_timeline(spot_id UUID)
RETURNS TABLE (
  previous_image TEXT,
  previous_date DATE,
  curr_image TEXT,
  curr_date DATE,
  upcoming_image TEXT,
  upcoming_date DATE,
  upcoming_auto_promote BOOLEAN
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.previous_image_url,
    s.previous_update_date,
    s.current_image_url,
    s.last_update_date,
    s.next_planned_image_url,
    s.next_planned_date,
    COALESCE(
      (SELECT ph.auto_promote 
       FROM photo_history ph 
       WHERE ph.signage_spot_id = spot_id 
         AND ph.image_type = 'planned' 
         AND ph.image_url = s.next_planned_image_url
       LIMIT 1),
      false
    ) as upcoming_auto_promote
  FROM signage_spots s
  WHERE s.id = spot_id;
END;
$$;

-- 4. Create function to promote planned image to current
CREATE OR REPLACE FUNCTION promote_planned_to_current(
  p_photo_id UUID,
  p_promoted_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_photo RECORD;
  v_spot RECORD;
  v_result JSONB;
BEGIN
  -- Get the photo details
  SELECT * INTO v_photo FROM photo_history WHERE id = p_photo_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Photo not found';
  END IF;
  
  IF v_photo.image_type != 'planned' THEN
    RAISE EXCEPTION 'Only planned images can be promoted';
  END IF;
  
  -- Get current spot details
  SELECT * INTO v_spot FROM signage_spots WHERE id = v_photo.signage_spot_id;
  
  -- Store current image as previous
  UPDATE signage_spots
  SET 
    previous_image_url = current_image_url,
    previous_update_date = last_update_date,
    current_image_url = v_photo.image_url,
    last_update_date = CURRENT_DATE,
    status = 'current',
    next_planned_image_url = NULL,
    next_planned_date = NULL,
    updated_at = NOW(),
    updated_by = p_promoted_by
  WHERE id = v_photo.signage_spot_id;
  
  -- Update the photo record
  UPDATE photo_history
  SET 
    image_type = 'current',
    promoted_at = NOW(),
    promoted_by = p_promoted_by,
    approval_status = 'approved'
  WHERE id = p_photo_id;
  
  -- Archive old current image as 'before'
  IF v_spot.current_image_url IS NOT NULL THEN
    UPDATE photo_history
    SET image_type = 'before'
    WHERE signage_spot_id = v_photo.signage_spot_id
      AND image_url = v_spot.current_image_url
      AND image_type = 'current';
  END IF;
  
  -- Log activity
  INSERT INTO activity_log (action_type, signage_spot_id, user_id, action_details)
  VALUES (
    'update',
    v_photo.signage_spot_id,
    p_promoted_by,
    jsonb_build_object(
      'action', 'promoted_planned_to_current',
      'photo_id', p_photo_id,
      'image_url', v_photo.image_url
    )
  );
  
  v_result := jsonb_build_object(
    'success', true,
    'spot_id', v_photo.signage_spot_id,
    'new_current_url', v_photo.image_url
  );
  
  RETURN v_result;
END;
$$;

-- 5. Create trigger to update next_planned_image on upload
CREATE OR REPLACE FUNCTION update_next_planned_image()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- If uploading a planned image, update the spot's next_planned fields
  IF NEW.image_type = 'planned' AND NEW.scheduled_date IS NOT NULL THEN
    -- Only update if this is the earliest planned image
    UPDATE signage_spots
    SET 
      next_planned_image_url = NEW.image_url,
      next_planned_date = NEW.scheduled_date,
      updated_at = NOW()
    WHERE id = NEW.signage_spot_id
      AND (
        next_planned_date IS NULL 
        OR NEW.scheduled_date < next_planned_date
      );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_next_planned
  AFTER INSERT ON photo_history
  FOR EACH ROW
  WHEN (NEW.image_type = 'planned')
  EXECUTE FUNCTION update_next_planned_image();