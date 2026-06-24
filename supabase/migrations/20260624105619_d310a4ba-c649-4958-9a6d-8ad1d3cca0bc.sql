DROP POLICY IF EXISTS "users see their own topups" ON public.topup_requests;
CREATE POLICY "users see own topups and reviewers see tenant topups"
ON public.topup_requests
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_tenant_admin(auth.uid(), tenant_id)
  OR public.is_superadmin(auth.uid())
  OR public.has_permission(auth.uid(), 'review_topups')
);

DROP POLICY IF EXISTS "admins update topups" ON public.topup_requests;
CREATE POLICY "reviewers update tenant topups"
ON public.topup_requests
FOR UPDATE
TO authenticated
USING (
  public.is_tenant_admin(auth.uid(), tenant_id)
  OR public.is_superadmin(auth.uid())
  OR public.has_permission(auth.uid(), 'review_topups')
)
WITH CHECK (
  public.is_tenant_admin(auth.uid(), tenant_id)
  OR public.is_superadmin(auth.uid())
  OR public.has_permission(auth.uid(), 'review_topups')
);

DROP POLICY IF EXISTS "conv_select" ON public.conversations;
CREATE POLICY "conv_select"
ON public.conversations
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR (
    tenant_id = public.get_user_tenant(auth.uid())
    AND (
      public.is_tenant_admin(auth.uid(), tenant_id)
      OR public.is_superadmin(auth.uid())
      OR (kind = 'support' AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.tenant_id = conversations.tenant_id
          AND ur.role = 'moderator'
      ))
      OR (kind = 'credit' AND public.has_permission(auth.uid(), 'review_topups'))
    )
  )
);

DROP POLICY IF EXISTS "msg_select" ON public.conversation_messages;
CREATE POLICY "msg_select"
ON public.conversation_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_messages.conversation_id
      AND (
        c.owner_id = auth.uid()
        OR (
          c.tenant_id = public.get_user_tenant(auth.uid())
          AND (
            public.is_tenant_admin(auth.uid(), c.tenant_id)
            OR public.is_superadmin(auth.uid())
            OR (c.kind = 'support' AND EXISTS (
              SELECT 1 FROM public.user_roles ur
              WHERE ur.user_id = auth.uid()
                AND ur.tenant_id = c.tenant_id
                AND ur.role = 'moderator'
            ))
            OR (c.kind = 'credit' AND public.has_permission(auth.uid(), 'review_topups'))
          )
        )
      )
  )
);