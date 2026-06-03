import { useState, useEffect } from "react";
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
  IdCard, Upload, Trash2, FileText, Download, GraduationCap, Award,
  BookOpen, AlertTriangle, Plane, BadgeCheck, Save, User, X, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

const BLUE = "oklch(19% 0.08 252)";
const GOLD = "oklch(68% 0.1 78)";
const MUTED = "oklch(45% 0.02 240)";
const BORDER = "oklch(88% 0.015 88)";
const RED = "oklch(55% 0.22 27)";
const GREEN = "oklch(55% 0.18 145)";
const CARD = { background: "white", border: `1px solid ${BORDER}` };

type Kind = "ID" | "PASSPORT" | "DIPLOMA" | "CERTIFICATE" | "LICENSE" | "RATING" | "LOGBOOK" | "EXPERIENCE" | "OTHER";
const KIND_ICON: Record<Kind, any> = {
  ID: IdCard, PASSPORT: IdCard, DIPLOMA: GraduationCap, CERTIFICATE: Award,
  LICENSE: BadgeCheck, RATING: Plane, LOGBOOK: BookOpen, EXPERIENCE: Plane, OTHER: FileText,
};

const d = (v: any) => (v ? new Date(v).toLocaleDateString("fr-FR") : "—");
const isExpired = (v: any) => v && new Date(v).getTime() < Date.now();

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/** Person-owned "ID / Passport" dossier, split into tabs: Général (editable profile +
 *  description + identity docs), Formation/Diplôme, Qualification, Expérience. */
export default function Passport() {
  const { t } = useI18n();
  const { data: documents = [] } = trpc.me.passport.documents.useQuery();
  const docsByKind = (kinds: Kind[]) => (documents as any[]).filter((x) => kinds.includes(x.kind));

  return (
    <Tabs defaultValue="general">
      <TabsList className="mb-4 flex-wrap h-auto">
        <TabsTrigger value="general"><User className="w-4 h-4 mr-1" /> {t("passport.tabGeneral")}</TabsTrigger>
        <TabsTrigger value="formation"><GraduationCap className="w-4 h-4 mr-1" /> {t("passport.tabFormation")}</TabsTrigger>
        <TabsTrigger value="qualification"><BadgeCheck className="w-4 h-4 mr-1" /> {t("passport.tabQualification")}</TabsTrigger>
        <TabsTrigger value="experience"><Plane className="w-4 h-4 mr-1" /> {t("passport.tabExperience")}</TabsTrigger>
        <TabsTrigger value="compliance"><ShieldCheck className="w-4 h-4 mr-1" /> {t("passport.tabCompliance")}</TabsTrigger>
      </TabsList>

      <TabsContent value="general"><GeneralTab docs={docsByKind(["ID", "PASSPORT", "OTHER"])} /></TabsContent>
      <TabsContent value="formation"><FormationTab docs={docsByKind(["DIPLOMA", "CERTIFICATE"])} /></TabsContent>
      <TabsContent value="qualification"><QualificationTab docs={docsByKind(["LICENSE", "RATING"])} /></TabsContent>
      <TabsContent value="experience"><ExperienceTab docs={docsByKind(["LOGBOOK", "EXPERIENCE"])} /></TabsContent>
      <TabsContent value="compliance"><SelfDossier /></TabsContent>
    </Tabs>
  );
}

// ─── Tab: Général (editable identity + description + ID documents) ─────────────
function GeneralTab({ docs }: { docs: any[] }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  // Name / email are managed in « My profile »; here we keep job title + description.
  const [form, setForm] = useState({ jobTitle: "", bio: "" });

  useEffect(() => {
    if (user) setForm({
      jobTitle: (user as any).jobTitle ?? "",
      bio: (user as any).bio ?? "",
    });
  }, [user]);

  const save = trpc.auth.updateProfile.useMutation({
    onSuccess: () => { toast.success(t("passport.profileSaved")); utils.auth.me.invalidate(); },
    onError: () => toast.error(t("passport.profileSaveError")),
  });

  const initials = (user?.name ?? user?.email ?? "U").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6" style={CARD}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0" style={{ background: GOLD, color: BLUE }}>{initials}</div>
          <div className="min-w-0">
            <h2 className="font-serif text-xl font-bold truncate" style={{ color: BLUE }}>{user?.name || "—"}</h2>
            <p className="text-sm truncate" style={{ color: MUTED }}>{user?.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <LabeledInput label={t("passport.jobTitle")} value={form.jobTitle} onChange={(v) => setForm((f) => ({ ...f, jobTitle: v }))} />
          <div>
            <Label>{t("passport.description")}</Label>
            <Textarea value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} placeholder={t("passport.descriptionPlaceholder")} rows={4} className="mt-1" />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <Button disabled={save.isPending} onClick={() => save.mutate(form)} style={{ background: BLUE, color: "white" }}>
            <Save className="w-4 h-4 mr-1" /> {save.isPending ? t("passport.saving") : t("passport.saveProfile")}
          </Button>
        </div>
      </div>

      <DocumentsSection title={t("passport.identityDocsTitle")} icon={IdCard} docs={docs} allowedKinds={["ID", "PASSPORT", "OTHER"]} defaultKind="ID" emptyKey="passport.noIdentityDocs" />
    </div>
  );
}

