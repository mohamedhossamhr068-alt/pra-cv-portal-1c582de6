
ALTER TABLE public.ats_check_leads
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS file_size integer,
  ADD COLUMN IF NOT EXISTS analysis jsonb,
  ADD COLUMN IF NOT EXISTS locale text DEFAULT 'en';

DROP POLICY IF EXISTS "Admins read ats leads" ON public.ats_check_leads;
CREATE POLICY "Admins read ats leads"
  ON public.ats_check_leads FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'superadmin')
    OR public.has_role(auth.uid(), 'company_admin')
    OR public.has_role(auth.uid(), 'moderator')
  );

DROP POLICY IF EXISTS "Admins delete ats leads" ON public.ats_check_leads;
CREATE POLICY "Admins delete ats leads"
  ON public.ats_check_leads FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'superadmin')
    OR public.has_role(auth.uid(), 'company_admin')
  );

DROP POLICY IF EXISTS "Admins read ats uploads" ON storage.objects;
CREATE POLICY "Admins read ats uploads"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'ats-uploads'
    AND (
      public.has_role(auth.uid(), 'superadmin')
      OR public.has_role(auth.uid(), 'company_admin')
      OR public.has_role(auth.uid(), 'moderator')
    )
  );

DROP POLICY IF EXISTS "Admins delete ats uploads" ON storage.objects;
CREATE POLICY "Admins delete ats uploads"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'ats-uploads'
    AND (
      public.has_role(auth.uid(), 'superadmin')
      OR public.has_role(auth.uid(), 'company_admin')
    )
  );
