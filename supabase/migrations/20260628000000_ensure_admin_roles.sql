-- Ensures the known admin accounts are approved and have the superadmin
-- role. This is idempotent (safe to run multiple times) and protects
-- against admin access being silently lost if the Supabase project is
-- ever migrated again (as happened on 2026-06-27, which is why this
-- migration exists — the previous role/approval state was not preserved
-- in version control).

DO $$
DECLARE
  admin_email text;
  admin_emails text[] := ARRAY['mh281509@gmail.com', 'mohamedhossamhr068@gmail.com'];
  target_user_id uuid;
BEGIN
  FOREACH admin_email IN ARRAY admin_emails LOOP
    SELECT id INTO target_user_id FROM auth.users WHERE email = admin_email;

    IF target_user_id IS NOT NULL THEN
      UPDATE public.profiles
      SET is_approved = true, approved_at = now()
      WHERE id = target_user_id AND (is_approved IS DISTINCT FROM true);

      IF NOT EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = target_user_id AND role = 'superadmin'
      ) THEN
        INSERT INTO public.user_roles (user_id, role) VALUES (target_user_id, 'superadmin');
      END IF;
    END IF;
    -- If target_user_id is NULL, the user hasn't signed up yet on this
    -- project — nothing to do; this will simply take effect next time
    -- this migration (or a copy of it) runs after they do.
  END LOOP;
END $$;
