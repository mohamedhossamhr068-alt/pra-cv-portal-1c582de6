
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS cv_quota_free integer NOT NULL DEFAULT 9999,
  ADD COLUMN IF NOT EXISTS cv_quota_pro integer NOT NULL DEFAULT 9999,
  ADD COLUMN IF NOT EXISTS cv_quota_business integer NOT NULL DEFAULT 9999;

CREATE OR REPLACE FUNCTION public.admin_update_cv_quota(
  _quota_free integer DEFAULT NULL,
  _quota_pro integer DEFAULT NULL,
  _quota_business integer DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = auth.uid();
  IF v_tenant IS NULL OR NOT public.is_tenant_admin(auth.uid(), v_tenant) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.tenants SET
    cv_quota_free = COALESCE(GREATEST(0, _quota_free), cv_quota_free),
    cv_quota_pro = COALESCE(GREATEST(0, _quota_pro), cv_quota_pro),
    cv_quota_business = COALESCE(GREATEST(0, _quota_business), cv_quota_business)
  WHERE id = v_tenant;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_cv_quota(integer,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_cv_quota(integer,integer,integer) TO authenticated;
