import { LanguageSwitcher } from "@/components/PublicNav";
import SupportNotificationQueue from "@/components/SupportNotificationQueue";
import { requestId as createRequestId } from "@/lib/requestId";
import BroadcastHistory from "@/components/BroadcastHistory";
import {supportRequestLabels,type supportRequestKinds} from "../../../shared/supportRequest";
import {collectComplianceReport} from "../../../shared/collectComplianceReport";
import {certificateReportLabels} from "../../../shared/certificateReport";
import {spreadsheetCsv} from "../../../shared/csvExport";
import AdminCertificates from "@/components/AdminCertificates";
import AdminWebinars from "@/components/AdminWebinars";
import OrganizationStatusHistory from "@/components/OrganizationStatusHistory";
import ExamFinalizationAlerts from "@/components/ExamFinalizationAlerts";
import PaymentReconciliation from "@/components/PaymentReconciliation";
import RefundHistory from "@/components/RefundHistory";
import { useState, useEffect, useRef } from "react";
import { useI18n } from "@/i18n";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import QuoteManageDialog from "@/components/QuoteManageDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Users, BookOpen, ShoppingCart, FileText, BarChart3, Award,
  Plus, XCircle, GraduationCap, Download, CheckCircle, Clock, AlertCircle, Ban, Pencil, Trash2, Calendar, Newspaper, Layers, LifeBuoy, Megaphone, Building2, UserCog, Settings, ShieldCheck, Mail, Send, CreditCard, HelpCircle
} from "lucide-react";
import DashboardSidebar from "@/components/DashboardSidebar";
import TicketThread from "@/components/TicketThread";
import UserFormDialog from "@/components/UserFormDialog";
import OrgFormDialog from "@/components/OrgFormDialog";
import OrgManagersDialog from "@/components/OrgManagersDialog";
import UserMenu from "@/components/UserMenu";
import AdminInbox from "@/components/AdminInbox";
import AdminOffers from "@/components/AdminOffers";
import AdminFaq from "@/components/AdminFaq";
import { toast } from "sonner";
import { Link } from "wouter";
import { Sparkles } from "lucide-react";
import BackButton from "@/components/BackButton";
import AdminContentManager from "@/components/AdminContentManager";
import AdminSessions from "@/components/AdminSessions";
import AdminArticles from "@/components/AdminArticles";
import { useUrlTab } from "@/hooks/useUrlTab";
import { catalogueKey, formatHours } from "@/lib/utils";

const QUOTE_STATUS: Record<string, { labelKey: string; color: string }> = {
  received: { labelKey: "adminDashboard.quoteStatusReceived", color: "var(--info)" },
  in_progress: { labelKey: "adminDashboard.quoteStatusInProgress", color: "var(--link)" },
  quote_sent: { labelKey: "adminDashboard.quoteStatusQuoteSent", color: "var(--success)" },
  accepted: { labelKey: "adminDashboard.quoteStatusAccepted", color: "var(--success)" },
  refused: { labelKey: "adminDashboard.quoteStatusRefused", color: "var(--destructive)" },
};

const ORDER_STATUS: Record<string, { labelKey: string; color: string }> = {
  pending: { labelKey: "adminDashboard.orderStatusPending", color: "var(--link)" },
  paid: { labelKey: "adminDashboard.orderStatusPaid", color: "var(--success)" },
  failed: { labelKey: "adminDashboard.orderStatusFailed", color: "var(--destructive)" },
  refunded: { labelKey: "adminDashboard.orderStatusRefunded", color: "var(--info)" },
  cancelled: { labelKey: "adminDashboard.orderStatusCancelled", color: "var(--muted-foreground)" },
};

const ENROLLMENT_STATUS_ICONS: Record<string, any> = {
  completed: CheckCircle,
  in_progress: Clock,
  not_started: Clock,
  expired: AlertCircle,
  failed: AlertCircle,
};

