import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * One-time/standalone way for an existing admin (super or company admin) to
 * set a password on their account, without needing to be logged in first.
 * Protected by ADMIN_SETUP_SECRET (a fixed value the operator configures via
 * env vars), NOT by a logged-in session — this is intentional, since the
 * whole point is to recover access for an account that currently has no
 * usable password (e.g. it was created via Google sign-in only).
 */
export const adminSetOwnPassword = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        secret: z.string().min(1),
        email: z.string().trim().toLowerCase().email(),
        new_password: z.string().min(8).max(128),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const expected = process.env.ADMIN_SETUP_SECRET;
    if (!expected) {
      throw new Error("ADMIN_SETUP_SECRET is not configured on the server.");
    }
    if (data.secret !== expected) {
      throw new Error("Invalid secret key.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles" as any)
      .select("id, email")
      .eq("email", data.email)
      .maybeSingle();
    if (!profile) {
      throw new Error("No account found with this email.");
    }
    const userId = (profile as any).id as string;

    const { data: roles } = await supabaseAdmin
      .from("user_roles" as any)
      .select("role")
      .eq("user_id", userId)
      .in("role", ["superadmin", "company_admin"]);
    if (!roles || roles.length === 0) {
      throw new Error("This account is not an admin.");
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: data.new_password,
    });
    if (error) throw new Error(error.message);

    return { ok: true };
  });
