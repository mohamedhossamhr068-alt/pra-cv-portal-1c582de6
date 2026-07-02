/**
 * OpenRouter — sole AI provider.
 * Primary model: meta-llama/llama-3.1-8b-instruct:free
 * Fallback models tried in order if primary is rate-limited (429).
 * Requires OPENROUTER_API_KEY in environment variables.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const MODEL_CHAIN = [
  "meta-llama/llama-3.1-8b-instruct:free",
  "mistralai/mistral-7b-instruct:free",
  "google/gemma-3-27b-it:free",
  "microsoft/phi-3-mini-128k-instruct:free",
  "openrouter/auto",
];

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

async function callModel(key: string, model: string, opts: OpenRouterOptions): Promise<string> {
  const messages: { role: string; content: string }[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  if (opts.messages?.length) {
    for (const m of opts.messages) messages.push({ role: m.role, content: m.content });
  }
  if (opts.prompt) messages.push({ role: "user", content: opts.prompt });
  if (messages.length === 0) throw new Error("openRouterGenerateText: no prompt or messages provided");

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
      "HTTP-Referer": "https://pra-cv-portal.lovable.app",
      "X-Title": "PRA Career Portal",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After");
    throw Object.assign(new Error(`RATE_LIMIT:${retryAfter ?? "30"}`), { status: 429 });
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${errText.slice(0, 500)}`);
  }

  const json: any = await res.json();
  const text = json?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("OpenRouter returned an empty response");
  return text;
}

/**
 * Tries each model in MODEL_CHAIN until one succeeds.
 * Skips 429 rate-limited models automatically.
 */
export async function openRouterGenerateText(opts: OpenRouterOptions): Promise<string> {
  const key = getKey();
  const models = opts.model ? [opts.model, ...MODEL_CHAIN] : MODEL_CHAIN;

  let lastError: any;
  for (const model of models) {
    try {
      console.log(`[OpenRouter] Trying model: ${model}`);
      const result = await callModel(key, model, opts);
      console.log(`[OpenRouter] Success with model: ${model}`);
      return result;
    } catch (err: any) {
      lastError = err;
      if (err?.status === 429 || err?.message?.startsWith("RATE_LIMIT:")) {
        console.warn(`[OpenRouter] Model ${model} rate-limited, trying next...`);
        continue;
      }
      // Non-429 error — still try next model
      console.warn(`[OpenRouter] Model ${model} failed: ${err?.message}, trying next...`);
    }
  }

  throw new Error(
    `All AI models are currently busy. Please try again in a moment. (${lastError?.message ?? "unknown"})`,
  );
}
