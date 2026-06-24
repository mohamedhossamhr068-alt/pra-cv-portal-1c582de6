import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const FilterSchema = z.object({
  category: z.enum(["all", "cv", "stripe", "ai", "topup", "admin"]).optional().default("all"),
  status: z.enum(["all", "success", "failure", "info"]).optional().default("all"),
  search: z.string().max(120).optional().default(""),
  limit: z.number().int().min(1).max(500).optional().default(200),
});

export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FilterSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    if (!prof?.tenant_id) return [];
    const { data: isAdmin } = await supabase.rpc("is_tenant_admin", {
      _user_id: userId, _tenant_id: prof.tenant_id,
    });
    if (!isAdmin) throw new Error("Forbidden");

    let q = supabase
      .from("audit_logs")
      .select("id,actor_id,action,target,status,link,metadata,created_at")
      .eq("tenant_id", prof.tenant_id)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.status !== "all") q = q.eq("status", data.status);

    if (data.category !== "all") {
      const prefixes: Record<string, string[]> = {
        cv: ["cv."],
        stripe: ["stripe.", "payment."],
        ai: ["ai."],
        topup: ["topup."],
        admin: ["admin."],
      };
      const prefs = prefixes[data.category] ?? [];
      if (prefs.length) {
        const or = prefs.map((p) => `action.ilike.${p}%`).join(",");
        q = q.or(or);
      }
    }

    if (data.search.trim()) {
      const s = data.search.trim();
      q = q.or(`action.ilike.%${s}%,target.ilike.%${s}%`);
    }

    const { data: rows, error } = await q;
    if (error) throw error;

    const actorIds = Array.from(new Set((rows ?? []).map((r) => r.actor_id).filter(Boolean) as string[]));
    let actors = new Map<string, { full_name: string | null; email: string | null }>();
    if (actorIds.length) {
      const { data: profs } = await supabase
        .from("profiles").select("id,full_name,email").in("id", actorIds);
      actors = new Map((profs ?? []).map((p: any) => [p.id, { full_name: p.full_name, email: p.email }]));
    }

    return (rows ?? []).map((r) => ({
      ...r,
      actor: r.actor_id ? actors.get(r.actor_id) ?? null : null,
    }));
  });
