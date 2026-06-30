import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Admin / superadmin can reset a user's password. */
export const adminSetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        target_user: z.string().uuid(),
        new_password: z.string().min(8).max(128),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Authorize: superadmin OR tenant admin of the target user's tenant.
    const { data: isSuper } = await supabase.rpc("is_superadmin", { _user_id: userId });
    let allowed = !!isSuper;
    if (!allowed) {
      const { data: targetProf } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", data.target_user)
        .maybeSingle();
      if (targetProf?.tenant_id) {
        const { data: isAdmin } = await supabase.rpc("is_tenant_admin", {
          _user_id: userId,
          _tenant_id: targetProf.tenant_id,
        });
        allowed = !!isAdmin;
      }
    }
    if (!allowed) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.target_user, {
      password: data.new_password,
    });
    if (error) throw new Error(error.message);

    await supabase.rpc("log_audit" as any, {
      _action: "admin.password_reset",
      _status: "success",
      _target: data.target_user,
      _link: "/admin/users",
      _metadata: {} as any,
    });
    return { ok: true };
  });
