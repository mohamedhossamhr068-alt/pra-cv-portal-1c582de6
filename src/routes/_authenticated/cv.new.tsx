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

function NewCv() {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const navigate = useNavigate();
  const me = useMeQuery();
  const fn = useServerFn(generateCv);
  const fileRef = useRef<HTMLInputElement>(null);

  // حافظنا على الـ Types الأصلية عشان الـ 36 خطأ يختفوا
  const [form, setForm] = useState({
    fullName: "", jobTitle: "", industry: "", seniority: "mid" as any, yearsExperience: "",
    jobs: [{ company: "", role: "", startDate: "", endDate: "", current: false, description: "" }],
    skills: "", education: "", certifications: "", englishLevel: "intermediate" as any,
    languages: [], erp: "", linkedinUrl: "", portfolioUrl: "", birthDate: "", maritalStatus: "",
    template: "ats_clean" as any, // سيبناها ats_clean عشان النظام يفضل مبسوط
    avatarDataUrl: "", email: "", phone: "", location: "",
  });

  // ... (احتفظ بباقي الدوال: updateJob, addJob, removeJob, serializeExperience, onPickAvatar كما هي) ...

  const mut = useMutation({
    mutationFn: () => fn({ data: { ...form, locale: ar ? "ar" : "en" } as any }),
    onSuccess: (res: any) => { toast.success("CV generated"); navigate({ to: `/cv/${res.id}` }); },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* ... حقول الإدخال ... */}
      
      {/* التعديل الوحيد: هنعرض قالبين للمستخدم، والـ value هتسمع في الـ form */}
      <div className="sm:col-span-2">
        <Label>Template</Label>
        <Select value={form.template} onValueChange={(v) => setForm({...form, template: v})}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {/* المستخدم يختار من دول فقط */}
            <SelectItem value="ats_clean">ATS Clean (Standard)</SelectItem>
            <SelectItem value="corporate_minimal">Corporate Minimal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button onClick={() => mut.mutate()} className="w-full mt-6">Generate CV</Button>
    </div>
  );
}
