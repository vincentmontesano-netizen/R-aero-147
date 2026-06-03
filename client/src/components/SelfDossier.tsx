import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Building2, Download } from "lucide-react";
import { toast } from "sonner";

const BLUE = "oklch(19% 0.08 252)";
const GOLD = "oklch(68% 0.1 78)";
const MUTED = "oklch(45% 0.02 240)";
const BORDER = "oklch(88% 0.015 88)";
const GREEN = "oklch(55% 0.18 145)";

/** Person-owned compliance dossier (INV-9 transparency + INV-5 person-initiated
 *  surfacing). The learner sees exactly what each employer sees of them, plus their
 *  full private layer, and controls which prior/external acquis they expose. */
export default function SelfDossier() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.me.selfView.useQuery();
  const invalidate = () => utils.me.selfView.invalidate();
  const setSharing = trpc.me.passport.setSharing.useMutation({
    onSuccess: (_r, v) => { toast.success(v.enabled ? t("selfDossier.toastShareOn") : t("selfDossier.toastShareOff")); invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const erase = trpc.me.eraseAccount.useMutation({
    onSuccess: () => { toast.success(t("selfDossier.toastAccountErased")); setTimeout(() => { window.location.href = "/"; }, 800); },
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

  if (isLoading) return <div className="h-40 rounded-xl animate-pulse" style={{ background: "oklch(88% 0.015 88)" }} />;
  if (!data) return <p className="text-sm" style={{ color: MUTED }}>{t("selfDossier.unavailable")}</p>;

  return (
    <div className="space-y-6">
      <div className="rounded-xl p-4" style={{ border: `1px solid ${BORDER}`, background: "white" }}>
        <div className="flex items-center gap-2 mb-1"><ShieldCheck className="w-4 h-4" style={{ color: GOLD }} /><h3 className="font-semibold" style={{ color: BLUE }}>{t("selfDossier.title")}</h3></div>
        <p className="text-xs mb-3" style={{ color: MUTED }}>{t("selfDossier.intro")}</p>
        <Button size="sm" variant="outline" onClick={downloadData}><Download className="w-4 h-4 mr-1" /> {t("selfDossier.exportData")}</Button>
      </div>

      {/* INV-9 — what each employer sees of you */}
      <div>
        <h4 className="text-sm font-semibold mb-2" style={{ color: BLUE }}>{t("selfDossier.employerViewTitle")}</h4>
        {data.orgViews.length === 0 ? <p className="text-xs" style={{ color: MUTED }}>{t("selfDossier.noActiveAffiliation")}</p> : (
          <div className="space-y-2">
            {data.orgViews.map((o: any) => (
              <div key={o.orgId} className="rounded-lg p-3" style={{ background: "oklch(97% 0.01 88)" }}>
                <div className="flex items-center gap-2 mb-1"><Building2 className="w-4 h-4" style={{ color: MUTED }} /><span className="text-sm font-medium" style={{ color: BLUE }}>{o.orgName ?? t("selfDossier.organization")}</span></div>
                <div className="text-xs" style={{ color: MUTED }}>
                  {t("selfDossier.orgViewStats", { required: o.view.requiredModules.length, coverage: o.view.part66Coverage.length, overdue: o.view.overdue, expiringSoon: o.view.expiringSoon })}
                </div>
                <div className="text-[11px] mt-1" style={{ color: MUTED }}>{t("selfDossier.employerCannotSee")}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Person consent — share the whole ID module (documents) with affiliated orgs */}
      <div className="rounded-xl p-4" style={{ border: `1px solid ${BORDER}`, background: "white" }}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-sm font-semibold flex items-center gap-2" style={{ color: BLUE }}>
              <ShieldCheck className="w-4 h-4" style={{ color: GOLD }} /> {t("selfDossier.shareTitle")}
            </h4>
            <p className="text-xs mt-1" style={{ color: MUTED }}>{t("selfDossier.shareDescription")}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={data.passportShared}
            disabled={setSharing.isPending}
            onClick={() => setSharing.mutate({ enabled: !data.passportShared })}
            className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
            style={{ background: data.passportShared ? GREEN : "oklch(80% 0.02 240)" }}
          >
            <span className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform" style={{ transform: data.passportShared ? "translateX(22px)" : "translateX(2px)" }} />
          </button>
        </div>
        <p className="text-[11px] mt-2 font-medium" style={{ color: data.passportShared ? GREEN : MUTED }}>
          {data.passportShared ? t("selfDossier.shareOn") : t("selfDossier.shareOff")}
        </p>
      </div>

      {/* INV-7 — right to erasure (reconciled with org retention of frozen proof) */}
      <div className="rounded-xl p-4" style={{ border: "1px solid oklch(80% 0.12 27)", background: "oklch(98% 0.02 27)" }}>
        <h4 className="text-sm font-semibold mb-1" style={{ color: "oklch(45% 0.18 27)" }}>{t("selfDossier.eraseTitle")}</h4>
        <p className="text-xs mb-3" style={{ color: MUTED }}>{t("selfDossier.eraseDescription")}</p>
        <Button size="sm" variant="outline" disabled={erase.isPending}
          onClick={() => { if (window.confirm(t("selfDossier.eraseConfirm"))) erase.mutate(); }}
          style={{ borderColor: "oklch(60% 0.2 27)", color: "oklch(45% 0.18 27)" }}>
          {t("selfDossier.eraseButton")}
        </Button>
      </div>
    </div>
  );
}
