-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the campaign status update to run daily at midnight
SELECT cron.schedule(
  'update-campaign-status-daily',
  '0 0 * * *', -- Every day at midnight
  $$
  SELECT
    net.http_post(
        url:='https://urqfyhaqtjgsngbjqpcc.supabase.co/functions/v1/update-campaign-status',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVycWZ5aGFxdGpnc25nYmpxcGNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4ODUyMzAsImV4cCI6MjA3NjQ2MTIzMH0.CWu_8B6c0z78d23q0Dg9u9nayoEGBPGQsNr7Hc3jYrU"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);