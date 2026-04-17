CREATE OR REPLACE FUNCTION public.list_cron_jobs()
RETURNS TABLE(jobname text, schedule text, active boolean, command text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, cron
AS $$
  SELECT jobname::text, schedule::text, active, command::text
  FROM cron.job
  ORDER BY jobname;
$$;

REVOKE ALL ON FUNCTION public.list_cron_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_cron_jobs() TO authenticated;