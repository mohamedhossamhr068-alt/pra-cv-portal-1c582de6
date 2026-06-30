import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldCheck, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { adminSetOwnPassword } from "@/lib/admin-setup.functions";

export const Route = createFileRoute("/admin/set-password")({
  ssr: false,
  component: AdminSetPasswordPage,
});

function AdminSetPasswordPage() {
  const { i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const navigate = useNavigate();
  const setPasswordFn = useServerFn(adminSetOwnPassword);

  const [secret, setSecret] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const schema = z.object({
    secret: z.string().min(1, ar ? "المفتاح السري مطلوب" : "Secret key is required"),
    email: z
      .string()
      .trim()
      .min(1, ar ? "البريد الإلكتروني مطلوب" : "Email is required")
      .email(ar ? "بريد إلكتروني غير صالح" : "Invalid email"),
    password: z
      .string()
      .min(8, ar ? "كلمة المرور يجب أن تكون 8 أحرف على الأقل" : "Password must be at least 8 characters")
      .max(128),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ secret, email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "");
      return;
    }
    if (password !== confirm) {
      setError(ar ? "كلمتا المرور غير متطابقتين" : "Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      await setPasswordFn({
        data: { secret: parsed.data.secret, email: parsed.data.email, new_password: parsed.data.password },
      });
      setDone(true);
    } catch (err: any) {
      setError(err?.message ?? (ar ? "حدث خطأ" : "Something went wrong"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute inset-0 bg-[image:var(--gradient-hero)] opacity-90" />
      <div className="pointer-events-none absolute -top-40 -right-40 h-[480px] w-[480px] rounded-full bg-primary/30 blur-3xl" />

      <Card className="relative z-10 w-full max-w-md border-white/20 bg-white/95 shadow-[var(--shadow-elegant)] backdrop-blur-xl dark:bg-card/95">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl tracking-tight">
            {ar ? "تحديد كلمة مرور الأدمن" : "Set admin password"}
          </CardTitle>
          <CardDescription>
            {ar
              ? "لحساب أدمن موجود بالفعل (مثلاً سجّل دخوله بـ Google ومش عنده كلمة مرور)."
              : "For an existing admin account (e.g. one that only signed in via Google and has no password set)."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="text-sm text-muted-foreground">
                {ar
                  ? "تم تحديد كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بالبريد الإلكتروني وكلمة المرور."
                  : "Password set successfully. You can now log in with your email and password."}
              </p>
              <Button onClick={() => navigate({ to: "/auth" })} className="h-11 w-full">
                {ar ? "الذهاب لتسجيل الدخول" : "Go to login"}
              </Button>
            </div>
          ) : (
            <form className="flex flex-col gap-3" onSubmit={submit} noValidate>
              <div className="grid gap-1.5">
                <Label htmlFor="secret">{ar ? "المفتاح السري" : "Secret key"}</Label>
                <Input
                  id="secret"
                  type="password"
                  value={secret}
                  onChange={(e) => {
                    setSecret(e.target.value);
                    if (error) setError(null);
                  }}
                  autoComplete="off"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="email">{ar ? "البريد الإلكتروني" : "Email"}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="admin@company.com"
                  autoComplete="email"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  {ar ? "لازم يكون إيميل حساب أدمن موجود فعلاً في النظام." : "Must be an existing admin account's email."}
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pw">{ar ? "كلمة المرور الجديدة" : "New password"}</Label>
                <Input
                  id="pw"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pw2">{ar ? "تأكيد كلمة المرور" : "Confirm password"}</Label>
                <Input
                  id="pw2"
                  type="password"
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                />
              </div>

              {error && (
                <p className="flex items-start gap-1.5 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </p>
              )}

              <Button type="submit" disabled={loading} className="mt-2 h-11">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {ar ? "جارٍ الحفظ…" : "Saving…"}
                  </>
                ) : ar ? (
                  "تحديد كلمة المرور"
                ) : (
                  "Set password"
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
