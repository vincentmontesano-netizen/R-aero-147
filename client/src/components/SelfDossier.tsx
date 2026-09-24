import { useQueryClient } from '@tanstack/react-query';
import { clearSessionCache } from '@/lib/sessionCache';
import { announceSessionChange } from '@/lib/sessionChange';
import {supportRequestLabels} from "../../../shared/supportRequest";
import {useState} from "react";
import CredentialSharing from "./CredentialSharing";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Building2, Download } from "lucide-react";
import { toast } from "sonner";

const BLUE = "var(--foreground)";
const GOLD = "var(--link)";
const MUTED = "var(--muted-foreground)";
const BORDER = "var(--border)";
const GREEN = "var(--success)";

/** Person-owned compliance dossier (INV-9 transparency + INV-5 person-initiated
 *  surfacing). The learner sees exactly what each employer sees of them, plus their
 *  full private layer, and controls which prior/external acquis they expose. */
export default function SelfDossier() {
  const queryClient = useQueryClient();
  const { t,lang } = useI18n();
  const [closingPassword,setClosingPassword]=useState('');
  const closure=lang==='fr'?{title:'Fermer mon compte',description:'Votre accès sera révoqué et les informations de votre profil seront retirées. Les certificats, examens, factures, preuves et historiques seront conservés. Cette action ne constitue pas un effacement complet des données personnelles.',password:'Mot de passe actuel',button:'Fermer mon compte',confirm:'Fermer définitivement votre compte et retirer les informations de votre profil ? Les justificatifs et historiques seront conservés.',success:'Compte fermé.'}:lang==='ar'?{title:'إغلاق حسابي',description:'سيُلغى وصولك وتُزال معلومات ملفك الشخصي. ستُحفظ الشهادات والاختبارات والفواتير والأدلة والسجلات. لا يمثل هذا الإجراء محواً كاملاً للبيانات الشخصية.',password:'كلمة المرور الحالية',button:'إغلاق حسابي',confirm:'هل تريد إغلاق حسابك نهائياً وإزالة معلومات ملفك الشخصي؟ ستُحفظ المستندات والسجلات.',success:'تم إغلاق الحساب.'}:{title:'Close my account',description:'Your access will be revoked and your profile information removed. Certificates, exams, invoices, evidence and histories will be retained. This does not fully erase personal data.',password:'Current password',button:'Close my account',confirm:'Permanently close your account and remove your profile information? Evidence and histories will be retained.',success:'Account closed.'};
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.me.selfView.useQuery();
  const invalidate = () => utils.me.selfView.invalidate();
  const setSharing = trpc.me.passport.setSharing.useMutation({
    onSuccess: (_r, v) => { toast.success(v.enabled ? t("selfDossier.toastShareOn") : t("selfDossier.toastShareOff")); invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const erase = trpc.me.eraseAccount.useMutation({
    onSuccess: async () => { setClosingPassword(''); await clearSessionCache(queryClient); utils.auth.me.setData(undefined, null); announceSessionChange(); toast.success(closure.success); window.location.assign("/"); },
    onError: (e) => toast.error(e.message),
  });
  const downloadData = async () => {
    const data = await utils.me.dataExport.fetch();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "mes-donnees-raero.json"; a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <div className="h-40 rounded-xl animate-pulse" style={{ background: "var(--border)" }} />;
  if (!data) return <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("selfDossier.unavailable")}</p>;

  return (
    <div className="space-y-6">
      <div className="rounded-xl p-4" style={{ border: `1px solid ${"var(--border)"}`, background: "var(--card)" }}>
        <div className="flex items-center gap-2 mb-1"><ShieldCheck className="w-4 h-4" style={{ color: "var(--link)" }} /><h3 className="font-semibold" style={{ color: "var(--foreground)" }}>{t("selfDossier.title")}</h3></div>
        <p className="text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>{t("selfDossier.intro")}</p>
        <Button size="sm" variant="outline" onClick={downloadData}><Download className="w-4 h-4 mr-1" /> {t("selfDossier.exportData")}</Button>
      </div>

      {/* INV-9 — what each employer sees of you */}
      <div>
        <h4 className="text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>{t("selfDossier.employerViewTitle")}</h4>
        {data.orgViews.length === 0 ? <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{t("selfDossier.noActiveAffiliation")}</p> : (
          <div className="space-y-2">
            {data.orgViews.map((o: any) => (
              <div key={o.orgId} className="rounded-lg p-3" style={{ background: "var(--background)" }}>
                <div className="flex items-center gap-2 mb-1"><Building2 className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} /><span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{o.orgName ?? t("selfDossier.organization")}</span></div>
                <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {t("selfDossier.orgViewStats", { required: o.view.requiredModules.length, coverage: o.view.part66Coverage.length, overdue: o.view.overdue, expiringSoon: o.view.expiringSoon })}
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{t("selfDossier.employerCannotSee")}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CredentialSharing data={data} />
      <a href="/support?request=privacy" className="inline-block underline text-sm">{supportRequestLabels[lang].link}</a>

      {/* Person consent — share the whole ID module (documents) with affiliated orgs */}
      <div className="rounded-xl p-4" style={{ border: `1px solid ${"var(--border)"}`, background: "var(--card)" }}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <ShieldCheck className="w-4 h-4" style={{ color: "var(--link)" }} /> {t("selfDossier.shareTitle")}
            </h4>
            <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{t("selfDossier.shareDescription")}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={data.passportShared}
            disabled={setSharing.isPending}
            onClick={() => setSharing.mutate({ enabled: !data.passportShared })}
            className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
            style={{ background: data.passportShared ? "color-mix(in srgb, var(--success) 18%, transparent)" : "var(--muted)" }}
          >
            <span className="inline-block h-5 w-5 transform rounded-full bg-card transition-transform" style={{ transform: data.passportShared ? "translateX(22px)" : "translateX(2px)" }} />
          </button>
        </div>
        <p className="text-xs mt-2 font-medium" style={{ color: data.passportShared ? "var(--success)" : "var(--muted-foreground)" }}>
          {data.passportShared ? t("selfDossier.shareOn") : t("selfDossier.shareOff")}
        </p>
      </div>

      {/* INV-7 — right to erasure (reconciled with org retention of frozen proof) */}
      <div className="rounded-xl p-4" style={{ border: "1px solid var(--destructive)", background: "color-mix(in srgb, var(--destructive) 16%, transparent)" }}>
        <h4 className="text-sm font-semibold mb-1" style={{ color: "var(--destructive)" }}>{closure.title}</h4>
        <p className="text-sm mb-3" style={{ color: "var(--muted-foreground)" }}>{closure.description}</p>
        <label className="block text-sm mb-3">{closure.password}<input type="password" autoComplete="current-password" maxLength={1024} value={closingPassword} disabled={erase.isPending} onChange={e=>setClosingPassword(e.target.value)} className="block mt-1 w-full rounded-md border bg-card p-2" /></label>
        <Button size="sm" variant="outline" disabled={erase.isPending||!closingPassword}
          onClick={() => { if (window.confirm(closure.confirm)) erase.mutate({password:closingPassword}); }}
          style={{ borderColor: "var(--destructive)", color: "var(--destructive)" }}>
          {closure.button}
        </Button>
      </div>
    </div>
  );
}
