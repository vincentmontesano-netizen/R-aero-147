import { loginDestination } from "@shared/loginReturn";
import { announceSessionChange } from '@/lib/sessionChange';
import { useQueryClient } from '@tanstack/react-query';
import { clearSessionCache } from '@/lib/sessionCache';
import { useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LOGO_EMBLEM, BRAND_NAME } from "@/lib/brand";
import { LogIn, Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";

const DEEP_BLUE = "oklch(19% 0.08 252)";
const GOLD = "oklch(68% 0.1 78)";
const IVORY = "oklch(97% 0.01 88)";

export default function Login() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [forgot, setForgot] = useState(false);
  const resetSending = useRef(false);
  const [resetNotice, setResetNotice] = useState<"accepted" | "uncertain" | null>(null);
  const [twoFA, setTwoFA] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const finishLogin = async (user: any) => {
    await clearSessionCache(queryClient);
    utils.auth.me.setData(undefined, user);
    announceSessionChange();
    toast.success(t("login.loginSuccess"));
    setLocation(loginDestination(search, user.role));
  };

  const login = trpc.auth.login.useMutation({
    onSuccess: async (res: any) => {
      if (res && res.twoFactorRequired) { setTwoFA(true); setError(""); toast.success(t("login.twoFactorSent")); return; }
      await finishLogin(res);
    },
    onError: (err) => { const m = err.message || t("login.loginError"); setError(m); toast.error(m); },
  });

  const verify2FA = trpc.auth.verifyTwoFactor.useMutation({
    onSuccess: (user: any) => finishLogin(user),
    onError: (err) => { const m = err.message || t("login.twoFactorInvalid"); setError(m); toast.error(m); },
  });

  const requestReset = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => setResetNotice("accepted"),
    onError: () => setResetNotice("uncertain"),
    onSettled: () => { resetSending.current = false; },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    login.mutate({ email, password });
  };

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (resetSending.current || requestReset.isPending) return;
    if (!email.trim()) return toast.error(t("login.emailLabel"));
    resetSending.current = true;
    setResetNotice(null);
    requestReset.mutate({ email: email.trim() });
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    verify2FA.mutate({ email, code: code.trim() });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: DEEP_BLUE }}>
      <div className="w-full max-w-md">
        <Link href="/">
          <button className="flex items-center gap-2 text-white/60 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> {t("login.backToHome")}
          </button>
        </Link>

        <div className="rounded-2xl p-8" style={{ background: IVORY }}>
          <div className="flex flex-col items-center mb-8">
            <img src={LOGO_EMBLEM} alt={BRAND_NAME} className="h-16 w-auto object-contain mb-3" />
            <h1 className="font-serif text-2xl font-bold" style={{ color: DEEP_BLUE }}>{t("login.title")}</h1>
            <p className="text-sm mt-1" style={{ color: "oklch(45% 0.02 240)" }}>
              {t("login.subtitle")}
            </p>
          </div>

          {error && !forgot && (
            <div className="mb-4 flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm" role="alert"
              style={{ background: "oklch(95% 0.05 27)", border: "1px solid oklch(80% 0.12 27)", color: "oklch(45% 0.18 27)" }}>
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {twoFA ? (
            <form onSubmit={handleVerify} className="space-y-4">
              <p className="text-sm" style={{ color: "oklch(45% 0.02 240)" }}>{t("login.twoFactorIntro")}</p>
              <div>
                <label htmlFor="login-field-1" className="text-xs font-semibold mb-1.5 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("login.twoFactorCode")}</label>
                <Input id="login-field-1" value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" inputMode="numeric" autoFocus className="text-center text-lg tracking-[0.4em] font-mono" />
              </div>
              <Button type="submit" disabled={verify2FA.isPending} className="w-full" style={{ background: DEEP_BLUE, color: IVORY }}>
                {verify2FA.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {t("login.twoFactorSubmit")}
              </Button>
              <button type="button" onClick={() => { setTwoFA(false); setCode(""); }} className="w-full text-sm hover:underline" style={{ color: GOLD }}>{t("login.backToLogin")}</button>
            </form>
          ) : forgot ? (
            <form onSubmit={handleReset} className="space-y-4" aria-busy={requestReset.isPending}>
              <p className="text-sm" style={{ color: "oklch(45% 0.02 240)" }}>{t("login.resetIntro")}</p>
              <div>
                <label htmlFor="reset-email" className="text-xs font-semibold mb-1.5 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("login.emailLabel")}</label>
                <Input id="reset-email" type="email" required disabled={requestReset.isPending} value={email} onChange={(e) => { setEmail(e.target.value); setResetNotice(null); }} placeholder={t("login.emailPlaceholder")} autoComplete="email" />
              </div>
              {resetNotice && <p role={resetNotice === "uncertain" ? "alert" : "status"} className="text-sm" style={{ color: DEEP_BLUE }}>{t(resetNotice === "accepted" ? "login.resetSent" : "login.resetUncertain")}</p>}
              <Button type="submit" disabled={requestReset.isPending} className="w-full" style={{ background: DEEP_BLUE, color: IVORY }}>
                {requestReset.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {t("login.resetSubmit")}
              </Button>
              <button type="button" disabled={requestReset.isPending} onClick={() => { setForgot(false); setResetNotice(null); }} className="w-full text-sm hover:underline" style={{ color: GOLD }}>{t("login.backToLogin")}</button>
            </form>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="login-field-2" className="text-xs font-semibold mb-1.5 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("login.emailLabel")}</label>
                  <Input id="login-field-2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("login.emailPlaceholder")} autoComplete="email" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="login-password" className="text-xs font-semibold" style={{ color: "oklch(45% 0.02 240)" }}>{t("login.passwordLabel")}</label>
                    <button type="button" onClick={() => setForgot(true)} className="text-xs hover:underline" style={{ color: GOLD }}>{t("login.forgotPassword")}</button>
                  </div>
                  <Input id="login-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
                </div>
                <Button type="submit" disabled={login.isPending} className="w-full" style={{ background: DEEP_BLUE, color: IVORY }}>
                  {login.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
                  {t("login.submit")}
                </Button>
              </form>

              <p className="text-sm text-center mt-6" style={{ color: "oklch(45% 0.02 240)" }}>
                {t("login.noAccount")}{" "}
                <Link href="/register">
                  <span className="font-semibold cursor-pointer hover:underline" style={{ color: GOLD }}>{t("login.createAccount")}</span>
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
