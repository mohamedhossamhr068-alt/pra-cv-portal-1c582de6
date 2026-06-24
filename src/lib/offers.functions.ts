import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listActiveOffers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    if (!prof?.tenant_id) return [];
    const { data, error } = await supabase
      .from("offers" as any).select("*")
      .eq("tenant_id", prof.tenant_id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("listActiveOffers error", error);
      return [];
    }
    const now = Date.now();
    return ((data as any[]) ?? []).filter(
      (o) => !o.valid_until || new Date(o.valid_until).getTime() > now,
    );
  });

export const listAllOffers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    if (!prof?.tenant_id) return [];
    const { data } = await supabase
      .from("offers" as any).select("*")
      .eq("tenant_id", prof.tenant_id)
      .order("created_at", { ascending: false });
    return (data as any[]) ?? [];
  });

const offerSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(500).optional().default(""),
  discount_percent: z.number().min(0).max(100).default(0),
  code: z.string().max(40).optional().default(""),
  valid_until: z.string().optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

export const createOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => offerSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    if (!prof?.tenant_id) throw new Error("NO_TENANT");
    const { error } = await supabase.from("offers" as any).insert({
      tenant_id: prof.tenant_id,
      title: data.title,
      description: data.description || null,
      discount_percent: data.discount_percent,
      code: data.code || null,
      valid_until: data.valid_until || null,
      is_active: data.is_active ?? true,
      created_by: userId,
    } as any);
    if (error) throw error;
    return { ok: true };
  });

export const toggleOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("offers" as any).update({ is_active: data.is_active }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("offers" as any).delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
