import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateCv } from "@/lib/cv.functions";
import { useMeQuery } from "@/lib/me.hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Sparkles, Upload, User, Mail, Phone, MapPin, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cv/new")({
  component: NewCv,
});

async function resizeImageToDataUrl(file: File, maxSize = 360): Promise<string> {
  const blobUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = blobUrl;
    });
    const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

function NewCv() {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const navigate = useNavigate();
  const me = useMeQuery();
  const fn = useServerFn(generateCv);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    fullName: "",
    jobTitle: "",
    industry: "",
    seniority: "mid" as "junior" | "mid" | "senior" | "lead",
    yearsExperience: "" as string,
    jobs: [
      { company: "", role: "", startDate: "", endDate: "", current: false, description: "" },
    ] as { company: string; role: string; startDate: string; endDate: string; current: boolean; description: string }[],
    skills: "",
    education: "",
    certifications: "",
    englishLevel: "intermediate" as "none" | "basic" | "intermediate" | "advanced" | "fluent" | "native",
    languages: [] as { name: string; level: string }[],
    erp: "",
    linkedinUrl: "",
    portfolioUrl: "",
    birthDate: "",
    maritalStatus: "" as "" | "single" | "married" | "divorced" | "widowed",
    // هنا تركنا القالب الافتراضي كما هو ليتوافق مع النظام
    template: "ats_clean" as "ats_clean" | "two_column_modern" | "classic_executive" | "creative_professional" | "corporate_minimal" | "modern_sidebar" | "elegant_serif" | "mono_dark",
    avatarDataUrl: "" as string,
    email: "",
    phone: "",
    location: "",
  });

  const updateJob = (idx: number, patch: Partial<(typeof form.jobs)[number]>) => {
    setForm((f) => ({ ...f, jobs: f.jobs.map((j, i) => (i === idx ? { ...j, ...patch } : j)) }));
  };
  const addJob = () =>
    setForm((f) => ({
      ...f,
      jobs: [...f.jobs, { company: "", role: "", startDate: "", endDate: "", current: false, description: "" }],
    }));
  const removeJob = (idx: number) =>
    setForm((f) => ({ ...f, jobs: f.jobs.length > 1 ? f.jobs.filter((_, i) => i !== idx) : f.jobs }));

  const serializeExperience = () =>
    form.jobs
      .filter((j) => j.company.trim() || j.role.trim() || j.description.trim())
      .map((j) => {
        const dates = j.current
          ? `${j.startDate || "?"} — ${ar ? "حتى الآن" : "Present"}`
          : `${j.startDate || "?"} — ${j.endDate || "?"}`;
        return `• ${j.role || "-"} @ ${j.company || "-"} (${dates})\n${j.description || ""}`.trim();
      })
      .join("\n\n");

  const [langDraft, setLangDraft] = useState<{ name: string; level: string }>({ name: "", level: "intermediate" });

  const onPickAvatar = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error(ar ? "ملف غير صالح" : "Invalid image"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error(ar ? "حجم الصورة كبير" : "Too large"); return; }
    try {
      const url = await resizeImageToDataUrl(file);
      setForm((f) => ({ ...f, avatarDataUrl: url }));
    } catch {
      toast.error(ar ? "تعذر تحميل الصورة" : "Could not load image");
    }
  };

  const mut = useMutation({
    mutationFn: () =>
      fn({
        data: {
          fullName: form.fullName,
          jobTitle: form.jobTitle,
          industry: form.industry,
          seniority: form.seniority,
          experience: serializeExperience(),
          skills: form.skills,
          template: form.template,
          avatarDataUrl: form.avatarDataUrl || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          location: form.location || undefined,
          englishLevel: form.englishLevel,
          languages: form.languages.length ? form.languages : undefined,
          erp: form.erp || undefined,
          yearsExperience: form.yearsExperience ? Number(form.yearsExperience) : undefined,
          education: form.education || undefined,
          certifications: form.certifications || undefined,
          linkedinUrl: form.linkedinUrl || undefined,
          portfolioUrl: form.portfolioUrl || undefined,
          birthDate: form.birthDate || undefined,
          maritalStatus: form.maritalStatus || undefined,
          locale: (ar ? "ar" : "en") as "en" | "ar",
        },
      }),
    onSuccess: (res) => {
      toast.success(ar ? "تم إنشاء السيرة" : "CV generated");
      navigate({ to: `/cv/${res.id}` });
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? "");
      if (msg.includes("QUOTA_REACHED")) toast.error(t("cv.quotaReached"));
      else toast.error(msg || "Failed");
    },
  });

  const quotaUsed = (me.data?.quota?.remaining ?? 0) <= 0;

  return (
    <div className="mx-auto max-w-4xl">
      {/* ... بقية الـ UI الخاص بك هنا كما هو ... */}
      
      {/* هنا التعديل الوحيد المطلوب في قسم اختيار القالب */}
      <div className="sm:col-span-2">
        <Label>{t("cv.template")}</Label>
        <Select value={form.template} onValueChange={(v: any) => setForm({ ...form, template: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {/* عرضنا قالبين فقط للمستخدم */}
            <SelectItem value="ats_clean">ATS Clean (recommended)</SelectItem>
            <SelectItem value="corporate_minimal">Corporate Minimal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* باقي الـ UI الخاص بك في الأسفل (الزر وغيره) */}
      {/* تأكد من إضافة زر Generate في نهاية الصفحة */}
    </div>
  );
}
