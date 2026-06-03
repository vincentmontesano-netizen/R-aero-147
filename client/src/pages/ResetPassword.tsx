import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LOGO_EMBLEM, BRAND_NAME } from "@/lib/brand";
import { Loader2, ArrowLeft, KeyRound, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";

const DEEP_BLUE = "oklch(19% 0.08 252)";
const GOLD = "oklch(68% 0.1 78)";
const IVORY = "oklch(97% 0.01 88)";

export default function ResetPassword() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);

  const reset = trpc.auth.resetPassword.useMutation({
    onSuccess: () => { setDone(true); toast.success(t("resetPassword.success")); setTimeout(() => setLocation("/login"), 1500); },
    onError: (e) => toast.error(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error(t("resetPassword.tooShort"));
    if (password !== confirm) return toast.error(t("resetPassword.mismatch"));
    reset.mutate({ token, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: DEEP_BLUE }}>
      <div className="w-full max-w-md">
        <Link href="/login">
          <button className="flex items-center gap-2 text-white/60 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> {t("login.backToLogin")}
          </button>
        </Link>
        <div className="rounded-2xl p-8" style={{ background: IVORY }}>
          <div className="flex flex-col items-center mb-6">
            <img src={LOGO_EMBLEM} alt={BRAND_NAME} className="h-16 w-auto object-contain mb-3" />
            <h1 className="font-serif text-2xl font-bold flex items-center gap-2" style={{ color: DEEP_BLUE }}><KeyRound className="w-5 h-5" style={{ color: GOLD }} /> {t("resetPassword.title")}</h1>
          </div>

          {!token ? (
            <p className="text-sm text-center" style={{ color: "oklch(55% 0.22 27)" }}>{t("resetPassword.invalidLink")}</p>
          ) : done ? (
            <p className="text-sm text-center flex items-center justify-center gap-2" style={{ color: "oklch(45% 0.15 145)" }}><CheckCircle className="w-4 h-4" /> {t("resetPassword.success")}</p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("resetPassword.newPassword")}</label>
                <Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("resetPassword.confirmPassword")}</label>
                <Input type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
              </div>
              <Button type="submit" disabled={reset.isPending} className="w-full" style={{ background: DEEP_BLUE, color: IVORY }}>
                {reset.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {t("resetPassword.submit")}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
