-- Schedule the send-alerts function to run daily at 2 AM (after signage/campaign status updates)
SELECT cron.schedule(
  'send-alerts-daily',
  '0 2 * * *', -- Every day at 2 AM
  $$
  SELECT
    net.http_post(
        url:='https://urqfyhaqtjgsngbjqpcc.supabase.co/functions/v1/send-alerts',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVycWZ5aGFxdGpnc25nYmpxcGNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4ODUyMzAsImV4cCI6MjA3NjQ2MTIzMH0.CWu_8B6c0z78d23q0Dg9u9nayoEGBPGQsNr7Hc3jYrU"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);