import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buildBotSystem, fetchBotPricing } from "./ai-gateway.server";
import { geminiGenerateText } from "./gemini.server";
import { openRouterGenerateText } from "./openrouter.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function callBot(
  history: { role: "user" | "assistant"; content: string }[],
  lang: string | undefined,
  audience: "guest" | "user",
) {
  const lastUser = [...history].reverse().find((h) => h.role === "user")?.content;
  const pricing = await fetchBotPricing();
  const bilingualHint =
    "Detect the user's language automatically. Reply in Arabic if the user wrote Arabic, otherwise reply in English. Be warm, concise, and guide the user step-by-step through the platform (login, CV creation, jobs, billing, top-up).";
  const system = `${buildBotSystem(lang, lastUser, { audience, ...pricing })}\n\n${bilingualHint}`;
  const messages = history.slice(-12);
  try {
    return await openRouterGenerateText({
      system,
      messages,
      temperature: 0.7,
      maxOutputTokens: 2048,
    });
  } catch (openRouterErr: any) {
    console.error("OpenRouter bot call failed, trying direct Gemini fallback:", openRouterErr?.message);
    return await geminiGenerateText({
      system,
      messages,
      temperature: 0.7,
      maxOutputTokens: 2048,
    });
  }
}

export const triggerSupportBotReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversation_id: string; lang?: string }) =>
    z.object({ conversation_id: z.string().uuid(), lang: z.string().max(8).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conv } = await supabaseAdmin
      .from("conversations" as any)
      .select("id, kind, bot_enabled, owner_id, tenant_id")
      .eq("id", data.conversation_id)
      .maybeSingle();
    if (!conv) return { ok: false, reason: "not_found" };
    const c = conv as any;
    // Respect the staff "bot on/off" toggle, but only for support conversations
    // (credit conversations don't expose this toggle and should always get a bot reply).
    if (c.kind === "support" && c.bot_enabled === false) {
      return { ok: false, reason: "disabled" };
    }
    if (c.owner_id !== context.userId) {
      const { data: isAdmin } = await context.supabase.rpc("is_tenant_admin", {
        _user_id: context.userId,
        _tenant_id: c.tenant_id,
      });
      if (!isAdmin) return { ok: false, reason: "forbidden" };
    }
    const { data: msgs } = await supabaseAdmin
      .from("conversation_messages" as any)
      .select("body, kind, sender_id")
      .eq("conversation_id", c.id)
      .order("created_at", { ascending: true })
      .limit(20);
    const history = ((msgs ?? []) as any[])
      .filter((m) => m.body && m.kind !== "system")
      .map((m) => ({
        role: m.sender_id === c.owner_id ? ("user" as const) : ("assistant" as const),
        content: m.body as string,
      }));
    if (history.length === 0 || history[history.length - 1].role !== "user") {
      return { ok: false, reason: "no_user_msg" };
    }
    let reply: string;
    try {
      reply = await callBot(history, data.lang, "user");
    } catch (e: any) {
      console.error("bot error", e?.message);
      return { ok: false, reason: "ai_error" };
    }
    await supabaseAdmin.rpc("chat_insert_bot_reply" as any, {
      _conversation_id: c.id,
      _body: reply,
      _is_guest: false,
    });
    return { ok: true };
  });
