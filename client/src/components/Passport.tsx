import { requestId as createRequestId } from '@/lib/requestId';
import { documentExpirySummary } from '@shared/documentExpiry';
import { certificateForEnrollment } from '@shared/certificateForEnrollment';
import { certificateStatus } from '@shared/certificateStatus';
import { certificateReportLabels } from '@shared/certificateReport';
import { useState, useEffect, useRef, useId, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import SelfDossier from "@/components/SelfDossier";
import {
  IdCard, Upload, Archive, FileText, Download, GraduationCap, Award,
  BookOpen, AlertTriangle, Plane, BadgeCheck, Save, User, X, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

const BLUE = "var(--foreground)";
const GOLD = "var(--link)";
const MUTED = "var(--muted-foreground)";
const BORDER = "var(--border)";
const RED = "var(--destructive)";
const GREEN = "var(--success)";
const CARD = { background: "var(--card)", border: `1px solid ${"var(--border)"}` };

type Kind = "ID" | "PASSPORT" | "DIPLOMA" | "CERTIFICATE" | "LICENSE" | "RATING" | "LOGBOOK" | "EXPERIENCE" | "OTHER";
const KIND_ICON: Record<Kind, any> = {
  ID: IdCard, PASSPORT: IdCard, DIPLOMA: GraduationCap, CERTIFICATE: Award,
  LICENSE: BadgeCheck, RATING: Plane, LOGBOOK: BookOpen, EXPERIENCE: Plane, OTHER: FileText,
};

const d = (v: any) => (v ? new Date(v).toLocaleDateString("fr-FR") : "—");
const isExpired = (v: any) => v && new Date(v).getTime() < Date.now();

function passportContentType(file: File): "application/pdf" | "image/png" | "image/jpeg" | undefined {
  if (file.type === "application/pdf" || file.type === "image/png" || file.type === "image/jpeg") return file.type;
}
function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.onabort = () => reject(new Error("File reading aborted"));
    r.readAsDataURL(file);
  });
}

