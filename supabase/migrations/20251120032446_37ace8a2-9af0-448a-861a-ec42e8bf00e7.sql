-- Create table for Slack user mention settings
CREATE TABLE public.slack_mention_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name TEXT NOT NULL,
  slack_user_id TEXT NOT NULL,
  mention_for_severities TEXT[] NOT NULL DEFAULT ARRAY['critical']::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.slack_mention_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can view mention settings
CREATE POLICY "Admins can view slack mention settings"
ON public.slack_mention_settings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Only admins can insert mention settings
CREATE POLICY "Admins can insert slack mention settings"
ON public.slack_mention_settings
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Only admins can update mention settings
CREATE POLICY "Admins can update slack mention settings"
ON public.slack_mention_settings
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Only admins can delete mention settings
CREATE POLICY "Admins can delete slack mention settings"
ON public.slack_mention_settings
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Add updated_at trigger
CREATE TRIGGER update_slack_mention_settings_updated_at
BEFORE UPDATE ON public.slack_mention_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();