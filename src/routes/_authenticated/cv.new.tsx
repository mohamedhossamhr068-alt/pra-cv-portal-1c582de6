import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateCv } from "@/lib/cv.functions";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Sparkles, Upload, X, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cv/new")({
  component: NewCv,
});

const TEMPLATES = [
  { id: "ats_clean", ar: "ATS نظيف (موصى به)", en: "ATS Clean (Recommended)" },
  { id: "two_column_modern", ar: "عمودين حديث", en: "Two-Column Modern" },
  { id: "classic_executive", ar: "كلاسيكي تنفيذي", en: "Classic Executive" },
  { id: "creative_professional", ar: "إبداعي احترافي", en: "Creative Pro" },
  { id: "corporate_minimal", ar: "مينيمال شركاتي", en: "Corporate Minimal" },
  { id: "modern_sidebar", ar: "حديث بشريط جانبي", en: "Modern Sidebar" },
  { id: "elegant_serif", ar: "أنيق سيريف", en: "Elegant Serif" },
  { id: "mono_dark", ar: "داكن أحادي", en: "Mono Dark" },
];

function NewCv() {
  const { i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fn = useServerFn(generateCv);
  const fileRef = useRef<HTMLInputElement>(null);


  const [form, setForm] = useState({
    fullName: "",
    jobTitle: "",
    industry: "",
    seniority: "mid" as "junior" | "mid" | "senior" | "lead",
    yearsExperience: "",
    experience: "",
    skills: "",
    education: "",
    certifications: "",
    englishLevel: "intermediate" as "none" | "basic" | "intermediate" | "advanced" | "fluent" | "native",
    erp: "",
    linkedinUrl: "",
    portfolioUrl: "",
    template: "ats_clean",
    avatarDataUrl: "",
    email: "",
    phone: "",
    location: "",
    birthDate: "",
    maritalStatus: "",
    recruitmentStatus: "",
  });

  type Company = {
    name: string;
    role: string;
    startDate: string;
    endDate: string;
    current: boolean;
    description: string;
  };
  const emptyCompany = (): Company => ({
    name: "",
    role: "",
    startDate: "",
    endDate: "",
    current: false,
    description: "",
  });
  const [companies, setCompanies] = useState<Company[]>([emptyCompany()]);

  function updateCompany(index: number, patch: Partial<Company>) {
    setCompanies((cs) => cs.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }
  function addCompany() {
    setCompanies((cs) => [...cs, emptyCompany()]);
  }
  function removeCompany(index: number) {
    setCompanies((cs) => (cs.length > 1 ? cs.filter((_, i) => i !== index) : cs));
  }

  function onPickAvatar(file: File) {
    if (file.size > 300_000) return toast.error(ar ? "الصورة كبيرة (حد أقصى 300KB)" : "Image too large (max 300KB)");
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, avatarDataUrl: String(reader.result || "") }));
    reader.readAsDataURL(file);
  }

  const mut = useMutation({
    mutationFn: () =>
      fn({
        data: {
          ...form,
          yearsExperience: form.yearsExperience ? Number(form.yearsExperience) : undefined,
          companies: companies
            .filter((c) => c.name.trim() || c.role.trim())
            .map((c) => ({
              name: c.name.trim(),
              role: c.role.trim(),
              startDate: c.startDate.trim() || undefined,
              endDate: c.current ? undefined : c.endDate.trim() || undefined,
              current: c.current,
              description: c.description.trim() || undefined,
            })),
          locale: ar ? "ar" : "en",
        } as any,
      }),
    onSuccess: (res: any) => {
      toast.success(ar ? "تم إنشاء السي في" : "CV generated");
      // Seed the CV viewer's query cache so the page renders immediately
      // without needing a refresh.
      if (res?.id) {
        queryClient.setQueryData(["cv", res.id], {
          id: res.id,
          output: res.output,
          analysis: res.analysis,
          input: {
            ...form,
            companies: companies.filter((c) => c.name.trim() || c.role.trim()),
            locale: ar ? "ar" : "en",
          },
          template: form.template,
          accent_color: null,
          created_at: new Date().toISOString(),
        });
        queryClient.invalidateQueries({ queryKey: ["cv", res.id] });
        navigate({ to: `/cv/${res.id}` });
      }
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });


  const hasValidCompany = companies.some((c) => c.name.trim() && c.role.trim());
  const canSubmit =
    form.fullName.trim() &&
    form.jobTitle.trim() &&
    form.industry.trim() &&
    (hasValidCompany || form.experience.trim().length >= 20) &&
    form.skills.trim();

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6" dir={ar ? "rtl" : "ltr"}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            {ar ? "إنشاء سي في جديد" : "Create a new CV"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 flex items-center gap-3">
            {form.avatarDataUrl ? (
              <div className="relative">
                <img src={form.avatarDataUrl} alt="avatar" className="h-16 w-16 rounded-full object-cover border" />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, avatarDataUrl: "" })}
                  className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="h-16 w-16 rounded-full bg-muted" />
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && onPickAvatar(e.target.files[0])}
            />
            <Button variant="outline" type="button" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              {ar ? "صورة شخصية" : "Photo"}
            </Button>
          </div>

          <div>
            <Label>{ar ? "الاسم الكامل" : "Full Name"} *</Label>
            <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div>
            <Label>{ar ? "المسمى الوظيفي" : "Job Title"} *</Label>
            <Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
          </div>
          <div>
            <Label>{ar ? "المجال" : "Industry"} *</Label>
            <Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
          </div>
          <div>
            <Label>{ar ? "سنوات الخبرة" : "Years of Experience"}</Label>
            <Input
              type="number"
              min={0}
              value={form.yearsExperience}
              onChange={(e) => setForm({ ...form, yearsExperience: e.target.value })}
            />
          </div>
          <div>
            <Label>{ar ? "المستوى" : "Seniority"}</Label>
            <Select value={form.seniority} onValueChange={(v: any) => setForm({ ...form, seniority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="junior">Junior</SelectItem>
                <SelectItem value="mid">Mid</SelectItem>
                <SelectItem value="senior">Senior</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{ar ? "مستوى الإنجليزي" : "English Level"}</Label>
            <Select value={form.englishLevel} onValueChange={(v: any) => setForm({ ...form, englishLevel: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
                <SelectItem value="fluent">Fluent</SelectItem>
                <SelectItem value="native">Native</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{ar ? "البريد" : "Email"}</Label>
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>{ar ? "الهاتف" : "Phone"}</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>{ar ? "العنوان" : "Location"}</Label>
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <Label>{ar ? "تاريخ الميلاد" : "Date of birth"}</Label>
            <Input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
          </div>
          <div>
            <Label>{ar ? "الحالة الاجتماعية" : "Marital status"}</Label>
            <Select value={form.maritalStatus} onValueChange={(v) => setForm({ ...form, maritalStatus: v })}>
              <SelectTrigger><SelectValue placeholder={ar ? "اختر" : "Select"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="single">{ar ? "أعزب" : "Single"}</SelectItem>
                <SelectItem value="married">{ar ? "متزوج" : "Married"}</SelectItem>
                <SelectItem value="engaged">{ar ? "مخطوب" : "Engaged"}</SelectItem>
                <SelectItem value="divorced">{ar ? "مطلق" : "Divorced"}</SelectItem>
                <SelectItem value="widowed">{ar ? "أرمل" : "Widowed"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>{ar ? "موقف التجنيد" : "Recruitment / military status"}</Label>
            <Select value={form.recruitmentStatus} onValueChange={(v) => setForm({ ...form, recruitmentStatus: v })}>
              <SelectTrigger><SelectValue placeholder={ar ? "اختر" : "Select"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="exempted">{ar ? "معفى" : "Exempted"}</SelectItem>
                <SelectItem value="completed">{ar ? "أدى الخدمة" : "Completed service"}</SelectItem>
                <SelectItem value="postponed">{ar ? "مؤجل" : "Postponed"}</SelectItem>
                <SelectItem value="exempted_only_son">{ar ? "إعفاء (ابن وحيد)" : "Exempted — only son"}</SelectItem>
                <SelectItem value="not_applicable">{ar ? "غير منطبق" : "Not applicable"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label>{ar ? "الشركات التي عملت بها" : "Companies you've worked at"} *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addCompany}>
                {ar ? "+ إضافة شركة" : "+ Add company"}
              </Button>
            </div>
            {companies.map((c, i) => (
              <Card key={i} className="border-dashed">
                <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
                  <div className="sm:col-span-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      {ar ? `شركة ${i + 1}` : `Company ${i + 1}`}
                    </span>
                    {companies.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCompany(i)}
                        className="text-xs text-destructive hover:underline"
                      >
                        {ar ? "إزالة" : "Remove"}
                      </button>
                    )}
                  </div>
                  <div>
                    <Label>{ar ? "اسم الشركة" : "Company name"}</Label>
                    <Input value={c.name} onChange={(e) => updateCompany(i, { name: e.target.value })} />
                  </div>
                  <div>
                    <Label>{ar ? "المسمى الوظيفي هناك" : "Role / title there"}</Label>
                    <Input value={c.role} onChange={(e) => updateCompany(i, { role: e.target.value })} />
                  </div>
                  <div>
                    <Label>{ar ? "تاريخ البداية" : "Start date"}</Label>
                    <Input
                      type="month"
                      value={c.startDate}
                      onChange={(e) => updateCompany(i, { startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>{ar ? "تاريخ النهاية" : "End date"}</Label>
                    <Input
                      type="month"
                      value={c.endDate}
                      disabled={c.current}
                      onChange={(e) => updateCompany(i, { endDate: e.target.value })}
                    />
                    <label className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={c.current}
                        onChange={(e) => updateCompany(i, { current: e.target.checked, endDate: "" })}
                      />
                      {ar ? "أعمل هنا حالياً" : "I currently work here"}
                    </label>
                  </div>
                  <div className="sm:col-span-2">
                    <Label>{ar ? "وصف المهام والإنجازات" : "Responsibilities & achievements"}</Label>
                    <Textarea
                      rows={3}
                      value={c.description}
                      onChange={(e) => updateCompany(i, { description: e.target.value })}
                      placeholder={ar ? "اوصف مهامك وإنجازاتك في هذا الدور" : "Describe your duties and achievements in this role"}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
            <p className="text-xs text-muted-foreground">
              {ar
                ? "أو، إذا كنت تفضل، يمكنك وصف خبراتك كنص حر بدلاً من ذلك:"
                : "Or, if you prefer, describe your experience as free text instead:"}
            </p>
            <Textarea
              rows={4}
              value={form.experience}
              onChange={(e) => setForm({ ...form, experience: e.target.value })}
              placeholder={ar ? "اختياري إذا أضفت شركة واحدة على الأقل أعلاه" : "Optional if you added at least one company above"}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>{ar ? "المهارات (مفصولة بفواصل)" : "Skills (comma separated)"} *</Label>
            <Textarea
              rows={3}
              value={form.skills}
              onChange={(e) => setForm({ ...form, skills: e.target.value })}
            />
          </div>
          <div>
            <Label>{ar ? "التعليم" : "Education"}</Label>
            <Input value={form.education} onChange={(e) => setForm({ ...form, education: e.target.value })} />
          </div>
          <div>
            <Label>{ar ? "الشهادات" : "Certifications"}</Label>
            <Input value={form.certifications} onChange={(e) => setForm({ ...form, certifications: e.target.value })} />
          </div>
          <div>
            <Label>LinkedIn</Label>
            <Input value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} />
          </div>
          <div>
            <Label>{ar ? "البورتفوليو" : "Portfolio"}</Label>
            <Input value={form.portfolioUrl} onChange={(e) => setForm({ ...form, portfolioUrl: e.target.value })} />
          </div>

          <div className="sm:col-span-2">
            <Label>{ar ? "القالب" : "Template"}</Label>
            <Select value={form.template} onValueChange={(v) => setForm({ ...form, template: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{ar ? t.ar : t.en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2 flex flex-col gap-2">
            <Button
              onClick={() => mut.mutate()}
              disabled={!canSubmit || mut.isPending}
              className="w-full"
            >
              {mut.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {ar ? "جاري الإنشاء…" : "Generating…"}
                </>
              ) : ar ? (
                "إنشاء السي في"
              ) : (
                "Generate CV"
              )}
            </Button>
            {mut.isPending && (
              <p className="text-center text-xs text-muted-foreground">
                {ar
                  ? "قد يستغرق هذا حتى دقيقة. من فضلك لا تغلق الصفحة أو تحدّثها."
                  : "This can take up to a minute. Please don't close or refresh the page."}
              </p>
            )}
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
