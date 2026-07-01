import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { checkAtsScore, type AtsResult } from "@/lib/ats-check.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Upload, FileText, Loader2, CheckCircle2,
  AlertTriangle, XCircle, Sparkles, Phone, ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/ats-check")({
  ssr: false,
  component: AtsCheckPage,
});

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-500";
  return "text-destructive";
}

function ScoreRing({ score }: { score: number }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <svg width="140" height="140" viewBox="0 0 140 140" className="mx-auto">
      <circle cx="70" cy="70" r={r} fill="none" stroke="currentColor" strokeWidth="12" className="text-muted" />
      <circle
        cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="12"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        transform="rotate(-90 70 70)"
      />
      <text x="70" y="78" textAnchor="middle" fontSize="32" fontWeight="700" fill={color}>{score}</text>
    </svg>
  );
}

export default function AtsCheckPage() {
  const { i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const fn = useServerFn(checkAtsScore);

  const [step, setStep] = useState<"phone" | "upload">("phone");
  const [phone, setPhone] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const mut = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error(ar ? "اختر ملفاً أولاً" : "Choose a file first");
      const ext = file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "docx";
      const base64 = await fileToBase64(file);
      return fn({ data: { phone, fileName: file.name, fileType: ext as "pdf" | "docx", base64, locale: ar ? "ar" : "en" } });
    },
    onError: (e: any) => toast.error(e?.message ?? (ar ? "فشل التحليل" : "Analysis failed")),
  });

  function handleFile(f: File | null) {
    if (!f) return;
    const isPdf = f.name.toLowerCase().endsWith(".pdf");
    const isDocx = f.name.toLowerCase().endsWith(".docx");
    if (!isPdf && !isDocx) {
      toast.error(ar ? "الملفات المدعومة: PDF أو Word (.docx) فقط" : "Supported files: PDF or .docx only");
      return;
    }
    if (f.size > 8_000_000) {
      toast.error(ar ? "الملف أكبر من 8MB" : "File is too large (max 8MB)");
      return;
    }
    setFile(f);
    mut.reset();
  }

  function submitPhone(e: React.FormEvent) {
    e.preventDefault();
    if (phone.trim().length < 5) {
      toast.error(ar ? "أدخل رقم هاتف صحيح" : "Enter a valid phone number");
      return;
    }
    setStep("upload");
  }

  const result = mut.data as AtsResult | undefined;

  return (
    <div className="relative min-h-screen bg-background" dir={ar ? "rtl" : "ltr"}>
      {/* Gradient backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-[image:var(--gradient-hero)] opacity-60" />

      <div className="relative z-10 mx-auto max-w-2xl px-4 py-10 sm:py-16">
        {/* Header */}
        <div className="mb-8 text-center text-white">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white/10 backdrop-blur ring-1 ring-white/20">
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            {ar ? "تحقق من نتيجة سيرتك الذاتية" : "ATS Score Checker"}
          </h1>
          <p className="mt-2 text-white/80">
            {ar
              ? "ارفع سيرتك الذاتية واحصل على تقييم فوري ومجاني لمدى توافقها مع أنظمة الفرز الآلي"
              : "Upload your CV and get an instant, free ATS compatibility analysis"}
          </p>
        </div>

        <Card className="border-white/20 bg-white/95 shadow-2xl backdrop-blur-xl dark:bg-card/95">
          <CardContent className="p-6">
            {/* ── Step 1: Phone ── */}
            {step === "phone" && (
              <form onSubmit={submitPhone} className="flex flex-col gap-4">
                <CardHeader className="p-0 pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Phone className="h-5 w-5 text-primary" />
                    {ar ? "أدخل رقم هاتفك" : "Enter your phone number"}
                  </CardTitle>
                  <CardDescription>
                    {ar
                      ? "رقمك بيساعدنا نتواصل معاك لو احتجت مساعدة في تحسين سيرتك"
                      : "We'll use this to follow up if you need help improving your CV"}
                  </CardDescription>
                </CardHeader>
                <div className="grid gap-1.5">
                  <Label htmlFor="phone">{ar ? "رقم الهاتف" : "Phone number"}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    dir="ltr"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+201001234567"
                    autoComplete="tel"
                    maxLength={20}
                    required
                  />
                </div>
                <Button type="submit" className="h-11 w-full">
                  {ar ? "متابعة" : "Continue"}
                </Button>
              </form>
            )}

            {/* ── Step 2: Upload ── */}
            {step === "upload" && (
              <div className="flex flex-col gap-5">
                <CardHeader className="p-0 pb-2">
                  <CardTitle className="text-lg">
                    {ar ? "ارفع سيرتك الذاتية" : "Upload your CV"}
                  </CardTitle>
                  <CardDescription>
                    {ar ? "PDF أو Word (.docx) — حتى 8 ميجابايت" : "PDF or Word (.docx) — up to 8MB"}
                  </CardDescription>
                </CardHeader>

                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0] ?? null); }}
                  onClick={() => fileRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                    dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                  }`}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.docx"
                    hidden
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  />
                  {file ? (
                    <>
                      <FileText className="h-8 w-8 text-primary" />
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm font-medium">
                        {ar ? "اسحب وأفلت الملف هنا، أو اضغط للاختيار" : "Drag & drop or click to choose a file"}
                      </p>
                    </>
                  )}
                </div>

                <Button onClick={() => mut.mutate()} disabled={!file || mut.isPending} className="h-11 w-full">
                  {mut.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {ar ? "جارٍ التحليل، انتظر لحظة…" : "Analyzing, please wait…"}
                    </>
                  ) : ar ? "تحليل السيرة الذاتية مجاناً" : "Analyze my CV — Free"}
                </Button>

                {/* Results */}
                {result && (
                  <div className="flex flex-col gap-6 border-t pt-6">
                    <div className="text-center">
                      <ScoreRing score={result.score} />
                      <p className={`mt-2 text-sm font-semibold ${scoreColor(result.score)}`}>
                        {ar ? "نتيجة التوافق مع ATS" : "ATS Compatibility Score"}
                      </p>
                      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{result.summary}</p>
                    </div>

                    {result.strengths.length > 0 && (
                      <Section
                        icon={<CheckCircle2 className="h-4 w-4" />}
                        color="text-emerald-600"
                        title={ar ? "نقاط القوة" : "Strengths"}
                        items={result.strengths}
                        bullet="text-emerald-600"
                      />
                    )}
                    {result.weaknesses.length > 0 && (
                      <Section
                        icon={<XCircle className="h-4 w-4" />}
                        color="text-destructive"
                        title={ar ? "نقاط الضعف" : "Weaknesses"}
                        items={result.weaknesses}
                        bullet="text-destructive"
                      />
                    )}
                    {result.formattingIssues.length > 0 && (
                      <Section
                        icon={<AlertTriangle className="h-4 w-4" />}
                        color="text-amber-600"
                        title={ar ? "مشاكل التنسيق" : "Formatting issues"}
                        items={result.formattingIssues}
                        bullet="text-amber-600"
                      />
                    )}
                    {result.missingKeywords.length > 0 && (
                      <div>
                        <h3 className="mb-2 text-sm font-semibold">
                          {ar ? "كلمات مفتاحية قد تكون ناقصة" : "Possibly missing keywords"}
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                          {result.missingKeywords.map((k, i) => (
                            <span key={i} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{k}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {result.recommendations.length > 0 && (
                      <Section
                        color="text-primary"
                        title={ar ? "توصيات للتحسين" : "Recommendations"}
                        items={result.recommendations}
                        bullet="text-primary"
                      />
                    )}

                    <Button variant="outline" onClick={() => { mut.reset(); setFile(null); }} className="w-full">
                      {ar ? "تحليل ملف آخر" : "Analyze another file"}
                    </Button>

                    {/* CTA to create a professional CV */}
                    <div className="rounded-2xl bg-[image:var(--gradient-primary)] p-6 text-center text-white">
                      <p className="text-lg font-bold">
                        {ar
                          ? "🚀 هل تريد سيرة ذاتية تحصل على 95+؟"
                          : "🚀 Want a CV that scores 95+?"}
                      </p>
                      <p className="mt-2 text-sm text-white/85">
                        {ar
                          ? "سيرتك الذاتية الحالية تحتاج تحسين. منصتنا تنشئ لك سيرة ذاتية احترافية محسّنة لأنظمة ATS في دقائق — مجاناً."
                          : "Your current CV needs improvement. Our platform generates a professional, ATS-optimized CV for you in minutes — for free."}
                      </p>
                      <a href="/auth" className="mt-4 inline-block">
                        <Button className="gap-2 bg-white text-primary hover:bg-white/90">
                          {ar ? "أنشئ سيرتي الذاتية الاحترافية الآن" : "Create my professional CV now"}
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Section({
  icon, color, title, items, bullet,
}: { icon?: React.ReactNode; color: string; title: string; items: string[]; bullet: string }) {
  return (
    <div>
      <h3 className={`mb-2 flex items-center gap-1.5 text-sm font-semibold ${color}`}>
        {icon}{title}
      </h3>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className={bullet}>•</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
