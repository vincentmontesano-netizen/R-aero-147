import { useDraftExitGuard } from "@/hooks/useDraftExitGuard";
import { useEffect, useState, useRef } from "react";
import { Link } from "wouter";
import { ShieldCheck, FileText, Plus, Upload, Send, ArrowLeft, History } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { requestId as createRequestId } from "@/lib/requestId";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n";
import PublicNav from "@/components/PublicNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function VerificationCenter() {
  const { user } = useAuth();
  return <VerificationWorkspace key={`${user?.id ?? 'anonymous'}:${user?.role ?? ''}`} />;
}

function VerificationWorkspace() {
  const { user, loading } = useAuth();
  const { lang } = useI18n();
  const tr = (fr: string, en: string, ar: string) => lang === "fr" ? fr : lang === "ar" ? ar : en;
  const [queue, setQueue] = useState(false);
  const [queueStatus, setQueueStatus] = useState<'all' | 'draft' | 'submitted' | 'needs_information' | 'approved' | 'rejected'>('submitted');
  const [mineBeforeId,setMineBeforeId]=useState<number|undefined>();
  const [queueBeforeId, setQueueBeforeId] = useState<number | undefined>();
  const [selected, setSelected] = useState<number | null>(null);
  const [form, setForm] = useState({ kind: "kyc" as "kyc" | "kyb", companyId: "", legalName: "", country: "", registrationNumber: "", address: "" });
  const dirty = useRef(false);
  const loadedRevision=useRef<number|null>(null);
  const loadedCase = useRef<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const editForm = (next: typeof form) => { dirty.current = true; setHasChanges(true); setForm(next); };
  const resetDraft = () => { dirty.current = false; setHasChanges(false); loadedCase.current = null; loadedRevision.current=null; };
  const [documentKind, setDocumentKind] = useState("identity" as "identity" | "registration" | "authority" | "supporting");
  const reviewRevision=useRef<number|null>(null);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProblem, setUploadProblem] = useState<'size' | 'type' | 'read' | 'send' | null>(null);
  const uploadLock = useRef(false);
  const pendingUpload = useRef<{ signature: string; requestId: string } | null>(null);
  useEffect(() => { pendingUpload.current = null; }, [selected]);
  const mounted = useRef(true);
  const activeReader = useRef<FileReader | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; activeReader.current?.abort(); }; }, []);
  const utils = trpc.useUtils();
  const mine = trpc.verification.minePage.useQuery({beforeId:mineBeforeId}, { enabled: !!user && !queue });
  const admin = trpc.verification.queuePage.useQuery({ beforeId: queueBeforeId, status: queueStatus === 'all' ? undefined : queueStatus }, { enabled: user?.role === "admin" && queue });
  const orgs = trpc.me.organizations.useQuery(undefined, { enabled: !!user });
  const detail = trpc.verification.detail.useQuery({ id: selected ?? 0 }, { enabled: !!user && selected !== null });
  const refresh = async () => { await Promise.all([utils.verification.mine.invalidate(), utils.verification.minePage.invalidate(), utils.verification.detail.invalidate(), utils.verification.history.invalidate(), utils.verification.documentsPage.invalidate(), utils.verification.queue.invalidate(), utils.verification.queuePage.invalidate()]); };
  const error = (e: { message: string }) => toast.error(e.message);
  const save = trpc.verification.save.useMutation({ onSuccess: async record => { dirty.current = false; setHasChanges(false); setSelected(record.id); await refresh(); }, onError: e=>{error(e);if(e.data?.code==='CONFLICT')void refresh();} });
  const upload = trpc.verification.upload.useMutation({ onSuccess: refresh, onError: e => { error(e); void refresh(); } });
  const submit = trpc.verification.submit.useMutation({ onSuccess: refresh, onError: e=>{error(e);void refresh();} });
  const review = trpc.verification.review.useMutation({ onSuccess: async () => { setNote(""); reviewRevision.current=null; await refresh(); }, onError: e=>{error(e);void refresh();} });
  const archive = trpc.verification.archiveDocument.useMutation({ onSuccess: refresh, onError: error });
  const busy = save.isPending || upload.isPending || uploading || submit.isPending || review.isPending || archive.isPending;
  const canLeave=useDraftExitGuard(hasChanges||note.length>0||busy,tr(
    "Quitter ce dossier ? Les modifications et le motif de revue non enregistrés seront perdus.",
    "Leave this file? Unsaved changes and the review reason will be lost.",
    "هل تريد مغادرة هذا الملف؟ ستفقد التغييرات وسبب المراجعة غير المحفوظين."
  ));
  const record = detail.data;
  useEffect(() => {
    if (record && (loadedCase.current !== record.id || !dirty.current || !["draft", "needs_information", "rejected"].includes(record.status))) {
      if (loadedCase.current !== record.id) { setNote(""); setUploadProblem(null); setDocumentKind(record.kind === "kyb" ? "registration" : "identity"); }
      loadedCase.current = record.id;
      loadedRevision.current=record.revision;
      dirty.current = false;
      setHasChanges(false);
      setForm({ kind: record.kind as "kyc" | "kyb", companyId: String(record.companyId ?? ""), legalName: record.legalName, country: record.country, registrationNumber: record.registrationNumber ?? "", address: record.address });
    }
  }, [record]);
  const needsOrganizations = form.kind === "kyb" && !record;
  const organizationsUnavailable = needsOrganizations && (orgs.isLoading || orgs.isError || !orgs.data);
  const editable = !queue && (!record || ["draft", "needs_information", "rejected"].includes(record.status));
  const labels: Record<string, string> = {
    draft: tr("Brouillon", "Draft", "مسودة"), submitted: tr("En cours d’examen", "Awaiting review", "قيد المراجعة"), needs_information: tr("Complément demandé", "Information requested", "معلومات مطلوبة"), approved: tr("Dossier validé", "File approved", "ملف معتمد"), rejected: tr("Dossier refusé", "File declined", "ملف مرفوض"),
    identity: tr("Pièce d’identité", "Identity document", "وثيقة هوية"), registration: tr("Immatriculation de la société", "Company registration", "تسجيل الشركة"), authority: tr("Mandat du représentant", "Representative authority", "تفويض الممثل"), supporting: tr("Justificatif complémentaire", "Supporting document", "وثيقة داعمة"),
    created: tr("Dossier créé", "File created", "إنشاء الملف"), updated: tr("Dossier modifié", "File updated", "تحديث الملف"), document_added: tr("Pièce ajoutée", "Document added", "إضافة وثيقة"), document_archived: tr("Pièce archivée", "Document archived", "أرشفة وثيقة"),
  };
  const field = "grid gap-2 text-sm font-medium";
  const inputStyle = "rounded-md border border-slate-300 bg-white p-3 min-h-11 w-full";
  const uploadErrors = {
    size: tr("Choisissez un fichier non vide de 8 Mo maximum.", "Choose a non-empty file up to 8 MB.", "اختر ملفًا غير فارغ لا يتجاوز 8 ميغابايت."),
    type: tr("Formats acceptés : PDF, JPEG ou PNG.", "Accepted formats: PDF, JPEG or PNG.", "الصيغ المقبولة: PDF أو JPEG أو PNG."),
    read: tr("Le fichier n’a pas pu être lu. Sélectionnez-le à nouveau pour réessayer.", "The file could not be read. Select it again to retry.", "تعذّرت قراءة الملف. حدّده مجدداً لإعادة المحاولة."),
    send: tr("L’ajout n’a pas été confirmé. Réessayez avec le même fichier et la même nature de pièce pour retrouver ce dépôt sans doublon. Consultez les justificatifs avant de changer de fichier ou de quitter cette page.", "The upload was not confirmed. Retry with the same file and document type to recover this upload without a duplicate. Check the evidence list before changing the file or leaving this page.", "لم يتم تأكيد الإضافة. أعد المحاولة بنفس الملف ونوع الوثيقة لاستعادة هذا الإيداع دون تكرار. تحقّق من المستندات قبل تغيير الملف أو مغادرة الصفحة."),
  };
  const uploadFile = async (file: File) => {
    if (!record || !editable || busy || uploadLock.current) return;
    setUploadProblem(null);
    if (!file.size || file.size > 8 * 1024 * 1024) { setUploadProblem('size'); return; }
    const contentType = file.type;
    if (contentType !== 'application/pdf' && contentType !== 'image/png' && contentType !== 'image/jpeg') { setUploadProblem('type'); return; }
    uploadLock.current = true;
    setUploading(true);
    try {
      let dataBase64: string;
      try {
        dataBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader(); activeReader.current = reader;
          reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
          reader.onerror = () => reject(reader.error);
          reader.onabort = () => reject(new Error('File reading aborted'));
          reader.readAsDataURL(file);
        });
      } catch { if (mounted.current) setUploadProblem('read'); return; }
      if (!mounted.current) return;
      const payload = { caseId: record.id, kind: documentKind, fileName: file.name, contentType, dataBase64 } as const;
      const signature = JSON.stringify(payload);
      if (pendingUpload.current?.signature !== signature) pendingUpload.current = { signature, requestId: createRequestId() };
      try {
        const document = await upload.mutateAsync({ ...payload, requestId: pendingUpload.current.requestId });
        pendingUpload.current = null;
        if (mounted.current && document.archivedAt) toast.info(tr("Ce dépôt a été retrouvé, mais sa pièce est déjà archivée.", "This upload was recovered, but its document is already archived.", "تم العثور على هذا الإيداع، لكن وثيقته مؤرشفة بالفعل."));
      }
      catch { if (mounted.current) setUploadProblem('send'); }
    } finally {
      activeReader.current = null;
      uploadLock.current = false;
      if (mounted.current) setUploading(false);
    }
  };
  if (loading) return <p role="status" className="p-12">{tr("Chargement…", "Loading…", "جار التحميل…")}</p>;
  if (!user) return <div className="min-h-screen grid place-items-center"><Link href="/login"><Button>{tr("Connectez-vous pour accéder à vos dossiers", "Sign in to access your files", "سجّل الدخول للوصول إلى ملفاتك")}</Button></Link></div>;
  const rows = queue ? admin : mine;
  const changeMinePage=(cursor?:number)=>{
    if(busy||mine.isFetching||!canLeave())return;
    resetDraft();setNote("");setSelected(null);setMineBeforeId(cursor);
    setForm({kind:"kyc",companyId:"",legalName:user.name??"",country:"",registrationNumber:"",address:""});
    if(cursor===undefined)void utils.verification.minePage.invalidate();
  };
  const entries = queue ? admin.data?.entries : mine.data?.entries;
  const changeQueuePage = (cursor?: number) => {
    if (busy || admin.isFetching || !canLeave()) return;
    resetDraft(); setNote(""); setSelected(null); setQueueBeforeId(cursor);
  };
  return <div className="min-h-screen bg-slate-50 text-slate-900"><PublicNav /><main className="max-w-7xl mx-auto px-5 pt-28 pb-20">
    <Link href={user.role === "admin" ? "/admin" : "/dashboard"} onClick={e=>{if(busy||!canLeave())e.preventDefault();}} className="inline-flex gap-2 items-center text-sm mb-6"><ArrowLeft size={16} />{tr("Mon espace", "My workspace", "مساحتي")}</Link>
    <header className="flex flex-wrap justify-between items-start gap-6 mb-8"><div><p className="text-sm tracking-widest text-amber-800 mb-3">KYC / KYB</p><h1 className="text-3xl font-sans font-semibold flex items-center gap-3"><ShieldCheck />{tr("Vérification des dossiers", "Document verification", "التحقق من الملفات")}</h1><p className="text-slate-600 mt-4 max-w-2xl">{tr("Une revue documentaire par notre équipe. Vos justificatifs restent privés. Cette validation ne constitue pas un agrément aéronautique.", "A documentary review by our team. Your evidence stays private. This validation is not an aviation approval.", "مراجعة وثائق يجريها فريقنا. تبقى مستنداتك خاصة. هذا التحقق لا يمثل اعتمادًا للطيران.")}</p></div>
    {user.role === "admin" && <Button variant="outline" disabled={busy} onClick={() => { if (!canLeave()) return; resetDraft(); setNote(""); setQueue(!queue); setQueueBeforeId(undefined); setSelected(null); setForm({ kind: "kyc", companyId: "", legalName: user.name ?? "", country: "", registrationNumber: "", address: "" }); }}>{queue ? tr("Mes dossiers", "My files", "ملفاتي") : tr("File de revue ADMIN", "Admin review queue", "قائمة مراجعة الإدارة")}</Button>}</header>
    <div className="grid lg:grid-cols-[300px_1fr] gap-7"><aside className="space-y-3">
      {!queue && <Button className="w-full" variant="outline" disabled={busy} onClick={() => { if (!canLeave()) return; resetDraft(); setNote(""); setSelected(null); setForm({ kind: "kyc", companyId: "", legalName: user.name ?? "", country: "", registrationNumber: "", address: "" }); }}><Plus size={16} />{tr("Nouveau dossier", "New file", "ملف جديد")}</Button>}
      {queue && <div className="space-y-3 rounded-xl border bg-white p-4">
        <label className={field}>{tr("Filtrer par statut", "Filter by status", "التصفية حسب الحالة")}<select className={inputStyle} value={queueStatus} disabled={busy || admin.isFetching} onChange={e => { if (!canLeave()) return; resetDraft(); setNote(""); setSelected(null); setQueueBeforeId(undefined); setQueueStatus(e.target.value as typeof queueStatus); }}>
          <option value="all">{tr("Tous les statuts", "All statuses", "جميع الحالات")}</option>
          {(['submitted', 'needs_information', 'draft', 'approved', 'rejected'] as const).map(status => <option key={status} value={status}>{labels[status]}</option>)}
        </select></label>
        <p className="text-xs text-slate-600">{tr("50 dossiers par page, du plus récemment créé au plus ancien.", "50 files per page, newest created first.", "50 ملفًا في الصفحة، بدءًا بالأحدث إنشاءً.")}</p>
        <Button variant="outline" size="sm" disabled={busy || admin.isFetching} onClick={() => { if (queueBeforeId !== undefined) changeQueuePage(); else void admin.refetch(); }}>{tr("Actualiser les derniers dossiers", "Refresh newest files", "تحديث أحدث الملفات")}</Button>
      </div>}
      {rows.isLoading && <p role="status">{tr("Chargement…", "Loading…", "جار التحميل…")}</p>}
      {rows.isError && <VerificationReadError busy={rows.isFetching} retry={() => { void rows.refetch(); }} />}
      {!rows.isLoading && !rows.isError && entries?.length === 0 && <p className="p-5 text-slate-500">{tr("Aucun dossier dans cette liste.", "No files in this list.", "لا توجد ملفات في هذه القائمة.")}</p>}
      {!rows.isError && entries?.map(item => <button key={item.id} disabled={busy} onClick={() => { if (selected === item.id || !canLeave()) return; resetDraft(); setNote(""); setSelected(item.id); }} className={`w-full text-start p-5 rounded-xl border ${selected === item.id ? "border-slate-900 bg-slate-100" : "border-slate-200 bg-white"}`}><span className="text-xs tracking-widest">{item.kind.toUpperCase()} · #{item.id}</span><strong className="block my-2">{item.legalName}</strong><span className="text-sm text-slate-600">{labels[item.status]}</span></button>)}
      {!queue&&<div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy||mine.isFetching} onClick={()=>changeMinePage()}>{tr("Actualiser les derniers dossiers","Refresh newest files","تحديث أحدث الملفات")}</Button>{!mine.isError&&mine.data?.nextCursor&&<Button variant="outline" disabled={busy||mine.isFetching} onClick={()=>changeMinePage(mine.data!.nextCursor!)}>{tr("Dossiers plus anciens","Older files","ملفات أقدم")}</Button>}</div>}
      {queue && !admin.isError && admin.data?.nextCursor && <Button variant="outline" className="w-full" disabled={busy || admin.isFetching} onClick={() => changeQueuePage(admin.data!.nextCursor!)}>{tr("Dossiers plus anciens", "Older files", "ملفات أقدم")}</Button>}
    </aside><div className="space-y-6">
      {detail.isError ? <VerificationReadError busy={detail.isFetching} retry={() => { void detail.refetch(); }} /> : selected && detail.isLoading ? <p role="status">{tr("Chargement…", "Loading…", "جار التحميل…")}</p> : queue && !record ? <p className="p-10 rounded-xl border bg-white">{tr("Sélectionnez un dossier à examiner.", "Select a file to review.", "اختر ملفًا للمراجعة.")}</p> : <>
      {record?.reviewNote && <div className="p-5 rounded-xl bg-amber-50 border border-amber-200"><strong>{labels[record.status]}</strong><p className="mt-2 whitespace-pre-wrap">{record.reviewNote}</p></div>}
      {save.error?.data?.code==='CONFLICT'&&<p role="alert" className="p-4 rounded border border-amber-300 bg-amber-50">{tr("La sauvegarde a été refusée car le dossier a changé. Si vous souhaitez conserver vos saisies, copiez-les avant de rouvrir le dossier.","Saving was refused because the file has changed. If you wish to keep your entries, copy them before reopening the file.","تم رفض الحفظ لأن الملف تغيّر. إذا أردت الاحتفاظ بمدخلاتك، فانسخها قبل إعادة فتح الملف.")}</p>}
      <form className="p-6 md:p-8 bg-white rounded-xl border border-slate-200 space-y-5" onSubmit={e => { e.preventDefault(); if (!editable || busy || organizationsUnavailable) return; save.mutate({ ...form, expectedRevision:loadedRevision.current, companyId: form.kind === "kyb" ? Number(form.companyId) : undefined }); }}>
        <h2 className="text-xl font-sans font-semibold">{tr("Informations du dossier", "File information", "معلومات الملف")}</h2>
        <fieldset disabled={!editable || busy} className="grid sm:grid-cols-2 gap-5">
          <label className={field}>{tr("Type", "Type", "النوع")}<select className={inputStyle} disabled={!!record} value={form.kind} onChange={e => editForm({ ...form, kind: e.target.value as "kyc" | "kyb" })}><option value="kyc">{tr("Particulier — KYC", "Individual — KYC", "فرد — KYC")}</option><option value="kyb">{tr("Entreprise — KYB", "Company — KYB", "شركة — KYB")}</option></select></label>
          {form.kind === "kyb" && <label className={field}>{tr("Organisation", "Organisation", "المؤسسة")}<select required className={inputStyle} disabled={!!record || organizationsUnavailable} value={form.companyId} onChange={e => editForm({ ...form, companyId: e.target.value })}><option value="">—</option>{record?.companyId && !orgs.data?.some(o => o.orgId === record.companyId && o.role === "MANAGER") && <option value={String(record.companyId)}>#{record.companyId} · {record.legalName}</option>}{orgs.data?.filter(o => o.role === "MANAGER").map(o => <option key={o.orgId} value={o.orgId}>{o.name}</option>)}</select></label>}
          <label className={field}>{tr("Nom légal complet", "Full legal name", "الاسم القانوني الكامل")}<Input required minLength={2} maxLength={255} value={form.legalName} onChange={e => editForm({ ...form, legalName: e.target.value })} /></label>
          <label className={field}>{tr("Pays (code à 2 lettres)", "Country (2-letter code)", "الدولة (رمز من حرفين)")}<Input required minLength={2} maxLength={2} placeholder="FR" value={form.country} onChange={e => editForm({ ...form, country: e.target.value.toUpperCase() })} /></label>
          {form.kind === "kyb" && <label className={field}>{tr("Numéro d’immatriculation", "Registration number", "رقم التسجيل")}<Input required value={form.registrationNumber} onChange={e => editForm({ ...form, registrationNumber: e.target.value })} /></label>}
          <label className={`${field} sm:col-span-2`}>{tr("Adresse", "Address", "العنوان")}<Textarea required minLength={5} maxLength={2000} value={form.address} onChange={e => editForm({ ...form, address: e.target.value })} /></label>
        </fieldset>
        {needsOrganizations && orgs.isLoading && <p role="status">{tr("Chargement des organisations…", "Loading organisations…", "جار تحميل المؤسسات…")}</p>}
        {needsOrganizations && orgs.isError && <VerificationReadError busy={orgs.isFetching} retry={() => { void orgs.refetch(); }} />}
        {needsOrganizations && !organizationsUnavailable && !orgs.data?.some(o => o.role === 'MANAGER') && <p className="text-sm text-slate-600">{tr("Une affiliation active de responsable d’organisation est nécessaire pour créer un dossier KYB.", "An active organisation manager affiliation is required to create a KYB file.", "يلزم ارتباط نشط بصفة مسؤول مؤسسة لإنشاء ملف KYB.")}</p>}
        {editable && <Button disabled={busy || organizationsUnavailable} type="submit">{tr("Enregistrer le brouillon", "Save draft", "حفظ المسودة")}</Button>}
      </form>
      {record && <section className="p-6 md:p-8 bg-white rounded-xl border space-y-5"><h2 className="font-sans text-xl font-semibold">{tr("Justificatifs", "Evidence", "المستندات")}</h2><p className="text-sm text-slate-600">{record.kind === "kyc" ? tr("Requis : une pièce d’identité. PDF, JPEG ou PNG, 8 Mo maximum.", "Required: an identity document. PDF, JPEG or PNG, up to 8 MB.", "المطلوب: وثيقة هوية. PDF أو JPEG أو PNG حتى 8 ميغابايت.") : tr("Requis : immatriculation de la société et mandat du représentant. PDF, JPEG ou PNG, 8 Mo maximum.", "Required: company registration and representative authority. PDF, JPEG or PNG, up to 8 MB.", "المطلوب: تسجيل الشركة وتفويض الممثل. PDF أو JPEG أو PNG حتى 8 ميغابايت.")}</p>
        <VerificationDocuments key={record.id} id={record.id} labels={labels} editable={editable} busy={busy} archive={id=>archive.mutate({id})} />
        {editable && <div className="grid sm:grid-cols-2 gap-4"><label className={field}>{tr("Nature de la pièce", "Document type", "نوع الوثيقة")}<select disabled={busy} className={inputStyle} value={documentKind} onChange={e => setDocumentKind(e.target.value as typeof documentKind)}>{(record.kind === "kyc" ? ["identity", "supporting"] : ["registration", "authority", "supporting"]).map(kind => <option key={kind} value={kind}>{labels[kind]}</option>)}</select></label><label className={field}><span className="flex gap-2 items-center"><Upload size={16} />{tr("Ajouter un fichier", "Add a file", "إضافة ملف")}</span><input type="file" accept="application/pdf,image/png,image/jpeg" disabled={busy} className={inputStyle} onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void uploadFile(file); }} /></label></div>}
        {uploading && <p role="status" className="text-sm">{tr("Lecture et envoi du fichier…", "Reading and uploading file…", "جار قراءة الملف ورفعه…")}</p>}
        {uploadProblem && <p role="alert" className="text-sm text-red-700">{uploadErrors[uploadProblem]}</p>}
        {editable && hasChanges && <p role="status" className="text-sm text-amber-800">{tr("Enregistrez vos modifications avant l’envoi pour examen.", "Save your changes before submitting for review.", "احفظ التغييرات قبل الإرسال للمراجعة.")}</p>}
        {editable && <Button disabled={busy || hasChanges} onClick={() => { if (!dirty.current && !busy) submit.mutate({ id: record.id, expectedRevision:record.revision }); }}><Send size={16} />{tr("Envoyer pour examen", "Submit for review", "إرسال للمراجعة")}</Button>}
      </section>}
      {queue && record?.status === "submitted" && <section className="p-6 bg-white rounded-xl border space-y-4"><h2 className="font-sans text-xl font-semibold">{tr("Décision de revue", "Review decision", "قرار المراجعة")}</h2>{review.error?.data?.code==='CONFLICT'&&<p role="alert" className="text-sm text-amber-800">{tr("Le dossier a changé. Consultez les informations actualisées, puis effacez et rédigez à nouveau votre motif avant de confirmer une décision.","The file has changed. Review the updated information, then clear and rewrite your reason before confirming a decision.","تغيّر الملف. راجع المعلومات المحدّثة، ثم امسح السبب وأعد كتابته قبل تأكيد القرار.")}</p>}<label className={field}>{tr("Motif communiqué au client", "Reason shared with the client", "السبب المرسل للعميل")}<Textarea disabled={review.isPending} value={note} maxLength={4000} onChange={e => {if(!note)reviewRevision.current=record.revision;setNote(e.target.value);}} /></label><div className="flex flex-wrap gap-3">{(["approved", "needs_information", "rejected"] as const).map(status => <Button key={status} variant={status === "approved" ? "default" : "outline"} disabled={review.isPending || note.trim().length < 5} onClick={() => review.mutate({ id: record.id, status, note, expectedRevision:reviewRevision.current??record.revision })}>{labels[status]}</Button>)}</div></section>}
      {record && <VerificationHistory key={record.id} id={record.id} labels={labels} />}
      </>}
    </div></div>
  </main></div>;
}

