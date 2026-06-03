import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Download, Award, Clock, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";

const BLUE = "oklch(19% 0.08 252)";
const GOLD = "oklch(68% 0.1 78)";
const MUTED = "oklch(45% 0.02 240)";
const BORDER = "oklch(88% 0.015 88)";
const REC_COLOR: Record<string, string> = {
  ok: "oklch(55% 0.18 145)",
  due_soon: "oklch(60% 0.12 78)",
  overdue: "oklch(55% 0.22 27)",
  not_started: "oklch(60% 0.02 240)",
};

function Section({ title, icon: Icon, count, action, children }: { title: string; icon: any; count: number; action?: any; children?: any }) {
  const { t } = useI18n();
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2"><Icon className="w-4 h-4" style={{ color: GOLD }} /><h3 className="font-semibold text-sm" style={{ color: BLUE }}>{title} ({count})</h3></div>
        {action}
      </div>
      <div className="space-y-1.5">{count === 0 && !action ? <p className="text-xs" style={{ color: MUTED }}>{t("technicianFileDialog.none")}</p> : children}</div>
    </div>
  );
}

function Row({ title, sub, right }: { title: string; sub?: string; right?: any }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: "oklch(97% 0.01 88)" }}>
      <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate" style={{ color: BLUE }}>{title}</div>{sub && <div className="text-xs" style={{ color: MUTED }}>{sub}</div>}</div>
      <div className="text-xs font-medium shrink-0">{right}</div>
    </div>
  );
}

const d = (v: any) => (v ? new Date(v).toLocaleDateString("fr-FR") : "");

