-- Stores phone numbers collected from the public, no-login ATS check
-- page (/ats-check). No OTP/verification — phone is stored as typed.
CREATE TABLE IF NOT EXISTS public.ats_check_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  file_name text,
  ats_score integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ats_check_leads ENABLE ROW LEVEL SECURITY;

-- Only superadmins can read leads (via the admin dashboard / service role).
CREATE POLICY "Superadmins can view ats_check_leads"
  ON public.ats_check_leads FOR SELECT
  USING (is_superadmin(auth.uid()));

-- No client-side INSERT policy: this table is only written to via the
-- checkAtsScore server function using the service-role client, since the
-- page is public/anonymous and we don't want anon-role direct table access.
REVOKE ALL ON public.ats_check_leads FROM anon, authenticated;
