import { createFileRoute } from "@tanstack/react-router";

/**
 * Public daily cron endpoint to refresh Egypt job listings.
 * Called by pg_cron with the project's anon `apikey` header.
 * Iterates a curated list of common Egyptian job keywords across multiple
 * Egypt-only sources via Firecrawl, then upserts into `job_listings`.
 */

const SOURCES: { host: string; source: string }[] = [
  { host: "wuzzuf.net", source: "wuzzuf" },
  { host: "linkedin.com/jobs", source: "linkedin" },
  { host: "bayt.com", source: "bayt" },
  { host: "forasna.com", source: "forasna" },
  { host: "naukrigulf.com", source: "naukrigulf" },
];

const DEFAULT_KEYWORDS = [
  "software engineer",
  "frontend developer",
  "backend developer",
  "mobile developer",
  "sales",
  "marketing",
  "accountant",
  "customer service",
  "graphic designer",
  "data analyst",
  "hr",
  "project manager",
];

function isSafeHttpUrl(u: string) {
  try { const p = new URL(u); return p.protocol === "https:" || p.protocol === "http:"; } catch { return false; }
}
function isEgyptUrl(u: string) {
  return /(\/eg\/|\/egypt|egypt|cairo|alexandria|giza|wuzzuf\.net)/i.test(u);
}
function logoFor(url: string, source: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return `https://logo.clearbit.com/${host}`;
  } catch { return `https://logo.clearbit.com/${source}.com`; }
}
function guessCompany(title: string, url: string) {
  const m = title.match(/\bat\s+([A-Z][\w&. -]{2,})/);
  if (m) return m[1].trim();
  try { return new URL(url).hostname.replace(/^www\./, "").split(".")[0]; } catch { return "Unknown"; }
}
function extractSkills(text: string): string[] {
  const k = ["React","Node.js","Python","Java","TypeScript","JavaScript","SQL","AWS","Docker","Kubernetes","Flutter","Swift","Kotlin","Figma","Photoshop","SEO","Marketing","Sales","Excel","Power BI","Arabic","English","Agile","Scrum","REST","GraphQL","Next.js","Vue","Angular","PHP","Laravel","Django","MongoDB","PostgreSQL"];
  const lower = text.toLowerCase();
  return k.filter((x) => lower.includes(x.toLowerCase())).slice(0, 8);
}

export const Route = createFileRoute("/api/public/cron/scrape-egypt-jobs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Require Supabase anon key as `apikey` header (pg_cron sends this).
        const apikey = request.headers.get("apikey") ?? request.headers.get("Apikey") ?? "";
        if (!apikey || apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }
        const fcKey = process.env.FIRECRAWL_API_KEY;
        if (!fcKey) return new Response("Firecrawl not configured", { status: 500 });

        const collected: any[] = [];
        for (const kw of DEFAULT_KEYWORDS) {
          for (const { host, source } of SOURCES) {
            try {
              const res = await fetch("https://api.firecrawl.dev/v2/search", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${fcKey}` },
                body: JSON.stringify({ query: `site:${host} "${kw}" Egypt`, limit: 5, lang: "en", country: "eg", location: "Egypt" }),
              });
              if (!res.ok) continue;
              const json = await res.json();
              const results = json?.data?.web ?? json?.data ?? [];
              for (const r of results) {
                if (!r?.url || !r?.title) continue;
                if (!isSafeHttpUrl(String(r.url))) continue;
                if (!isEgyptUrl(String(r.url))) continue;
                const desc = String(r.description ?? r.snippet ?? r.markdown ?? "");
                if (/\b(saudi|riyadh|jeddah|dubai|abu dhabi|qatar|kuwait|oman|bahrain|usa|united states|uk|london)\b/i.test(`${r.title} ${desc}`)) continue;
                collected.push({
                  title: String(r.title).slice(0, 200),
                  company: guessCompany(String(r.title), String(r.url)),
                  description: desc.slice(0, 500),
                  external_url: String(r.url),
                  source,
                  company_logo: logoFor(String(r.url), source),
                  skills: extractSkills(`${r.title} ${desc}`),
                  seniority: /senior|lead|principal/i.test(r.title) ? "senior" : /junior|entry|intern/i.test(r.title) ? "junior" : "mid",
                  location: "Egypt",
                  country: "EG",
                  employment_type: /remote/i.test(`${r.title} ${desc}`) ? "Remote" : "Full-time",
                  industry: source,
                  posted_at: new Date().toISOString(),
                });
              }
            } catch { /* swallow per-query */ }
          }
        }

        if (collected.length === 0) {
          return Response.json({ ok: true, inserted: 0, note: "No results" });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("job_listings")
          .upsert(collected, { onConflict: "external_url", ignoreDuplicates: false });
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ ok: true, inserted: collected.length });
      },
    },
  },
});
