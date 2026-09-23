import { useQueryClient } from '@tanstack/react-query';
import { clearSessionCache } from '@/lib/sessionCache';
import { announceSessionChange } from '@/lib/sessionChange';
import TwoFactorSettings from "@/components/TwoFactorSettings";
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import BackButton from "@/components/BackButton";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Globe, Save, CheckCircle, Shield, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import PublicNav from "@/components/PublicNav";

export default function UserProfile() {
  const queryClient = useQueryClient();
  const { t, setLang, lang } = useI18n();
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [saved, setSaved] = useState(false);
  const [sessionPassword, setSessionPassword] = useState("");
  const revokeSessions = trpc.auth.revokeAllSessions.useMutation({
    onSuccess: async () => { setSessionPassword(""); await clearSessionCache(queryClient); utils.auth.me.setData(undefined, null); announceSessionChange(); window.location.assign("/login"); },
    onError: () => {
      setSessionPassword("");
      toast.error(lang === "fr" ? "Déconnexion impossible. Vérifiez votre mot de passe ou reconnectez-vous. Après plusieurs essais, attendez quelques minutes." : lang === "ar" ? "تعذر تسجيل الخروج. تحقق من كلمة المرور أو سجّل الدخول مجددًا. انتظر بضع دقائق بعد محاولات متكررة." : "Could not sign out. Check your password or sign in again. After repeated attempts, wait a few minutes.");
    },
  });
  const [exporting, setExporting] = useState(false);
  const downloadExport = async () => {
    setExporting(true);
    try {
      const data = await utils.me.dataExport.fetch();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = `raero-personal-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Export failed"); }
    finally { setExporting(false); }
  };
  // Part-66 licence/categories now live in the ID module (Passport › Qualification),
  // so the profile form no longer manages them.
  const [form, setForm] = useState({
    name: "",
    jobTitle: "",
    preferredLanguage: "fr",
  });

  useEffect(() => {
    if (user) {
      setForm({
        name: (user as any).name ?? "",
        jobTitle: (user as any).jobTitle ?? "",
        preferredLanguage: (user as any).preferredLanguage ?? "fr",
      });
    }
  }, [user]);

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast.success(t("userProfile.toastUpdateSuccess"));
      utils.auth.me.invalidate();
    },
    onError: () => toast.error(t("userProfile.toastUpdateError")),
  });

  const setConsents = trpc.me.setConsents.useMutation({
    onSuccess: () => { toast.success(t("userProfile.toastConsentsSaved")); utils.auth.me.invalidate(); },
    onError: () => toast.error(t("userProfile.toastConsentsError")),
  });
  const marketingOptIn = !!(user as any)?.marketingOptIn;
  const dataConsent = !!(user as any)?.dataProcessingConsentAt;
  const twoFactorEnabled = !!(user as any)?.twoFactorEnabled;
  const requestReset = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => toast.success(t("userProfile.passwordLinkSent")),
    onError: () => toast.success(t("userProfile.passwordLinkSent")),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate(form);
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen" style={{ background: "oklch(97% 0.01 88)" }}>
      <PublicNav />
      <div style={{ background: "oklch(19% 0.08 252)", paddingTop: "5rem" }}>
        <div className="container py-10">
          <BackButton dark />
          <h1 className="font-serif text-2xl font-bold text-white mb-1">{t("userProfile.title")}</h1>
          <p className="text-white/60 text-sm">{t("userProfile.subtitle")}</p>
        </div>
      </div>

      <div className="container py-8 max-w-2xl">
        <form onSubmit={handleSubmit} className="rounded-xl p-8 space-y-6" style={{ background: "oklch(100% 0 0)", border: "1px solid oklch(88% 0.015 88)" }}>
          {/* Personal info */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <User className="w-4 h-4" style={{ color: "oklch(68% 0.1 78)" }} />
              <h2 className="font-semibold" style={{ color: "oklch(19% 0.08 252)" }}>{t("userProfile.personalInfoHeading")}</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label htmlFor="profile-field-1" className="text-xs font-semibold mb-1.5 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("userProfile.fullNameLabel")}</label>
                <Input id="profile-field-1" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t("userProfile.fullNamePlaceholder")} />
              </div>
              <div>
                <label htmlFor="profile-field-2" className="text-xs font-semibold mb-1.5 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("userProfile.jobTitleLabel")}</label>
                <Input id="profile-field-2" value={form.jobTitle} onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))} placeholder={t("userProfile.jobTitlePlaceholder")} />
              </div>
              <div>
                <label htmlFor="profile-field-3" className="text-xs font-semibold mb-1.5 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("userProfile.preferredLanguageLabel")}</label>
                <select id="profile-field-3"
                  value={form.preferredLanguage}
                  onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, preferredLanguage: v })); if (v === "fr" || v === "en") setLang(v); }}
                  className="w-full h-9 rounded-md border px-3 text-sm"
                  style={{ borderColor: "oklch(88% 0.015 88)" }}
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
          </div>

          {/* Read-only info */}
          <div className="p-4 rounded-lg" style={{ background: "oklch(97% 0.01 88)", border: "1px solid oklch(88% 0.015 88)" }}>
            <div className="text-xs font-semibold mb-2" style={{ color: "oklch(45% 0.02 240)" }}>{t("userProfile.accountInfoHeading")}</div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span style={{ color: "oklch(62% 0.02 240)" }}>{t("userProfile.emailLabel")}</span>
                <span style={{ color: "oklch(19% 0.08 252)" }}>{user?.email ?? "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: "oklch(62% 0.02 240)" }}>{t("userProfile.roleLabel")}</span>
                <span style={{ color: "oklch(19% 0.08 252)" }}>{user?.role ?? "user"}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updateProfile.isPending}
              style={{ background: saved ? "oklch(55% 0.18 145)" : "oklch(19% 0.08 252)", color: "oklch(97% 0.01 88)" }}
            >
              {saved ? <><CheckCircle className="w-4 h-4 mr-2" /> {t("userProfile.savedButton")}</> : <><Save className="w-4 h-4 mr-2" /> {t("userProfile.saveButton")}</>}
            </Button>
          </div>
        </form>

        {/* Security — email two-factor authentication */}
        <div className="rounded-xl p-8 mt-6" style={{ background: "oklch(100% 0 0)", border: "1px solid oklch(88% 0.015 88)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4" style={{ color: "oklch(68% 0.1 78)" }} />
            <h2 className="font-semibold" style={{ color: "oklch(19% 0.08 252)" }}>{t("userProfile.securityHeading")}</h2>
          </div>
          {/* Change password via an emailed link */}
          <div className="flex items-center justify-between gap-3 pb-4 mb-4" style={{ borderBottom: "1px solid oklch(88% 0.015 88)" }}>
            <div className="min-w-0">
              <div className="text-sm font-medium" style={{ color: "oklch(19% 0.08 252)" }}>{t("userProfile.passwordTitle")}</div>
              <p className="text-xs mt-0.5" style={{ color: "oklch(45% 0.02 240)" }}>{t("userProfile.passwordDesc")}</p>
            </div>
            <Button type="button" variant="outline" disabled={requestReset.isPending || !user?.email}
              onClick={() => user?.email && requestReset.mutate({ email: user.email, origin: window.location.origin })}>
              {requestReset.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <KeyRound className="w-4 h-4 mr-1" />} {t("userProfile.passwordButton")}
            </Button>
          </div>

          <TwoFactorSettings enabled={twoFactorEnabled} />
        </div>

        <section className="rounded-xl border bg-white p-8 mt-6 space-y-3" aria-labelledby="session-security-title">
          <h2 id="session-security-title" className="font-semibold">{lang === "fr" ? "Mes appareils connectés" : lang === "ar" ? "أجهزتي المتصلة" : "My signed-in devices"}</h2>
          <p className="text-sm text-slate-600">{lang === "fr" ? "Déconnectez toutes les sessions de votre compte, y compris cet appareil. Vos formations, documents et résultats sont conservés. Vous devrez vous reconnecter." : lang === "ar" ? "سجّل الخروج من جميع جلسات حسابك، بما فيها هذا الجهاز. ستبقى تدريباتك ومستنداتك ونتائجك محفوظة. ستحتاج إلى تسجيل الدخول مجددًا." : "Sign out of every account session, including this device. Your training, documents and results are preserved. You will need to sign in again."}</p>
          <form className="space-y-3" onSubmit={event => { event.preventDefault(); if (sessionPassword && !revokeSessions.isPending) revokeSessions.mutate({password: sessionPassword}); }}>
            <label className="block text-sm font-medium" htmlFor="session-password">{lang === "fr" ? "Mot de passe actuel" : lang === "ar" ? "كلمة المرور الحالية" : "Current password"}</label>
            <Input id="session-password" type="password" autoComplete="current-password" maxLength={1024} required value={sessionPassword} onChange={event => setSessionPassword(event.target.value)} disabled={revokeSessions.isPending} />
            <Button type="submit" variant="outline" disabled={!sessionPassword || revokeSessions.isPending}>
              {revokeSessions.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
              {lang === "fr" ? "Déconnecter tous mes appareils" : lang === "ar" ? "تسجيل الخروج من جميع أجهزتي" : "Sign out all my devices"}
            </Button>
          </form>
        </section>

        <section className="rounded-xl border bg-white p-8 mt-6 space-y-3">
          <h2 className="font-semibold">{lang === "fr" ? "Mes données personnelles" : lang === "ar" ? "بياناتي الشخصية" : "My personal data"}</h2>
          <p className="text-sm text-slate-600">{lang === "fr" ? "Téléchargez vos données de compte, documents du coffre, parcours, vérifications d’identité et assistance en JSON. Les fichiers sont référencés par leurs liens privés et ne sont pas inclus dans ce téléchargement." : lang === "ar" ? "نزّل بيانات الحساب والخزنة والتدريب والتحقق من الهوية والدعم بصيغة JSON. يتضمن التصدير روابط خاصة للملفات وليس الملفات نفسها." : "Download account, vault, learning, identity verification and support data as JSON. Files are referenced through private links; their contents are not included."}</p>
          <Button variant="outline" disabled={exporting} onClick={downloadExport}>{exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : lang === "fr" ? "Télécharger mes données" : lang === "ar" ? "تنزيل بياناتي" : "Download my data"}</Button>
        </section>

        {/* RGPD consents — not relevant for an admin account. */}
        {(user as any)?.role !== "admin" && (
          <div className="rounded-xl p-8 mt-6 space-y-4" style={{ background: "oklch(100% 0 0)", border: "1px solid oklch(88% 0.015 88)" }}>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" style={{ color: "oklch(68% 0.1 78)" }} />
              <h2 className="font-semibold" style={{ color: "oklch(19% 0.08 252)" }}>{t("userProfile.consentsHeading")}</h2>
            </div>
            <label className="flex items-start gap-3 text-sm cursor-pointer">
              <input type="checkbox" checked={dataConsent} onChange={(e) => setConsents.mutate({ dataProcessingConsent: e.target.checked })} className="mt-1" />
              <span><span style={{ color: "oklch(19% 0.08 252)" }}>{t("userProfile.dataConsentTitle")}</span><br /><span className="text-xs" style={{ color: "oklch(45% 0.02 240)" }}>{t("userProfile.dataConsentDesc")} {dataConsent ? t("userProfile.consentGiven") : t("userProfile.consentNotGiven")}</span></span>
            </label>
            <label className="flex items-start gap-3 text-sm cursor-pointer">
              <input type="checkbox" checked={marketingOptIn} onChange={(e) => setConsents.mutate({ marketingOptIn: e.target.checked })} className="mt-1" />
              <span><span style={{ color: "oklch(19% 0.08 252)" }}>{t("userProfile.marketingConsentTitle")}</span><br /><span className="text-xs" style={{ color: "oklch(45% 0.02 240)" }}>{t("userProfile.marketingConsentDesc")}</span></span>
            </label>
            <p className="text-xs" style={{ color: "oklch(62% 0.02 240)" }}>{t("userProfile.exportHint")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
