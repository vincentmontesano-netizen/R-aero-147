import { useState, useEffect } from "react";
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
  Plus, XCircle, GraduationCap, Download, CheckCircle, Clock, AlertCircle, Ban, Pencil, Trash2, Calendar, Newspaper, Layers, LifeBuoy, Megaphone, Building2, UserCog, Settings, ShieldCheck, Mail, Send, CreditCard
} from "lucide-react";
import DashboardSidebar from "@/components/DashboardSidebar";
import TicketThread from "@/components/TicketThread";
import UserFormDialog from "@/components/UserFormDialog";
import OrgFormDialog from "@/components/OrgFormDialog";
import OrgManagersDialog from "@/components/OrgManagersDialog";
import UserMenu from "@/components/UserMenu";
import AdminInbox from "@/components/AdminInbox";
import { toast } from "sonner";
import { Link } from "wouter";
import { Sparkles } from "lucide-react";
import BackButton from "@/components/BackButton";
import AdminContentManager from "@/components/AdminContentManager";
import AdminSessions from "@/components/AdminSessions";
import AdminArticles from "@/components/AdminArticles";

const QUOTE_STATUS: Record<string, { labelKey: string; color: string }> = {
  received: { labelKey: "adminDashboard.quoteStatusReceived", color: "oklch(42% 0.1 218)" },
  in_progress: { labelKey: "adminDashboard.quoteStatusInProgress", color: "oklch(68% 0.1 78)" },
  quote_sent: { labelKey: "adminDashboard.quoteStatusQuoteSent", color: "oklch(55% 0.18 145)" },
  accepted: { labelKey: "adminDashboard.quoteStatusAccepted", color: "oklch(55% 0.18 145)" },
  refused: { labelKey: "adminDashboard.quoteStatusRefused", color: "oklch(55% 0.22 27)" },
};

