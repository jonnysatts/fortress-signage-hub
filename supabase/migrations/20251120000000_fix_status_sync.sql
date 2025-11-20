-- Fix status field synchronization issues
-- This migration addresses spots where status is 'empty' but they actually have content

-- STEP 1: One-time repair - Update status for ALL spots based on actual content state
UPDATE signage_spots
SET
  status = CASE
    -- If has scheduled future content, mark as planned
    WHEN next_planned_date IS NOT NULL AND next_planned_date > CURRENT_DATE THEN 'planned'::signage_status

    -- If has current content and is overdue
    WHEN current_image_url IS NOT NULL
      AND expiry_date IS NOT NULL
      AND expiry_date < CURRENT_DATE THEN 'overdue'::signage_status

    -- If has current content and expiring soon (within 7 days)
    WHEN current_image_url IS NOT NULL
      AND expiry_date IS NOT NULL
      AND expiry_date >= CURRENT_DATE
      AND expiry_date <= (CURRENT_DATE + INTERVAL '7 days') THEN 'expiring_soon'::signage_status

    -- If has current content and not expired = current
    WHEN current_image_url IS NOT NULL THEN 'current'::signage_status

    -- Otherwise truly empty
    ELSE 'empty'::signage_status
  END,
  updated_at = NOW()
WHERE
  -- Only update rows where status doesn't match reality
  (status = 'empty' AND current_image_url IS NOT NULL)
  OR (status != 'empty' AND current_image_url IS NULL)
  OR (status != 'overdue' AND current_image_url IS NOT NULL AND expiry_date < CURRENT_DATE)
  OR (status != 'expiring_soon' AND current_image_url IS NOT NULL AND expiry_date >= CURRENT_DATE AND expiry_date <= (CURRENT_DATE + INTERVAL '7 days'));

-- STEP 2: Create or replace function to calculate correct status
CREATE OR REPLACE FUNCTION calculate_spot_status(
  p_current_image_url TEXT,
  p_expiry_date DATE,
  p_next_planned_date DATE
)
RETURNS signage_status AS \$\$
BEGIN
  -- Check for scheduled future content first
  IF p_next_planned_date IS NOT NULL AND p_next_planned_date > CURRENT_DATE THEN
    RETURN 'planned'::signage_status;
  END IF;

  -- Check if has current content
  IF p_current_image_url IS NOT NULL THEN
    -- Check if overdue
    IF p_expiry_date IS NOT NULL AND p_expiry_date < CURRENT_DATE THEN
      RETURN 'overdue'::signage_status;
    END IF;

    -- Check if expiring soon (within 7 days)
    IF p_expiry_date IS NOT NULL
      AND p_expiry_date >= CURRENT_DATE
      AND p_expiry_date <= (CURRENT_DATE + INTERVAL '7 days') THEN
      RETURN 'expiring_soon'::signage_status;
    END IF;

    -- Has content and not expired = current
    RETURN 'current'::signage_status;
  END IF;

  -- No content = empty
  RETURN 'empty'::signage_status;
END;
\$\$ LANGUAGE plpgsql IMMUTABLE;

-- STEP 3: Update handle_photo_upload to use the new status calculation
CREATE OR REPLACE FUNCTION handle_photo_upload()
RETURNS TRIGGER AS \$\$
DECLARE
  v_expiry_behavior text;
  v_install_date date;
  v_campaign_end_date date;
  v_custom_expiry_date date;
  v_new_expiry_date date;
  v_next_planned_date date;
BEGIN
  -- Only process if it's a 'current' image type
  IF NEW.image_type = 'current' THEN
    -- Get signage spot details
    SELECT
      expiry_behavior,
      install_date,
      expiry_date,
      next_planned_date
    INTO
      v_expiry_behavior,
      v_install_date,
      v_custom_expiry_date,
      v_next_planned_date
    FROM signage_spots
    WHERE id = NEW.signage_spot_id;

    -- Get campaign end date if linked to active campaign
    SELECT c.end_date
    INTO v_campaign_end_date
    FROM campaigns c
    JOIN signage_campaigns sc ON sc.campaign_id = c.id
    WHERE sc.signage_spot_id = NEW.signage_spot_id
      AND c.is_active = true
    LIMIT 1;

    -- Calculate new expiry date
    v_new_expiry_date := calculate_expiry_date(
      v_expiry_behavior,
      v_install_date,
      CURRENT_DATE, -- Set last_update_date to today
      v_custom_expiry_date,
      v_campaign_end_date
    );

    -- Update signage spot with auto-calculated status
    UPDATE signage_spots
    SET
      last_update_date = CURRENT_DATE,
      expiry_date = v_new_expiry_date,
      status = calculate_spot_status(NEW.image_url, v_new_expiry_date, v_next_planned_date),
      current_image_url = NEW.image_url,
      updated_at = NOW()
    WHERE id = NEW.signage_spot_id;

  END IF;

  RETURN NEW;
END;
\$\$ LANGUAGE plpgsql SET search_path = public;

-- STEP 4: Create trigger to auto-update status when key fields change
CREATE OR REPLACE FUNCTION update_spot_status_on_change()
RETURNS TRIGGER AS \$\$
BEGIN
  -- Auto-calculate status whenever relevant fields change
  IF (NEW.current_image_url IS DISTINCT FROM OLD.current_image_url)
    OR (NEW.expiry_date IS DISTINCT FROM OLD.expiry_date)
    OR (NEW.next_planned_date IS DISTINCT FROM OLD.next_planned_date) THEN

    NEW.status := calculate_spot_status(
      NEW.current_image_url,
      NEW.expiry_date,
      NEW.next_planned_date
    );
  END IF;

  RETURN NEW;
END;
\$\$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_spot_status ON signage_spots;
CREATE TRIGGER trg_update_spot_status
  BEFORE UPDATE ON signage_spots
  FOR EACH ROW
  EXECUTE FUNCTION update_spot_status_on_change();

-- STEP 5: Add helpful comment
COMMENT ON COLUMN signage_spots.status IS 'Auto-calculated based on current_image_url, expiry_date, and next_planned_date. Updated automatically by triggers.';

-- STEP 6: Log results
DO \$\$
DECLARE
  v_fixed_count int;
  v_current_count int;
  v_empty_count int;
  v_overdue_count int;
BEGIN
  -- Count how many were fixed
  SELECT COUNT(*)
  INTO v_current_count
  FROM signage_spots
  WHERE status = 'current';

  SELECT COUNT(*)
  INTO v_empty_count
  FROM signage_spots
  WHERE status = 'empty';

  SELECT COUNT(*)
  INTO v_overdue_count
  FROM signage_spots
  WHERE status = 'overdue';

  RAISE NOTICE 'Status sync complete: % current, % empty, % overdue',
    v_current_count, v_empty_count, v_overdue_count;
END \$\$;
