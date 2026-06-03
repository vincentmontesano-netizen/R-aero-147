import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import BackButton from "@/components/BackButton";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Globe, Save, CheckCircle, Shield, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";

export default function UserProfile() {
  const { t, setLang } = useI18n();
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [saved, setSaved] = useState(false);
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
  const setTwoFactor = trpc.auth.setTwoFactor.useMutation({
    onSuccess: (_r, v) => { toast.success(v.enabled ? t("userProfile.twoFactorOn") : t("userProfile.twoFactorOff")); utils.auth.me.invalidate(); },
    onError: () => toast.error(t("userProfile.toastUpdateError")),
  });
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
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("userProfile.fullNameLabel")}</label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t("userProfile.fullNamePlaceholder")} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("userProfile.jobTitleLabel")}</label>
                <Input value={form.jobTitle} onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))} placeholder={t("userProfile.jobTitlePlaceholder")} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("userProfile.preferredLanguageLabel")}</label>
                <select
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

          {/* Email two-factor authentication (2FA) */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium" style={{ color: "oklch(19% 0.08 252)" }}>{t("userProfile.twoFactorTitle")}</div>
              <p className="text-xs mt-0.5" style={{ color: "oklch(45% 0.02 240)" }}>{t("userProfile.twoFactorDesc")}</p>
            </div>
            <button
              type="button" role="switch" aria-checked={twoFactorEnabled} disabled={setTwoFactor.isPending}
              onClick={() => setTwoFactor.mutate({ enabled: !twoFactorEnabled })}
              className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
              style={{ background: twoFactorEnabled ? "oklch(55% 0.18 145)" : "oklch(80% 0.02 240)" }}
            >
              <span className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform" style={{ transform: twoFactorEnabled ? "translateX(22px)" : "translateX(2px)" }} />
            </button>
          </div>
        </div>

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
