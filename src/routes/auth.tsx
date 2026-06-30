import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldCheck, Sparkles, Briefcase, Users, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "PRA — Join your career platform" },
      {
        name: "description",
        content:
          "Access PRA: AI CV generation, job matching, and professional career tools for individuals and companies.",
      },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

function mapAuthError(t: (k: string) => string, msg: string | undefined): string {
  const m = (msg ?? "").toLowerCase();
  if (!m) return t("auth.errEmailInvalid");
  if (m.includes("rate") || m.includes("too many") || m.includes("429")) return t("auth.errRate");
  if (m.includes("network") || m.includes("fetch") || m.includes("failed to fetch")) return t("auth.errNetwork");
  if (m.includes("invalid login") || m.includes("invalid") || m.includes("credentials")) return t("auth.errEmailInvalid");
  if (m.includes("user already registered") || m.includes("already registered")) return m;
  return msg ?? "";
}

function AuthPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const ar = i18n.language === "ar";

  const [tab, setTab] = useState<"signup" | "login">("signup");

  // Shared
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // Sign-up only
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");

  const emailSchema = z
    .string()
    .trim()
    .min(1, t("auth.errEmailRequired"))
    .max(255, t("auth.errEmailTooLong"))
    .email(t("auth.errEmailInvalid"));

  const passwordSchema = z.string().min(8, t("auth.errPasswordShort")).max(128);

  const googleSignIn = async () => {
    setLoading(true);
    setStatus(t("auth.statusSending"));
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/auth/callback",
        extraParams: { prompt: "select_account" },
      });
      if (result.error) {
        toast.error((result.error as any)?.message ?? "Google sign-in failed");
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err?.message ?? "Google sign-in failed");
    } finally {
      setLoading(false);
      setStatus(null);
    }
  };

  const handleSignUp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) {
      setError(parsedEmail.error.issues[0]?.message ?? "");
      return;
    }
    const parsedPassword = passwordSchema.safeParse(password);
    if (!parsedPassword.success) {
      setError(parsedPassword.error.issues[0]?.message ?? "");
      return;
    }
    if (!fullName.trim()) {
      setError(t("auth.errNameRequired"));
      return;
    }
    setLoading(true);
    setStatus(t("auth.sending"));
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: parsedEmail.data,
        password: parsedPassword.data,
        options: {
          emailRedirectTo: window.location.origin + "/pending-approval",
          data: {
            full_name: fullName.trim(),
            phone: phone.trim() || undefined,
            company_name: company.trim() || undefined,
          },
        },
      });
      if (signUpError) throw signUpError;
      if (!data.session) {
        toast.success(
          ar
            ? "تم إنشاء الحساب — تحقق من بريدك لتأكيده ثم سجل الدخول."
            : "Account created — confirm your email then log in.",
        );
        setTab("login");
        setPassword("");
        return;
      }
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      const friendly = mapAuthError(t, err?.message);
      setError(friendly);
      toast.error(friendly);
    } finally {
      setLoading(false);
      setStatus(null);
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) {
      setError(parsedEmail.error.issues[0]?.message ?? "");
      return;
    }
    if (!password) {
      setError(t("auth.errPasswordShort"));
      return;
    }
    setLoading(true);
    setStatus(ar ? "جارٍ التحقق…" : "Signing in…");
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: parsedEmail.data,
        password,
      });
      if (signInError) throw signInError;
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      const friendly = mapAuthError(t, err?.message);
      setError(friendly);
      toast.error(friendly);
    } finally {
      setLoading(false);
      setStatus(null);
    }
  };

  const switchTab = (next: "signup" | "login") => {
    setTab(next);
    setError(null);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Ambient brand backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-[image:var(--gradient-hero)] opacity-90" />
      <div className="pointer-events-none absolute -top-40 -right-40 h-[480px] w-[480px] rounded-full bg-primary/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[480px] w-[480px] rounded-full bg-accent/30 blur-3xl" />

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 items-center gap-10 px-6 py-10 lg:grid-cols-2">
        {/* Brand panel */}
        <div className="hidden flex-col gap-8 text-white lg:flex">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 backdrop-blur ring-1 ring-white/20">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <span className="text-lg font-semibold tracking-tight">{t("brand")}</span>
          </Link>

          <div className="space-y-4">
            <h1 className="text-4xl font-bold leading-tight tracking-tight">
              {tab === "signup" ? t("auth.signUpTitle") : t("auth.loginTitle")}
            </h1>
            <p className="max-w-md text-base text-white/80">
              {tab === "signup" ? t("auth.signUpSub") : t("auth.loginSub")}
            </p>
          </div>

          <ul className="space-y-4">
            {[
              { icon: Sparkles, title: t("landing.feat2Title"), body: t("landing.feat2Body") },
              { icon: Briefcase, title: t("landing.feat3Title"), body: t("landing.feat3Body") },
              { icon: Users, title: t("landing.feat1Title"), body: t("landing.feat1Body") },
            ].map((f, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <f.icon className="h-4 w-4" />
                </span>
                <div>
                  <div className="font-medium">{f.title}</div>
                  <div className="text-sm text-white/70">{f.body}</div>
                </div>
              </li>
            ))}
          </ul>

          <div className="text-xs text-white/60">
            © {new Date().getFullYear()} {t("brand")}
          </div>
        </div>

        {/* Form panel */}
        <div className="flex justify-center lg:justify-end">
          <Card className="w-full max-w-md border-white/20 bg-white/95 shadow-[var(--shadow-elegant)] backdrop-blur-xl dark:bg-card/95">
            <CardHeader className="space-y-2 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)] lg:hidden">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <CardTitle className="text-2xl tracking-tight">
                {tab === "signup" ? t("auth.signUpTitle") : t("auth.loginTitle")}
              </CardTitle>
              <CardDescription>
                {tab === "signup" ? t("auth.signUpSub") : t("auth.loginSub")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {status && (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{status}</span>
                </div>
              )}

              <Button type="button" variant="outline" className="h-11 w-full" disabled={loading} onClick={googleSignIn}>
                {t("auth.google")}
              </Button>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                {t("auth.or")}
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Sign up / Log in toggle */}
              <div className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/30 p-1">
                <button
                  type="button"
                  onClick={() => switchTab("signup")}
                  className={`h-9 rounded-md text-sm font-medium transition-colors ${
                    tab === "signup" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("auth.tabSignUp")}
                </button>
                <button
                  type="button"
                  onClick={() => switchTab("login")}
                  className={`h-9 rounded-md text-sm font-medium transition-colors ${
                    tab === "login" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("auth.tabLogin")}
                </button>
              </div>

              {tab === "signup" ? (
                <form className="flex flex-col gap-3" onSubmit={handleSignUp} noValidate>
                  <div className="grid gap-1.5">
                    <Label htmlFor="fn">{t("auth.fullName")}</Label>
                    <Input
                      id="fn"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (error) setError(null);
                      }}
                      maxLength={100}
                      required
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="em-su">{t("auth.email")}</Label>
                    <Input
                      id="em-su"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="you@company.com"
                      autoComplete="email"
                      maxLength={255}
                      required
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="ph">{t("auth.phoneOptional")}</Label>
                    <Input
                      id="ph"
                      type="tel"
                      dir="ltr"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+201001234567"
                      autoComplete="tel"
                      maxLength={20}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="co">{t("auth.company")}</Label>
                    <Input id="co" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={120} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="pw-su">{t("auth.password")}</Label>
                    <Input
                      id="pw-su"
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
                        {t("auth.sending")}
                      </>
                    ) : (
                      t("auth.createAccount")
                    )}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">{t("auth.awaitingApproval")}</p>
                </form>
              ) : (
                <form className="flex flex-col gap-3" onSubmit={handleLogin} noValidate>
                  <div className="grid gap-1.5">
                    <Label htmlFor="em-li">{t("auth.email")}</Label>
                    <Input
                      id="em-li"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="you@company.com"
                      autoComplete="email"
                      maxLength={255}
                      required
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="pw-li">{t("auth.password")}</Label>
                    <Input
                      id="pw-li"
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="••••••••"
                      autoComplete="current-password"
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
                        {t("auth.sending")}
                      </>
                    ) : (
                      t("auth.logIn")
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
