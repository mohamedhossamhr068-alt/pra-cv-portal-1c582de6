-- Restores reserve_cv_generation() and refund_cv_generation(), referenced by
-- src/lib/cv.functions.ts but missing from version control (the original
-- migration, mentioned only in a code comment as
-- 20260625120000_fix_credit_race_condition.sql, was applied directly to the
-- database and never committed to the repo, so it was lost).
--
-- Behavior matches what the application code expects:
--  - reserve_cv_generation: atomically checks is_blocked, available credits,
--    and the monthly plan quota, then deducts credits and bumps the quota
--    counter in a single locked transaction (SECURITY DEFINER + row lock)
--    to avoid race conditions from double-clicks / multiple tabs.
--  - refund_cv_generation: reverses a reservation (credits + quota) when a
--    CV generation fails after the reservation succeeded.

CREATE OR REPLACE FUNCTION public.reserve_cv_generation(
  _user_id uuid,
  _tenant_id uuid,
  _period_month text,
  _plan_limit integer
)
RETURNS TABLE(credits_left integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cost integer;
  _current_credits integer;
  _is_blocked boolean;
  _used integer;
BEGIN
  -- Lock the profile row first so concurrent requests for the same user
  -- serialize here instead of racing on a stale credits value.
  SELECT credits, is_blocked INTO _current_credits, _is_blocked
  FROM public.profiles
  WHERE id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  IF _is_blocked THEN
    RAISE EXCEPTION 'ACCOUNT_BLOCKED';
  END IF;

  -- Resolve the per-CV credit cost (tenant override, default 5).
  IF _tenant_id IS NOT NULL THEN
    SELECT cv_credit_cost INTO _cost FROM public.tenants WHERE id = _tenant_id;
  END IF;
  _cost := COALESCE(_cost, 5);

  IF _current_credits < _cost THEN
    RAISE EXCEPTION 'NO_CREDITS';
  END IF;

  -- Lock (or create) this month's quota row for this user, then check the
  -- monthly plan limit.
  INSERT INTO public.usage_quotas (user_id, tenant_id, period_month, cv_generations_used)
  VALUES (_user_id, _tenant_id, _period_month, 0)
  ON CONFLICT (user_id, period_month) DO NOTHING;

  SELECT cv_generations_used INTO _used
  FROM public.usage_quotas
  WHERE user_id = _user_id AND period_month = _period_month
  FOR UPDATE;

  IF _used >= _plan_limit THEN
    RAISE EXCEPTION 'QUOTA_REACHED';
  END IF;

  -- Deduct credits and bump quota usage atomically.
  UPDATE public.profiles
  SET credits = credits - _cost
  WHERE id = _user_id
  RETURNING credits INTO _current_credits;

  UPDATE public.usage_quotas
  SET cv_generations_used = cv_generations_used + 1,
      updated_at = now()
  WHERE user_id = _user_id AND period_month = _period_month;

  RETURN QUERY SELECT _current_credits;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_cv_generation(uuid, uuid, text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.refund_cv_generation(
  _user_id uuid,
  _tenant_id uuid,
  _period_month text,
  _cost integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET credits = credits + COALESCE(_cost, 5)
  WHERE id = _user_id;

  UPDATE public.usage_quotas
  SET cv_generations_used = GREATEST(0, cv_generations_used - 1),
      updated_at = now()
  WHERE user_id = _user_id AND period_month = _period_month;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refund_cv_generation(uuid, uuid, text, integer) TO authenticated;