const ORDER_STATUS: Record<string, { labelKey: string; color: string }> = {
  pending: { labelKey: "adminDashboard.orderStatusPending", color: "oklch(68% 0.1 78)" },
  paid: { labelKey: "adminDashboard.orderStatusPaid", color: "oklch(55% 0.18 145)" },
  failed: { labelKey: "adminDashboard.orderStatusFailed", color: "oklch(55% 0.22 27)" },
  refunded: { labelKey: "adminDashboard.orderStatusRefunded", color: "oklch(42% 0.1 218)" },
  cancelled: { labelKey: "adminDashboard.orderStatusCancelled", color: "oklch(62% 0.02 240)" },
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
            <label className="text-xs font-medium mb-1 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.fieldTitleRequired")}</label>
            <Input value={form.title} onChange={(e) => setForm((f: any) => ({ ...f, title: e.target.value, ...(isEdit ? {} : { slug: generateSlug(e.target.value) }) }))} placeholder={t("adminDashboard.placeholderTrainingTitle")} />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium mb-1 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.fieldSlug")}</label>
            <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="human-factors-initial" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium mb-1 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.fieldDescription")}</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full rounded-md border px-3 py-2 text-sm h-20 resize-none" style={{ borderColor: "oklch(88% 0.015 88)" }} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.fieldType")}</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as any }))} className="w-full h-9 rounded-md border px-3 text-sm" style={{ borderColor: "oklch(88% 0.015 88)" }}>
              {[["elearning", "E-learning"], ["webinar", "Webinar"], ["qt", "Type Rating"], ["seminar", t("adminDashboard.trainingTypeSeminar")], ["event", t("adminDashboard.trainingTypeEvent")]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.fieldDomain")}</label>
            <select value={form.domain} onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value as any }))} className="w-full h-9 rounded-md border px-3 text-sm" style={{ borderColor: "oklch(88% 0.015 88)" }}>
              {[["b1", "B1"], ["b2", "B2"], ["b1b2", "B1/B2"], ["part66", "Part-66"], ["general", t("adminDashboard.domainGeneral")], ["management", "Management"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.fieldDurationHours")}</label>
            <Input value={form.durationHours} onChange={(e) => setForm((f) => ({ ...f, durationHours: e.target.value }))} placeholder="4.00" type="number" step="0.5" />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.fieldLanguage")}</label>
            <select value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))} className="w-full h-9 rounded-md border px-3 text-sm" style={{ borderColor: "oklch(88% 0.015 88)" }}>
              <option value="fr">{t("adminDashboard.languageFrench")}</option><option value="en">{t("adminDashboard.languageEnglish")}</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.fieldPriceHt")}</label>
            <Input value={form.priceHt} onChange={(e) => setForm((f) => ({ ...f, priceHt: e.target.value }))} placeholder="149.00" type="number" step="0.01" />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.fieldPriceTtc")}</label>
            <Input value={form.priceTtc} onChange={(e) => setForm((f) => ({ ...f, priceTtc: e.target.value }))} placeholder="178.80" type="number" step="0.01" />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.fieldPassingScore")}</label>
            <Input value={form.passingScore} onChange={(e) => setForm((f) => ({ ...f, passingScore: Number(e.target.value) }))} type="number" min="0" max="100" />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.fieldMaxAttempts")}</label>
            <Input value={form.maxAttempts} onChange={(e) => setForm((f) => ({ ...f, maxAttempts: Number(e.target.value) }))} type="number" min="1" max="10" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium mb-1 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.fieldPart147Reference")}</label>
            <Input value={form.part147Reference} onChange={(e) => setForm((f) => ({ ...f, part147Reference: e.target.value }))} placeholder="Part-145 AMC 145.A.30(e)" />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" id="published" checked={form.isPublished} onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))} />
            <label htmlFor="published" className="text-sm" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.fieldPublishImmediately")}</label>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("adminDashboard.btnCancel")}</Button>
          <Button onClick={save} disabled={!form.title || !form.slug || saving} style={{ background: "oklch(19% 0.08 252)", color: "oklch(97% 0.01 88)" }}>
            {isEdit ? t("adminDashboard.btnSave") : t("adminDashboard.btnCreateTraining")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminDashboard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [manageQuote, setManageQuote] = useState<any | null>(null);
  const { data: stats } = trpc.admin.stats.useQuery();
  const { data: users = [] } = trpc.admin.users.useQuery();
  const { data: adminTrainings = [], refetch: refetchTrainings } = trpc.admin.trainings.list.useQuery();
  const { data: orders = [] } = trpc.admin.orders.useQuery();
  const { data: quotes = [], refetch: refetchQuotes } = trpc.admin.quotes.list.useQuery();
  const { data: adminTickets = [], refetch: refetchTickets } = trpc.support.adminList.useQuery();
  const setTicketStatus = trpc.support.setStatus.useMutation({ onSuccess: () => refetchTickets() });
  const broadcast = trpc.admin.broadcast.useMutation({ onSuccess: (r: any) => toast.success(t("adminDashboard.toastBroadcastSent", { count: r?.sent ?? 0 })), onError: (e) => toast.error(e.message) });
  const [openTicket, setOpenTicket] = useState<number | null>(null);
  const [bcast, setBcast] = useState({ title: "", body: "", audience: "all", email: false });
  const [emailSubTab, setEmailSubTab] = useState<"compose" | "inbox">("compose");
  // Dedicated email composer (Emails module).
  const [mail, setMail] = useState({ mode: "all" as "all" | "company" | "user", orgId: "", userId: "", subject: "", body: "", alsoInApp: true });
  const sendMail = trpc.admin.broadcast.useMutation({
    onSuccess: () => { toast.success(t("adminDashboard.toastMailSent")); setMail((m) => ({ ...m, subject: "", body: "" })); }, onError: (e) => toast.error(e.message),
  });
  const submitMail = () => {
    const base: any = { title: mail.subject, body: mail.body || undefined, email: true };
    if (!mail.alsoInApp) base.title = mail.subject; // email always carries the subject as title
    if (mail.mode === "user") { if (!mail.userId) return toast.error(t("adminDashboard.mailPickUser")); sendMail.mutate({ ...base, userId: Number(mail.userId) }); }
    else if (mail.mode === "company") { if (!mail.orgId) return toast.error(t("adminDashboard.mailPickOrg")); sendMail.mutate({ ...base, audience: `company:${mail.orgId}` }); }
    else sendMail.mutate({ ...base, audience: "all" });
  };
  const { data: complianceReport = [] } = trpc.admin.complianceReport.useQuery();

  const updateQuoteStatus = trpc.admin.quotes.updateStatus.useMutation({
    onSuccess: () => { toast.success(t("adminDashboard.toastStatusUpdated")); refetchQuotes(); },
  });
  const updateTraining = trpc.admin.trainings.update.useMutation({
    onSuccess: () => { toast.success(t("adminDashboard.toastTrainingUpdated")); refetchTrainings(); },
  });
  const deleteTrainingM = trpc.admin.trainings.delete.useMutation({
    onSuccess: () => { toast.success(t("adminDashboard.toastTrainingDeleted")); refetchTrainings(); },
    onError: (e) => toast.error(e.message),
  });
  const [trainingDialog, setTrainingDialog] = useState<{ training: any | null } | null>(null);
  const [tab, setTab] = useState("trainings");
  const [formSubTab, setFormSubTab] = useState<"catalogue" | "content" | "sessions">("catalogue");
  const utils = trpc.useUtils();
  const setUserStatus = trpc.admin.setUserStatus.useMutation({
    onSuccess: () => { toast.success(t("adminDashboard.toastAccountStatusUpdated")); utils.admin.users.invalidate(); },
  });
  const setUserRole = trpc.admin.setUserRole.useMutation({
    onSuccess: () => { toast.success(t("adminDashboard.toastRoleUpdated")); utils.admin.users.invalidate(); },
  });
  const eraseUser = trpc.admin.erasePerson.useMutation({
    onSuccess: () => { toast.success(t("adminDashboard.toastAccountErased")); utils.admin.users.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const [userDialog, setUserDialog] = useState<{ mode: "new"; defaultRole?: string } | { mode: "edit"; user: any } | null>(null);
  const { data: organizations = [] } = trpc.admin.organizations.list.useQuery();
  const setOrgStatus = trpc.admin.organizations.setStatus.useMutation({
    onSuccess: () => { toast.success(t("adminDashboard.toastOrgUpdated")); utils.admin.organizations.list.invalidate(); }, onError: (e) => toast.error(e.message),
  });
  const deleteOrg = trpc.admin.organizations.delete.useMutation({
    onSuccess: () => { toast.success(t("adminDashboard.toastOrgDeleted")); utils.admin.organizations.list.invalidate(); }, onError: (e) => toast.error(e.message),
  });
  const [orgDialog, setOrgDialog] = useState<{ mode: "new" } | { mode: "edit"; org: any } | null>(null);
  const [mgrOrg, setMgrOrg] = useState<any | null>(null);
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

  const exportComplianceCSV = () => {
    const headers = [t("adminDashboard.csvLearner"), t("adminDashboard.csvEmail"), t("adminDashboard.csvTraining"), t("adminDashboard.csvType"), t("adminDashboard.csvStatus"), t("adminDashboard.csvProgress"), t("adminDashboard.csvCompletionDate"), t("adminDashboard.csvExpiration"), t("adminDashboard.csvCertificateNumber")];
    const rows = complianceReport.map((r: any) => [
      r.userName, r.userEmail, r.trainingTitle, r.trainingType, r.status,
      `${r.progressPercent}%`,
      r.completedAt ? new Date(r.completedAt).toLocaleDateString("fr-FR") : "—",
      r.expiresAt ? new Date(r.expiresAt).toLocaleDateString("fr-FR") : "—",
      r.certificateNumber ?? "—",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "rapport_conformite_r-aero.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success(t("adminDashboard.toastComplianceExported"));
  };

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(97% 0.01 88)" }}>
        <div className="text-center">
          <XCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "oklch(55% 0.22 27)" }} />
          <h2 className="font-serif text-2xl font-bold mb-2" style={{ color: "oklch(19% 0.08 252)" }}>{t("adminDashboard.accessDeniedTitle")}</h2>
          <p className="text-sm" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.accessDeniedBody")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "oklch(97% 0.01 88)" }}>
      <div style={{ background: "oklch(19% 0.08 252)" }}>
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <BackButton dark />
          <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
            <div className="flex items-center gap-3">
              <GraduationCap className="w-6 h-6" style={{ color: "oklch(68% 0.1 78)" }} />
              <div>
                <h1 className="font-serif text-2xl font-bold text-white">{t("adminDashboard.headerTitle")}</h1>
                <p className="text-white/60 text-sm">{t("adminDashboard.headerSubtitle")}</p>
              </div>
            </div>
            <UserMenu />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { icon: Users, value: stats?.users ?? 0, label: t("adminDashboard.statUsers") },
              { icon: BookOpen, value: stats?.trainings ?? 0, label: t("adminDashboard.statTrainings") },
              { icon: ShoppingCart, value: stats?.orders ?? 0, label: t("adminDashboard.statOrders") },
              { icon: FileText, value: stats?.quotes ?? 0, label: t("adminDashboard.statQuotes") },
              { icon: GraduationCap, value: stats?.enrollments ?? 0, label: t("adminDashboard.statEnrollments") },
            ].map((s) => (
              <div key={s.label} className="rounded-xl p-4" style={{ background: "oklch(97% 0.01 88 / 0.07)", border: "1px solid oklch(97% 0.01 88 / 0.1)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className="w-4 h-4" style={{ color: "oklch(68% 0.1 78)" }} />
                  <span className="font-serif text-2xl font-bold" style={{ color: "oklch(68% 0.1 78)" }}>{s.value}</span>
                </div>
                <div className="text-xs text-white/50">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex flex-col md:flex-row gap-4 md:gap-6 md:items-start">
            <DashboardSidebar active={tab} onSelect={setTab} heading={t("adminDashboard.sidebarHeading")} items={[
              { key: "trainings", label: t("adminDashboard.navTrainings"), icon: BookOpen },
              { key: "news", label: t("adminDashboard.navNews"), icon: Newspaper },
              { key: "users", label: t("adminDashboard.navUsers"), icon: Users },
              { key: "organizations", label: t("adminDashboard.navOrganizations"), icon: Building2 },
              { key: "admins", label: t("adminDashboard.navAdmins"), icon: ShieldCheck },
              { key: "orders", label: t("adminDashboard.navOrders"), icon: ShoppingCart },
              { key: "quotes", label: t("adminDashboard.navQuotes"), icon: FileText },
              { key: "support", label: t("adminDashboard.navSupport"), icon: LifeBuoy },
              { key: "emails", label: t("adminDashboard.navEmails"), icon: Mail },
              { key: "stripe", label: t("adminDashboard.navStripe"), icon: CreditCard },
              { key: "compliance", label: t("adminDashboard.navCompliance"), icon: BarChart3 },
              { key: "settings", label: t("adminDashboard.navSettings"), icon: Settings },
            ]} />
            <div className="flex-1 min-w-0">

          {/* Trainings */}
          <TabsContent value="trainings">
            <div className="flex gap-2 mb-5 border-b" style={{ borderColor: "oklch(88% 0.015 88)" }}>
              {([["catalogue", t("adminDashboard.subTabCatalogue")], ["content", t("adminDashboard.subTabContent")], ["sessions", t("adminDashboard.subTabSessions")]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setFormSubTab(k)} className="px-3 py-2 text-sm font-medium" style={{ borderBottom: `2px solid ${formSubTab === k ? "oklch(68% 0.1 78)" : "transparent"}`, color: formSubTab === k ? "oklch(19% 0.08 252)" : "oklch(45% 0.02 240)" }}>{l}</button>
              ))}
            </div>
            {formSubTab === "catalogue" ? (
              <>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="font-semibold" style={{ color: "oklch(19% 0.08 252)" }}>{t("adminDashboard.trainingsCatalogTitle")}</h2>
              <div className="flex flex-wrap gap-2">
                <Link href="/maker">
                  <Button size="sm" variant="outline"><Sparkles className="w-4 h-4 mr-1" /> {t("adminDashboard.btnAiCreator")}</Button>
                </Link>
                <Button size="sm" onClick={() => setTrainingDialog({ training: null })} style={{ background: "oklch(68% 0.1 78)", color: "oklch(19% 0.08 252)" }}>
                  <Plus className="w-4 h-4 mr-1" /> {t("adminDashboard.btnNewTraining")}
                </Button>
              </div>
            </div>
            <TrainingFormDialog open={!!trainingDialog} training={trainingDialog?.training ?? null} onOpenChange={(o) => { if (!o) setTrainingDialog(null); }} onSuccess={() => { setTrainingDialog(null); refetchTrainings(); }} />
            <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid oklch(88% 0.015 88)" }}>
              <table className="w-full text-sm min-w-[640px]">
                <thead style={{ background: "oklch(93% 0.015 88)" }}>
                  <tr>{[t("adminDashboard.thTitle"), t("adminDashboard.thType"), t("adminDashboard.thDomain"), t("adminDashboard.thDuration"), t("adminDashboard.thPriceTtc"), t("adminDashboard.thRequiredScore"), t("adminDashboard.thStatus"), t("adminDashboard.thActions")].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-xs tracking-wide" style={{ color: "oklch(45% 0.02 240)" }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {adminTrainings.map((tr, i) => (
                    <tr key={tr.id} style={{ background: i % 2 === 0 ? "oklch(100% 0 0)" : "oklch(97% 0.01 88)", borderTop: "1px solid oklch(93% 0.015 88)" }}>
                      <td className="px-4 py-3 font-medium max-w-xs" style={{ color: "oklch(19% 0.08 252)" }}>
                        <div className="truncate">{tr.title}</div>
                        {tr.part147Reference && <div className="text-xs mt-0.5" style={{ color: "oklch(42% 0.1 218)" }}>{tr.part147Reference}</div>}
                      </td>
                      <td className="px-4 py-3" style={{ color: "oklch(45% 0.02 240)" }}>{tr.type}</td>
                      <td className="px-4 py-3" style={{ color: "oklch(45% 0.02 240)" }}>{tr.domain ?? "—"}</td>
                      <td className="px-4 py-3" style={{ color: "oklch(45% 0.02 240)" }}>{tr.durationHours ? `${tr.durationHours}h` : "—"}</td>
                      <td className="px-4 py-3 font-medium" style={{ color: "oklch(19% 0.08 252)" }}>{tr.priceTtc ? `${Number(tr.priceTtc).toFixed(0)} €` : t("adminDashboard.priceOnQuote")}</td>
                      <td className="px-4 py-3" style={{ color: "oklch(45% 0.02 240)" }}>{tr.passingScore ?? 75}%</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: tr.isPublished ? "oklch(55% 0.18 145 / 0.1)" : "oklch(62% 0.02 240 / 0.1)", color: tr.isPublished ? "oklch(55% 0.18 145)" : "oklch(62% 0.02 240)" }}>
                          {tr.isPublished ? t("adminDashboard.statusPublished") : t("adminDashboard.statusDraft")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Button variant="outline" size="sm" onClick={() => setTrainingDialog({ training: tr })}><Pencil className="w-3.5 h-3.5 mr-1" /> {t("adminDashboard.btnEdit")}</Button>
                          <Button variant="outline" size="sm" onClick={() => updateTraining.mutate({ id: tr.id, isPublished: !tr.isPublished })}>
                            {tr.isPublished ? t("adminDashboard.btnUnpublish") : t("adminDashboard.btnPublish")}
                          </Button>
                          <button onClick={() => { if (confirm(t("adminDashboard.confirmDeleteTraining", { title: tr.title }))) deleteTrainingM.mutate({ id: tr.id }); }} title={t("adminDashboard.btnDelete")} className="p-1.5 rounded hover:bg-black/5 text-red-500"><Trash2 className="w-4 h-4" /></button>
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
              <AdminSessions />
            )}
          </TabsContent>

          {/* News / Actualités */}
          <TabsContent value="news">
            <AdminArticles />
          </TabsContent>

          {/* Users */}
          <TabsContent value="users">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="font-semibold" style={{ color: "oklch(19% 0.08 252)" }}>{t("adminDashboard.usersTitle")}</h2>
              <Button size="sm" onClick={() => setUserDialog({ mode: "new" })} style={{ background: "oklch(68% 0.1 78)", color: "oklch(19% 0.08 252)" }}><Plus className="w-4 h-4 mr-1" /> {t("adminDashboard.btnAddUser")}</Button>
            </div>
            <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid oklch(88% 0.015 88)" }}>
              <table className="w-full text-sm min-w-[640px]">
                <thead style={{ background: "oklch(93% 0.015 88)" }}>
                  <tr>{[t("adminDashboard.thName"), t("adminDashboard.thEmail"), t("adminDashboard.thOrganization"), t("adminDashboard.thRole"), t("adminDashboard.thPart66License"), t("adminDashboard.thStatus"), t("adminDashboard.thRegistration"), t("adminDashboard.thActions")].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-xs tracking-wide" style={{ color: "oklch(45% 0.02 240)" }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {users.map((u, i) => {
                    const suspended = (u as any).status === "suspended";
                    return (
                    <tr key={u.id} style={{ background: i % 2 === 0 ? "oklch(100% 0 0)" : "oklch(97% 0.01 88)", borderTop: "1px solid oklch(93% 0.015 88)" }}>
                      <td className="px-4 py-3 font-medium" style={{ color: "oklch(19% 0.08 252)" }}>{u.name ?? "—"}</td>
                      <td className="px-4 py-3" style={{ color: "oklch(45% 0.02 240)" }}>{u.email ?? "—"}</td>
                      <td className="px-4 py-3" style={{ color: "oklch(45% 0.02 240)" }}>
                        {(u as any).organizationName
                          ? <span>{(u as any).organizationName}{(u as any).affiliationRole === "MANAGER" ? <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "oklch(68% 0.1 78 / 0.18)", color: "oklch(50% 0.1 78)" }}>{t("org.roleManager")}</span> : ""}</span>
                          : <span style={{ color: "oklch(62% 0.02 240)" }}>{t("adminDashboard.orgNA")}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          onChange={(e) => setUserRole.mutate({ id: u.id, role: e.target.value as any })}
                          className="h-7 rounded-md border px-1.5 text-xs"
                          style={{ borderColor: "oklch(88% 0.015 88)" }}
                        >
                          {[["user", t("adminDashboard.roleLearner")], ["company_manager", t("adminDashboard.roleManager")], ["instructor", t("adminDashboard.roleInstructor")], ["admin", t("adminDashboard.roleAdmin")]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: "oklch(45% 0.02 240)" }}>{(u as any).licenseNumber ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: suspended ? "oklch(55% 0.22 27 / 0.1)" : "oklch(55% 0.18 145 / 0.1)", color: suspended ? "oklch(55% 0.22 27)" : "oklch(55% 0.18 145)" }}>
                          {suspended ? t("adminDashboard.statusSuspended") : t("adminDashboard.statusActive")}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ color: "oklch(45% 0.02 240)" }}>{new Date(u.createdAt).toLocaleDateString("fr-FR")}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Button variant="outline" size="sm" onClick={() => setUserDialog({ mode: "edit", user: u })}><Pencil className="w-3.5 h-3.5 mr-1" /> {t("adminDashboard.btnEdit")}</Button>
                          <Button variant="outline" size="sm" onClick={() => setUserStatus.mutate({ id: u.id, status: suspended ? "active" : "suspended" })}>
                            {suspended ? <><CheckCircle className="w-3.5 h-3.5 mr-1" /> {t("adminDashboard.btnActivate")}</> : <><Ban className="w-3.5 h-3.5 mr-1" /> {t("adminDashboard.btnSuspend")}</>}
                          </Button>
                          <button title={t("adminDashboard.btnDeleteGdpr")} onClick={() => { if (window.confirm(t("adminDashboard.confirmEraseUser", { user: u.name ?? u.email ?? "" }))) eraseUser.mutate({ userId: u.id }); }} className="p-1.5 rounded hover:bg-black/5 text-red-500"><Trash2 className="w-4 h-4" /></button>
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
            <h2 className="font-semibold mb-4" style={{ color: "oklch(19% 0.08 252)" }}>{t("adminDashboard.ordersTitle")}</h2>
            <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid oklch(88% 0.015 88)" }}>
              <table className="w-full text-sm min-w-[640px]">
                <thead style={{ background: "oklch(93% 0.015 88)" }}>
                  <tr>{[t("adminDashboard.thInvoiceNumber"), t("adminDashboard.thClient"), t("adminDashboard.thTotalTtc"), t("adminDashboard.thStatus"), t("adminDashboard.thStripeId"), t("adminDashboard.thDate")].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-xs tracking-wide" style={{ color: "oklch(45% 0.02 240)" }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {orders.map((o: any, i: number) => {
                    const statusConf = ORDER_STATUS[o.status] ?? ORDER_STATUS.pending;
                    return (
                      <tr key={o.id} style={{ background: i % 2 === 0 ? "oklch(100% 0 0)" : "oklch(97% 0.01 88)", borderTop: "1px solid oklch(93% 0.015 88)" }}>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: "oklch(45% 0.02 240)" }}>{o.invoiceNumber ?? `#${o.id}`}</td>
                        <td className="px-4 py-3" style={{ color: "oklch(19% 0.08 252)" }}>{o.user?.name ?? o.user?.email ?? "—"}</td>
                        <td className="px-4 py-3 font-medium" style={{ color: "oklch(19% 0.08 252)" }}>{Number(o.totalTtc).toFixed(2)} €</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: statusConf.color, background: statusConf.color + " / 0.1" }}>
                            {t(statusConf.labelKey)}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: "oklch(62% 0.02 240)" }}>{o.stripePaymentIntentId ? o.stripePaymentIntentId.slice(0, 16) + "..." : "—"}</td>
                        <td className="px-4 py-3" style={{ color: "oklch(45% 0.02 240)" }}>{new Date(o.createdAt).toLocaleDateString("fr-FR")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Quotes */}
          <TabsContent value="quotes">
            <h2 className="font-semibold mb-4" style={{ color: "oklch(19% 0.08 252)" }}>{t("adminDashboard.quotesTitle")}</h2>
            <div className="space-y-4">
              {quotes.map((q: any) => {
                const statusConf = QUOTE_STATUS[q.status] ?? QUOTE_STATUS.received;
                return (
                  <div key={q.id} className="rounded-xl p-5" style={{ background: "oklch(100% 0 0)", border: "1px solid oklch(88% 0.015 88)" }}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold" style={{ color: "oklch(19% 0.08 252)" }}>{q.companyName}</span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: statusConf.color, background: statusConf.color + " / 0.1" }}>{t(statusConf.labelKey)}</span>
                        </div>
                        <div className="text-sm mb-1" style={{ color: "oklch(45% 0.02 240)" }}>{q.contactName} — {q.contactEmail}{q.contactPhone && ` — ${q.contactPhone}`}</div>
                        {q.employeeCount && <div className="text-xs" style={{ color: "oklch(62% 0.02 240)" }}>{t("adminDashboard.employeesConcerned", { count: q.employeeCount })}</div>}
                        {q.trainingTypes && <div className="text-xs mt-1" style={{ color: "oklch(62% 0.02 240)" }}>{t("adminDashboard.quoteTrainings", { types: q.trainingTypes })}</div>}
                        {q.message && <div className="text-xs mt-2 p-2 rounded" style={{ background: "oklch(93% 0.015 88)", color: "oklch(45% 0.02 240)" }}>{q.message}</div>}
                        <div className="text-xs mt-2" style={{ color: "oklch(62% 0.02 240)" }}>{t("adminDashboard.receivedOn", { date: new Date(q.createdAt).toLocaleDateString("fr-FR") })}</div>
                      </div>
                      <div className="flex flex-col gap-2 items-end shrink-0">
                        <select value={q.status} onChange={(e) => updateQuoteStatus.mutate({ id: q.id, status: e.target.value as any })} className="h-8 rounded-md border px-2 text-xs min-w-32" style={{ borderColor: "oklch(88% 0.015 88)" }}>
                          {Object.entries(QUOTE_STATUS).map(([v, { labelKey }]) => <option key={v} value={v}>{t(labelKey)}</option>)}
                        </select>
                        <button onClick={() => setManageQuote(q)} className="text-xs px-3 py-1.5 rounded-md font-medium" style={{ background: "oklch(19% 0.08 252)", color: "white" }}>{t("adminDashboard.btnManageReply")}</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <QuoteManageDialog quote={manageQuote} meId={user?.id ?? 0} onClose={() => { setManageQuote(null); refetchQuotes(); }} />
          </TabsContent>

          {/* Compliance */}
          <TabsContent value="compliance">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="font-semibold" style={{ color: "oklch(19% 0.08 252)" }}>{t("adminDashboard.complianceTitle")}</h2>
              <Button variant="outline" size="sm" onClick={exportComplianceCSV}>
                <Download className="w-4 h-4 mr-1" /> {t("adminDashboard.btnExportCsvAudit")}
              </Button>
            </div>
            <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid oklch(88% 0.015 88)" }}>
              <table className="w-full text-sm min-w-[640px]">
                <thead style={{ background: "oklch(93% 0.015 88)" }}>
                  <tr>{[t("adminDashboard.thLearner"), t("adminDashboard.thTraining"), t("adminDashboard.thStatus"), t("adminDashboard.thProgress"), t("adminDashboard.thCompletion"), t("adminDashboard.thExpiration"), t("adminDashboard.thCertificate")].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-xs tracking-wide" style={{ color: "oklch(45% 0.02 240)" }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {complianceReport.map((r: any, i: number) => {
                    const Icon = ENROLLMENT_STATUS_ICONS[r.status] ?? Clock;
                    const statusColors: Record<string, string> = {
                      completed: "oklch(55% 0.18 145)", in_progress: "oklch(42% 0.1 218)",
                      not_started: "oklch(62% 0.02 240)", expired: "oklch(55% 0.22 27)", failed: "oklch(55% 0.22 27)",
                    };
                    return (
                      <tr key={r.enrollmentId} style={{ background: i % 2 === 0 ? "oklch(100% 0 0)" : "oklch(97% 0.01 88)", borderTop: "1px solid oklch(93% 0.015 88)" }}>
                        <td className="px-4 py-3" style={{ color: "oklch(19% 0.08 252)" }}>
                          <div className="font-medium">{r.userName}</div>
                          <div className="text-xs" style={{ color: "oklch(62% 0.02 240)" }}>{r.userEmail}</div>
                        </td>
                        <td className="px-4 py-3 max-w-xs" style={{ color: "oklch(45% 0.02 240)" }}>
                          <div className="truncate">{r.trainingTitle}</div>
                          <div className="text-xs" style={{ color: "oklch(62% 0.02 240)" }}>{r.trainingType}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: statusColors[r.status] ?? "oklch(62% 0.02 240)" }}>
                            <Icon className="w-3 h-3" />
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3" style={{ color: "oklch(45% 0.02 240)" }}>{r.progressPercent}%</td>
                        <td className="px-4 py-3" style={{ color: "oklch(45% 0.02 240)" }}>{r.completedAt ? new Date(r.completedAt).toLocaleDateString("fr-FR") : "—"}</td>
                        <td className="px-4 py-3" style={{ color: "oklch(45% 0.02 240)" }}>{r.expiresAt ? new Date(r.expiresAt).toLocaleDateString("fr-FR") : "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: r.certificateNumber ? "oklch(55% 0.18 145)" : "oklch(62% 0.02 240)" }}>
                          {r.certificateNumber ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Organizations */}
          <TabsContent value="organizations">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="font-semibold" style={{ color: "oklch(19% 0.08 252)" }}>{t("adminDashboard.organizationsTitle")}</h2>
              <Button size="sm" onClick={() => setOrgDialog({ mode: "new" })} style={{ background: "oklch(68% 0.1 78)", color: "oklch(19% 0.08 252)" }}><Plus className="w-4 h-4 mr-1" /> {t("adminDashboard.btnNewOrg")}</Button>
            </div>
            <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid oklch(88% 0.015 88)" }}>
              <table className="w-full text-sm min-w-[680px]">
                <thead style={{ background: "oklch(93% 0.015 88)" }}>
                  <tr>{[t("adminDashboard.thName"), t("adminDashboard.thType"), t("adminDashboard.thCountry"), t("adminDashboard.thManagers"), t("adminDashboard.thEmployees"), t("adminDashboard.thStatus"), t("adminDashboard.thActions")].map((h) => <th key={h} className="text-left px-4 py-3 font-semibold text-xs tracking-wide" style={{ color: "oklch(45% 0.02 240)" }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {organizations.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-sm" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.noOrganizations")}</td></tr>}
                  {organizations.map((o: any, i: number) => {
                    const suspended = o.status === "SUSPENDED";
                    return (
                      <tr key={o.id} style={{ background: i % 2 === 0 ? "oklch(100% 0 0)" : "oklch(97% 0.01 88)", borderTop: "1px solid oklch(93% 0.015 88)" }}>
                        <td className="px-4 py-3 font-medium" style={{ color: "oklch(19% 0.08 252)" }}>{o.name}</td>
                        <td className="px-4 py-3" style={{ color: "oklch(45% 0.02 240)" }}>{o.type ?? "—"}</td>
                        <td className="px-4 py-3" style={{ color: "oklch(45% 0.02 240)" }}>{o.country ?? "—"}</td>
                        <td className="px-4 py-3" style={{ color: "oklch(45% 0.02 240)" }}>{o.managerCount}</td>
                        <td className="px-4 py-3" style={{ color: "oklch(45% 0.02 240)" }}>{o.employeeCount}</td>
                        <td className="px-4 py-3"><span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: suspended ? "oklch(55% 0.22 27 / 0.1)" : "oklch(55% 0.18 145 / 0.1)", color: suspended ? "oklch(55% 0.22 27)" : "oklch(55% 0.18 145)" }}>{suspended ? t("adminDashboard.statusSuspendedFem") : t("adminDashboard.statusActiveFem")}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Button variant="outline" size="sm" onClick={() => setMgrOrg(o)}><UserCog className="w-3.5 h-3.5 mr-1" /> {t("adminDashboard.btnManagers")}</Button>
                            <Button variant="outline" size="sm" onClick={() => setOrgDialog({ mode: "edit", org: o })}><Pencil className="w-3.5 h-3.5 mr-1" /> {t("adminDashboard.btnEdit")}</Button>
                            <Button variant="outline" size="sm" onClick={() => setOrgStatus.mutate({ id: o.id, status: suspended ? "ACTIVE" : "SUSPENDED" })}>{suspended ? t("adminDashboard.btnActivate") : t("adminDashboard.btnSuspend")}</Button>
                            <button title={t("adminDashboard.btnDelete")} onClick={() => { if (window.confirm(t("adminDashboard.confirmDeleteOrg", { name: o.name }))) deleteOrg.mutate({ id: o.id }); }} className="p-1.5 rounded hover:bg-black/5 text-red-500"><Trash2 className="w-4 h-4" /></button>
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
              <h2 className="font-semibold" style={{ color: "oklch(19% 0.08 252)" }}>{t("adminDashboard.adminsTitle")}</h2>
              <Button size="sm" onClick={() => setUserDialog({ mode: "new", defaultRole: "admin" })} style={{ background: "oklch(68% 0.1 78)", color: "oklch(19% 0.08 252)" }}><Plus className="w-4 h-4 mr-1" /> {t("adminDashboard.btnCreateAdmin")}</Button>
            </div>
            <p className="text-xs mb-4" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.adminsNote")}</p>
            <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid oklch(88% 0.015 88)" }}>
              <table className="w-full text-sm min-w-[560px]">
                <thead style={{ background: "oklch(93% 0.015 88)" }}>
                  <tr>{[t("adminDashboard.thName"), t("adminDashboard.thEmail"), t("adminDashboard.thStatus"), t("adminDashboard.thActions")].map((h) => <th key={h} className="text-left px-4 py-3 font-semibold text-xs tracking-wide" style={{ color: "oklch(45% 0.02 240)" }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {users.filter((u: any) => u.role === "admin").map((u: any, i: number) => {
                    const suspended = u.status === "suspended";
                    const isSelf = u.id === user?.id;
                    return (
                      <tr key={u.id} style={{ background: i % 2 === 0 ? "oklch(100% 0 0)" : "oklch(97% 0.01 88)", borderTop: "1px solid oklch(93% 0.015 88)" }}>
                        <td className="px-4 py-3 font-medium" style={{ color: "oklch(19% 0.08 252)" }}>{u.name ?? "—"}{isSelf && <span className="text-[11px] ml-1" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.youMarker")}</span>}</td>
                        <td className="px-4 py-3" style={{ color: "oklch(45% 0.02 240)" }}>{u.email ?? "—"}</td>
                        <td className="px-4 py-3"><span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: suspended ? "oklch(55% 0.22 27 / 0.1)" : "oklch(55% 0.18 145 / 0.1)", color: suspended ? "oklch(55% 0.22 27)" : "oklch(55% 0.18 145)" }}>{suspended ? t("adminDashboard.statusSuspended") : t("adminDashboard.statusActive")}</span></td>
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
            <div className="rounded-xl p-5 mb-5" style={{ background: "oklch(100% 0 0)", border: "1px solid oklch(88% 0.015 88)" }}>
              <div className="flex items-center gap-2 mb-2"><Megaphone className="w-4 h-4" style={{ color: "oklch(68% 0.1 78)" }} /><h3 className="font-semibold text-sm" style={{ color: "oklch(19% 0.08 252)" }}>{t("adminDashboard.broadcastTitle")}</h3></div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <Input value={bcast.title} onChange={(e) => setBcast((b) => ({ ...b, title: e.target.value }))} placeholder={t("adminDashboard.placeholderBroadcastTitle")} />
                <select value={bcast.audience} onChange={(e) => setBcast((b) => ({ ...b, audience: e.target.value }))} className="h-9 rounded-md border px-2 text-sm" style={{ borderColor: "oklch(88% 0.015 88)" }}>
                  <option value="all">{t("adminDashboard.audienceAll")}</option>
                </select>
              </div>
              <Input value={bcast.body} onChange={(e) => setBcast((b) => ({ ...b, body: e.target.value }))} placeholder={t("adminDashboard.placeholderBroadcastBody")} className="mb-2" />
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "oklch(45% 0.02 240)" }}>
                  <input type="checkbox" checked={bcast.email} onChange={(e) => setBcast((b) => ({ ...b, email: e.target.checked }))} />
                  <span>{t("adminDashboard.broadcastAlsoEmail")}</span>
                </label>
                <Button size="sm" disabled={!bcast.title.trim() || broadcast.isPending} onClick={() => broadcast.mutate({ audience: bcast.audience, title: bcast.title, body: bcast.body || undefined, email: bcast.email })} style={{ background: "oklch(19% 0.08 252)", color: "white" }}>{t("adminDashboard.btnBroadcast")}</Button>
              </div>
            </div>
            <h2 className="font-semibold mb-4" style={{ color: "oklch(19% 0.08 252)" }}>{t("adminDashboard.supportTicketsTitle")}</h2>
            <div className="space-y-3">
              {adminTickets.length === 0 && <p className="text-sm" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.noTickets")}</p>}
              {adminTickets.map((tk: any) => (
                <div key={tk.id} className="rounded-xl" style={{ background: "oklch(100% 0 0)", border: "1px solid oklch(88% 0.015 88)" }}>
                  <div className="flex items-center justify-between gap-3 p-4">
                    <button onClick={() => setOpenTicket(openTicket === tk.id ? null : tk.id)} className="text-left flex-1 min-w-0">
                      <div className="font-semibold truncate" style={{ color: "oklch(19% 0.08 252)" }}>{tk.subject}</div>
                      <div className="text-xs" style={{ color: "oklch(45% 0.02 240)" }}>{tk.userName ?? "—"} · {tk.userEmail ?? ""} · {new Date(tk.updatedAt).toLocaleDateString("fr-FR")}</div>
                    </button>
                    <select value={tk.status} onChange={(e) => setTicketStatus.mutate({ ticketId: tk.id, status: e.target.value as any })} className="h-8 rounded-md border px-2 text-xs shrink-0" style={{ borderColor: "oklch(88% 0.015 88)" }}>
                      <option value="OPEN">{t("adminDashboard.ticketStatusOpen")}</option><option value="PENDING">{t("adminDashboard.ticketStatusPending")}</option><option value="CLOSED">{t("adminDashboard.ticketStatusClosed")}</option>
                    </select>
                  </div>
                  {openTicket === tk.id && <div className="px-4 pb-4"><TicketThread ticketId={tk.id} meId={user?.id} /></div>}
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Emails — composer + SMTP configuration */}
          <TabsContent value="emails">
            <h2 className="font-semibold mb-4" style={{ color: "oklch(19% 0.08 252)" }}>{t("adminDashboard.emailsTitle")}</h2>

            {/* Sub-tabs: Composer/Config vs Réception */}
            <div className="flex gap-2 mb-4">
              {[["compose", t("adminDashboard.emailTabCompose")], ["inbox", t("adminDashboard.emailTabInbox")]].map(([k, l]) => (
                <button key={k} onClick={() => setEmailSubTab(k as any)}
                  className="text-sm px-3 py-1.5 rounded-lg font-medium transition-colors"
                  style={emailSubTab === k ? { background: "oklch(19% 0.08 252)", color: "white" } : { background: "oklch(93% 0.015 88)", color: "oklch(45% 0.02 240)" }}>{l}</button>
              ))}
            </div>

            {emailSubTab === "inbox" ? (
              <AdminInbox configured={!!(settings as any)?.imap?.configured} />
            ) : (<>

            {/* Composer */}
            <div className="rounded-xl p-5 mb-5 max-w-2xl" style={{ background: "oklch(100% 0 0)", border: "1px solid oklch(88% 0.015 88)" }}>
              <div className="flex items-center gap-2 mb-3"><Send className="w-4 h-4" style={{ color: "oklch(68% 0.1 78)" }} /><h3 className="font-semibold text-sm" style={{ color: "oklch(19% 0.08 252)" }}>{t("adminDashboard.emailComposeTitle")}</h3></div>
              {!settings?.smtp?.configured && <p className="text-xs mb-3" style={{ color: "oklch(55% 0.22 27)" }}>{t("adminDashboard.emailNotConfiguredWarn")}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                <select value={mail.mode} onChange={(e) => setMail((m) => ({ ...m, mode: e.target.value as any }))} className="h-9 rounded-md border px-2 text-sm" style={{ borderColor: "oklch(88% 0.015 88)" }}>
                  <option value="all">{t("adminDashboard.mailToAll")}</option>
                  <option value="company">{t("adminDashboard.mailToCompany")}</option>
                  <option value="user">{t("adminDashboard.mailToUser")}</option>
                </select>
                {mail.mode === "company" && (
                  <select value={mail.orgId} onChange={(e) => setMail((m) => ({ ...m, orgId: e.target.value }))} className="h-9 rounded-md border px-2 text-sm sm:col-span-2" style={{ borderColor: "oklch(88% 0.015 88)" }}>
                    <option value="">{t("adminDashboard.mailPickOrg")}</option>
                    {(organizations as any[]).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                )}
                {mail.mode === "user" && (
                  <select value={mail.userId} onChange={(e) => setMail((m) => ({ ...m, userId: e.target.value }))} className="h-9 rounded-md border px-2 text-sm sm:col-span-2" style={{ borderColor: "oklch(88% 0.015 88)" }}>
                    <option value="">{t("adminDashboard.mailPickUser")}</option>
                    {(users as any[]).map((u) => <option key={u.id} value={u.id}>{(u.name ?? u.email)}{u.email ? ` · ${u.email}` : ""}</option>)}
                  </select>
                )}
              </div>
              <Input value={mail.subject} onChange={(e) => setMail((m) => ({ ...m, subject: e.target.value }))} placeholder={t("adminDashboard.mailSubject")} className="mb-2" />
              <textarea value={mail.body} onChange={(e) => setMail((m) => ({ ...m, body: e.target.value }))} placeholder={t("adminDashboard.mailBody")} rows={5} className="w-full rounded-md border px-3 py-2 text-sm mb-2" style={{ borderColor: "oklch(88% 0.015 88)" }} />
              <Button disabled={!mail.subject.trim() || sendMail.isPending} onClick={submitMail} style={{ background: "oklch(19% 0.08 252)", color: "white" }}><Send className="w-4 h-4 mr-1" /> {t("adminDashboard.mailSendButton")}</Button>
              <p className="text-[11px] mt-2" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.mailAlsoInAppNote")}</p>
            </div>

            {/* SMTP configuration */}
            <div className="rounded-xl p-5 max-w-2xl" style={{ background: "oklch(100% 0 0)", border: "1px solid oklch(88% 0.015 88)" }}>
              <div className="flex items-center gap-2 mb-1"><Mail className="w-4 h-4" style={{ color: "oklch(68% 0.1 78)" }} /><h3 className="font-semibold text-sm" style={{ color: "oklch(19% 0.08 252)" }}>{t("adminDashboard.smtpTitle")}</h3></div>
              <p className="text-xs mb-3" style={{ color: "oklch(45% 0.02 240)" }}>
                {t("adminDashboard.smtpDescription")}{" "}
                {settings?.smtp?.configured
                  ? <span style={{ color: "oklch(55% 0.18 145)" }}>{t("adminDashboard.smtpConfigured")}</span>
                  : <span style={{ color: "oklch(55% 0.22 27)" }}>{t("adminDashboard.smtpNotConfigured")}</span>}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="sm:col-span-2"><label className="text-[11px]" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.smtpHost")}</label><Input value={smtp.host} onChange={(e) => setSmtp((s) => ({ ...s, host: e.target.value }))} placeholder="smtp.r-aero-academy.com" /></div>
                <div><label className="text-[11px]" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.smtpPort")}</label><Input value={smtp.port} onChange={(e) => setSmtp((s) => ({ ...s, port: e.target.value }))} placeholder="587" /></div>
                <div><label className="text-[11px]" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.smtpUser")}</label><Input value={smtp.user} onChange={(e) => setSmtp((s) => ({ ...s, user: e.target.value }))} placeholder="contact@r-aero-academy.com" /></div>
                <div className="sm:col-span-2"><label className="text-[11px]" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.smtpPassword")}</label><Input type="password" value={smtp.password} onChange={(e) => setSmtp((s) => ({ ...s, password: e.target.value }))} placeholder={settings?.smtp?.passwordSet ? "••••••••" : ""} className="font-mono" /></div>
                <div><label className="text-[11px]" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.smtpFrom")}</label><Input value={smtp.from} onChange={(e) => setSmtp((s) => ({ ...s, from: e.target.value }))} placeholder="R-AERO Academy <contact@r-aero-academy.com>" /></div>
                <div><label className="text-[11px]" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.smtpNotifyEmail")}</label><Input value={smtp.notifyEmail} onChange={(e) => setSmtp((s) => ({ ...s, notifyEmail: e.target.value }))} placeholder="contact@r-aero-academy.com" /></div>
                <div><label className="text-[11px]" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.imapHost")}</label><Input value={smtp.imapHost} onChange={(e) => setSmtp((s) => ({ ...s, imapHost: e.target.value }))} placeholder="imap.hostinger.com" /></div>
                <div><label className="text-[11px]" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.imapPort")}</label><Input value={smtp.imapPort} onChange={(e) => setSmtp((s) => ({ ...s, imapPort: e.target.value }))} placeholder="993" /></div>
              </div>
              <p className="text-[11px] mt-2" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.imapNote")}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button disabled={saveSmtp.isPending} onClick={() => saveSmtp.mutate(smtp)} style={{ background: "oklch(19% 0.08 252)", color: "white" }}>{t("adminDashboard.btnSaveSetting")}</Button>
              </div>
              <p className="text-[11px] mt-2" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.smtpStorageNote")}</p>
              <div className="mt-4 pt-4 flex flex-wrap gap-2 items-end" style={{ borderTop: "1px solid oklch(88% 0.015 88)" }}>
                <div className="flex-1 min-w-[200px]"><label className="text-[11px]" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.smtpTestLabel")}</label><Input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="vous@example.com" /></div>
                <Button variant="outline" disabled={!testTo.trim() || sendTest.isPending} onClick={() => sendTest.mutate({ to: testTo })}>{t("adminDashboard.smtpTestButton")}</Button>
              </div>
            </div>
            </>)}
          </TabsContent>

          {/* Stripe — payment keys */}
          <TabsContent value="stripe">
            <h2 className="font-semibold mb-4" style={{ color: "oklch(19% 0.08 252)" }}>{t("adminDashboard.stripeTitle")}</h2>
            <div className="rounded-xl p-5 max-w-2xl" style={{ background: "oklch(100% 0 0)", border: "1px solid oklch(88% 0.015 88)" }}>
              <div className="flex items-center gap-2 mb-1"><CreditCard className="w-4 h-4" style={{ color: "oklch(68% 0.1 78)" }} /><h3 className="font-semibold text-sm" style={{ color: "oklch(19% 0.08 252)" }}>{t("adminDashboard.stripeKeysTitle")}</h3></div>
              <p className="text-xs mb-3" style={{ color: "oklch(45% 0.02 240)" }}>
                {t("adminDashboard.stripeDescription")}{" "}
                {settings?.stripe?.configured
                  ? <span style={{ color: "oklch(55% 0.18 145)" }}>{t("adminDashboard.stripeConfigured")}</span>
                  : <span style={{ color: "oklch(55% 0.22 27)" }}>{t("adminDashboard.stripeNotConfigured")}</span>}
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px]" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.stripePublishable")}</label>
                  <Input value={stripe.publishableKey} onChange={(e) => setStripe((s) => ({ ...s, publishableKey: e.target.value }))} placeholder="pk_live_… / pk_test_…" className="font-mono" />
                </div>
                <div>
                  <label className="text-[11px]" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.stripeSecret")}</label>
                  <Input type="password" value={stripe.secretKey} onChange={(e) => setStripe((s) => ({ ...s, secretKey: e.target.value }))} placeholder={settings?.stripe?.secretSet ? "••••••••" : "sk_live_… / sk_test_…"} className="font-mono" />
                </div>
                <div>
                  <label className="text-[11px]" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.stripeWebhook")} {(settings as any)?.stripe?.webhookSet ? <span style={{ color: "oklch(55% 0.18 145)" }}>✓</span> : null}</label>
                  <Input type="password" value={stripe.webhookSecret} onChange={(e) => setStripe((s) => ({ ...s, webhookSecret: e.target.value }))} placeholder={(settings as any)?.stripe?.webhookSet ? "••••••••" : "whsec_…"} className="font-mono" />
                  <p className="text-[11px] mt-1" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.stripeWebhookHint")}</p>
                </div>
                <Button disabled={saveStripe.isPending} onClick={() => saveStripe.mutate(stripe)} style={{ background: "oklch(19% 0.08 252)", color: "white" }}>{t("adminDashboard.btnSaveSetting")}</Button>
                <p className="text-[11px]" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.stripeStorageNote")}</p>
              </div>
            </div>
          </TabsContent>

          {/* Settings — AI API keys */}
          <TabsContent value="settings">
            <h2 className="font-semibold mb-4" style={{ color: "oklch(19% 0.08 252)" }}>{t("adminDashboard.settingsTitle")}</h2>
            <div className="rounded-xl p-5 max-w-2xl" style={{ background: "oklch(100% 0 0)", border: "1px solid oklch(88% 0.015 88)" }}>
              <h3 className="font-semibold text-sm mb-1" style={{ color: "oklch(19% 0.08 252)" }}>{t("adminDashboard.mistralKeyTitle")}</h3>
              <p className="text-xs mb-3" style={{ color: "oklch(45% 0.02 240)" }}>
                {t("adminDashboard.mistralKeyDescription")}{" "}
                {settings?.mistral?.configured
                  ? <span style={{ color: "oklch(55% 0.18 145)" }}>{t("adminDashboard.mistralConfigured", { masked: settings.mistral.masked ?? "" })}</span>
                  : <span style={{ color: "oklch(55% 0.22 27)" }}>{t("adminDashboard.mistralNotConfigured")}</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                <Input type="password" value={mistralKey} onChange={(e) => setMistralKey(e.target.value)} placeholder={t("adminDashboard.placeholderMistralKey")} className="flex-1 min-w-[240px] font-mono" />
                <Button disabled={!mistralKey.trim() || saveMistral.isPending} onClick={() => saveMistral.mutate({ key: mistralKey })} style={{ background: "oklch(19% 0.08 252)", color: "white" }}>{t("adminDashboard.btnSaveSetting")}</Button>
                {settings?.mistral?.configured && (
                  <Button variant="outline" disabled={saveMistral.isPending} onClick={() => { if (window.confirm(t("adminDashboard.confirmEraseMistral"))) saveMistral.mutate({ key: "" }); }}>{t("adminDashboard.btnErase")}</Button>
                )}
              </div>
              <p className="text-[11px] mt-2" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.mistralStorageNote")}</p>
              <p className="text-[11px] mt-1" style={{ color: "oklch(45% 0.02 240)" }}>{t("adminDashboard.mistralMediaNote")}</p>
            </div>
          </TabsContent>
            </div>
          </div>
        </Tabs>
        {userDialog && <UserFormDialog mode={userDialog.mode} user={userDialog.mode === "edit" ? userDialog.user : undefined} defaultRole={userDialog.mode === "new" ? userDialog.defaultRole : undefined} onClose={() => setUserDialog(null)} onSaved={() => { setUserDialog(null); utils.admin.users.invalidate(); }} />}
        {orgDialog && <OrgFormDialog mode={orgDialog.mode} org={orgDialog.mode === "edit" ? orgDialog.org : undefined} onClose={() => setOrgDialog(null)} onSaved={() => { setOrgDialog(null); utils.admin.organizations.list.invalidate(); }} />}
        <OrgManagersDialog org={mgrOrg} onClose={() => setMgrOrg(null)} />
      </div>
    </div>
  );
}
