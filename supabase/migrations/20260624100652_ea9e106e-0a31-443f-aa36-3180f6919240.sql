ALTER TABLE public.profiles ALTER COLUMN credits SET DEFAULT 3;

UPDATE public.profiles p
SET credits = 3
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = p.id AND ur.role IN ('company_admin','superadmin','moderator')
);