-- Function to calculate expiry date based on expiry_behavior
CREATE OR REPLACE FUNCTION calculate_expiry_date(
  p_expiry_behavior text,
  p_install_date date,
  p_last_update_date date,
  p_custom_expiry_date date,
  p_campaign_end_date date
) RETURNS date AS $$
BEGIN
  CASE p_expiry_behavior
    WHEN 'auto_6_months' THEN
      -- Use last_update_date if available, otherwise install_date
      IF p_last_update_date IS NOT NULL THEN
        RETURN p_last_update_date + INTERVAL '6 months';
      ELSIF p_install_date IS NOT NULL THEN
        RETURN p_install_date + INTERVAL '6 months';
      ELSE
        RETURN NULL;
      END IF;
    WHEN 'custom' THEN
      RETURN p_custom_expiry_date;
    WHEN 'event_based' THEN
      RETURN p_campaign_end_date;
    WHEN 'never' THEN
      RETURN NULL;
    ELSE
      -- Default to 6 months from last update or install
      IF p_last_update_date IS NOT NULL THEN
        RETURN p_last_update_date + INTERVAL '6 months';
      ELSIF p_install_date IS NOT NULL THEN
        RETURN p_install_date + INTERVAL '6 months';
      ELSE
        RETURN NULL;
      END IF;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to update signage spot when photo is uploaded
CREATE OR REPLACE FUNCTION handle_photo_upload()
RETURNS TRIGGER AS $$
DECLARE
  v_expiry_behavior text;
  v_install_date date;
  v_campaign_end_date date;
  v_custom_expiry_date date;
  v_new_expiry_date date;
BEGIN
  -- Only process if it's a 'current' image type
  IF NEW.image_type = 'current' THEN
    -- Get signage spot details
    SELECT 
      expiry_behavior,
      install_date,
      expiry_date
    INTO 
      v_expiry_behavior,
      v_install_date,
      v_custom_expiry_date
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

    -- Update signage spot
    UPDATE signage_spots
    SET 
      last_update_date = CURRENT_DATE,
      expiry_date = v_new_expiry_date,
      status = 'current',
      current_image_url = NEW.image_url,
      updated_at = NOW()
    WHERE id = NEW.signage_spot_id;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for photo uploads
DROP TRIGGER IF EXISTS trigger_photo_upload ON photo_history;
CREATE TRIGGER trigger_photo_upload
  AFTER INSERT ON photo_history
  FOR EACH ROW
  EXECUTE FUNCTION handle_photo_upload();

-- Schedule the signage status update to run daily at 1 AM
SELECT cron.schedule(
  'update-signage-status-daily',
  '0 1 * * *', -- Every day at 1 AM
  $$
  SELECT
    net.http_post(
        url:='https://urqfyhaqtjgsngbjqpcc.supabase.co/functions/v1/update-signage-status',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVycWZ5aGFxdGpnc25nYmpxcGNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4ODUyMzAsImV4cCI6MjA3NjQ2MTIzMH0.CWu_8B6c0z78d23q0Dg9u9nayoEGBPGQsNr7Hc3jYrU"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);
