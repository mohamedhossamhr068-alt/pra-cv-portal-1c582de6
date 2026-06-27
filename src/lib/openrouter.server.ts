/**
 * OpenRouter fallback — used ONLY if the direct Gemini call (gemini.server.ts)
 * fails (e.g. Google Cloud billing/prepay not configured on the project).
 * OpenRouter is OpenAI-compatible and can route to Gemini itself or to other
 * free models, so this acts as a safety net without changing the primary
 * provider. Requires OPENROUTER_API_KEY.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Free-tier auto-router on OpenRouter: automatically picks from currently
// available free models based on the request, so this stays working even
// if a specific free model slug gets removed or renamed over time.
const DEFAULT_MODEL = "openrouter/free";

export type OpenRouterMessage = { role: "user" | "assistant"; content: string };

export type OpenRouterOptions = {
  system?: string;
  prompt?: string;
  messages?: OpenRouterMessage[];
  jsonMode?: boolean;
  maxOutputTokens?: number;
  temperature?: number;
  model?: string;
};

function getKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not configured");
  return key;
}

export async function openRouterGenerateText(opts: OpenRouterOptions): Promise<string> {
  const key = getKey();
  const model = opts.model || DEFAULT_MODEL;

  const messages: { role: string; content: string }[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  if (opts.messages?.length) {
    for (const m of opts.messages) messages.push({ role: m.role, content: m.content });
  }
  if (opts.prompt) messages.push({ role: "user", content: opts.prompt });
  if (messages.length === 0) {
    throw new Error("openRouterGenerateText: no prompt or messages provided");
  }

  const body: any = {
    model,
    messages,
    temperature: opts.temperature ?? 0.6,
    max_tokens: opts.maxOutputTokens ?? 4096,
  };
  if (opts.jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${errText.slice(0, 500)}`);
  }
  const json: any = await res.json();
  const text = json?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("OpenRouter returned an empty response");
  return text;
}
