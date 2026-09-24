import { useQueryClient } from '@tanstack/react-query';
import { clearSessionCache } from '@/lib/sessionCache';
import { announceSessionChange } from '@/lib/sessionChange';
import { useRef, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LOGO_EMBLEM, BRAND_NAME } from "@/lib/brand";
import { Loader2, ArrowLeft, KeyRound, CheckCircle } from "lucide-react";
import { useI18n } from "@/i18n";

const DEEP_BLUE = "var(--foreground)";
const GOLD = "var(--link)";
const IVORY = "var(--foreground)";

export default function ResetPassword() {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const sending = useRef(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const validToken = token.length >= 10 && token.length <= 128;

  const reset = trpc.auth.resetPassword.useMutation({
    onSuccess: async () => {
      setPassword(""); setConfirm(""); setDone(true); setErrorKey(null);
      await clearSessionCache(queryClient);
      announceSessionChange();
    },
    onError: () => setErrorKey("resetPassword.unconfirmed"),
    onSettled: () => { sending.current = false; },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sending.current || reset.isPending || done || !validToken) return;
    if (password.length < 8) return setErrorKey("resetPassword.tooShort");
    if (password.length > 1024) return setErrorKey("resetPassword.tooLong");
    if (password !== confirm) return setErrorKey("resetPassword.mismatch");
    sending.current = true;
    setErrorKey(null);
    reset.mutate({ token, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--surface-strong)" }}>
      <div className="w-full max-w-md">
        <Link href="/login">
          <button className="flex items-center gap-2 text-muted-foreground hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> {t("login.backToLogin")}
          </button>
        </Link>
        <div className="rounded-2xl p-8" style={{ background: "var(--background)" }}>
          <div className="flex flex-col items-center mb-6">
            <img src={LOGO_EMBLEM} alt={BRAND_NAME} className="h-16 w-auto object-contain mb-3" />
            <h1 className="font-sans text-2xl font-bold flex items-center gap-2" style={{ color: "var(--foreground)" }}><KeyRound className="w-5 h-5" style={{ color: "var(--link)" }} /> {t("resetPassword.title")}</h1>
          </div>

          {!validToken ? (
            <p role="alert" className="text-sm text-center" style={{ color: "var(--destructive)" }}>{t("resetPassword.invalidLink")}</p>
          ) : done ? (
            <p role="status" className="text-sm text-center flex items-center justify-center gap-2" style={{ color: "var(--success)" }}><CheckCircle className="w-4 h-4" /> {t("resetPassword.success")}</p>
          ) : (
            <form onSubmit={submit} className="space-y-4" aria-busy={reset.isPending}>
              <div>
                <label htmlFor="new-password" className="text-sm font-semibold mb-1.5 block" style={{ color: "var(--muted-foreground)" }}>{t("resetPassword.newPassword")}</label>
                <Input id="new-password" type="password" required minLength={8} maxLength={1024} disabled={reset.isPending} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
              </div>
              <div>
                <label htmlFor="confirm-password" className="text-sm font-semibold mb-1.5 block" style={{ color: "var(--muted-foreground)" }}>{t("resetPassword.confirmPassword")}</label>
                <Input id="confirm-password" type="password" required minLength={8} maxLength={1024} disabled={reset.isPending} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
              </div>
              {errorKey && <p role="alert" className="text-sm" style={{ color: "var(--foreground)" }}>{t(errorKey)}</p>}
              <Button type="submit" disabled={reset.isPending} className="w-full" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
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