function VerificationReadError({ busy, retry }: { busy: boolean; retry: () => void }) {
  const { lang, t } = useI18n();
  return <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-5">
    <p role="alert" className="text-sm">{lang === 'fr' ? 'Ces données n’ont pas pu être actualisées. Réessayez pour consulter leur état.' : lang === 'ar' ? 'تعذّر تحديث هذه البيانات. أعد المحاولة للاطلاع على حالتها.' : 'These records could not be refreshed. Retry to check their status.'}</p>
    <Button type="button" variant="outline" disabled={busy} onClick={retry}>{t('learningPlayer.save.retry')}</Button>
  </div>;
}

function VerificationHistory({id,labels}:{id:number;labels:Record<string,string>}) {
  const {lang}=useI18n();
  const tr=(fr:string,en:string,ar:string)=>lang==='fr'?fr:lang==='ar'?ar:en;
  const [beforeId,setBeforeId]=useState<number|undefined>();
  const history=trpc.verification.history.useQuery({id,beforeId});
  return <section className="p-6 bg-white rounded-xl border space-y-4">
    <h2 className="font-sans text-xl font-semibold flex items-center gap-2"><History size={20}/>{tr('Historique','History','السجل')}</h2>
    <p className="text-xs text-slate-600">{tr('50 événements par page, du plus récent au plus ancien.','50 events per page, newest first.','50 حدثًا في الصفحة، بدءًا بالأحدث.')}</p>
    <Button variant="outline" size="sm" disabled={history.isFetching} onClick={()=>{if(beforeId!==undefined)setBeforeId(undefined);else void history.refetch();}}>{tr('Actualiser les derniers événements','Refresh latest events','تحديث أحدث الأحداث')}</Button>
    {history.isLoading && <p role="status">{tr('Chargement…','Loading…','جار التحميل…')}</p>}
    {history.isError ? <VerificationReadError busy={history.isFetching} retry={()=>{void history.refetch();}}/> : <>
      {history.data?.entries.length===0 && <p>{tr('Aucun événement.','No events.','لا توجد أحداث.')}</p>}
      <ol className="space-y-3">{history.data?.entries.map(event=><li key={event.id} className="border-b py-3 text-sm space-y-2">
        <div className="flex flex-wrap gap-3 justify-between"><span>{labels[event.action]??event.action}</span><time dateTime={new Date(event.createdAt).toISOString()}>{new Date(event.createdAt).toLocaleString(lang)}</time></div>
        {event.reviewNote && <p className="whitespace-pre-wrap break-words">{event.reviewNote}</p>}
      </li>)}</ol>
      {history.data?.nextCursor && <Button variant="outline" disabled={history.isFetching} onClick={()=>setBeforeId(history.data!.nextCursor!)}>{tr('Événements plus anciens','Older events','أحداث أقدم')}</Button>}
    </>}
  </section>;
}

