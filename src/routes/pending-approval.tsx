import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/pending-approval")({
  ssr: false,
  component: PendingApproval,
});

function PendingApproval() {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const navigate = useNavigate();
  const [approved, setApproved] = useState(false);

  // Poll every 4s; as soon as is_approved flips true, redirect to dashboard.
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("is_approved, is_blocked")
        .eq("id", u.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data?.is_approved && !data?.is_blocked) {
        setApproved(true);
        // Refresh session to get latest claims, then navigate.
        await supabase.auth.refreshSession();
        setTimeout(() => navigate({ to: "/dashboard" }), 800);
      }
    };
    check();
    const t = setInterval(check, 4000);
    return () => { cancelled = true; clearInterval(t); };
  }, [navigate]);

  const onSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <Card className="w-full max-w-md border-border/60 shadow-[var(--shadow-elegant)]">
        <CardHeader className="text-center">
          <div className={`mx-auto grid h-12 w-12 place-items-center rounded-full ${approved ? "bg-emerald-500/15 text-emerald-600" : "bg-primary/10 text-primary"}`}>
            {approved ? <CheckCircle2 className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
          </div>
          <CardTitle className="mt-3">
            {approved ? (ar ? "تم تفعيل حسابك" : "Account approved") : t("auth.pendingTitle")}
          </CardTitle>
          <CardDescription>
            {approved
              ? (ar ? "جارٍ تحويلك إلى لوحة التحكم…" : "Redirecting to your dashboard…")
              : t("auth.pendingMsg")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!approved && (
            <>
              <p className="text-center text-xs text-muted-foreground">
                {ar ? "سيتم تحويلك تلقائياً فور موافقة الإدارة." : "You'll be redirected automatically once approved."}
              </p>
              <Button variant="outline" onClick={onSignOut}>{t("nav.signOut")}</Button>
              <Link to="/" className="text-center text-xs text-muted-foreground hover:text-foreground">
                ← {t("brand")}
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
