/**
 * Google Gemini is the SOLE AI provider for this project.
 * All chat, CV generation, analysis, and translation routes go through here.
 * No Lovable AI Gateway, no fallback — GEMINI_API_KEY only.
 */

const DEFAULT_MODEL = "gemini-2.0-flash";

export type GeminiMessage = { role: "user" | "assistant"; content: string };

export type GeminiOptions = {
  system?: string;
  prompt?: string;
  messages?: GeminiMessage[];
  jsonMode?: boolean;
  maxOutputTokens?: number;
  temperature?: number;
  model?: string;
};

function getKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  return key;
}

export async function geminiGenerateText(opts: GeminiOptions): Promise<string> {
  const key = getKey();
  const model = opts.model || DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

  const contents: any[] = [];
  if (opts.messages?.length) {
    for (const m of opts.messages) {
      contents.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      });
    }
  }
  if (opts.prompt) {
    contents.push({ role: "user", parts: [{ text: opts.prompt }] });
  }
  if (contents.length === 0) {
    throw new Error("geminiGenerateText: no prompt or messages provided");
  }

  const body: any = {
    contents,
    generationConfig: {
      temperature: opts.temperature ?? 0.6,
      maxOutputTokens: opts.maxOutputTokens ?? 4096,
    },
  };
  if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };
  if (opts.jsonMode) body.generationConfig.responseMimeType = "application/json";

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${errText.slice(0, 500)}`);
  }
  const json: any = await res.json();
  const text =
    json?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p?.text)
      .filter(Boolean)
      .join("") ?? "";
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}