function VerificationDocuments({id,labels,editable,busy,archive}:{id:number;labels:Record<string,string>;editable:boolean;busy:boolean;archive:(id:number)=>void}) {
  const {lang}=useI18n();
  const tr=(fr:string,en:string,ar:string)=>lang==='fr'?fr:lang==='ar'?ar:en;
  const [archived,setArchived]=useState(false);
  const [beforeId,setBeforeId]=useState<number|undefined>();
  const page=trpc.verification.documentsPage.useQuery({id,archived,beforeId});
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-3">{[false,true].map(value=><Button key={String(value)} variant={archived===value?'default':'outline'} aria-pressed={archived===value} disabled={busy||page.isFetching} onClick={()=>{setArchived(value);setBeforeId(undefined);}}>{value?tr('Pièces archivées','Archived evidence','المستندات المؤرشفة'):tr('Pièces actuelles','Current evidence','المستندات الحالية')}</Button>)}</div>
    <p className="text-xs text-slate-600">{tr('50 pièces par page, du dernier dépôt au plus ancien.','50 files per page, latest upload first.','50 ملفًا في الصفحة، بدءًا بآخر رفع.')}</p>
    {archived && <p className="text-sm text-slate-600">{tr('Les pièces archivées ne sont plus utilisées pour la revue. Leurs informations restent consultables ici ; leur téléchargement est désactivé.','Archived evidence is no longer used for review. Its information remains available here; downloads are disabled.','لم تعد المستندات المؤرشفة مستخدمة للمراجعة. تبقى معلوماتها متاحة هنا والتنزيل معطل.')}</p>}
    <Button variant="outline" size="sm" disabled={busy||page.isFetching} onClick={()=>{if(beforeId!==undefined)setBeforeId(undefined);else void page.refetch();}}>{tr('Actualiser les derniers dépôts','Refresh latest uploads','تحديث أحدث الملفات المرفوعة')}</Button>
    {page.isLoading && <p role="status">{tr('Chargement…','Loading…','جار التحميل…')}</p>}
    {page.isError?<VerificationReadError busy={page.isFetching} retry={()=>{void page.refetch();}}/>:<>
      {page.data?.entries.length===0 && <p className="text-sm">{tr('Aucune pièce dans cette liste.','No evidence in this list.','لا توجد مستندات في هذه القائمة.')}</p>}
      {page.data?.entries.map(doc=><div key={doc.id} className="flex flex-wrap gap-3 items-center justify-between border-b py-3">
        <div className="min-w-0 space-y-1"><div className="flex items-center gap-2 text-sm break-all"><FileText size={18}/>{doc.fileUrl?<a href={doc.fileUrl} target="_blank" rel="noreferrer" className="underline">{labels[doc.kind]} · {doc.fileName}</a>:<span>{labels[doc.kind]} · {doc.fileName}</span>}</div>
          <p className="text-xs text-slate-600">{tr('Déposé le','Uploaded on','تاريخ الرفع')} {new Date(doc.createdAt).toLocaleString(lang)}</p>
          {doc.archivedAt && <p className="text-xs text-slate-600">{tr('Archivé le','Archived on','تاريخ الأرشفة')} {new Date(doc.archivedAt).toLocaleString(lang)}</p>}
        </div>
        {!archived&&editable&&<Button variant="ghost" size="sm" disabled={busy||page.isFetching} onClick={()=>archive(doc.id)}>{tr('Archiver','Archive','أرشفة')}</Button>}
      </div>)}
      {page.data?.nextCursor&&<Button variant="outline" disabled={busy||page.isFetching} onClick={()=>setBeforeId(page.data!.nextCursor!)}>{tr('Dépôts plus anciens','Older uploads','ملفات أقدم')}</Button>}
    </>}
  </div>;
}
