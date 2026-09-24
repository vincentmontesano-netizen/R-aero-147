import {spreadsheetCsv} from "../../../shared/csvExport";
import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Archive, Download, Award, Clock, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { requestId as createRequestId } from "@/lib/requestId";

const BLUE = "var(--foreground)";
const GOLD = "var(--link)";
const MUTED = "var(--muted-foreground)";
const BORDER = "var(--border)";
const REC_COLOR: Record<string, string> = {
  ok: "var(--success)",
  due_soon: "var(--link)",
  overdue: "var(--destructive)",
  not_started: "var(--muted-foreground)",
};

function Section({ title, icon: Icon, count, action, children }: { title: string; icon: any; count: number; action?: any; children?: any }) {
  const { t } = useI18n();
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2"><Icon className="w-4 h-4" style={{ color: "var(--link)" }} /><h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{title} ({count})</h3></div>
        {action}
      </div>
      <div className="space-y-1.5">{count === 0 && !action ? <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{t("technicianFileDialog.none")}</p> : children}</div>
    </div>
  );
}

function Row({ title, sub, right }: { title: string; sub?: string; right?: any }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: "var(--background)" }}>
      <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{title}</div>{sub && <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{sub}</div>}</div>
      <div className="text-xs font-medium shrink-0">{right}</div>
    </div>
  );
}

const d = (v: any) => (v ? new Date(v).toLocaleDateString("fr-FR") : "");

