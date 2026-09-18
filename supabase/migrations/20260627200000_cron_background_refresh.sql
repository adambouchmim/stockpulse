-- Background news refresh cron job
-- Calls the fetch-news edge function once daily at 07:00 UTC for ALL users.
-- pg_cron and pg_net extensions are already enabled.

SELECT cron.schedule(
  'daily-news-refresh',        -- job name
  '0 7 * * *',                 -- cron expression: every day at 07:00 UTC
  $$
  SELECT net.http_post(
    url     := 'https://xyuetzzrybnstxtpvfou.supabase.co/functions/v1/fetch-news',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5dWV0enpyeWJuc3R4dHB2Zm91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NDAwOTEsImV4cCI6MjA5NDAxNjA5MX0.7J1NblzbBwzQkZXuuNA-tJyjUfI2b_BUIGkmB_-fN1g"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
