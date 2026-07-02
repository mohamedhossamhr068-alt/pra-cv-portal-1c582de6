import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertStaff(supabase: any, userId: string) {
  const [{ data: isSuper }, { data: isAdmin }, { data: isMod }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "superadmin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "company_admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "moderator" }),
  ]);
  if (!isSuper && !isAdmin && !isMod) throw new Error("Forbidden");
  return { isSuper: !!isSuper, isAdmin: !!isAdmin };
}

export const listAtsChecks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("ats_check_leads" as any)
      .select("id, phone, file_name, file_size, file_path, ats_score, analysis, locale, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as any[];
    const uniquePhones = new Set(rows.map((r) => r.phone).filter(Boolean));
    return {
      total: rows.length,
      uniquePhones: uniquePhones.size,
      rows,
    };
  });

export const getAtsFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ file_path: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data: signed, error } = await context.supabase.storage
      .from("ats-uploads")
      .createSignedUrl(data.file_path, 60 * 10);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

export const deleteAtsCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { isSuper, isAdmin } = await assertStaff(context.supabase, context.userId);
    if (!isSuper && !isAdmin) throw new Error("Forbidden");
    const { data: row } = await context.supabase
      .from("ats_check_leads" as any)
      .select("file_path")
      .eq("id", data.id)
      .maybeSingle();
    const filePath = (row as any)?.file_path as string | null | undefined;
    if (filePath) {
      await context.supabase.storage.from("ats-uploads").remove([filePath]);
    }
    const { error } = await context.supabase.from("ats_check_leads" as any).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
