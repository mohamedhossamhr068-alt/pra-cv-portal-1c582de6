
-- 1) Default credit rate: 1 credit = 50 EGP  => 0.02 credit per EGP
ALTER TABLE public.wallet_settings ALTER COLUMN credits_per_egp SET DEFAULT 0.02;
UPDATE public.wallet_settings SET credits_per_egp = 0.02 WHERE credits_per_egp = 1;

-- 2) Offers table
CREATE TABLE public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  discount_percent NUMERIC NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  code TEXT,
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.offers TO authenticated;
GRANT ALL ON public.offers TO service_role;

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view offers"
ON public.offers FOR SELECT TO authenticated
USING (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Tenant admins can insert offers"
ON public.offers FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant(auth.uid())
  AND public.is_tenant_admin(auth.uid(), tenant_id)
);

CREATE POLICY "Tenant admins can update offers"
ON public.offers FOR UPDATE TO authenticated
USING (
  tenant_id = public.get_user_tenant(auth.uid())
  AND public.is_tenant_admin(auth.uid(), tenant_id)
);

CREATE POLICY "Tenant admins can delete offers"
ON public.offers FOR DELETE TO authenticated
USING (
  tenant_id = public.get_user_tenant(auth.uid())
  AND public.is_tenant_admin(auth.uid(), tenant_id)
);

CREATE TRIGGER offers_set_updated_at
BEFORE UPDATE ON public.offers
FOR EACH ROW EXECUTE FUNCTION public._touch_payment_methods();

-- 3) Notify all tenant users when a new offer is created
CREATE OR REPLACE FUNCTION public.notify_offer_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  _body TEXT;
BEGIN
  IF NEW.is_active IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  _body := COALESCE(NEW.description, '') ||
           CASE WHEN NEW.discount_percent > 0
                THEN ' — خصم ' || NEW.discount_percent::text || '%'
                ELSE '' END ||
           CASE WHEN NEW.code IS NOT NULL AND NEW.code <> ''
                THEN ' — كود: ' || NEW.code
                ELSE '' END;
  FOR r IN
    SELECT id FROM public.profiles WHERE tenant_id = NEW.tenant_id
  LOOP
    PERFORM public.push_notification(
      r.id,
      'offer_created',
      'عرض جديد: ' || NEW.title,
      _body,
      '/billing',
      jsonb_build_object('offer_id', NEW.id, 'discount_percent', NEW.discount_percent, 'code', NEW.code)
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER offers_notify_after_insert
AFTER INSERT ON public.offers
FOR EACH ROW EXECUTE FUNCTION public.notify_offer_created();