/** Consolidated technician dossier (internal + external) with compliance CSV export. */
export default function TechnicianFileDialog({ employeeId, onClose }: { employeeId: number | null; onClose: () => void }) {
  const { t, lang } = useI18n();
  const [archiveId,setArchiveId] = useState<number | null>(null);
  const [archiveReason,setArchiveReason] = useState("");
  const labels = lang === "fr" ? {archive:"Archiver", archived:"Archivée", reason:"Motif de l’archivage", confirm:"Confirmer l’archivage", cancel:"Annuler", notice:"L’entrée et son justificatif seront conservés. L’archivage est définitif."} : lang === "ar" ? {archive:"أرشفة",archived:"مؤرشف",reason:"سبب الأرشفة",confirm:"تأكيد الأرشفة",cancel:"إلغاء",notice:"سيتم الاحتفاظ بالسجل والمستند. الأرشفة نهائية."} : {archive:"Archive",archived:"Archived",reason:"Reason for archiving",confirm:"Confirm archive",cancel:"Cancel",notice:"The entry and its evidence will be retained. Archiving is final."};
  const recLabel = (status: string) =>
    status === "ok" ? "OK" : t(`technicianFileDialog.status.${status}` as any);
  const utils = trpc.useUtils();
  const { data: file } = trpc.company.technicianFile.useQuery({ employeeId: employeeId! }, { enabled: employeeId != null });
  const invalidate = () => utils.company.technicianFile.invalidate({ employeeId: employeeId! });
  const archive = trpc.company.archiveExternalTraining.useMutation({
    onSuccess: () => { invalidate(); setArchiveId(null); setArchiveReason(""); },
    onError: (e) => toast.error(e.message),
  });
  const { data: signoffs } = trpc.company.signoffs.useQuery({ employeeId: employeeId! }, { enabled: employeeId != null });
  const signRequests=useRef(new Map<string,string>());
  const sign = trpc.company.signoff.useMutation({
    onSuccess: (_result,input) => { signRequests.current.delete(`${input.employeeId}:${input.trainingId}`); toast.success(t("technicianFileDialog.signoffSuccess")); utils.company.signoffs.invalidate({ employeeId: employeeId! }); },
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
    for (const x of file.externalTrainings ?? []) rows.push([t("technicianFileDialog.csvExternal"), x.title, x.provider ?? "", x.archivedAt ? `${labels.archived} · ${d(x.archivedAt)} · #${x.archivedBy} · ${x.archiveReason}` : t("technicianFileDialog.csvCompleted"), x.certNumber ?? "—", d(x.expiresAt)]);
    for (const s of signoffs ?? []) rows.push([t("technicianFileDialog.csvSignoff"), s.trainingTitle ?? s.scope ?? t("technicianFileDialog.competence"), t("technicianFileDialog.csvManagerPrefix") + (s.managerName ?? ""), s.decision, "", d(s.signedAt)]);
    const csv = spreadsheetCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
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
          <p className="text-sm py-8 text-center" style={{ color: "var(--muted-foreground)" }}>{t("technicianFileDialog.loading")}</p>
        ) : (
          <div className="space-y-5 mt-2">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
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
                <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "var(--background)", color: "var(--muted-foreground)" }}>
                  {t("technicianFileDialog.scopedNotice")}{" "}
                  {t("technicianFileDialog.part66CoveragePrefix")} <strong style={{ color: "var(--foreground)" }}>{file.scoped.part66Coverage.length}</strong> {t("technicianFileDialog.part66CoverageSuffix")}
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
                        <button onClick={() => {
                          const key=`${employeeId}:${m.trainingId}`;
                          const requestId=signRequests.current.get(key)??createRequestId();
                          signRequests.current.set(key,requestId);
                          sign.mutate({ requestId, employeeId: employeeId!, trainingId: m.trainingId, scope: "COMPETENCE", decision: "VALIDATED" });
                        }} disabled={sign.isPending}
                          className="text-sm px-2 py-0.5 rounded" style={{ border: `1px solid ${"var(--link)"}`, color: "var(--foreground)" }}>{t("technicianFileDialog.signButton")}</button>
                      </div>} />;
                  })}
                </Section>
                <Section title={t("technicianFileDialog.signoffsSection")} icon={CheckCircle2} count={signoffs?.length ?? 0}>
                  {(signoffs ?? []).map((s: any) => (
                    <Row key={s.id} title={`${s.trainingTitle ?? s.scope ?? t("technicianFileDialog.competence")} — ${s.decision}`}
                      sub={t("technicianFileDialog.signedByOn", { name: s.managerName ?? "—", date: d(s.signedAt) }) + (s.note ? " · " + s.note : "")}
                      right={<CheckCircle2 className="w-4 h-4" style={{ color: "var(--success)" }} />} />
                  ))}
                </Section>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
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
                  <div key={x.id}>
                    <Row title={x.title} sub={`${x.provider ?? "—"}${x.completedAt ? " · " + d(x.completedAt) : ""}${x.expiresAt ? " · " + t("technicianFileDialog.expiresLabel", { date: d(x.expiresAt) }) : ""}`}
                      right={x.archivedAt ? <span>{labels.archived}</span> : <Button size="sm" variant="outline" disabled={archive.isPending} onClick={() => {setArchiveId(x.id);setArchiveReason("");}}><Archive className="w-4 h-4 mr-1" />{labels.archive}</Button>} />
                    {x.archivedAt && <p className="text-xs mt-1">{d(x.archivedAt)} · #{x.archivedBy} · {x.archiveReason}</p>}
                    {archiveId === x.id && !x.archivedAt && <form className="p-3 space-y-2" onSubmit={e => {e.preventDefault();archive.mutate({id:x.id,reason:archiveReason});}}>
                      <p className="text-xs">{labels.notice}</p>
                      <label className="text-sm" htmlFor={`archive-reason-${x.id}`}>{labels.reason}</label>
                      <Input id={`archive-reason-${x.id}`} value={archiveReason} onChange={e => setArchiveReason(e.target.value)} minLength={3} maxLength={1000} required disabled={archive.isPending} />
                      <div className="flex gap-2"><Button type="submit" size="sm" disabled={archive.isPending || archiveReason.trim().length < 3}>{labels.confirm}</Button><Button type="button" size="sm" variant="outline" disabled={archive.isPending} onClick={() => {setArchiveId(null);setArchiveReason("");}}>{labels.cancel}</Button></div>
                    </form>}
                  </div>
                ))}
              </Section>
            )}

            {/* ID module documents — visible only when the person shared their passport. */}
            {(file.passportDocuments?.length ?? 0) > 0 && (
              <Section title={t("technicianFileDialog.passportSection")} icon={Award} count={file.passportDocuments.length}>
                {file.passportDocuments.map((p: any) => (
                  <Row key={p.id} title={`${p.title}${p.reference ? " · " + p.reference : ""}`}
                    sub={`${p.kind}${p.issuer ? " · " + p.issuer : ""}${p.expiresAt ? " · " + t("technicianFileDialog.expiresLabel", { date: d(p.expiresAt) }) : ""}`}
                    right={<a href={p.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--foreground)" }}><Download className="w-4 h-4" /></a>} />
                ))}
              </Section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
