-- Add venue filtering to slack_mention_settings
ALTER TABLE public.slack_mention_settings
ADD COLUMN venues TEXT[] NOT NULL DEFAULT ARRAY['Melbourne', 'Sydney']::TEXT[];