-- Daily Egypt job scrape: schedule pg_cron to call the public cron endpoint at 06:00 UTC (08:00 Cairo).
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop any prior schedule with the same name to keep this migration idempotent.
DO $$
BEGIN
  PERFORM cron.unschedule('scrape-egypt-jobs-daily');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'scrape-egypt-jobs-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://pra-cv-portal.lovable.app/api/public/cron/scrape-egypt-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1bW1uZWhwcHB3ZW9iYWFicWluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMjEyODksImV4cCI6MjA5Nzc5NzI4OX0.Y_c-MrnBs3xhyVWAfst0XtnQF3u2blMKY4wigaVl4DI'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Notify the user via in-app notification when their account is approved
-- (auto-refresh on the pending page picks this up immediately).
CREATE OR REPLACE FUNCTION public.notify_user_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_approved = true AND COALESCE(OLD.is_approved, false) = false THEN
    INSERT INTO public.notifications (user_id, tenant_id, type, title, body, link, metadata)
    VALUES (
      NEW.id,
      NEW.tenant_id,
      'account_approved',
      'تم تفعيل حسابك',
      'مرحباً بك! حسابك الآن مفعّل ويمكنك استخدام جميع المزايا.',
      '/dashboard',
      jsonb_build_object('email', NEW.email)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_notify_on_approval ON public.profiles;
CREATE TRIGGER profiles_notify_on_approval
  AFTER UPDATE OF is_approved ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_user_on_approval();