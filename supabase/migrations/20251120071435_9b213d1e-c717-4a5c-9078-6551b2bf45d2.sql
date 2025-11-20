-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create alert_history table to track what's been sent
CREATE TABLE IF NOT EXISTS public.alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  signage_spot_id UUID REFERENCES public.signage_spots(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.alert_history ENABLE ROW LEVEL SECURITY;

-- Allow admins to view alert history
CREATE POLICY "Admins can view alert history"
ON public.alert_history
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Create index for faster lookups
CREATE INDEX idx_alert_history_sent_at ON public.alert_history(sent_at);
CREATE INDEX idx_alert_history_spot_id ON public.alert_history(signage_spot_id);
CREATE INDEX idx_alert_history_type ON public.alert_history(alert_type);

-- Add columns to alert_settings for better configuration
ALTER TABLE public.alert_settings
ADD COLUMN IF NOT EXISTS cron_schedule TEXT DEFAULT 'daily_9am',
ADD COLUMN IF NOT EXISTS alert_once BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS venue_filter TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_run TIMESTAMP WITH TIME ZONE;

-- Create comment for clarity
COMMENT ON TABLE public.alert_history IS 'Tracks all sent alerts to prevent duplicates and provide audit trail';