function TrainingFormDialog({ training, open, onOpenChange, onSuccess }: { training: any | null; open: boolean; onOpenChange: (o: boolean) => void; onSuccess: () => void }) {
  const { t } = useI18n();
  const isEdit = !!training;
  const blank = { title: "", slug: "", description: "", type: "elearning", domain: "general", language: "fr", durationHours: "", priceHt: "", priceTtc: "", part147Reference: "", isPublished: false, passingScore: 75, maxAttempts: 3 };
  const [form, setForm] = useState<Record<string, any>>(blank);
  useEffect(() => {
    if (!open) return;
    setForm(training ? {
      title: training.title ?? "", slug: training.slug ?? "", description: training.description ?? "",
      type: training.type ?? "elearning", domain: training.domain ?? "general", language: training.language ?? "fr",
      durationHours: training.durationHours ?? "", priceHt: training.priceHt ?? "", priceTtc: training.priceTtc ?? "",
      part147Reference: training.part147Reference ?? "", isPublished: !!training.isPublished,
      passingScore: training.passingScore ?? 75, maxAttempts: training.maxAttempts ?? 3,
    } : blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, training]);
  const createTraining = trpc.admin.trainings.create.useMutation({
    onSuccess: () => { toast.success(t("adminDashboard.toastTrainingCreated")); onSuccess(); },
    onError: () => toast.error(t("adminDashboard.toastCreateError")),
  });
  const updateTrainingFull = trpc.admin.trainings.update.useMutation({
    onSuccess: () => { toast.success(t("adminDashboard.toastTrainingUpdated")); onSuccess(); },
    onError: () => toast.error(t("adminDashboard.toastUpdateError")),
  });
  const saving = createTraining.isPending || updateTrainingFull.isPending;
  const save = () => { if (isEdit) updateTrainingFull.mutate({ id: training.id, ...form } as any); else createTraining.mutate(form as any); };
  const generateSlug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? t("adminDashboard.dialogEditTraining") : t("adminDashboard.dialogCreateTraining")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="col-span-2">
            <label className="text-sm font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.fieldTitleRequired")}</label>
            <Input value={form.title} onChange={(e) => setForm((f: any) => ({ ...f, title: e.target.value, ...(isEdit ? {} : { slug: generateSlug(e.target.value) }) }))} placeholder={t("adminDashboard.placeholderTrainingTitle")} />
          </div>
          <div className="col-span-2">
            <label className="text-sm font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.fieldSlug")}</label>
            <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="human-factors-initial" />
          </div>
          <div className="col-span-2">
            <label className="text-sm font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.fieldDescription")}</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full rounded-md border px-3 py-2 text-sm h-20 resize-none" style={{ borderColor: "var(--border)" }} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.fieldType")}</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as any }))} className="w-full h-9 rounded-md border px-3 text-sm" style={{ borderColor: "var(--border)" }}>
              {[["elearning", "E-learning"], ["webinar", "Webinar"], ["qt", "Type Rating"], ["seminar", t("adminDashboard.trainingTypeSeminar")], ["event", t("adminDashboard.trainingTypeEvent")]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.fieldDomain")}</label>
            <select value={form.domain} onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value as any }))} className="w-full h-9 rounded-md border px-3 text-sm" style={{ borderColor: "var(--border)" }}>
              {[["b1", "B1"], ["b2", "B2"], ["b1b2", "B1/B2"], ["part66", "Part-66"], ["general", t("adminDashboard.domainGeneral")], ["management", "Management"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.fieldDurationHours")}</label>
            <Input value={form.durationHours} onChange={(e) => setForm((f) => ({ ...f, durationHours: e.target.value }))} placeholder="4.00" type="number" step="0.5" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.fieldLanguage")}</label>
            <select value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))} className="w-full h-9 rounded-md border px-3 text-sm" style={{ borderColor: "var(--border)" }}>
              <option value="fr">{t("adminDashboard.languageFrench")}</option><option value="en">{t("adminDashboard.languageEnglish")}</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.fieldPriceHt")}</label>
            <Input value={form.priceHt} onChange={(e) => setForm((f) => ({ ...f, priceHt: e.target.value }))} placeholder="149.00" type="number" step="0.01" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.fieldPriceTtc")}</label>
            <Input value={form.priceTtc} onChange={(e) => setForm((f) => ({ ...f, priceTtc: e.target.value }))} placeholder="178.80" type="number" step="0.01" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.fieldPassingScore")}</label>
            <Input value={form.passingScore} onChange={(e) => setForm((f) => ({ ...f, passingScore: Number(e.target.value) }))} type="number" min="0" max="100" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.fieldMaxAttempts")}</label>
            <Input value={form.maxAttempts} onChange={(e) => setForm((f) => ({ ...f, maxAttempts: Number(e.target.value) }))} type="number" min="1" max="10" />
          </div>
          <div className="col-span-2">
            <label className="text-sm font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.fieldPart147Reference")}</label>
            <Input value={form.part147Reference} onChange={(e) => setForm((f) => ({ ...f, part147Reference: e.target.value }))} placeholder="Part-145 AMC 145.A.30(e)" />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" id="published" checked={form.isPublished} onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))} />
            <label htmlFor="published" className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.fieldPublishImmediately")}</label>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("adminDashboard.btnCancel")}</Button>
          <Button onClick={save} disabled={!form.title || !form.slug || saving} style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
            {isEdit ? t("adminDashboard.btnSave") : t("adminDashboard.btnCreateTraining")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminDashboard() {
  const { t, lang } = useI18n();
  /** Catalogue codes ("elearning", "b1b2") → the labels learners see in the catalogue. */
  const codeLabel = (prefix: string, code: string) => { const key = catalogueKey(prefix, code); const label = t(key); return label === key ? code : label; };
  const certificateLabels=certificateReportLabels[lang];
  const { user } = useAuth();
  const [manageQuote, setManageQuote] = useState<any | null>(null);
  const { data: stats } = trpc.admin.stats.useQuery();
  const { data: users = [] } = trpc.admin.users.useQuery();
  const { data: adminTrainings = [], refetch: refetchTrainings } = trpc.admin.trainings.list.useQuery();
  const { data: orders = [] } = trpc.admin.orders.useQuery();
  const quotesQuery = trpc.admin.quotes.list.useQuery();
  const {data:quotes=[],refetch:refetchQuotes}=quotesQuery;
  const [ticketBeforeId, setTicketBeforeId] = useState<number | undefined>();
  const [ticketStatusFilter, setTicketStatusFilter] = useState<"" | "OPEN" | "PENDING" | "CLOSED">("");
  const [ticketSearch, setTicketSearch] = useState("");
  const ticketsQuery = trpc.support.adminList.useQuery({beforeId: ticketBeforeId, status: ticketStatusFilter || undefined, search: ticketSearch});
  const adminTickets = ticketsQuery.data?.entries ?? [];
  const refetchTickets = ticketsQuery.refetch;
  const setTicketStatus = trpc.support.setStatus.useMutation({ onSuccess: () => {refetchTickets();utils.support.statusHistory.invalidate();},onError:e=>toast.error(e.message) });
  const mailRequest = useRef<{signature: string; id: string} | null>(null);
  const broadcastRequest = useRef<{signature: string; id: string} | null>(null);
  const reuseRequest = (input: object, holder: {current: {signature: string; id: string} | null}) => {
    const signature = JSON.stringify(input);
    if (holder.current?.signature !== signature) holder.current = {signature, id: createRequestId()};
    return holder.current.id;
  };
  const reportBroadcast = (result: {sent: number; recipients: number; email: {requested: boolean; accepted: number; failed: number; skipped: number}}) => {
    const message = result.email.requested ? t('adminDashboard.mailOutcome', {notifications: result.sent, accepted: result.email.accepted, failed: result.email.failed, skipped: result.email.skipped}) : t('adminDashboard.toastBroadcastSent', {count: result.sent});
    if (result.email.failed || result.email.skipped || !result.recipients) toast.warning(message); else toast.success(message);
  };
  const broadcast = trpc.admin.broadcast.useMutation({ onSuccess: reportBroadcast, onError: (e) => toast.error(e.message), onSettled: () => { void utils.admin.broadcastHistory.invalidate(); void utils.admin.broadcastRecipients.invalidate(); } });
  const [openTicket, setOpenTicket] = useState<number | null>(null);
  const [bcast, setBcast] = useState({ title: "", body: "", audience: "all", email: false });
  const [emailSubTab, setEmailSubTab] = useState<"compose" | "inbox">("compose");
  // Dedicated email composer (Emails module).
  const [mail, setMail] = useState({ mode: "all" as "all" | "company" | "user", orgId: "", userId: "", subject: "", body: "", alsoInApp: true });
  const sendMail = trpc.admin.broadcast.useMutation({
    onSuccess: (result, input) => { reportBroadcast(result); if (result.recipients > 0 && !result.email.failed && !result.email.skipped) setMail((m) => m.subject.trim() === input.title.trim() && m.body === (input.body ?? "") ? ({ ...m, subject: "", body: "" }) : m); }, onError: (e) => toast.error(e.message), onSettled: () => { void utils.admin.broadcastHistory.invalidate(); void utils.admin.broadcastRecipients.invalidate(); },
  });
  const submitMail = () => {
    if (sendMail.isPending) return;
    const base = { title: mail.subject, body: mail.body || undefined, email: true, inApp: mail.alsoInApp };
    const send = (input: Parameters<typeof sendMail.mutate>[0]) => sendMail.mutate({...input, requestId: reuseRequest(input, mailRequest)});
    if (mail.mode === "user") { if (!mail.userId) return toast.error(t("adminDashboard.mailPickUser")); send({ ...base, userId: Number(mail.userId) }); }
    else if (mail.mode === "company") { if (!mail.orgId) return toast.error(t("adminDashboard.mailPickOrg")); send({ ...base, audience: `company:${mail.orgId}` }); }
    else send({ ...base, audience: "all" });
  };
  const reportQuery=trpc.admin.complianceReport.useInfiniteQuery({}, {getNextPageParam:page=>page.nextCursor??undefined});
  const complianceReport=reportQuery.data?.pages.flatMap(page=>page.entries)??[];
  const [exportingReport,setExportingReport]=useState(false);
  const reportExport = useRef<AbortController | null>(null);
  const [exportedRows, setExportedRows] = useState(0);
  const [exportNotice, setExportNotice] = useState<'cancelled' | 'error' | null>(null);
  useEffect(() => () => { reportExport.current?.abort(); }, [user?.id]);
  const reportText=lang==='fr'?{more:'Afficher la suite',retry:'Réessayer',error:'Rapport indisponible.',loading:'Chargement…',exporting:'Préparation du CSV…'}:lang==='ar'?{more:'عرض المزيد',retry:'إعادة المحاولة',error:'التقرير غير متاح.',loading:'جارٍ التحميل…',exporting:'جارٍ إعداد CSV…'}:{more:'Show more',retry:'Retry',error:'Report unavailable.',loading:'Loading…',exporting:'Preparing CSV…'};

  const updateQuoteStatus = trpc.admin.quotes.updateStatus.useMutation({
    onSuccess: async () => { toast.success(t("adminDashboard.toastStatusUpdated")); await Promise.all([refetchQuotes(),utils.admin.quotes.statusHistory.invalidate()]); },
    onError: () => { toast.error(t("quoteHistory.updateError")); void refetchQuotes(); },
  });
  const updateTraining = trpc.admin.trainings.update.useMutation({
    onSuccess: () => { toast.success(t("adminDashboard.toastTrainingUpdated")); refetchTrainings(); },
    onError: e => toast.error(e.message),
  });
  const deleteTrainingM = trpc.admin.trainings.delete.useMutation({
    onSuccess: () => { toast.success(t("contentArchive.done")); refetchTrainings(); },
    onError: (e) => toast.error(e.message),
  });
  const [trainingDialog, setTrainingDialog] = useState<{ training: any | null } | null>(null);
  const [tab, setTab] = useUrlTab("trainings");
  const [formSubTab, setFormSubTab] = useState<"catalogue" | "content" | "sessions">("catalogue");
  const utils = trpc.useUtils();
  const setUserStatus = trpc.admin.setUserStatus.useMutation({
    onSuccess: () => { toast.success(t("adminDashboard.toastAccountStatusUpdated")); utils.admin.users.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const setUserRole = trpc.admin.setUserRole.useMutation({
    onSuccess: () => { toast.success(t("adminDashboard.toastRoleUpdated")); utils.admin.users.invalidate(); },
    onError: error => { toast.error(error.message); void utils.admin.users.invalidate(); },
  });
  const eraseUser = trpc.admin.erasePerson.useMutation({
    onSuccess: () => { toast.success(t("adminDashboard.toastAccountErased")); utils.admin.users.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const [userDialog, setUserDialog] = useState<{ mode: "new"; defaultRole?: string } | { mode: "edit"; user: any } | null>(null);
  const { data: organizations = [] } = trpc.admin.organizations.list.useQuery();
  const setOrgStatus = trpc.admin.organizations.setStatus.useMutation({
    onSuccess: () => { toast.success(t("adminDashboard.toastOrgUpdated")); utils.admin.organizations.list.invalidate(); utils.admin.organizations.statusHistory.invalidate(); }, onError: (e) => toast.error(e.message),
  });
  const [orgDialog, setOrgDialog] = useState<{ mode: "new" } | { mode: "edit"; org: any } | null>(null);
  const [mgrOrg, setMgrOrg] = useState<any | null>(null);
  const [historyOrg, setHistoryOrg] = useState<number | null>(null);
  const { data: settings } = trpc.admin.settings.get.useQuery();
  const [mistralKey, setMistralKey] = useState("");
  const saveMistral = trpc.admin.settings.setMistralKey.useMutation({
    onSuccess: () => { toast.success(t("adminDashboard.toastMistralSaved")); setMistralKey(""); utils.admin.settings.get.invalidate(); }, onError: (e) => toast.error(e.message),
  });
  // SMTP / email config (password left empty = keep the stored one).
  const [smtp, setSmtp] = useState({ host: "", port: "587", user: "", password: "", from: "", notifyEmail: "", imapHost: "", imapPort: "993" });
  const [smtpLoaded, setSmtpLoaded] = useState(false);
  useEffect(() => {
    if (settings?.smtp && !smtpLoaded) {
      setSmtp({
        host: settings.smtp.host ?? "", port: settings.smtp.port ?? "587", user: settings.smtp.user ?? "", password: "",
        from: settings.smtp.from ?? "", notifyEmail: settings.smtp.notifyEmail ?? "",
        imapHost: (settings as any).imap?.host ?? "imap.hostinger.com", imapPort: (settings as any).imap?.port ?? "993",
      });
      setSmtpLoaded(true);
    }
  }, [settings, smtpLoaded]);
  const [testTo, setTestTo] = useState("");
  const saveSmtp = trpc.admin.settings.setSmtp.useMutation({
    onSuccess: () => { toast.success(t("adminDashboard.toastSmtpSaved")); setSmtp((s) => ({ ...s, password: "" })); utils.admin.settings.get.invalidate(); }, onError: (e) => toast.error(e.message),
  });
  const sendTest = trpc.admin.settings.sendTestEmail.useMutation({
    onSuccess: () => toast.success(t("adminDashboard.toastTestSent")), onError: (e) => toast.error(e.message),
  });
  // Stripe keys (secret left empty = keep the stored one).
  const [stripe, setStripe] = useState({ publishableKey: "", secretKey: "", webhookSecret: "" });
  const [stripeLoaded, setStripeLoaded] = useState(false);
  useEffect(() => {
    if (settings?.stripe && !stripeLoaded) { setStripe({ publishableKey: settings.stripe.publishableKey ?? "", secretKey: "", webhookSecret: "" }); setStripeLoaded(true); }
  }, [settings, stripeLoaded]);
  const saveStripe = trpc.admin.settings.setStripe.useMutation({
    onSuccess: () => { toast.success(t("adminDashboard.toastStripeSaved")); setStripe((s) => ({ ...s, secretKey: "", webhookSecret: "" })); utils.admin.settings.get.invalidate(); }, onError: (e) => toast.error(e.message),
  });

  const exportComplianceCSV = async () => {
    if(reportExport.current)return;
    const controller = new AbortController();
    reportExport.current = controller;
    setExportNotice(null);
    setExportedRows(0);
    setExportingReport(true);
    try{
    const completeReport=await collectComplianceReport(cursor=>utils.admin.complianceReport.fetch({cursor,pageSize:250}), { signal: controller.signal, onProgress: setExportedRows });
    const headers = [t("adminDashboard.csvLearner"), t("adminDashboard.csvEmail"), t("adminDashboard.csvTraining"), t("adminDashboard.csvType"), t("adminDashboard.csvStatus"), t("adminDashboard.csvProgress"), t("adminDashboard.csvCompletionDate"), certificateLabels.accessEnd, t("adminDashboard.csvCertificateNumber"),certificateLabels.status,certificateLabels.certificateEnd,certificateLabels.holder];
    const rows = completeReport.map((r) => [
      r.userName, r.userEmail, r.trainingTitle, r.trainingType, r.status,
      `${r.progressPercent}%`,
      r.completedAt ? new Date(r.completedAt).toLocaleDateString("fr-FR") : "—",
      r.expiresAt ? new Date(r.expiresAt).toLocaleDateString("fr-FR") : "—",
      r.certificateNumber ?? "—",certificateLabels[r.certificateStatus],r.certificateExpiresAt?new Date(r.certificateExpiresAt).toLocaleDateString(lang):"—",r.certificateHolderName??"—",
    ]);
    const csv = spreadsheetCsv([headers,...rows]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "rapport_conformite_r-aero.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success(t("adminDashboard.toastComplianceExported"));
    }catch{setExportNotice(controller.signal.aborted ? 'cancelled' : 'error');}
    finally{reportExport.current = null;setExportingReport(false);}
  };

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="text-center">
          <XCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--destructive)" }} />
          <h2 className="font-sans text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>{t("adminDashboard.accessDeniedTitle")}</h2>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.accessDeniedBody")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <div style={{ background: "var(--surface-strong)" }}>
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <BackButton dark />
          <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
            <div className="flex items-center gap-3">
              <GraduationCap className="w-6 h-6" style={{ color: "var(--link)" }} />
              <div>
                <h1 className="font-sans text-2xl font-bold text-white">{t("adminDashboard.headerTitle")}</h1>
                <p className="text-muted-foreground text-sm">{t("adminDashboard.headerSubtitle")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <UserMenu />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { icon: Users, value: stats?.users ?? 0, label: t("adminDashboard.statUsers") },
              { icon: BookOpen, value: stats?.trainings ?? 0, label: t("adminDashboard.statTrainings") },
              { icon: ShoppingCart, value: stats?.orders ?? 0, label: t("adminDashboard.statOrders") },
              { icon: FileText, value: stats?.quotes ?? 0, label: t("adminDashboard.statQuotes") },
              { icon: GraduationCap, value: stats?.enrollments ?? 0, label: t("adminDashboard.statEnrollments") },
            ].map((s) => (
              <div key={s.label} className="rounded-xl p-4" style={{ background: "color-mix(in srgb, var(--foreground) 7%, transparent)", border: "1px solid color-mix(in srgb, var(--foreground) 10%, transparent)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className="w-4 h-4" style={{ color: "var(--link)" }} />
                  <span className="font-sans text-2xl font-bold" style={{ color: "var(--link)" }}>{s.value}</span>
                </div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex flex-col md:flex-row gap-4 md:gap-6 md:items-start">
            <DashboardSidebar active={tab} onSelect={setTab} heading={t("adminDashboard.sidebarHeading")} items={[
              // Contenu & site
              { key: "trainings", label: t("adminDashboard.navTrainings"), icon: BookOpen, section: t("adminDashboard.secContent") },
              { key: "news", label: t("adminDashboard.navNews"), icon: Newspaper, section: t("adminDashboard.secContent") },
              { key: "offers", label: t("adminDashboard.navOffers"), icon: Layers, section: t("adminDashboard.secContent") },
              { key: "faq", label: t("adminDashboard.navFaq"), icon: HelpCircle, section: t("adminDashboard.secContent") },
              // Ventes
              { key: "orders", label: t("adminDashboard.navOrders"), icon: ShoppingCart, section: t("adminDashboard.secSales") },
              { key: "quotes", label: t("adminDashboard.navQuotes"), icon: FileText, section: t("adminDashboard.secSales") },
              // Utilisateurs
              { key: "users", label: t("adminDashboard.navUsers"), icon: Users, section: t("adminDashboard.secPeople") },
              { key: "organizations", label: t("adminDashboard.navOrganizations"), icon: Building2, section: t("adminDashboard.secPeople") },
              { key: "admins", label: t("adminDashboard.navAdmins"), icon: ShieldCheck, section: t("adminDashboard.secPeople") },
              // Communication
              { key: "support", label: t("adminDashboard.navSupport"), icon: LifeBuoy, section: t("adminDashboard.secComms") },
              { key: "emails", label: t("adminDashboard.navEmails"), icon: Mail, section: t("adminDashboard.secComms") },
              // Conformité
              { key: "certificates", label: lang==='fr'?'Certificats':lang==='ar'?'الشهادات':'Certificates', icon: GraduationCap, section: t("adminDashboard.secCompliance") },
              { key: "compliance", label: t("adminDashboard.navCompliance"), icon: BarChart3, section: t("adminDashboard.secCompliance") },
              // Configuration
              { key: "stripe", label: t("adminDashboard.navStripe"), icon: CreditCard, section: t("adminDashboard.secConfig") },
              { key: "settings", label: t("adminDashboard.navSettings"), icon: Settings, section: t("adminDashboard.secConfig") },
            ]} />
            <div className="flex-1 min-w-0">

          {/* Trainings */}
          <TabsContent value="certificates"><AdminCertificates /></TabsContent>
          <TabsContent value="trainings">
            <div className="flex gap-2 mb-5 border-b" style={{ borderColor: "var(--border)" }}>
              {([["catalogue", t("adminDashboard.subTabCatalogue")], ["content", t("adminDashboard.subTabContent")], ["sessions", t("adminDashboard.subTabSessions")]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setFormSubTab(k)} className="px-3 py-2 text-sm font-medium" style={{ borderBottom: `2px solid ${formSubTab === k ? "var(--link)" : "transparent"}`, color: formSubTab === k ? "var(--foreground)" : "var(--muted-foreground)" }}>{l}</button>
              ))}
            </div>
            {formSubTab === "catalogue" ? (
              <>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="font-semibold" style={{ color: "var(--foreground)" }}>{t("adminDashboard.trainingsCatalogTitle")}</h2>
              <div className="flex flex-wrap gap-2">
                <Link href="/maker">
                  <Button size="sm" variant="outline"><Sparkles className="w-4 h-4 mr-1" /> {t("adminDashboard.btnAiCreator")}</Button>
                </Link>
                <Button size="sm" onClick={() => setTrainingDialog({ training: null })} style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                  <Plus className="w-4 h-4 mr-1" /> {t("adminDashboard.btnNewTraining")}
                </Button>
              </div>
            </div>
            <TrainingFormDialog open={!!trainingDialog} training={trainingDialog?.training ?? null} onOpenChange={(o) => { if (!o) setTrainingDialog(null); }} onSuccess={() => { setTrainingDialog(null); refetchTrainings(); }} />
            <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid var(--border)" }}>
              <table className="w-full text-sm min-w-[640px]">
                <thead style={{ background: "var(--muted)" }}>
                  <tr>{[t("adminDashboard.thTitle"), t("adminDashboard.thType"), t("adminDashboard.thDomain"), t("adminDashboard.thDuration"), t("adminDashboard.thPriceTtc"), t("adminDashboard.thRequiredScore"), t("adminDashboard.thStatus"), t("adminDashboard.thActions")].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-xs tracking-wide" style={{ color: "var(--muted-foreground)" }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {adminTrainings.map((tr, i) => (
                    <tr key={tr.id} style={{ background: i % 2 === 0 ? "var(--card)" : "var(--background)", borderTop: "1px solid var(--muted-foreground)" }}>
                      <td className="px-4 py-3 font-medium max-w-xs" style={{ color: "var(--foreground)" }}>
                        <div className="truncate">{tr.title}</div>
                        <div className="text-xs mt-0.5" style={{ color: "var(--info)" }}>{[tr.part147Reference, tr.language?.toUpperCase()].filter(Boolean).join(" · ")}</div>
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--muted-foreground)" }}>{codeLabel("catalogue.type", tr.type)}</td>
                      <td className="px-4 py-3" style={{ color: "var(--muted-foreground)" }}>{tr.domain ? codeLabel("catalogue.domain", tr.domain) : "—"}</td>
                      <td className="px-4 py-3" style={{ color: "var(--muted-foreground)" }}>{tr.durationHours ? formatHours(tr.durationHours, lang) : "—"}</td>
                      <td className="px-4 py-3 font-medium" style={{ color: "var(--foreground)" }}>{tr.priceTtc ? `${Number(tr.priceTtc).toFixed(0)} €` : t("adminDashboard.priceOnQuote")}</td>
                      <td className="px-4 py-3" style={{ color: "var(--muted-foreground)" }}>{tr.passingScore ?? 75}%</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: tr.isPublished ? "color-mix(in srgb, var(--success) 10%, transparent)" : "color-mix(in srgb, var(--muted-foreground) 10%, transparent)", color: tr.isPublished ? "var(--success)" : "var(--muted-foreground)" }}>
                          {tr.isPublished ? t("adminDashboard.statusPublished") : t("adminDashboard.statusDraft")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Button variant="outline" size="sm" onClick={() => setTrainingDialog({ training: tr })}><Pencil className="w-3.5 h-3.5 mr-1" /> {t("adminDashboard.btnEdit")}</Button>
                          <Button variant="outline" size="sm" onClick={() => updateTraining.mutate({ id: tr.id, isPublished: !tr.isPublished })}>
                            {tr.isPublished ? t("adminDashboard.btnUnpublish") : t("adminDashboard.btnPublish")}
                          </Button>
                          <button onClick={() => { if (confirm(t("contentArchive.confirm"))) deleteTrainingM.mutate({ id: tr.id }); }} title={t("contentArchive.action")} className="p-1.5 rounded hover:bg-foreground/5 text-destructive"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
              </>
            ) : formSubTab === "content" ? (
              <AdminContentManager trainings={adminTrainings as any} />
            ) : (
              <><AdminSessions /><AdminWebinars /></>
            )}
          </TabsContent>

          {/* News / Actualités */}
          <TabsContent value="news">
            <AdminArticles />
          </TabsContent>

          {/* Users */}
          <TabsContent value="users">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="font-semibold" style={{ color: "var(--foreground)" }}>{t("adminDashboard.usersTitle")}</h2>
              <Button size="sm" onClick={() => setUserDialog({ mode: "new" })} style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}><Plus className="w-4 h-4 mr-1" /> {t("adminDashboard.btnAddUser")}</Button>
            </div>
            <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid var(--border)" }}>
              <table className="w-full text-sm min-w-[640px]">
                <thead style={{ background: "var(--muted)" }}>
                  <tr>{[t("adminDashboard.thName"), t("adminDashboard.thEmail"), t("adminDashboard.thOrganization"), t("adminDashboard.thRole"), t("adminDashboard.thPart66License"), t("adminDashboard.thStatus"), t("adminDashboard.thRegistration"), t("adminDashboard.thActions")].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-xs tracking-wide" style={{ color: "var(--muted-foreground)" }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {users.map((u, i) => {
                    const suspended = (u as any).status === "suspended";
                    const isSelf = u.id === user?.id;
                    const roleOptions = [["user", t("adminDashboard.roleLearner")], ["company_manager", t("adminDashboard.roleManager")], ["instructor", t("adminDashboard.roleInstructor")], ["admin", t("adminDashboard.roleAdmin")]];
                    return (
                    <tr key={u.id} style={{ background: i % 2 === 0 ? "var(--card)" : "var(--background)", borderTop: "1px solid var(--muted-foreground)" }}>
                      <td className="px-4 py-3 font-medium" style={{ color: "var(--foreground)" }}>{u.name ?? "—"}</td>
                      <td className="px-4 py-3" style={{ color: "var(--muted-foreground)" }}>{u.email ?? "—"}</td>
                      <td className="px-4 py-3" style={{ color: "var(--muted-foreground)" }}>
                        {(u as any).organizationName
                          ? <span>{(u as any).organizationName}{(u as any).affiliationRole === "MANAGER" ? <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full" style={{ background: "color-mix(in srgb, var(--link) 18%, transparent)", color: "var(--link)" }}>{t("org.roleManager")}</span> : ""}</span>
                          : <span style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.orgNA")}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          disabled={isSelf || setUserRole.isPending}
                          aria-label={t("adminDashboard.thRole")}
                          onChange={(e) => {
                            const role = e.target.value;
                            const roleLabel = roleOptions.find(([v]) => v === role)?.[1] ?? role;
                            if (window.confirm(t("adminDashboard.confirmRoleChange", { user: u.name ?? u.email ?? "", role: roleLabel }))) setUserRole.mutate({ id: u.id, role: role as any });
                          }}
                          className="h-7 rounded-md border px-1.5 text-xs"
                          style={{ borderColor: "var(--border)" }}
                        >
                          {roleOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>{(u as any).licenseNumber ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: suspended ? "color-mix(in srgb, var(--destructive) 10%, transparent)" : "color-mix(in srgb, var(--success) 10%, transparent)", color: suspended ? "var(--destructive)" : "var(--success)" }}>
                          {suspended ? t("adminDashboard.statusSuspended") : t("adminDashboard.statusActive")}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--muted-foreground)" }}>{new Date(u.createdAt).toLocaleDateString(lang)}</td>
                      <td className="px-4 py-3">
                        {/* Icon buttons (labelled) keep every action visible without horizontal scrolling. */}
                        <div className="flex items-center gap-1.5">
                          <Button variant="outline" size="icon" className="h-8 w-8" title={t("adminDashboard.btnEdit")} aria-label={t("adminDashboard.btnEdit")} onClick={() => setUserDialog({ mode: "edit", user: u })}><Pencil className="w-3.5 h-3.5" /></Button>
                          {!isSelf && <Button variant="outline" size="icon" className="h-8 w-8" disabled={setUserStatus.isPending} title={t(suspended ? "adminDashboard.btnActivate" : "adminDashboard.btnSuspend")} aria-label={t(suspended ? "adminDashboard.btnActivate" : "adminDashboard.btnSuspend")} onClick={() => setUserStatus.mutate({ id: u.id, status: suspended ? "active" : "suspended" })}>
                            {suspended ? <CheckCircle className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                          </Button>}
                          {!isSelf && <button title={t("adminDashboard.btnDeleteGdpr")} aria-label={t("adminDashboard.btnDeleteGdpr")} onClick={() => { if (window.confirm(t("adminDashboard.confirmEraseUser", { user: u.name ?? u.email ?? "" }))) eraseUser.mutate({ userId: u.id }); }} className="p-1.5 rounded hover:bg-foreground/5 text-destructive"><Trash2 className="w-4 h-4" /></button>}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Orders */}
          <TabsContent value="orders">
            <h2 className="font-semibold mb-4" style={{ color: "var(--foreground)" }}>{t("adminDashboard.ordersTitle")}</h2>
            <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid var(--border)" }}>
              <table className="w-full text-sm min-w-[640px]">
                <thead style={{ background: "var(--muted)" }}>
                  <tr>{[t("adminDashboard.thInvoiceNumber"), t("adminDashboard.thClient"), t("adminDashboard.thTotalTtc"), t("adminDashboard.thStatus"), t("adminDashboard.thStripeId"), t("adminDashboard.thDate")].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-xs tracking-wide" style={{ color: "var(--muted-foreground)" }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {orders.map((o: any, i: number) => {
                    const statusConf = ORDER_STATUS[o.status] ?? ORDER_STATUS.pending;
                    return (
                      <tr key={o.id} style={{ background: i % 2 === 0 ? "var(--card)" : "var(--background)", borderTop: "1px solid var(--muted-foreground)" }}>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>{o.invoiceNumber ?? `#${o.id}`}</td>
                        <td className="px-4 py-3" style={{ color: "var(--foreground)" }}>{o.user?.name ?? o.user?.email ?? "—"}</td>
                        <td className="px-4 py-3 font-medium" style={{ color: "var(--foreground)" }}>{Number(o.totalTtc).toFixed(2)} €{o.refundedAmountCents > 0 && <><span className="block text-xs">{t("refund.amount", { amount: (o.refundedAmountCents / 100).toFixed(2) })}</span><RefundHistory orderId={o.id} /></>}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: statusConf.color, background: `color-mix(in srgb, ${statusConf.color} 10%, transparent)` }}>
                            {t(statusConf.labelKey)}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>{o.stripePaymentIntentId ? o.stripePaymentIntentId.slice(0, 16) + "..." : "—"}<PaymentReconciliation orderId={o.id} sessionId={o.stripeSessionId} /></td>
                        <td className="px-4 py-3" style={{ color: "var(--muted-foreground)" }}>{new Date(o.createdAt).toLocaleDateString(lang)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Quotes */}
          <TabsContent value="quotes">
            <h2 className="font-semibold mb-4" style={{ color: "var(--foreground)" }}>{t("adminDashboard.quotesTitle")}</h2>
            <Button variant="outline" disabled={quotesQuery.isFetching || updateQuoteStatus.isPending} onClick={async()=>{const result=await refetchQuotes();if(!result.isError)updateQuoteStatus.reset();}}>{t("quoteHistory.refresh")}</Button>
            {quotesQuery.isError&&<p role="alert">{t("quoteHistory.listError")}</p>}
            {quotesQuery.isPending&&<p role="status">{t("common.loading")}</p>}
            {updateQuoteStatus.isError && <p role="alert" className="text-sm text-destructive mb-3">{t("quoteHistory.updateError")}</p>}
            <div className="space-y-4">
              {!quotesQuery.isError && quotes.map((q: any) => {
                const statusConf = QUOTE_STATUS[q.status] ?? QUOTE_STATUS.received;
                return (
                  <div key={q.id} className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold" style={{ color: "var(--foreground)" }}>{q.companyName}</span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: statusConf.color, background: `color-mix(in srgb, ${statusConf.color} 10%, transparent)` }}>{t(statusConf.labelKey)}</span>
                        </div>
                        <div className="text-sm mb-1" style={{ color: "var(--muted-foreground)" }}>{q.contactName} — {q.contactEmail}{q.contactPhone && ` — ${q.contactPhone}`}</div>
                        {q.employeeCount && <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.employeesConcerned", { count: q.employeeCount })}</div>}
                        {q.trainingTypes && <div className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.quoteTrainings", { types: q.trainingTypes })}</div>}
                        {q.message && <div className="text-xs mt-2 p-2 rounded" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>{q.message}</div>}
                        <div className="text-xs mt-2" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.receivedOn", { date: new Date(q.createdAt).toLocaleDateString(lang) })}</div>
                      </div>
                      <div className="flex flex-col gap-2 items-end shrink-0">
                        <select disabled={updateQuoteStatus.isPending || quotesQuery.isFetching} value={q.status} onChange={(e) => updateQuoteStatus.mutate({ id: q.id, expectedRevision:q.revision, status: e.target.value as any })} className="h-8 rounded-md border px-2 text-xs min-w-32" style={{ borderColor: "var(--border)" }}>
                          {Object.entries(QUOTE_STATUS).map(([v, { labelKey }]) => <option key={v} value={v}>{t(labelKey)}</option>)}
                        </select>
                        <button onClick={() => setManageQuote(q)} className="text-sm px-3 py-1.5 rounded-md font-medium" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>{t("adminDashboard.btnManageReply")}</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <QuoteManageDialog key={manageQuote?.id ?? "closed"} quote={manageQuote} meId={user?.id ?? 0} onClose={() => { setManageQuote(null); refetchQuotes(); }} />
          </TabsContent>

          {/* Compliance */}
          <TabsContent value="compliance">
            <ExamFinalizationAlerts />
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="font-semibold" style={{ color: "var(--foreground)" }}>{t("adminDashboard.complianceTitle")}</h2>
              <Button variant="outline" size="sm" disabled={exportingReport} onClick={exportComplianceCSV}>
                <Download className="w-4 h-4 mr-1" /> {exportingReport?reportText.exporting:t("adminDashboard.btnExportCsvAudit")}
              </Button>
            </div>
            {exportingReport && <div className="flex flex-wrap items-center gap-3 mb-3">
              <p role="status">{t('adminDashboard.exportProgress', { count: exportedRows })}</p>
              <Button variant="outline" size="sm" onClick={() => reportExport.current?.abort()}>{t('adminDashboard.cancelExport')}</Button>
            </div>}
            {exportNotice && <p role={exportNotice === 'error' ? 'alert' : 'status'} className="mb-3">{t(exportNotice === 'error' ? 'adminDashboard.exportFailed' : 'adminDashboard.exportCancelled')}</p>}
            {reportQuery.isLoading&&<p role="status">{reportText.loading}</p>}
            {reportQuery.isError&&<div role="alert"><p>{reportText.error}</p><Button variant="outline" onClick={()=>void reportQuery.refetch()}>{reportText.retry}</Button></div>}
            <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid var(--border)" }}>
              <table className="w-full text-sm min-w-[640px]">
                <thead style={{ background: "var(--muted)" }}>
                  <tr>{[t("adminDashboard.thLearner"), t("adminDashboard.thTraining"), t("adminDashboard.thStatus"), t("adminDashboard.thProgress"), t("adminDashboard.thCompletion"), certificateLabels.accessEnd, t("adminDashboard.thCertificate")].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-xs tracking-wide" style={{ color: "var(--muted-foreground)" }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {complianceReport.map((r, i) => {
                    const Icon = ENROLLMENT_STATUS_ICONS[r.status] ?? Clock;
                    const statusColors: Record<string, string> = {
                      completed: "var(--success)", in_progress: "var(--info)",
                      not_started: "var(--muted-foreground)", expired: "var(--destructive)", failed: "var(--destructive)",
                    };
                    return (
                      <tr key={r.enrollmentId} style={{ background: i % 2 === 0 ? "var(--card)" : "var(--background)", borderTop: "1px solid var(--muted-foreground)" }}>
                        <td className="px-4 py-3" style={{ color: "var(--foreground)" }}>
                          <div className="font-medium">{r.userName}</div>
                          <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{r.userEmail}</div>
                        </td>
                        <td className="px-4 py-3 max-w-xs" style={{ color: "var(--muted-foreground)" }}>
                          <div className="truncate">{r.trainingTitle}</div>
                          <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{r.trainingType}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: statusColors[r.status] ?? "var(--muted-foreground)" }}>
                            <Icon className="w-3 h-3" />
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--muted-foreground)" }}>{r.progressPercent}%</td>
                        <td className="px-4 py-3" style={{ color: "var(--muted-foreground)" }}>{r.completedAt ? new Date(r.completedAt).toLocaleDateString(lang) : "—"}</td>
                        <td className="px-4 py-3" style={{ color: "var(--muted-foreground)" }}>{r.expiresAt ? new Date(r.expiresAt).toLocaleDateString(lang) : "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: r.certificateStatus==='valid' ? "var(--success)" : "var(--muted-foreground)" }}>
                          <div>{r.certificateNumber ?? "—"}</div>
                          <div className="font-sans text-sm">{certificateLabels[r.certificateStatus]}</div>
                          {r.certificateExpiresAt&&<div className="font-sans text-sm">{certificateLabels.certificateEnd}: {new Date(r.certificateExpiresAt).toLocaleDateString(lang)}</div>}
                          {r.certificateHolderName&&<div className="font-sans text-sm">{certificateLabels.holder}: {r.certificateHolderName}</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {reportQuery.hasNextPage&&<Button variant="outline" className="mt-3" disabled={reportQuery.isFetchingNextPage} onClick={()=>void reportQuery.fetchNextPage()}>{reportQuery.isFetchingNextPage?reportText.loading:reportText.more}</Button>}
          </TabsContent>

          {/* Organizations */}
          <TabsContent value="organizations">
            <p className="text-sm text-muted-foreground mb-4">{lang === "fr" ? "Suspendez une compagnie pour bloquer ses accès tout en conservant ses formations, paiements et traces de conformité." : lang === "ar" ? "علّق الشركة لمنع وصولها مع الاحتفاظ بالتدريب والمدفوعات وسجلات الامتثال." : "Suspend a company to block access while retaining its training, payments and compliance records."}</p>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="font-semibold" style={{ color: "var(--foreground)" }}>{t("adminDashboard.organizationsTitle")}</h2>
              <Button size="sm" onClick={() => setOrgDialog({ mode: "new" })} style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}><Plus className="w-4 h-4 mr-1" /> {t("adminDashboard.btnNewOrg")}</Button>
            </div>
            <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid var(--border)" }}>
              <table className="w-full text-sm min-w-[680px]">
                <thead style={{ background: "var(--muted)" }}>
                  <tr>{[t("adminDashboard.thName"), t("adminDashboard.thType"), t("adminDashboard.thCountry"), t("adminDashboard.thManagers"), t("adminDashboard.thEmployees"), t("adminDashboard.thStatus"), t("adminDashboard.thActions")].map((h) => <th key={h} className="text-left px-4 py-3 font-semibold text-xs tracking-wide" style={{ color: "var(--muted-foreground)" }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {organizations.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.noOrganizations")}</td></tr>}
                  {organizations.map((o: any, i: number) => {
                    const suspended = o.status === "SUSPENDED";
                    return (
                      <tr key={o.id} style={{ background: i % 2 === 0 ? "var(--card)" : "var(--background)", borderTop: "1px solid var(--muted-foreground)" }}>
                        <td className="px-4 py-3 font-medium" style={{ color: "var(--foreground)" }}>{o.name}</td>
                        <td className="px-4 py-3" style={{ color: "var(--muted-foreground)" }}>{o.type ?? "—"}</td>
                        <td className="px-4 py-3" style={{ color: "var(--muted-foreground)" }}>{o.country ?? "—"}</td>
                        <td className="px-4 py-3" style={{ color: "var(--muted-foreground)" }}>{o.managerCount}</td>
                        <td className="px-4 py-3" style={{ color: "var(--muted-foreground)" }}>{o.employeeCount}</td>
                        <td className="px-4 py-3"><span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: suspended ? "color-mix(in srgb, var(--destructive) 10%, transparent)" : "color-mix(in srgb, var(--success) 10%, transparent)", color: suspended ? "var(--destructive)" : "var(--success)" }}>{suspended ? t("adminDashboard.statusSuspendedFem") : t("adminDashboard.statusActiveFem")}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Button variant="outline" size="sm" onClick={() => setMgrOrg(o)}><UserCog className="w-3.5 h-3.5 mr-1" /> {t("adminDashboard.btnManagers")}</Button>
                            <Button variant="outline" size="sm" onClick={() => setOrgDialog({ mode: "edit", org: o })}><Pencil className="w-3.5 h-3.5 mr-1" /> {t("adminDashboard.btnEdit")}</Button>
                            <Button variant="outline" size="sm" onClick={() => setHistoryOrg(o.id)}>{lang === "fr" ? "Historique" : lang === "ar" ? "السجل" : "History"}</Button>
                            <Button variant="outline" size="sm" disabled={setOrgStatus.isPending} onClick={() => setOrgStatus.mutate({ id: o.id, status: suspended ? "ACTIVE" : "SUSPENDED" })}>{suspended ? t("adminDashboard.btnActivate") : t("adminDashboard.btnSuspend")}</Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Admins */}
          <TabsContent value="admins">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="font-semibold" style={{ color: "var(--foreground)" }}>{t("adminDashboard.adminsTitle")}</h2>
              <Button size="sm" onClick={() => setUserDialog({ mode: "new", defaultRole: "admin" })} style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}><Plus className="w-4 h-4 mr-1" /> {t("adminDashboard.btnCreateAdmin")}</Button>
            </div>
            <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.adminsNote")}</p>
            <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid var(--border)" }}>
              <table className="w-full text-sm min-w-[560px]">
                <thead style={{ background: "var(--muted)" }}>
                  <tr>{[t("adminDashboard.thName"), t("adminDashboard.thEmail"), t("adminDashboard.thStatus"), t("adminDashboard.thActions")].map((h) => <th key={h} className="text-left px-4 py-3 font-semibold text-xs tracking-wide" style={{ color: "var(--muted-foreground)" }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {users.filter((u: any) => u.role === "admin").map((u: any, i: number) => {
                    const suspended = u.status === "suspended";
                    const isSelf = u.id === user?.id;
                    return (
                      <tr key={u.id} style={{ background: i % 2 === 0 ? "var(--card)" : "var(--background)", borderTop: "1px solid var(--muted-foreground)" }}>
                        <td className="px-4 py-3 font-medium" style={{ color: "var(--foreground)" }}>{u.name ?? "—"}{isSelf && <span className="text-xs ml-1" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.youMarker")}</span>}</td>
                        <td className="px-4 py-3" style={{ color: "var(--muted-foreground)" }}>{u.email ?? "—"}</td>
                        <td className="px-4 py-3"><span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: suspended ? "color-mix(in srgb, var(--destructive) 10%, transparent)" : "color-mix(in srgb, var(--success) 10%, transparent)", color: suspended ? "var(--destructive)" : "var(--success)" }}>{suspended ? t("adminDashboard.statusSuspended") : t("adminDashboard.statusActive")}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Button variant="outline" size="sm" onClick={() => setUserDialog({ mode: "edit", user: u })}><Pencil className="w-3.5 h-3.5 mr-1" /> {t("adminDashboard.btnEdit")}</Button>
                            {!isSelf && <Button variant="outline" size="sm" onClick={() => { if (window.confirm(t("adminDashboard.confirmRevokeAdmin", { user: u.name ?? u.email ?? "" }))) setUserRole.mutate({ id: u.id, role: "user" }); }}>{t("adminDashboard.btnRevoke")}</Button>}
                            {!isSelf && <Button variant="outline" size="sm" onClick={() => setUserStatus.mutate({ id: u.id, status: suspended ? "active" : "suspended" })}>{suspended ? t("adminDashboard.btnActivate") : t("adminDashboard.btnSuspend")}</Button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Support + broadcast */}
          <TabsContent value="support">
            <SupportNotificationQueue />
            <div className="rounded-xl p-5 mb-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-2"><Megaphone className="w-4 h-4" style={{ color: "var(--link)" }} /><h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{t("adminDashboard.broadcastTitle")}</h3></div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <Input value={bcast.title} onChange={(e) => setBcast((b) => ({ ...b, title: e.target.value }))} placeholder={t("adminDashboard.placeholderBroadcastTitle")} />
                <select value={bcast.audience} onChange={(e) => setBcast((b) => ({ ...b, audience: e.target.value }))} className="h-9 rounded-md border px-2 text-sm" style={{ borderColor: "var(--border)" }}>
                  <option value="all">{t("adminDashboard.audienceAll")}</option>
                </select>
              </div>
              <Input value={bcast.body} onChange={(e) => setBcast((b) => ({ ...b, body: e.target.value }))} placeholder={t("adminDashboard.placeholderBroadcastBody")} className="mb-2" />
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--muted-foreground)" }}>
                  <input type="checkbox" checked={bcast.email} onChange={(e) => setBcast((b) => ({ ...b, email: e.target.checked }))} />
                  <span>{t("adminDashboard.broadcastAlsoEmail")}</span>
                </label>
                <Button size="sm" disabled={!bcast.title.trim() || broadcast.isPending} onClick={() => { const input = { audience: bcast.audience, title: bcast.title, body: bcast.body || undefined, email: bcast.email }; broadcast.mutate({...input, requestId: reuseRequest(input, broadcastRequest)}); }} style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>{t("adminDashboard.btnBroadcast")}</Button>
              </div>
            </div>
            <h2 className="font-semibold mb-4" style={{ color: "var(--foreground)" }}>{t("adminDashboard.supportTicketsTitle")}</h2>
            <p className="text-sm mb-3">{t("supportList.order")}</p>
            <div className="flex gap-2 flex-wrap mb-3">
              <Input aria-label={t("supportList.search")} placeholder={t("supportList.search")} maxLength={255} value={ticketSearch} onChange={e => {setTicketSearch(e.target.value);setTicketBeforeId(undefined);setOpenTicket(null);}} />
              <select aria-label={t("supportList.status")} value={ticketStatusFilter} onChange={e => {setTicketStatusFilter(e.target.value as typeof ticketStatusFilter);setTicketBeforeId(undefined);setOpenTicket(null);}} className="border rounded px-2 py-1">
                <option value="">{t("supportList.allStatuses")}</option>
                <option value="OPEN">{t("support.statusOpen")}</option><option value="PENDING">{t("support.statusPending")}</option><option value="CLOSED">{t("support.statusClosed")}</option>
              </select>
              <Button variant="outline" disabled={ticketsQuery.isFetching} onClick={() => {setOpenTicket(null);if(ticketBeforeId !== undefined)setTicketBeforeId(undefined);else void refetchTickets();}}>{t("myQuotes.firstPage")}</Button>
            </div>
            {ticketsQuery.isError ? <div role="alert" className="mb-3"><p>{t("supportList.loadError")}</p><Button variant="outline" disabled={ticketsQuery.isFetching} onClick={() => void refetchTickets()}>{t("supportList.retry")}</Button></div> : ticketsQuery.isPending ? <p role="status">{t("common.loading")}</p> : <div className="space-y-3">
              {adminTickets.length === 0 && <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.noTickets")}</p>}
              {adminTickets.map((tk) => (
                <div key={tk.id} className="rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between gap-3 p-4">
                    <button onClick={() => setOpenTicket(openTicket === tk.id ? null : tk.id)} className="text-left flex-1 min-w-0">
                      <div className="font-semibold truncate" style={{ color: "var(--foreground)" }}>{tk.subject}</div><div className="text-sm">{supportRequestLabels[lang][tk.requestKind as (typeof supportRequestKinds)[number]]}</div>
                      <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{tk.userName ?? "—"} · {tk.userEmail ?? ""} · {new Date(tk.updatedAt).toLocaleDateString(lang === "ar" ? "ar" : lang === "en" ? "en-GB" : "fr-FR")}</div>
                    </button>
                    <select aria-label={t("supportList.status")} value={tk.status} disabled={setTicketStatus.isPending || ticketsQuery.isFetching} onChange={(e) => {
                      const status=e.target.value as 'OPEN'|'PENDING'|'CLOSED';
                      let reason:string|undefined;
                      if(status==='CLOSED'&&tk.requestKind!=='GENERAL'){
                        const text=window.prompt(lang==='fr'?'Expliquez au titulaire la clôture de sa demande (10 caractères minimum).':lang==='ar'?'اشرح لصاحب الطلب سبب إغلاقه (10 أحرف على الأقل).':'Explain the closure to the requester (at least 10 characters).');
                        if(text===null)return;reason=text;
                      }
                      setTicketStatus.mutate({ticketId:tk.id,status,reason});
                    }} className="h-8 rounded-md border px-2 text-xs shrink-0" style={{ borderColor: "var(--border)" }}>
                      <option value="OPEN">{t("adminDashboard.ticketStatusOpen")}</option><option value="PENDING">{t("adminDashboard.ticketStatusPending")}</option><option value="CLOSED">{t("adminDashboard.ticketStatusClosed")}</option>
                    </select>
                  </div>
                  {openTicket === tk.id && <div className="px-4 pb-4"><TicketThread ticketId={tk.id} meId={user?.id} /></div>}
                </div>
              ))}
              {ticketsQuery.data?.nextBeforeId != null && <Button variant="outline" disabled={ticketsQuery.isFetching} onClick={() => {setOpenTicket(null);setTicketBeforeId(ticketsQuery.data!.nextBeforeId!);}}>{t("supportList.next")}</Button>}
            </div>}
          </TabsContent>

          {/* Emails — composer + SMTP configuration */}
          <TabsContent value="emails">
            <h2 className="font-semibold mb-4" style={{ color: "var(--foreground)" }}>{t("adminDashboard.emailsTitle")}</h2>

            {/* Sub-tabs: Composer/Config vs Réception */}
            <div className="flex gap-2 mb-4">
              {[["compose", t("adminDashboard.emailTabCompose")], ["inbox", t("adminDashboard.emailTabInbox")]].map(([k, l]) => (
                <button key={k} onClick={() => setEmailSubTab(k as any)}
                  className="text-sm px-3 py-1.5 rounded-lg font-medium transition-colors"
                  style={emailSubTab === k ? { background: "var(--primary)", color: "var(--primary-foreground)" } : { background: "var(--muted)", color: "var(--muted-foreground)" }}>{l}</button>
              ))}
            </div>

            {emailSubTab === "inbox" ? (
              <AdminInbox configured={!!(settings as any)?.imap?.configured} />
            ) : (<>

            {/* Composer */}
            <div className="rounded-xl p-5 mb-5 max-w-2xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-3"><Send className="w-4 h-4" style={{ color: "var(--link)" }} /><h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{t("adminDashboard.emailComposeTitle")}</h3></div>
              {!settings?.smtp?.configured && <p className="text-xs mb-3" style={{ color: "var(--destructive)" }}>{t("adminDashboard.emailNotConfiguredWarn")}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                <select value={mail.mode} onChange={(e) => setMail((m) => ({ ...m, mode: e.target.value as any }))} className="h-9 rounded-md border px-2 text-sm" style={{ borderColor: "var(--border)" }}>
                  <option value="all">{t("adminDashboard.mailToAll")}</option>
                  <option value="company">{t("adminDashboard.mailToCompany")}</option>
                  <option value="user">{t("adminDashboard.mailToUser")}</option>
                </select>
                {mail.mode === "company" && (
                  <select value={mail.orgId} onChange={(e) => setMail((m) => ({ ...m, orgId: e.target.value }))} className="h-9 rounded-md border px-2 text-sm sm:col-span-2" style={{ borderColor: "var(--border)" }}>
                    <option value="">{t("adminDashboard.mailPickOrg")}</option>
                    {(organizations as any[]).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                )}
                {mail.mode === "user" && (
                  <select value={mail.userId} onChange={(e) => setMail((m) => ({ ...m, userId: e.target.value }))} className="h-9 rounded-md border px-2 text-sm sm:col-span-2" style={{ borderColor: "var(--border)" }}>
                    <option value="">{t("adminDashboard.mailPickUser")}</option>
                    {(users as any[]).map((u) => <option key={u.id} value={u.id}>{(u.name ?? u.email)}{u.email ? ` · ${u.email}` : ""}</option>)}
                  </select>
                )}
              </div>
              <Input value={mail.subject} onChange={(e) => setMail((m) => ({ ...m, subject: e.target.value }))} placeholder={t("adminDashboard.mailSubject")} className="mb-2" />
              <textarea value={mail.body} onChange={(e) => setMail((m) => ({ ...m, body: e.target.value }))} placeholder={t("adminDashboard.mailBody")} rows={5} className="w-full rounded-md border px-3 py-2 text-sm mb-2" style={{ borderColor: "var(--border)" }} />
              <Button disabled={!mail.subject.trim() || sendMail.isPending} onClick={submitMail} style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}><Send className="w-4 h-4 mr-1" /> {t("adminDashboard.mailSendButton")}</Button>
              <p className="mt-3 text-sm">{t("adminDashboard.broadcastRecoveryInfo")}</p>
              {sendMail.data && <p role="status" className="mt-3 text-sm">{t("adminDashboard.mailOutcome", {notifications: sendMail.data.sent, accepted: sendMail.data.email.accepted, failed: sendMail.data.email.failed, skipped: sendMail.data.email.skipped})}</p>}
              <p className="text-xs mt-2" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.mailAlsoInAppNote")}</p>
            </div>

            <BroadcastHistory />

            {/* SMTP configuration */}
            <div className="rounded-xl p-5 max-w-2xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-1"><Mail className="w-4 h-4" style={{ color: "var(--link)" }} /><h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{t("adminDashboard.smtpTitle")}</h3></div>
              <p className="text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>
                {t("adminDashboard.smtpDescription")}{" "}
                {settings?.smtp?.configured
                  ? <span style={{ color: "var(--success)" }}>{t("adminDashboard.smtpConfigured")}</span>
                  : <span style={{ color: "var(--destructive)" }}>{t("adminDashboard.smtpNotConfigured")}</span>}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="sm:col-span-2"><label className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.smtpHost")}</label><Input value={smtp.host} onChange={(e) => setSmtp((s) => ({ ...s, host: e.target.value }))} placeholder="smtp.r-aero-academy.com" /></div>
                <div><label className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.smtpPort")}</label><Input value={smtp.port} onChange={(e) => setSmtp((s) => ({ ...s, port: e.target.value }))} placeholder="587" /></div>
                <div><label className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.smtpUser")}</label><Input value={smtp.user} onChange={(e) => setSmtp((s) => ({ ...s, user: e.target.value }))} placeholder="contact@r-aero-academy.com" /></div>
                <div className="sm:col-span-2"><label className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.smtpPassword")}</label><Input type="password" value={smtp.password} onChange={(e) => setSmtp((s) => ({ ...s, password: e.target.value }))} placeholder={settings?.smtp?.passwordSet ? "••••••••" : ""} className="font-mono" /></div>
                <div><label className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.smtpFrom")}</label><Input value={smtp.from} onChange={(e) => setSmtp((s) => ({ ...s, from: e.target.value }))} placeholder="R-AERO Academy <contact@r-aero-academy.com>" /></div>
                <div><label className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.smtpNotifyEmail")}</label><Input value={smtp.notifyEmail} onChange={(e) => setSmtp((s) => ({ ...s, notifyEmail: e.target.value }))} placeholder="contact@r-aero-academy.com" /></div>
                <div><label className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.imapHost")}</label><Input value={smtp.imapHost} onChange={(e) => setSmtp((s) => ({ ...s, imapHost: e.target.value }))} placeholder="imap.hostinger.com" /></div>
                <div><label className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.imapPort")}</label><Input value={smtp.imapPort} onChange={(e) => setSmtp((s) => ({ ...s, imapPort: e.target.value }))} placeholder="993" /></div>
              </div>
              <p className="text-xs mt-2" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.imapNote")}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button disabled={saveSmtp.isPending} onClick={() => saveSmtp.mutate(smtp)} style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>{t("adminDashboard.btnSaveSetting")}</Button>
              </div>
              <p className="text-xs mt-2" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.smtpStorageNote")}</p>
              <div className="mt-4 pt-4 flex flex-wrap gap-2 items-end" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="flex-1 min-w-[200px]"><label className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.smtpTestLabel")}</label><Input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="vous@example.com" /></div>
                <Button variant="outline" disabled={!testTo.trim() || sendTest.isPending} onClick={() => sendTest.mutate({ to: testTo })}>{t("adminDashboard.smtpTestButton")}</Button>
              </div>
            </div>
            </>)}
          </TabsContent>

          {/* Stripe — payment keys */}
          <TabsContent value="stripe">
            <h2 className="font-semibold mb-4" style={{ color: "var(--foreground)" }}>{t("adminDashboard.stripeTitle")}</h2>
            <div className="rounded-xl p-5 max-w-2xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-1"><CreditCard className="w-4 h-4" style={{ color: "var(--link)" }} /><h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{t("adminDashboard.stripeKeysTitle")}</h3></div>
              <p className="text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>
                {t("adminDashboard.stripeDescription")}{" "}
                {settings?.stripe?.configured
                  ? <span style={{ color: "var(--success)" }}>{t("adminDashboard.stripeConfigured")}</span>
                  : <span style={{ color: "var(--destructive)" }}>{t("adminDashboard.stripeNotConfigured")}</span>}
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.stripePublishable")}</label>
                  <Input value={stripe.publishableKey} onChange={(e) => setStripe((s) => ({ ...s, publishableKey: e.target.value }))} placeholder="pk_live_… / pk_test_…" className="font-mono" />
                </div>
                <div>
                  <label className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.stripeSecret")}</label>
                  <Input type="password" value={stripe.secretKey} onChange={(e) => setStripe((s) => ({ ...s, secretKey: e.target.value }))} placeholder={settings?.stripe?.secretSet ? "••••••••" : "sk_live_… / sk_test_…"} className="font-mono" />
                </div>
                <div>
                  <label className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.stripeWebhook")} {(settings as any)?.stripe?.webhookSet ? <span style={{ color: "var(--success)" }}>✓</span> : null}</label>
                  <Input type="password" value={stripe.webhookSecret} onChange={(e) => setStripe((s) => ({ ...s, webhookSecret: e.target.value }))} placeholder={(settings as any)?.stripe?.webhookSet ? "••••••••" : "whsec_…"} className="font-mono" />
                  <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.stripeWebhookHint")}</p>
                </div>
                <Button disabled={saveStripe.isPending} onClick={() => saveStripe.mutate(stripe)} style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>{t("adminDashboard.btnSaveSetting")}</Button>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.stripeStorageNote")}</p>
              </div>
            </div>
          </TabsContent>

          {/* Offers — landing-page pricing */}
          <TabsContent value="offers"><AdminOffers /></TabsContent>

          {/* FAQ — landing-page */}
          <TabsContent value="faq"><AdminFaq /></TabsContent>

          {/* Settings — AI API keys */}
          <TabsContent value="settings">
            <h2 className="font-semibold mb-4" style={{ color: "var(--foreground)" }}>{t("adminDashboard.settingsTitle")}</h2>
            <div className="rounded-xl p-5 max-w-2xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <h3 className="font-semibold text-sm mb-1" style={{ color: "var(--foreground)" }}>{t("adminDashboard.mistralKeyTitle")}</h3>
              <p className="text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>
                {t("adminDashboard.mistralKeyDescription")}{" "}
                {settings?.mistral?.configured
                  ? <span style={{ color: "var(--success)" }}>{t("adminDashboard.mistralConfigured", { masked: settings.mistral.masked ?? "" })}</span>
                  : <span style={{ color: "var(--destructive)" }}>{t("adminDashboard.mistralNotConfigured")}</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                <Input type="password" value={mistralKey} onChange={(e) => setMistralKey(e.target.value)} placeholder={t("adminDashboard.placeholderMistralKey")} className="flex-1 min-w-[240px] font-mono" />
                <Button disabled={!mistralKey.trim() || saveMistral.isPending} onClick={() => saveMistral.mutate({ key: mistralKey })} style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>{t("adminDashboard.btnSaveSetting")}</Button>
                {settings?.mistral?.configured && (
                  <Button variant="outline" disabled={saveMistral.isPending} onClick={() => { if (window.confirm(t("adminDashboard.confirmEraseMistral"))) saveMistral.mutate({ key: "" }); }}>{t("adminDashboard.btnErase")}</Button>
                )}
              </div>
              <p className="text-xs mt-2" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.mistralStorageNote")}</p>
              <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{t("adminDashboard.mistralMediaNote")}</p>
            </div>
          </TabsContent>
            </div>
          </div>
        </Tabs>
        {userDialog && <UserFormDialog mode={userDialog.mode} user={userDialog.mode === "edit" ? userDialog.user : undefined} defaultRole={userDialog.mode === "new" ? userDialog.defaultRole : undefined} onClose={() => setUserDialog(null)} onSaved={() => { setUserDialog(null); utils.admin.users.invalidate(); }} />}
        {historyOrg !== null && <OrganizationStatusHistory key={historyOrg} companyId={historyOrg} onClose={() => setHistoryOrg(null)} />}
        {orgDialog && <OrgFormDialog mode={orgDialog.mode} org={orgDialog.mode === "edit" ? orgDialog.org : undefined} onClose={() => setOrgDialog(null)} onSaved={() => { setOrgDialog(null); utils.admin.organizations.list.invalidate(); }} />}
        <OrgManagersDialog org={mgrOrg} onClose={() => setMgrOrg(null)} />
      </div>
    </div>
  );
}