// ─── Tab: Formation / Diplôme ─────────────────────────────────────────────────
// A training IS its certificate: one unified list. A completed/certified training
// shows its certificate (number, download, verify, expiry) inline on the same row.
function FormationTab({ docs }: { docs: any[] }) {
  const { t } = useI18n();
  const { data: enrollments = [] } = trpc.dashboard.enrollments.useQuery();
  const { data: certificates = [] } = trpc.dashboard.certificates.useQuery();

  // Match each enrollment to its certificate (by enrollmentId, fallback trainingId).
  const certFor = (e: any) =>
    (certificates as any[]).find((c) => c.enrollmentId === e.id) ??
    (certificates as any[]).find((c) => c.trainingId === e.trainingId) ?? null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6" style={CARD}>
        <h3 className="font-semibold flex items-center gap-2 mb-4" style={{ color: BLUE }}><GraduationCap className="w-4 h-4" style={{ color: GOLD }} /> {t("passport.trainingsTitle")}</h3>
        {enrollments.length === 0 ? <Empty text={t("passport.noTrainings")} /> : (
          <div className="space-y-2">
            {(enrollments as any[]).map((e) => {
              const cert = certFor(e);
              const expired = cert && isExpired(cert.expiresAt);
              return (
                <div key={e.id} className="p-3 rounded-lg" style={{ background: "oklch(97% 0.01 88)" }}>
                  <div className="flex items-center gap-3">
                    {cert ? <Award className="w-4 h-4 shrink-0" style={{ color: GOLD }} /> : <BookOpen className="w-4 h-4 shrink-0" style={{ color: GOLD }} />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: BLUE }}>{e.training?.title ?? `#${e.trainingId}`}</div>
                      <div className="text-xs" style={{ color: MUTED }}>{t("passport.progress", { percent: e.progressPercent ?? 0 })}</div>
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: cert ? `${GREEN}22` : (e.status === "completed" ? `${GREEN}22` : "oklch(92% 0.01 240)"), color: cert || e.status === "completed" ? GREEN : MUTED }}>
                      {cert ? t("passport.certified") : (e.status === "completed" ? t("passport.completed") : t("passport.inProgress"))}
                    </span>
                  </div>
                  {cert && (
                    <div className="flex items-center gap-3 mt-2 pt-2 pl-7" style={{ borderTop: `1px dashed ${BORDER}` }}>
                      <div className="flex-1 min-w-0 text-xs truncate" style={{ color: MUTED }}>
                        {cert.certificateNumber} · {t("passport.issued")} {d(cert.issuedAt)}
                        {cert.expiresAt && <> · {t("passport.expires")} <span style={{ color: expired ? RED : MUTED }}>{d(cert.expiresAt)}</span></>}
                      </div>
                      {expired && <span className="flex items-center gap-1 text-[11px] font-semibold shrink-0" style={{ color: RED }}><AlertTriangle className="w-3 h-3" /> {t("passport.expired")}</span>}
                      {cert.pdfUrl && <a href={cert.pdfUrl} target="_blank" rel="noopener noreferrer" className="p-1 rounded shrink-0" title={t("passport.view")} style={{ color: BLUE }}><Download className="w-4 h-4" /></a>}
                      <a href={`/verification/${cert.verificationCode}`} className="text-xs shrink-0 hover:underline" style={{ color: BLUE }}>{t("passport.verify")}</a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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

  useEffect(() => {
    if (user) setForm({
      licenseNumber: (user as any).licenseNumber ?? "",
      licenseCategories: (user as any).licenseCategories ?? "",
      typeRatings: (user as any).typeRatings ?? "",
    });
  }, [user]);

  const save = trpc.auth.updateProfile.useMutation({
    onSuccess: () => { toast.success(t("passport.profileSaved")); utils.auth.me.invalidate(); },
    onError: () => toast.error(t("passport.profileSaveError")),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6" style={CARD}>
        <h3 className="font-semibold flex items-center gap-2 mb-4" style={{ color: BLUE }}><BadgeCheck className="w-4 h-4" style={{ color: GOLD }} /> {t("passport.part66Title")}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <LabeledInput label={t("passport.licenseNumber")} value={form.licenseNumber} onChange={(v) => setForm((f) => ({ ...f, licenseNumber: v }))} />
          <LabeledInput label={t("passport.licenseCategories")} value={form.licenseCategories} onChange={(v) => setForm((f) => ({ ...f, licenseCategories: v }))} placeholder="B1.1, B2…" />
        </div>
        <div className="mt-3">
          <TagInput label={t("passport.typeRatings")} value={form.typeRatings} onChange={(v) => setForm((f) => ({ ...f, typeRatings: v }))} placeholder="A320, B737…" />
        </div>
        <div className="flex justify-end mt-4">
          <Button disabled={save.isPending} onClick={() => save.mutate(form)} style={{ background: BLUE, color: "white" }}>
            <Save className="w-4 h-4 mr-1" /> {save.isPending ? t("passport.saving") : t("passport.saveProfile")}
          </Button>
        </div>
      </div>

      {/* Each type rating expects a rating certificate to be uploaded. */}
      <RatingChecklist typeRatings={form.typeRatings} ratingDocs={docs.filter((d) => d.kind === "RATING")} />

      <DocumentsSection title={t("passport.licenseDocsTitle")} icon={BadgeCheck} docs={docs.filter((d) => d.kind === "LICENSE")} allowedKinds={["LICENSE"]} defaultKind="LICENSE" emptyKey="passport.noLicenseDocs" />
    </div>
  );
}

// Rating certificates checklist: one group per type rating. Each rating can hold
// SEVERAL documents, and every document carries its own renewal ("refresh") date.
// A rating is valid while it has at least one non-expired document; otherwise it
// needs to be renewed (or uploaded if it has none yet).
function RatingChecklist({ typeRatings, ratingDocs }: { typeRatings: string; ratingDocs: any[] }) {
  const { t } = useI18n();
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
    onSuccess: () => { toast.success(t("passport.uploaded")); setTarget(null); setForm(blank); utils.me.passport.documents.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.me.passport.deleteDocument.useMutation({
    onSuccess: () => { toast.success(t("passport.deleted")); utils.me.passport.documents.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const upload = async () => {
    if (!form.file || !target) { toast.error(t("passport.fileRequired")); return; }
    if (form.file.size > 45 * 1024 * 1024) { toast.error(t("passport.fileTooLarge")); return; }
    const dataBase64 = await readAsBase64(form.file);
    add.mutate({
      kind: "RATING", reference: target,
      title: form.title.trim() || t("passport.ratingCertTitle", { rating: target }),
      issuer: form.issuer || undefined, issuedAt: form.issuedAt || undefined, expiresAt: form.expiresAt || undefined,
      fileName: form.file.name, contentType: form.file.type || "application/octet-stream", dataBase64,
    });
  };

  return (
    <div className="rounded-2xl p-6" style={CARD}>
      <h3 className="font-semibold flex items-center gap-2 mb-1" style={{ color: BLUE }}><Plane className="w-4 h-4" style={{ color: GOLD }} /> {t("passport.ratingCertsTitle")}</h3>
      <p className="text-xs mb-4" style={{ color: MUTED }}>{t("passport.ratingCertsHint")}</p>

      {tags.length === 0 ? <Empty text={t("passport.noRatings")} /> : (
        <div className="space-y-3">
          {tags.map((rating) => {
            const docs = docsFor(rating);
            const hasValid = docs.some((d) => !isExpired(d.expiresAt));
            const status = docs.length === 0
              ? { label: t("passport.ratingToUpload"), bg: "oklch(92% 0.01 240)", fg: MUTED }
              : hasValid
                ? { label: t("passport.ratingValid"), bg: `${GREEN}22`, fg: GREEN }
                : { label: t("passport.ratingToRenew"), bg: `${RED}22`, fg: RED };
            return (
              <div key={rating} className="rounded-lg p-3" style={{ background: "oklch(97% 0.01 88)" }}>
                <div className="flex items-center gap-3">
                  <Plane className="w-4 h-4 shrink-0" style={{ color: GOLD }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: BLUE }}>{rating}</div>
                    <div className="text-xs" style={{ color: MUTED }}>{t("passport.ratingDocCount", { count: docs.length })}</div>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: status.bg, color: status.fg }}>{status.label}</span>
                  <Button size="sm" variant="outline" onClick={() => { setTarget(rating); setForm(blank); }}><Upload className="w-4 h-4 mr-1" /> {t("passport.ratingAddDoc")}</Button>
                </div>

                {docs.length > 0 && (
                  <div className="mt-2 pt-2 space-y-1.5 pl-7" style={{ borderTop: `1px dashed ${BORDER}` }}>
                    {docs.map((doc) => {
                      const expired = isExpired(doc.expiresAt);
                      return (
                        <div key={doc.id} className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: MUTED }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate" style={{ color: BLUE }}>{doc.title}</div>
                            <div className="text-[11px] truncate" style={{ color: MUTED }}>
                              {doc.issuedAt && <>{t("passport.issued")} {d(doc.issuedAt)} · </>}
                              {doc.expiresAt
                                ? <>{t("passport.refresh")} <span style={{ color: expired ? RED : MUTED }}>{d(doc.expiresAt)}</span></>
                                : t("passport.noRefresh")}
                            </div>
                          </div>
                          {expired && <span className="flex items-center gap-1 text-[11px] font-semibold shrink-0" style={{ color: RED }}><AlertTriangle className="w-3 h-3" /> {t("passport.expired")}</span>}
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="p-1 rounded shrink-0" title={t("passport.view")} style={{ color: BLUE }}><Download className="w-4 h-4" /></a>
                          <button onClick={() => { if (confirm(t("passport.confirmDelete"))) del.mutate({ id: doc.id }); }} className="text-red-500 p-1 shrink-0" title={t("passport.delete")}><Trash2 className="w-4 h-4" /></button>
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

      <Dialog open={target != null} onOpenChange={(o) => { if (!o) { setTarget(null); setForm(blank); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("passport.ratingCertTitle", { rating: target ?? "" })}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <LabeledInput label={t("passport.fieldTitle")} value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} placeholder={t("passport.ratingCertTitle", { rating: target ?? "" })} />
            <LabeledInput label={t("passport.fieldIssuer")} value={form.issuer} onChange={(v) => setForm((f) => ({ ...f, issuer: v }))} />
            <div className="grid grid-cols-2 gap-2">
              <LabeledInput type="date" label={t("passport.fieldIssuedAt")} value={form.issuedAt} onChange={(v) => setForm((f) => ({ ...f, issuedAt: v }))} />
              <LabeledInput type="date" label={t("passport.refreshDate")} value={form.expiresAt} onChange={(v) => setForm((f) => ({ ...f, expiresAt: v }))} />
            </div>
            <div>
              <Label>{t("passport.fieldFile")}</Label>
              <input type="file" accept=".pdf,image/*" onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] ?? null }))} className="w-full text-sm mt-1 file:mr-2 file:rounded file:border-0 file:px-2 file:py-1 file:text-xs file:cursor-pointer" style={{ color: MUTED }} />
              <p className="text-[11px] mt-1" style={{ color: MUTED }}>{t("passport.fileHint")}</p>
            </div>
            <Button disabled={add.isPending} onClick={upload} className="w-full" style={{ background: BLUE, color: "white" }}>{add.isPending ? t("passport.uploading") : t("passport.save")}</Button>
          </div>
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
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const blank = { kind: defaultKind as Kind, title: "", issuer: "", reference: "", country: "", issuedAt: "", expiresAt: "" };
  const [form, setForm] = useState(blank);
  const reset = () => { setForm(blank); setFile(null); };
  const kindLabel = (k: string) => t(`passport.kind.${k}` as any);

  const add = trpc.me.passport.addDocument.useMutation({
    onSuccess: () => { toast.success(t("passport.uploaded")); setOpen(false); reset(); utils.me.passport.documents.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.me.passport.deleteDocument.useMutation({
    onSuccess: () => { toast.success(t("passport.deleted")); utils.me.passport.documents.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const submit = async () => {
    if (!file) { toast.error(t("passport.fileRequired")); return; }
    if (!form.title.trim()) { toast.error(t("passport.titleRequired")); return; }
    if (file.size > 45 * 1024 * 1024) { toast.error(t("passport.fileTooLarge")); return; }
    const dataBase64 = await readAsBase64(file);
    add.mutate({
      kind: form.kind, title: form.title.trim(),
      issuer: form.issuer || undefined, reference: form.reference || undefined, country: form.country || undefined,
      issuedAt: form.issuedAt || undefined, expiresAt: form.expiresAt || undefined,
      fileName: file.name, contentType: file.type || "application/octet-stream", dataBase64,
    });
  };

  return (
    <div className="rounded-2xl p-6" style={CARD}>
      <div className="flex items-center justify-between mb-4 gap-2">
        <h3 className="font-semibold flex items-center gap-2" style={{ color: BLUE }}><Icon className="w-4 h-4" style={{ color: GOLD }} /> {title}</h3>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button size="sm" style={{ background: BLUE, color: "white" }}><Upload className="w-4 h-4 mr-1" /> {t("passport.addDocument")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{t("passport.addDocument")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{t("passport.fieldKind")}</Label>
                <select value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as Kind }))} className="w-full h-9 rounded-md border px-2 text-sm mt-1" style={{ borderColor: BORDER }}>
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
                <Label>{t("passport.fieldFile")}</Label>
                <input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full text-sm mt-1 file:mr-2 file:rounded file:border-0 file:px-2 file:py-1 file:text-xs file:cursor-pointer" style={{ color: MUTED }} />
                <p className="text-[11px] mt-1" style={{ color: MUTED }}>{t("passport.fileHint")}</p>
              </div>
              <Button disabled={add.isPending} onClick={submit} className="w-full" style={{ background: BLUE, color: "white" }}>{add.isPending ? t("passport.uploading") : t("passport.save")}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {hint && <p className="text-xs mb-3" style={{ color: MUTED }}>{hint}</p>}

      {docs.length === 0 ? <Empty text={t(emptyKey as any)} /> : (
        <div className="space-y-2">
          {docs.map((doc) => {
            const DocIcon = KIND_ICON[doc.kind as Kind] ?? FileText;
            const expired = isExpired(doc.expiresAt);
            return (
              <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "oklch(97% 0.01 88)" }}>
                <DocIcon className="w-5 h-5 shrink-0" style={{ color: GOLD }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: BLUE }}>
                    {doc.title} <span className="text-[11px] font-normal px-1.5 py-0.5 rounded-full" style={{ background: "oklch(92% 0.01 240)", color: MUTED }}>{kindLabel(doc.kind)}</span>
                  </div>
                  <div className="text-xs truncate" style={{ color: MUTED }}>
                    {[doc.issuer, doc.reference, doc.country].filter(Boolean).join(" · ") || doc.fileName}
                    {doc.expiresAt && <> · {t("passport.expires")} <span style={{ color: expired ? RED : MUTED }}>{d(doc.expiresAt)}</span></>}
                  </div>
                </div>
                {expired && <span className="flex items-center gap-1 text-[11px] font-semibold shrink-0" style={{ color: RED }}><AlertTriangle className="w-3 h-3" /> {t("passport.expired")}</span>}
                <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded shrink-0" title={t("passport.view")} style={{ color: BLUE }}><Download className="w-4 h-4" /></a>
                <button onClick={() => { if (confirm(t("passport.confirmDelete"))) del.mutate({ id: doc.id }); }} className="text-red-500 p-1.5 shrink-0" title={t("passport.delete")}><Trash2 className="w-4 h-4" /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm py-6 text-center" style={{ color: MUTED }}>{text}</p>;
}
function Label({ children }: { children: any }) {
  return <label className="text-xs font-semibold" style={{ color: MUTED }}>{children}</label>;
}
function LabeledInput({ label, value, onChange, placeholder, type }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type={type ?? "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 h-9" />
    </div>
  );
}

// Multi-value chip input. Stores/returns a comma-separated string so the backend
// (a plain varchar) is unchanged; the UI exposes add (Enter / +) and remove (×).
function TagInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  const tags = value.split(",").map((s) => s.trim()).filter(Boolean);
  const commit = (next: string[]) => onChange(Array.from(new Set(next)).join(", "));
  const addDraft = () => { const v = draft.trim(); if (v) commit([...tags, v]); setDraft(""); };
  const remove = (tag: string) => commit(tags.filter((x) => x !== tag));

  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 flex flex-wrap gap-1.5 rounded-md border p-2 min-h-9" style={{ borderColor: BORDER }}>
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full" style={{ background: `${GOLD}22`, color: BLUE }}>
            {tag}
            <button type="button" onClick={() => remove(tag)} className="hover:opacity-70" aria-label="remove"><X className="w-3 h-3" /></button>
          </span>
        ))}
        <input
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