function usePassportFileSubmission() {
  const running = useRef(false);
  const pending = useRef<{ signature: string; requestId: string } | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [busy, setBusy] = useState(false);
  const [readError, setReadError] = useState(false);
  const [sendError, setSendError] = useState(false);
  const run = async <T extends { dataBase64: string },>(file: File, build: (dataBase64: string) => T, send: (input: T & { requestId: string }) => Promise<unknown>) => {
    if (running.current || !mounted.current) return;
    running.current = true;
    setBusy(true);
    setReadError(false);
    setSendError(false);
    try {
      let dataBase64: string;
      try { dataBase64 = await readAsBase64(file); }
      catch { if (mounted.current) setReadError(true); return; }
      if (!mounted.current) return;
      const payload = build(dataBase64);
      const signature = JSON.stringify(payload);
      if (pending.current?.signature !== signature) pending.current = { signature, requestId: createRequestId() };
      try { await send({ ...payload, requestId: pending.current.requestId }); pending.current = null; }
      catch { if (mounted.current) setSendError(true); }
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return { busy, readError, sendError, run, clearErrors: () => { setReadError(false); setSendError(false); }, isRunning: () => running.current };
}

/** Person-owned "ID / Passport" dossier, split into tabs: Général (editable profile +
 *  description + identity docs), Formation/Diplôme, Qualification, Expérience. */
export default function Passport() {
  const { t } = useI18n();
  const { user } = useAuth();
  const documentsQuery = trpc.me.passport.documents.useQuery();
  const documents = documentsQuery.data ?? [];
  const documentContent = (content: ReactNode) => <>
    {documentsQuery.isLoading && <p role="status">{t('common.loading')}</p>}
    {documentsQuery.isError && <PassportReadError busy={documentsQuery.isFetching} retry={() => { void documentsQuery.refetch(); }} cached={documentsQuery.data !== undefined} />}
    {documentsQuery.data !== undefined && content}
  </>;
  const docsByKind = (kinds: Kind[]) => (documents as any[]).filter((x) => kinds.includes(x.kind));

  return (
    <Tabs key={user?.id ?? "anonymous"} defaultValue="general">
      <TabsList className="mb-4 flex-wrap h-auto">
        <TabsTrigger value="general"><User className="w-4 h-4 mr-1" /> {t("passport.tabGeneral")}</TabsTrigger>
        <TabsTrigger value="formation"><GraduationCap className="w-4 h-4 mr-1" /> {t("passport.tabFormation")}</TabsTrigger>
        <TabsTrigger value="qualification"><BadgeCheck className="w-4 h-4 mr-1" /> {t("passport.tabQualification")}</TabsTrigger>
        <TabsTrigger value="experience"><Plane className="w-4 h-4 mr-1" /> {t("passport.tabExperience")}</TabsTrigger>
        <TabsTrigger value="archives"><Archive className="w-4 h-4 mr-1" /> {t("passport.archives")}</TabsTrigger>
        <TabsTrigger value="compliance"><ShieldCheck className="w-4 h-4 mr-1" /> {t("passport.tabCompliance")}</TabsTrigger>
      </TabsList>

      <TabsContent value="general">{documentContent(<GeneralTab docs={docsByKind(["ID", "PASSPORT", "OTHER"])} />)}</TabsContent>
      <TabsContent value="formation">{documentContent(<FormationTab docs={docsByKind(["DIPLOMA", "CERTIFICATE"])} />)}</TabsContent>
      <TabsContent value="qualification">{documentContent(<QualificationTab docs={docsByKind(["LICENSE", "RATING"])} />)}</TabsContent>
      <TabsContent value="experience">{documentContent(<ExperienceTab docs={docsByKind(["LOGBOOK", "EXPERIENCE"])} />)}</TabsContent>
      <TabsContent value="archives"><PassportArchives /></TabsContent>
      <TabsContent value="compliance"><SelfDossier /></TabsContent>
    </Tabs>
  );
}

// ─── Tab: Général (editable identity + description + ID documents) ─────────────
function GeneralTab({ docs }: { docs: any[] }) {
  const { t } = useI18n();
  const descriptionId = useId();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  // Name / email are managed in « My profile »; here we keep job title + description.
  const [form, setForm] = useState({ jobTitle: "", bio: "" });
  const dirty = useRef(false);
  const editForm = (update: (current: typeof form) => typeof form) => {
    dirty.current = true;
    setForm(update);
  };

  useEffect(() => {
    if (user && !dirty.current) setForm({
      jobTitle: (user as any).jobTitle ?? "",
      bio: (user as any).bio ?? "",
    });
  }, [user]);

  const save = trpc.auth.updateProfile.useMutation({
    onSuccess: () => { dirty.current = false; toast.success(t("passport.profileSaved")); utils.auth.me.invalidate(); },
    onError: () => toast.error(t("passport.profileSaveError")),
  });

  const initials = (user?.name ?? user?.email ?? "U").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <fieldset disabled={save.isPending} aria-busy={save.isPending} className="rounded-2xl p-6" style={CARD}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>{initials}</div>
          <div className="min-w-0">
            <h2 className="font-sans text-xl font-bold truncate" style={{ color: "var(--foreground)" }}>{user?.name || "—"}</h2>
            <p className="text-sm truncate" style={{ color: "var(--muted-foreground)" }}>{user?.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <LabeledInput label={t("passport.jobTitle")} value={form.jobTitle} onChange={(v) => editForm((f) => ({ ...f, jobTitle: v }))} />
          <div>
            <Label htmlFor={descriptionId}>{t("passport.description")}</Label>
            <Textarea id={descriptionId} value={form.bio} onChange={(e) => editForm((f) => ({ ...f, bio: e.target.value }))} placeholder={t("passport.descriptionPlaceholder")} rows={4} className="mt-1" />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <Button disabled={save.isPending} onClick={() => save.mutate(form)} style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
            <Save className="w-4 h-4 mr-1" /> {save.isPending ? t("passport.saving") : t("passport.saveProfile")}
          </Button>
        </div>
      </fieldset>

      <DocumentsSection title={t("passport.identityDocsTitle")} icon={IdCard} docs={docs} allowedKinds={["ID", "PASSPORT", "OTHER"]} defaultKind="ID" emptyKey="passport.noIdentityDocs" />
    </div>
  );
}

// ─── Tab: Formation / Diplôme ─────────────────────────────────────────────────
// Show a certificate only when its enrollment, holder and course match uniquely.
function FormationTab({ docs }: { docs: any[] }) {
  const { t, lang } = useI18n();
  const enrollmentsQuery = trpc.dashboard.enrollments.useQuery();
  const certificatesQuery = trpc.dashboard.certificates.useQuery();
  const loading = enrollmentsQuery.isLoading || certificatesQuery.isLoading;
  const failed = enrollmentsQuery.isError || certificatesQuery.isError;
  const labels = certificateReportLabels[lang];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6" style={CARD}>
        <h3 className="font-semibold flex items-center gap-2 mb-4" style={{ color: "var(--foreground)" }}><GraduationCap className="w-4 h-4" style={{ color: "var(--link)" }} /> {t("passport.trainingsTitle")}</h3>
        {loading && <p role="status">{t('common.loading')}</p>}
        {failed && <div className="space-y-2"><p role="alert">{t('dashboard.loadError')}</p><Button variant="outline" disabled={enrollmentsQuery.isFetching || certificatesQuery.isFetching} onClick={() => { void enrollmentsQuery.refetch(); void certificatesQuery.refetch(); }}>{t('learningPlayer.save.retry')}</Button></div>}
        {!loading && !failed && ((enrollmentsQuery.data ?? []).length === 0 ? <Empty text={t("passport.noTrainings")} /> : (
          <div className="space-y-2">
            {(enrollmentsQuery.data ?? []).map((e) => {
              const link = certificateForEnrollment(e, certificatesQuery.data ?? []);
              const cert = link.certificate;
              const status = cert ? certificateStatus(cert) : null;
              const expired = status === 'expired';
              const color = status === 'revoked' || expired ? RED : (status === 'valid' ? GREEN : MUTED);
              return (
                <div key={e.id} className="p-3 rounded-lg" style={{ background: "var(--background)" }}>
                  <div className="flex items-center gap-3">
                    {cert ? <Award className="w-4 h-4 shrink-0" style={{ color: "var(--link)" }} /> : <BookOpen className="w-4 h-4 shrink-0" style={{ color: "var(--link)" }} />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{e.training?.title ?? `#${e.trainingId}`}</div>
                      <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{t("passport.progress", { percent: e.progressPercent ?? 0 })}</div>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: "var(--muted)", color }}>
                      {status ? labels[status] : link.state === 'review' ? labels.review : (e.status === "completed" ? t("passport.completed") : t("passport.inProgress"))}
                    </span>
                  </div>
                  {cert && (
                    <div className="flex items-center gap-3 mt-2 pt-2 pl-7" style={{ borderTop: `1px dashed ${"var(--border)"}` }}>
                      <div className="flex-1 min-w-0 text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
                        {cert.certificateNumber} · {t("passport.issued")} {new Date(cert.issuedAt).toLocaleDateString(lang)}
                        {cert.expiresAt && <> · {t("passport.expires")} <span style={{ color: expired ? "var(--destructive)" : "var(--muted-foreground)" }}>{new Date(cert.expiresAt).toLocaleDateString(lang)}</span></>}
                      </div>
                      {expired && <span className="flex items-center gap-1 text-xs font-semibold shrink-0" style={{ color: "var(--destructive)" }}><AlertTriangle className="w-3 h-3" /> {t("passport.expired")}</span>}
                      {cert.pdfUrl && <a href={cert.pdfUrl} target="_blank" rel="noopener noreferrer" className="p-1 rounded shrink-0" title={t("passport.view")} style={{ color: "var(--foreground)" }}><Download className="w-4 h-4" /></a>}
                      <a href={`/verification/${cert.verificationCode}`} className="text-xs shrink-0 hover:underline" style={{ color: "var(--foreground)" }}>{t("passport.verify")}</a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <DocumentsSection title={t("passport.diplomasTitle")} icon={GraduationCap} docs={docs} allowedKinds={["DIPLOMA", "CERTIFICATE"]} defaultKind="DIPLOMA" emptyKey="passport.noDiplomas" hint={t("passport.diplomasHint")} />
    </div>
  );
}

// ─── Tab: Qualification (Part-66 license/ratings, editable + LICENSE docs) ─────
function QualificationTab({ docs }: { docs: any[] }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [form, setForm] = useState({ licenseNumber: "", licenseCategories: "", typeRatings: "" });
  const dirty = useRef(false);
  const editForm = (update: (current: typeof form) => typeof form) => {
    dirty.current = true;
    setForm(update);
  };

  useEffect(() => {
    if (user && !dirty.current) setForm({
      licenseNumber: (user as any).licenseNumber ?? "",
      licenseCategories: (user as any).licenseCategories ?? "",
      typeRatings: (user as any).typeRatings ?? "",
    });
  }, [user]);

  const save = trpc.auth.updateProfile.useMutation({
    onSuccess: () => { dirty.current = false; toast.success(t("passport.profileSaved")); utils.auth.me.invalidate(); },
    onError: () => toast.error(t("passport.profileSaveError")),
  });

  return (
    <div className="space-y-6">
      <fieldset disabled={save.isPending} aria-busy={save.isPending} className="rounded-2xl p-6" style={CARD}>
        <h3 className="font-semibold flex items-center gap-2 mb-4" style={{ color: "var(--foreground)" }}><BadgeCheck className="w-4 h-4" style={{ color: "var(--link)" }} /> {t("passport.part66Title")}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <LabeledInput label={t("passport.licenseNumber")} value={form.licenseNumber} onChange={(v) => editForm((f) => ({ ...f, licenseNumber: v }))} />
          <LabeledInput label={t("passport.licenseCategories")} value={form.licenseCategories} onChange={(v) => editForm((f) => ({ ...f, licenseCategories: v }))} placeholder="B1.1, B2…" />
        </div>
        <div className="mt-3">
          <TagInput label={t("passport.typeRatings")} value={form.typeRatings} onChange={(v) => editForm((f) => ({ ...f, typeRatings: v }))} placeholder="A320, B737…" />
        </div>
        <div className="flex justify-end mt-4">
          <Button disabled={save.isPending} onClick={() => save.mutate(form)} style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
            <Save className="w-4 h-4 mr-1" /> {save.isPending ? t("passport.saving") : t("passport.saveProfile")}
          </Button>
        </div>
      </fieldset>

      {/* Each type rating expects a rating certificate to be uploaded. */}
      <RatingChecklist typeRatings={form.typeRatings} ratingDocs={docs.filter((d) => d.kind === "RATING")} />

      <DocumentsSection title={t("passport.licenseDocsTitle")} icon={BadgeCheck} docs={docs.filter((d) => d.kind === "LICENSE")} allowedKinds={["LICENSE"]} defaultKind="LICENSE" emptyKey="passport.noLicenseDocs" />
    </div>
  );
}

// Rating certificates checklist: one group per type rating. Each rating can hold
// SEVERAL documents, and every document carries its own renewal ("refresh") date.
// The badge describes document expiry only; it does not validate a rating.
function RatingChecklist({ typeRatings, ratingDocs }: { typeRatings: string; ratingDocs: any[] }) {
  const { t } = useI18n();
  const fileInputId = useId();
  const submission = usePassportFileSubmission();
  const utils = trpc.useUtils();
  const tags = typeRatings.split(",").map((s) => s.trim()).filter(Boolean);
  const [target, setTarget] = useState<string | null>(null);
  const blank = { file: null as File | null, title: "", issuer: "", issuedAt: "", expiresAt: "" };
  const [form, setForm] = useState(blank);

  const norm = (s: string) => s.trim().toLowerCase();
  const docsFor = (rating: string) => ratingDocs
    .filter((d) => norm(d.reference ?? "") === norm(rating))
    .sort((a, b) => new Date(b.issuedAt ?? b.createdAt).getTime() - new Date(a.issuedAt ?? a.createdAt).getTime());

  const add = trpc.me.passport.addDocument.useMutation({
    onSuccess: (document) => { toast.success(t(document.archivedAt ? "passport.uploadArchived" : "passport.uploaded")); setTarget(null); setForm(blank); utils.me.passport.documents.invalidate(); utils.me.passport.archives.invalidate(); utils.me.passport.history.invalidate(); utils.me.passport.historyPage.invalidate(); },
    onError: (e) => { toast.error(e.message); utils.me.passport.documents.invalidate(); utils.me.passport.archives.invalidate(); utils.me.passport.history.invalidate(); utils.me.passport.historyPage.invalidate(); },
  });
  const del = trpc.me.passport.deleteDocument.useMutation({
    onSuccess: () => { toast.success(t("passport.deleted")); utils.me.passport.documents.invalidate(); utils.me.passport.archives.invalidate(); utils.me.passport.history.invalidate(); utils.me.passport.historyPage.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const upload = async () => {
    if (!form.file || !target) { toast.error(t("passport.fileRequired")); return; }
    if (form.file.size > 10 * 1024 * 1024) { toast.error(t("passport.fileTooLarge")); return; }
    const contentType = passportContentType(form.file);
    if (!contentType) { toast.error(t("passport.formats")); return; }
    await submission.run(form.file, dataBase64 => ({
      kind: "RATING" as const, reference: target,
      title: form.title.trim() || t("passport.ratingCertTitle", { rating: target }),
      issuer: form.issuer || undefined, issuedAt: form.issuedAt || undefined, expiresAt: form.expiresAt || undefined,
      fileName: form.file!.name, contentType, dataBase64,
    }), payload => add.mutateAsync(payload));
  };

  return (
    <div className="rounded-2xl p-6" style={CARD}>
      <h3 className="font-semibold flex items-center gap-2 mb-1" style={{ color: "var(--foreground)" }}><Plane className="w-4 h-4" style={{ color: "var(--link)" }} /> {t("passport.ratingCertsTitle")}</h3>
      <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>{t("passport.ratingCertsHint")}</p>

      {tags.length === 0 ? <Empty text={t("passport.noRatings")} /> : (
        <div className="space-y-3">
          {tags.map((rating) => {
            const docs = docsFor(rating);
            const expiry = documentExpirySummary(docs);
            const status = {
              label: t(`passport.documentExpiry.${expiry}`),
              bg: expiry === 'expired' ? "color-mix(in srgb, var(--destructive) 10%, transparent)" : "var(--muted-foreground)",
              fg: expiry === 'expired' ? RED : MUTED,
            };
            return (
              <div key={rating} className="rounded-lg p-3" style={{ background: "var(--background)" }}>
                <div className="flex items-center gap-3">
                  <Plane className="w-4 h-4 shrink-0" style={{ color: "var(--link)" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{rating}</div>
                    <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{t("passport.ratingDocCount", { count: docs.length })}</div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full max-w-40" style={{ background: status.bg, color: status.fg }}>{status.label}</span>
                  <Button size="sm" variant="outline" onClick={() => { submission.clearErrors(); setTarget(rating); setForm(blank); }}><Upload className="w-4 h-4 mr-1" /> {t("passport.ratingAddDoc")}</Button>
                </div>

                {docs.length > 0 && (
                  <div className="mt-2 pt-2 space-y-1.5 pl-7" style={{ borderTop: `1px dashed ${"var(--border)"}` }}>
                    {docs.map((doc) => {
                      const expired = isExpired(doc.expiresAt);
                      return (
                        <div key={doc.id} className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--muted-foreground)" }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>{doc.title}</div>
                            <div className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
                              {doc.issuedAt && <>{t("passport.issued")} {d(doc.issuedAt)} · </>}
                              {doc.expiresAt
                                ? <>{t("passport.refresh")} <span style={{ color: expired ? "var(--destructive)" : "var(--muted-foreground)" }}>{d(doc.expiresAt)}</span></>
                                : t("passport.noRefresh")}
                            </div>
                          </div>
                          {expired && <span className="flex items-center gap-1 text-xs font-semibold shrink-0" style={{ color: "var(--destructive)" }}><AlertTriangle className="w-3 h-3" /> {t("passport.expired")}</span>}
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="p-1 rounded shrink-0" title={t("passport.view")} style={{ color: "var(--foreground)" }}><Download className="w-4 h-4" /></a>
                          <button onClick={() => { if (confirm(t("passport.confirmDelete"))) del.mutate({ id: doc.id }); }} className="text-destructive p-1 shrink-0" title={t("passport.delete")}><Archive className="w-4 h-4" /></button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={target != null} onOpenChange={(o) => { if (!o && !submission.isRunning()) { setTarget(null); setForm(blank); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("passport.ratingCertTitle", { rating: target ?? "" })}</DialogTitle></DialogHeader>
          <fieldset disabled={submission.busy} aria-busy={submission.busy} className="space-y-3">
            <LabeledInput label={t("passport.fieldTitle")} value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} placeholder={t("passport.ratingCertTitle", { rating: target ?? "" })} />
            <LabeledInput label={t("passport.fieldIssuer")} value={form.issuer} onChange={(v) => setForm((f) => ({ ...f, issuer: v }))} />
            <div className="grid grid-cols-2 gap-2">
              <LabeledInput type="date" label={t("passport.fieldIssuedAt")} value={form.issuedAt} onChange={(v) => setForm((f) => ({ ...f, issuedAt: v }))} />
              <LabeledInput type="date" label={t("passport.refreshDate")} value={form.expiresAt} onChange={(v) => setForm((f) => ({ ...f, expiresAt: v }))} />
            </div>
            <div>
              <Label htmlFor={fileInputId}>{t("passport.fieldFile")}</Label>
              <input id={fileInputId} aria-describedby={`${fileInputId}-formats ${fileInputId}-hint`} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] ?? null }))} className="w-full text-sm mt-1 file:mr-2 file:rounded file:border-0 file:px-2 file:py-1 file:text-xs file:cursor-pointer" style={{ color: "var(--muted-foreground)" }} />
              <p id={`${fileInputId}-formats`} className="text-xs mt-1">{t("passport.formats")}</p>
              <p id={`${fileInputId}-hint`} className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{t("passport.fileHint")}</p>
            </div>
            {submission.readError && <p role="alert" className="text-sm text-destructive">{t('passport.fileReadError')}</p>}
              {submission.sendError && <p role="alert" className="text-sm text-destructive">{t('passport.uploadUnconfirmed')}</p>}
            <Button disabled={submission.busy} onClick={upload} className="w-full" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>{submission.busy ? t("passport.uploading") : t("passport.save")}</Button>
          </fieldset>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab: Expérience (logbook / experience PDFs) ──────────────────────────────
function ExperienceTab({ docs }: { docs: any[] }) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <DocumentsSection title={t("passport.experienceTitle")} icon={Plane} docs={docs} allowedKinds={["LOGBOOK", "EXPERIENCE"]} defaultKind="EXPERIENCE" emptyKey="passport.noExperience" hint={t("passport.experienceHint")} />
    </div>
  );
}

// ─── Reusable documents section (list + scoped upload dialog) ──────────────────
function DocumentsSection({ title, icon: Icon, docs, allowedKinds, defaultKind, emptyKey, hint }: {
  title: string; icon: any; docs: any[]; allowedKinds: Kind[]; defaultKind: Kind; emptyKey: string; hint?: string;
}) {
  const { t } = useI18n();
  const fileInputId = useId();
  const kindInputId = useId();
  const submission = usePassportFileSubmission();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const blank = { kind: defaultKind as Kind, title: "", issuer: "", reference: "", country: "", issuedAt: "", expiresAt: "" };
  const [form, setForm] = useState(blank);
  const reset = () => { setForm(blank); setFile(null); };
  const kindLabel = (k: string) => t(`passport.kind.${k}` as any);

  const add = trpc.me.passport.addDocument.useMutation({
    onSuccess: (document) => { toast.success(t(document.archivedAt ? "passport.uploadArchived" : "passport.uploaded")); setOpen(false); reset(); utils.me.passport.documents.invalidate(); utils.me.passport.archives.invalidate(); utils.me.passport.history.invalidate(); utils.me.passport.historyPage.invalidate(); },
    onError: (e) => { toast.error(e.message); utils.me.passport.documents.invalidate(); utils.me.passport.archives.invalidate(); utils.me.passport.history.invalidate(); utils.me.passport.historyPage.invalidate(); },
  });
  const del = trpc.me.passport.deleteDocument.useMutation({
    onSuccess: () => { toast.success(t("passport.deleted")); utils.me.passport.documents.invalidate(); utils.me.passport.archives.invalidate(); utils.me.passport.history.invalidate(); utils.me.passport.historyPage.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const submit = async () => {
    if (!file) { toast.error(t("passport.fileRequired")); return; }
    if (!form.title.trim()) { toast.error(t("passport.titleRequired")); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error(t("passport.fileTooLarge")); return; }
    const contentType = passportContentType(file);
    if (!contentType) { toast.error(t("passport.formats")); return; }
    await submission.run(file, dataBase64 => ({
      kind: form.kind, title: form.title.trim(),
      issuer: form.issuer || undefined, reference: form.reference || undefined, country: form.country || undefined,
      issuedAt: form.issuedAt || undefined, expiresAt: form.expiresAt || undefined,
      fileName: file.name, contentType, dataBase64,
    }), payload => add.mutateAsync(payload));
  };

  return (
    <div className="rounded-2xl p-6" style={CARD}>
      <div className="flex items-center justify-between mb-4 gap-2">
        <h3 className="font-semibold flex items-center gap-2" style={{ color: "var(--foreground)" }}><Icon className="w-4 h-4" style={{ color: "var(--link)" }} /> {title}</h3>
        <Dialog open={open} onOpenChange={(o) => { if (submission.isRunning()) return; submission.clearErrors(); setOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button size="sm" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}><Upload className="w-4 h-4 mr-1" /> {t("passport.addDocument")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{t("passport.addDocument")}</DialogTitle></DialogHeader>
            <fieldset disabled={submission.busy} aria-busy={submission.busy} className="space-y-3">
              <div>
                <Label htmlFor={kindInputId}>{t("passport.fieldKind")}</Label>
                <select id={kindInputId} value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as Kind }))} className="w-full h-9 rounded-md border px-2 text-sm mt-1" style={{ borderColor: "var(--border)" }}>
                  {allowedKinds.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
                </select>
              </div>
              <LabeledInput label={t("passport.fieldTitle")} value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} placeholder={t("passport.titlePlaceholder")} />
              <div className="grid grid-cols-2 gap-2">
                <LabeledInput label={t("passport.fieldIssuer")} value={form.issuer} onChange={(v) => setForm((f) => ({ ...f, issuer: v }))} />
                <LabeledInput label={t("passport.fieldReference")} value={form.reference} onChange={(v) => setForm((f) => ({ ...f, reference: v }))} />
                <LabeledInput label={t("passport.fieldCountry")} value={form.country} onChange={(v) => setForm((f) => ({ ...f, country: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <LabeledInput type="date" label={t("passport.fieldIssuedAt")} value={form.issuedAt} onChange={(v) => setForm((f) => ({ ...f, issuedAt: v }))} />
                <LabeledInput type="date" label={t("passport.fieldExpiresAt")} value={form.expiresAt} onChange={(v) => setForm((f) => ({ ...f, expiresAt: v }))} />
              </div>
              <div>
                <Label htmlFor={fileInputId}>{t("passport.fieldFile")}</Label>
                <input id={fileInputId} aria-describedby={`${fileInputId}-formats ${fileInputId}-hint`} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full text-sm mt-1 file:mr-2 file:rounded file:border-0 file:px-2 file:py-1 file:text-xs file:cursor-pointer" style={{ color: "var(--muted-foreground)" }} />
              <p id={`${fileInputId}-formats`} className="text-xs mt-1">{t("passport.formats")}</p>
                <p id={`${fileInputId}-hint`} className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{t("passport.fileHint")}</p>
              </div>
              {submission.readError && <p role="alert" className="text-sm text-destructive">{t('passport.fileReadError')}</p>}
              {submission.sendError && <p role="alert" className="text-sm text-destructive">{t('passport.uploadUnconfirmed')}</p>}
              <Button disabled={submission.busy} onClick={submit} className="w-full" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>{submission.busy ? t("passport.uploading") : t("passport.save")}</Button>
            </fieldset>
          </DialogContent>
        </Dialog>
      </div>

      {hint && <p className="text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>{hint}</p>}

      {docs.length === 0 ? <Empty text={t(emptyKey as any)} /> : (
        <div className="space-y-2">
          {docs.map((doc) => {
            const DocIcon = KIND_ICON[doc.kind as Kind] ?? FileText;
            const expired = isExpired(doc.expiresAt);
            return (
              <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "var(--background)" }}>
                <DocIcon className="w-5 h-5 shrink-0" style={{ color: "var(--link)" }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
                    {doc.title} <span className="text-xs font-normal px-1.5 py-0.5 rounded-full" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>{kindLabel(doc.kind)}</span>
                  </div>
                  <div className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
                    {[doc.issuer, doc.reference, doc.country].filter(Boolean).join(" · ") || doc.fileName}
                    {doc.expiresAt && <> · {t("passport.expires")} <span style={{ color: expired ? "var(--destructive)" : "var(--muted-foreground)" }}>{d(doc.expiresAt)}</span></>}
                  </div>
                </div>
                {expired && <span className="flex items-center gap-1 text-xs font-semibold shrink-0" style={{ color: "var(--destructive)" }}><AlertTriangle className="w-3 h-3" /> {t("passport.expired")}</span>}
                <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded shrink-0" title={t("passport.view")} style={{ color: "var(--foreground)" }}><Download className="w-4 h-4" /></a>
                <button onClick={() => { if (confirm(t("passport.confirmDelete"))) del.mutate({ id: doc.id }); }} className="text-destructive p-1.5 shrink-0" title={t("passport.delete")}><Archive className="w-4 h-4" /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm py-6 text-center" style={{ color: "var(--muted-foreground)" }}>{text}</p>;
}
function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className="text-sm font-semibold" style={{ color: "var(--muted-foreground)" }}>{children}</label>;
}
function LabeledInput({ label, value, onChange, placeholder, type }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type ?? "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 h-9" />
    </div>
  );
}

// Multi-value chip input. Stores/returns a comma-separated string so the backend
// (a plain varchar) is unchanged; the UI exposes add (Enter / +) and remove (×).
function TagInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const id = useId();
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const tags = value.split(",").map((s) => s.trim()).filter(Boolean);
  const commit = (next: string[]) => onChange(Array.from(new Set(next)).join(", "));
  const addDraft = () => { const v = draft.trim(); if (v) commit([...tags, v]); setDraft(""); };
  const remove = (tag: string) => commit(tags.filter((x) => x !== tag));

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="mt-1 flex flex-wrap gap-1.5 rounded-md border p-2 min-h-9" style={{ borderColor: "var(--border)" }}>
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full" style={{ background: "color-mix(in srgb, var(--link) 13%, transparent)", color: "var(--foreground)" }}>
            {tag}
            <button type="button" onClick={() => remove(tag)} className="hover:opacity-70" aria-label={t("passport.removeRating", { rating: tag })}><X className="w-3 h-3" /></button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addDraft(); }
            else if (e.key === "Backspace" && !draft && tags.length) remove(tags[tags.length - 1]);
          }}
          onBlur={addDraft}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[8rem] bg-transparent text-sm outline-none px-1"
        />
      </div>
    </div>
  );
}

function PassportReadError({ busy, retry, cached = false }: { busy: boolean; retry: () => void; cached?: boolean }) {
  const { t } = useI18n();
  return <div className="space-y-2 py-2">
    <p role="alert" className="text-sm">{t(cached ? 'passport.refreshError' : 'passport.readError')}</p>
    <Button variant="outline" size="sm" disabled={busy} onClick={retry}>{t('learningPlayer.save.retry')}</Button>
  </div>;
}

function PassportArchives() {
  const { t, lang } = useI18n();
  const archives = trpc.me.passport.archives.useQuery();
  const [beforeId, setBeforeId] = useState<number>();
  const history = trpc.me.passport.historyPage.useQuery({ beforeId });
  return <div className="rounded-2xl p-6 space-y-4" style={CARD}>
    <h3 className="font-semibold">{t("passport.archives")}</h3>
    <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("passport.archiveHint")}</p>
    {archives.isLoading && <p role="status">{t('common.loading')}</p>}
    {archives.isError && <PassportReadError busy={archives.isFetching} retry={() => { void archives.refetch(); }} />}
    {!archives.isLoading && !archives.isError && archives.data?.length === 0 && <p>{t("passport.noArchives")}</p>}
    {!archives.isError && archives.data?.map(doc => <div key={doc.id} className="flex gap-3 justify-between border-b pb-3">
      <div><p className="font-medium">{doc.title}</p><p className="text-xs">{t(`passport.kind.${doc.kind}`)} · {doc.archivedAt && new Date(doc.archivedAt).toLocaleDateString(lang)}</p></div>
      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="underline text-sm">{t("passport.archiveDownload")}</a>
    </div>)}
    <h3 className="font-semibold pt-3">{t("passport.history")}</h3>
    {history.isLoading && <p role="status">{t('common.loading')}</p>}
    {history.isError && <PassportReadError busy={history.isFetching} retry={() => { void history.refetch(); }} />}
    {!history.isLoading && !history.isError && history.data?.entries.length === 0 && <p>{t('passport.noHistory')}</p>}
    {!history.isError && history.data?.entries.map(event => <p key={event.id} className="text-sm">{new Date(event.createdAt).toLocaleString(lang)} · {t(`passport.event.${event.action}`)}{typeof event.data.title === "string" && ` · ${event.data.title}`}{event.action === "sharing_changed" && ` · ${t(event.data.after ? "passport.sharingOn" : "passport.sharingOff")}`}</p>)}
    <div className="flex flex-wrap gap-2">
      {beforeId !== undefined && <Button variant="outline" size="sm" disabled={history.isFetching} onClick={() => setBeforeId(undefined)}>{t('passport.historyLatest')}</Button>}
      {!history.isError && history.data?.nextCursor && <Button variant="outline" size="sm" disabled={history.isFetching} onClick={() => setBeforeId(history.data!.nextCursor!)}>{t('passport.historyOlder')}</Button>}
    </div>
  </div>;
}