/** Consolidated technician dossier (internal + external) with compliance CSV export. */
export default function TechnicianFileDialog({ employeeId, onClose }: { employeeId: number | null; onClose: () => void }) {
  const { t } = useI18n();
  const recLabel = (status: string) =>
    status === "ok" ? "OK" : t(`technicianFileDialog.status.${status}` as any);
  const utils = trpc.useUtils();
  const { data: file } = trpc.company.technicianFile.useQuery({ employeeId: employeeId! }, { enabled: employeeId != null });
  const invalidate = () => utils.company.technicianFile.invalidate({ employeeId: employeeId! });
  // INV-5: the manager can no longer ADD external trainings — the person surfaces them
  // (« Mon dossier »). The manager may still remove legacy manager-added entries.
  const delExt = trpc.company.deleteExternalTraining.useMutation({ onSuccess: invalidate });
  const { data: signoffs } = trpc.company.signoffs.useQuery({ employeeId: employeeId! }, { enabled: employeeId != null });
  const sign = trpc.company.signoff.useMutation({
    onSuccess: () => { toast.success(t("technicianFileDialog.signoffSuccess")); utils.company.signoffs.invalidate({ employeeId: employeeId! }); },
    onError: (e) => toast.error(e.message),
  });

  const exportCSV = () => {
    if (!file) return;
    const rows: string[][] = [
      [t("technicianFileDialog.csvDisclaimer")],
      [],
      [t("technicianFileDialog.csvType"), t("technicianFileDialog.csvModule"), t("technicianFileDialog.csvSource"), t("technicianFileDialog.csvStatus"), t("technicianFileDialog.csvCertificate"), t("technicianFileDialog.csvDueDate")],
    ];
    for (const m of file.scoped?.requiredModules ?? []) rows.push([t("technicianFileDialog.csvRequiredModule"), m.title ?? `#${m.trainingId}`, "R-AERO", recLabel(m.recurrencyStatus), m.hasValidCertificate ? (m.certificateNumber ?? t("technicianFileDialog.csvValid")) : "—", d(m.nextDueAt)]);
    if (!file.scoped) for (const r of file.recurrencies ?? []) rows.push([t("technicianFileDialog.csvRecurrency"), r.training?.title ?? `#${r.trainingId}`, "R-AERO", recLabel(r.status ?? "not_started"), "—", d(r.nextDueAt)]);
    for (const x of file.externalTrainings ?? []) rows.push([t("technicianFileDialog.csvExternal"), x.title, x.provider ?? "", t("technicianFileDialog.csvCompleted"), x.certNumber ?? "—", d(x.expiresAt)]);
    for (const s of signoffs ?? []) rows.push([t("technicianFileDialog.csvSignoff"), s.trainingTitle ?? s.scope ?? t("technicianFileDialog.competence"), t("technicianFileDialog.csvManagerPrefix") + (s.managerName ?? ""), s.decision, "", d(s.signedAt)]);
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `dossier_${file.employee.lastName}_${file.employee.firstName}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={employeeId != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t("technicianFileDialog.title")}{file ? ` — ${file.employee.firstName} ${file.employee.lastName}` : ""}</DialogTitle></DialogHeader>
        {!file ? (
          <p className="text-sm py-8 text-center" style={{ color: MUTED }}>{t("technicianFileDialog.loading")}</p>
        ) : (
          <div className="space-y-5 mt-2">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm" style={{ color: MUTED }}>
              <span>{file.employee.jobTitle ?? "—"}</span>
              {file.employee.licenseNumber && <span>{t("technicianFileDialog.license", { number: file.employee.licenseNumber })}</span>}
              {file.employee.licenseCategories && <span>{t("technicianFileDialog.category", { categories: file.employee.licenseCategories })}</span>}
              {file.employee.base && <span>{t("technicianFileDialog.base", { base: file.employee.base })}</span>}
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={exportCSV}><Download className="w-4 h-4 mr-1" /> {t("technicianFileDialog.exportButton")}</Button>
            </div>

            {file.scoped ? (
              <>
                <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "oklch(97% 0.01 88)", color: MUTED }}>
                  {t("technicianFileDialog.scopedNotice")}{" "}
                  {t("technicianFileDialog.part66CoveragePrefix")} <strong style={{ color: BLUE }}>{file.scoped.part66Coverage.length}</strong> {t("technicianFileDialog.part66CoverageSuffix")}
                </div>
                <Section title={t("technicianFileDialog.requiredModulesSection")} icon={Award} count={file.scoped.requiredModules.length}>
                  {file.scoped.requiredModules.map((m: any) => {
                    const col = REC_COLOR[m.recurrencyStatus] ?? REC_COLOR.not_started;
                    const lbl = recLabel(m.recurrencyStatus);
                    return <Row key={m.trainingId}
                      title={m.title ?? t("technicianFileDialog.trainingFallback", { id: m.trainingId })}
                      sub={`${m.hasValidCertificate ? t("technicianFileDialog.certificateNumber", { number: m.certificateNumber }) : t("technicianFileDialog.noValidCertificate")}${m.nextDueAt ? " · " + t("technicianFileDialog.dueLabel", { date: d(m.nextDueAt) }) : ""}`}
                      right={<div className="flex items-center gap-2">
                        <span style={{ color: col }}>{lbl}</span>
                        <button onClick={() => sign.mutate({ employeeId: employeeId!, trainingId: m.trainingId, scope: "COMPETENCE", decision: "VALIDATED" })} disabled={sign.isPending}
                          className="text-[11px] px-2 py-0.5 rounded" style={{ border: `1px solid ${GOLD}`, color: BLUE }}>{t("technicianFileDialog.signButton")}</button>
                      </div>} />;
                  })}
                </Section>
                <Section title={t("technicianFileDialog.signoffsSection")} icon={CheckCircle2} count={signoffs?.length ?? 0}>
                  {(signoffs ?? []).map((s: any) => (
                    <Row key={s.id} title={`${s.trainingTitle ?? s.scope ?? t("technicianFileDialog.competence")} — ${s.decision}`}
                      sub={t("technicianFileDialog.signedByOn", { name: s.managerName ?? "—", date: d(s.signedAt) }) + (s.note ? " · " + s.note : "")}
                      right={<CheckCircle2 className="w-4 h-4" style={{ color: "oklch(55% 0.18 145)" }} />} />
                  ))}
                </Section>
                <p className="text-[11px]" style={{ color: MUTED }}>
                  {t("technicianFileDialog.humanDeterminationNotice")}
                </p>
              </>
            ) : (
              <Section title={t("technicianFileDialog.recurrenciesSection")} icon={Clock} count={file.recurrencies.length}>
                {file.recurrencies.map((r: any) => {
                  const col = REC_COLOR[r.status ?? "not_started"] ?? REC_COLOR.not_started;
                  const lbl = recLabel(r.status ?? "not_started");
                  return <Row key={r.id} title={r.training?.title ?? t("technicianFileDialog.trainingFallback", { id: r.trainingId })} sub={r.nextDueAt ? t("technicianFileDialog.dueLabel", { date: d(r.nextDueAt) }) : ""} right={<span style={{ color: col }}>{lbl}</span>} />;
                })}
              </Section>
            )}

            {file.externalTrainings.length > 0 && (
              <Section title={t("technicianFileDialog.externalTrainingsSection")} icon={ExternalLink} count={file.externalTrainings.length}>
                {file.externalTrainings.map((x: any) => (
                  <Row key={x.id} title={x.title} sub={`${x.provider ?? "—"}${x.completedAt ? " · " + d(x.completedAt) : ""}${x.expiresAt ? " · " + t("technicianFileDialog.expiresLabel", { date: d(x.expiresAt) }) : ""}`}
                    right={<button onClick={() => delExt.mutate({ id: x.id })} className="text-red-500"><Trash2 className="w-4 h-4" /></button>} />
                ))}
              </Section>
            )}

            {/* ID module documents — visible only when the person shared their passport. */}
            {(file.passportDocuments?.length ?? 0) > 0 && (
              <Section title={t("technicianFileDialog.passportSection")} icon={Award} count={file.passportDocuments.length}>
                {file.passportDocuments.map((p: any) => (
                  <Row key={p.id} title={`${p.title}${p.reference ? " · " + p.reference : ""}`}
                    sub={`${p.kind}${p.issuer ? " · " + p.issuer : ""}${p.expiresAt ? " · " + t("technicianFileDialog.expiresLabel", { date: d(p.expiresAt) }) : ""}`}
                    right={<a href={p.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: BLUE }}><Download className="w-4 h-4" /></a>} />
                ))}
              </Section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
