import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { listAtsChecks, getAtsFileUrl, deleteAtsCheck } from "@/lib/ats-admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Download, Trash2, MessageCircle, Search, FileCheck2, Users2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/ats-checks")({
  component: AdminAtsChecks,
});

function scoreClass(score: number) {
  if (score >= 80) return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
  if (score >= 60) return "bg-amber-500/15 text-amber-600 border-amber-500/30";
  return "bg-destructive/15 text-destructive border-destructive/30";
}

function AdminAtsChecks() {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const listFn = useServerFn(listAtsChecks);
  const urlFn = useServerFn(getAtsFileUrl);
  const delFn = useServerFn(deleteAtsCheck);
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["ats-checks"],
    queryFn: () => listFn(),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ats-checks"] });
      toast.success(ar ? "تم الحذف" : "Deleted");
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const rows = useMemo(() => {
    const all = (data?.rows ?? []) as any[];
    if (!q.trim()) return all;
    const needle = q.trim().toLowerCase();
    return all.filter(
      (r) =>
        String(r.phone ?? "").toLowerCase().includes(needle) ||
        String(r.file_name ?? "").toLowerCase().includes(needle),
    );
  }, [data, q]);

  async function download(row: any) {
    if (!row.file_path) {
      toast.error(ar ? "الملف غير متاح" : "File not available");
      return;
    }
    try {
      const { url } = await urlFn({ data: { file_path: row.file_path } });
      window.open(url, "_blank", "noopener");
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  }

  function whatsapp(phone: string) {
    const clean = String(phone).replace(/[^\d+]/g, "");
    window.open(`https://wa.me/${clean.replace(/^\+/, "")}`, "_blank", "noopener");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6" dir={ar ? "rtl" : "ltr"}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {ar ? "فحوصات ATS المجانية" : "Free ATS Checks"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {ar
            ? "كل من رفع سيرته الذاتية لفحص التوافق مع ATS من الصفحة العامة"
            : "Everyone who uploaded a CV on the public ATS checker page"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{ar ? "إجمالي الفحوصات" : "Total checks"}</p>
              <p className="text-xl font-bold">{data?.total ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <Users2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{ar ? "أرقام مختلفة" : "Unique numbers"}</p>
              <p className="text-xl font-bold">{data?.uniquePhones ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={ar ? "ابحث برقم الهاتف أو اسم الملف…" : "Search by phone or file name…"}
          className="ps-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {ar ? "جاري التحميل…" : "Loading…"}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              {ar ? "لا توجد فحوصات بعد" : "No checks yet"}
            </div>
          ) : (
            <div className="divide-y">
              {rows.map((row: any) => (
                <div key={row.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-medium" dir="ltr">
                        {row.phone}
                      </span>
                      <Badge variant="outline" className={scoreClass(row.ats_score ?? 0)}>
                        {row.ats_score ?? 0}/100
                      </Badge>
                      {row.locale === "ar" && <Badge variant="secondary">AR</Badge>}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.file_name} · {row.file_size ? `${(row.file_size / 1024).toFixed(0)} KB` : "—"} ·{" "}
                      {new Date(row.created_at).toLocaleString(ar ? "ar-EG" : "en-US")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => whatsapp(row.phone)}>
                      <MessageCircle className="me-1 h-4 w-4" />
                      {ar ? "واتساب" : "WhatsApp"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => download(row)} disabled={!row.file_path}>
                      <Download className="me-1 h-4 w-4" />
                      {ar ? "تحميل" : "Download"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(ar ? "حذف؟" : "Delete?")) del.mutate(row.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
