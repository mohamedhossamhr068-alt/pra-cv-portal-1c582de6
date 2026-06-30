import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateTextWithFallback, extractJsonObject } from "./cv.functions";

const AtsCheckInput = z.object({
  phone: z.string().min(5).max(20),
  fileName: z.string().min(1).max(200),
  fileType: z.enum(["pdf", "docx"]),
  base64: z.string().min(1).max(8_000_000),
  locale: z.enum(["en", "ar"]).default("en"),
});

const AtsResultSchema = z.object({
  score: z.number().min(0).max(100),
  summary: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  missingKeywords: z.array(z.string()).optional().default([]),
  formattingIssues: z.array(z.string()).optional().default([]),
  recommendations: z.array(z.string()),
});

export type AtsResult = z.infer<typeof AtsResultSchema>;

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const { getDocumentProxy, extractText } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const result = await mammoth.extractRawText({ arrayBuffer } as any);
  return result.value;
}

// Public server function — no auth middleware. Anyone can use it.
export const checkAtsScore = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => AtsCheckInput.parse(d))
  .handler(async ({ data }) => {
    let bytes: Uint8Array;
    try {
      bytes = base64ToUint8Array(data.base64);
    } catch {
      throw new Error("Could not read the uploaded file.");
    }

    let rawText: string;
    try {
      rawText = data.fileType === "pdf"
        ? await extractPdfText(bytes)
        : await extractDocxText(bytes);
    } catch (e: any) {
      console.error("ATS extraction failed:", e?.message);
      throw new Error(
        data.fileType === "pdf"
          ? "Could not read this PDF. It may be scanned/image-only or password-protected."
          : "Could not read this Word document. Make sure it's a valid .docx file.",
      );
    }

    rawText = rawText.trim();
    if (rawText.length < 50) {
      throw new Error("This file doesn't contain enough readable text to analyze.");
    }

    const trimmedText = rawText.slice(0, 12000);
    const ar = data.locale === "ar";
    const langInstr = ar
      ? "Write the entire analysis in Modern Standard Arabic."
      : "Write the entire analysis in English.";

    const text = await generateTextWithFallback({
      maxOutputTokens: 4096,
      jsonMode: true,
      system: `You are an expert ATS (Applicant Tracking System) and recruiting analyst. Evaluate the CV the way a real ATS parser plus a senior recruiter would. Return ONLY one valid JSON object — no markdown, no prose outside JSON.
${langInstr}
Score (0–100) based on: section clarity, contact info presence, quantified achievements, action verbs, keyword relevance, formatting/parsing risks (tables, columns, headers/footers that ATS systems often fail to parse), and completeness. Be honest — do not inflate the score.`,
      prompt: `Raw extracted CV text:
"""
${trimmedText}
"""

Return exactly this JSON shape:
{
  "score": number (0-100),
  "summary": "2-3 sentence overall verdict",
  "strengths": ["string", ...],
  "weaknesses": ["string", ...],
  "missingKeywords": ["string", ...],
  "formattingIssues": ["string", ...],
  "recommendations": ["string", ...]
}`,
    });

    const result = AtsResultSchema.parse(extractJsonObject(text));

    // Store lead (phone + score) via service role — no client auth needed.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("ats_check_leads" as any).insert({
        phone: data.phone.trim(),
        file_name: data.fileName,
        ats_score: result.score,
      });
    } catch (e) {
      // Non-fatal — don't block the user if lead storage fails.
      console.error("Failed to store ATS lead:", e);
    }

    return result;
  });
