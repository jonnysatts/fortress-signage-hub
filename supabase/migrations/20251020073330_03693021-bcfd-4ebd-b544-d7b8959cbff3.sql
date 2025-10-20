-- Calendar settings table (per-user preferences)
CREATE TABLE calendar_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  show_scheduled_promotions boolean DEFAULT true,
  show_print_jobs boolean DEFAULT true,
  show_campaigns boolean DEFAULT true,
  show_expiry_dates boolean DEFAULT true,
  show_stale_warnings boolean DEFAULT true,
  show_recurring_events boolean DEFAULT true,
  default_view text DEFAULT 'month',
  email_reminders_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Recurring events table
CREATE TABLE recurring_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  event_type text NOT NULL,
  recurrence_rule jsonb NOT NULL,
  start_time time,
  end_time time,
  all_day boolean DEFAULT false,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Email reminder settings
CREATE TABLE email_reminder_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  remind_scheduled_promotions boolean DEFAULT true,
  remind_print_jobs boolean DEFAULT true,
  remind_expiry_dates boolean DEFAULT true,
  remind_campaigns boolean DEFAULT true,
  days_before integer DEFAULT 3,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE calendar_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_reminder_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for calendar_settings
CREATE POLICY "Users can view own calendar settings"
ON calendar_settings FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calendar settings"
ON calendar_settings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar settings"
ON calendar_settings FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- RLS Policies for recurring_events
CREATE POLICY "All authenticated users can view recurring events"
ON recurring_events FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Managers and admins can create recurring events"
ON recurring_events FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Managers and admins can update recurring events"
ON recurring_events FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Managers and admins can delete recurring events"
ON recurring_events FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- RLS Policies for email_reminder_settings
CREATE POLICY "Users can view own email reminder settings"
ON email_reminder_settings FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own email reminder settings"
ON email_reminder_settings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own email reminder settings"
ON email_reminder_settings FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_calendar_settings_updated_at
BEFORE UPDATE ON calendar_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recurring_events_updated_at
BEFORE UPDATE ON recurring_events
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_reminder_settings_updated_at
BEFORE UPDATE ON email_reminder_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();