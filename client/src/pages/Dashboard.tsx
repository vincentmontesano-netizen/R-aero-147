import { LanguageSwitcher } from "@/components/PublicNav";
import {certificateStatus} from '@shared/certificateStatus';
import {certificateReportLabels} from '@shared/certificateReport';
import InvoiceRequestDialog from "@/components/InvoiceRequestDialog";
import InstructorAgenda from "@/components/InstructorAgenda";
import RefundHistory from "@/components/RefundHistory";
import { useState, useMemo, useEffect } from "react";
import { Link, Redirect } from "wouter";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { PDFPreviewModal, usePDFPreview } from "@/components/PDFPreviewModal";
import BackButton from "@/components/BackButton";
import NotificationBell from "@/components/NotificationBell";
import CartButton from "@/components/CartButton";
import DashboardSidebar from "@/components/DashboardSidebar";
import Passport from "@/components/Passport";
import UserMenu from "@/components/UserMenu";
import {
  BookOpen, Award, Clock, CheckCircle, PlayCircle, AlertCircle,
  Download, Eye, LogIn, GraduationCap, ShoppingCart,
  FileText, ArrowRight, Search, Filter, X, SortAsc, SortDesc,
  Calendar, Building2, IdCard
} from "lucide-react";
import { toast } from "sonner";
import { useUrlTab } from "@/hooks/useUrlTab";

// ─── Types ────────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { labelKey: string; color: string; icon: typeof CheckCircle }> = {
  not_started: { labelKey: "dashboard.statusNotStarted", color: "var(--muted-foreground)", icon: Clock },
  in_progress: { labelKey: "dashboard.statusInProgress", color: "var(--info)", icon: PlayCircle },
  completed: { labelKey: "dashboard.statusCompleted", color: "var(--success)", icon: CheckCircle },
  expired: { labelKey: "dashboard.statusExpired", color: "var(--destructive)", icon: AlertCircle },
  failed: { labelKey: "dashboard.statusFailed", color: "var(--destructive)", icon: AlertCircle },
};

type SortDir = "asc" | "desc";

// ─── Filter Bar Component ─────────────────────────────────────────────────────
function FilterBar({
  search, onSearch,
  dateFrom, onDateFrom,
  dateTo, onDateTo,
  statusFilter, onStatusFilter,
  statusOptions,
  sortDir, onSortDir,
  resultCount, totalCount,
  onReset,
}: {
  search: string; onSearch: (v: string) => void;
  dateFrom: string; onDateFrom: (v: string) => void;
  dateTo: string; onDateTo: (v: string) => void;
  statusFilter: string; onStatusFilter: (v: string) => void;
  statusOptions?: { value: string; label: string }[];
  sortDir: SortDir; onSortDir: (v: SortDir) => void;
  resultCount: number; totalCount: number;
  onReset: () => void;
}) {
  const { t } = useI18n();
  const hasFilters = search || dateFrom || dateTo || statusFilter;

  return (
    <div className="rounded-xl p-4 mb-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex flex-wrap gap-3 items-end">
        {/* Search */}
        <div className="flex-1 min-w-48">
          <label className="text-sm font-semibold mb-1.5 block" style={{ color: "var(--muted-foreground)" }}>
            {t("dashboard.filterSearchLabel")}
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} />
            <Input
              placeholder={t("dashboard.filterSearchPlaceholder")}
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
            {search && (
              <button onClick={() => onSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} />
              </button>
            )}
          </div>
        </div>

        {/* Date from */}
        <div className="min-w-36">
          <label className="text-sm font-semibold mb-1.5 block" style={{ color: "var(--muted-foreground)" }}>
            {t("dashboard.filterDateFrom")}
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: "var(--muted-foreground)" }} />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFrom(e.target.value)}
              className="w-full h-9 rounded-md border pl-8 pr-3 text-sm"
              style={{ borderColor: "var(--border)", color: "var(--foreground)", background: "var(--card)" }}
            />
          </div>
        </div>

        {/* Date to */}
        <div className="min-w-36">
          <label className="text-sm font-semibold mb-1.5 block" style={{ color: "var(--muted-foreground)" }}>
            {t("dashboard.filterDateTo")}
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: "var(--muted-foreground)" }} />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => onDateTo(e.target.value)}
              className="w-full h-9 rounded-md border pl-8 pr-3 text-sm"
              style={{ borderColor: "var(--border)", color: "var(--foreground)", background: "var(--card)" }}
            />
          </div>
        </div>

        {/* Status filter */}
        {statusOptions && statusOptions.length > 0 && (
          <div className="min-w-36">
            <label className="text-sm font-semibold mb-1.5 block" style={{ color: "var(--muted-foreground)" }}>
              {t("dashboard.filterStatusLabel")}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilter(e.target.value)}
              className="w-full h-9 rounded-md border px-3 text-sm"
              style={{ borderColor: "var(--border)", color: "var(--foreground)", background: "var(--card)" }}
            >
              <option value="">{t("dashboard.filterStatusAll")}</option>
              {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}

        {/* Sort direction */}
        <div>
          <label className="text-sm font-semibold mb-1.5 block" style={{ color: "var(--muted-foreground)" }}>
            {t("dashboard.filterSortLabel")}
          </label>
          <button
            onClick={() => onSortDir(sortDir === "desc" ? "asc" : "desc")}
            className="h-9 px-3 rounded-md border flex items-center gap-1.5 text-sm transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--muted-foreground)", background: "var(--card)" }}
          >
            {sortDir === "desc" ? <SortDesc className="w-3.5 h-3.5" /> : <SortAsc className="w-3.5 h-3.5" />}
            {sortDir === "desc" ? t("dashboard.sortNewest") : t("dashboard.sortOldest")}
          </button>
        </div>

        {/* Reset */}
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={onReset} className="h-9 self-end">
            <X className="w-3.5 h-3.5 mr-1" /> {t("dashboard.filterReset")}
          </Button>
        )}
      </div>

      {/* Results count */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          {resultCount === totalCount
            ? (totalCount > 1
                ? t("dashboard.resultCountPlural", { count: totalCount })
                : t("dashboard.resultCountSingular", { count: totalCount }))
            : (resultCount > 1
                ? t("dashboard.resultCountOfPlural", { count: resultCount, total: totalCount })
                : t("dashboard.resultCountOfSingular", { count: resultCount, total: totalCount }))}
        </span>
        {hasFilters && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "color-mix(in srgb, var(--link) 10%, transparent)", color: "var(--link)" }}>
            <Filter className="w-2.5 h-2.5 inline mr-1" />{t("dashboard.filtersActive")}
          </span>
        )}
      </div>
    </div>
  );
}

function DashboardLoadError({retry,busy}:{retry:()=>void;busy:boolean}) {
  const {t}=useI18n();
  return <div className="rounded-xl border bg-card p-6 space-y-3">
    <p role="alert">{t('dashboard.loadError')}</p>
    <Button variant="outline" disabled={busy} onClick={retry}>{t(busy?'common.loading':'learningPlayer.save.retry')}</Button>
  </div>;
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { t, lang } = useI18n();
  const { user, isAuthenticated, loading } = useAuth();
  const enrollmentQuery = trpc.dashboard.enrollments.useQuery(undefined, { enabled: isAuthenticated });
  const { data: enrollments = [], isLoading: loadingEnrollments } = enrollmentQuery;
  const certificateQuery = trpc.dashboard.certificates.useQuery(undefined, { enabled: isAuthenticated });
  const { data: certificates = [], isLoading: loadingCerts } = certificateQuery;
  const orderQuery = trpc.dashboard.orders.useQuery(undefined, { enabled: isAuthenticated });
  const { data: userOrders = [] } = orderQuery;
  const organizationQuery = trpc.me.organizations.useQuery(undefined, { enabled: isAuthenticated });
  const { data: myOrgs = [] } = organizationQuery;
  const { state: pdfState, openPreview, closePreview } = usePDFPreview();
  const utils = trpc.useUtils();

  // ── Confirm payment on return from Stripe (works even without a webhook) ──
  const resumePayment = trpc.checkout.resume.useMutation({
    onSuccess: data => { window.location.href = data.url; },
    onError: error => { toast.error(error.message); utils.dashboard.orders.invalidate(); },
  });
  const confirmPayment = trpc.checkout.confirm.useMutation({
    onSuccess: (r) => {
      if (r?.status === "paid") {
        toast.success(t("dashboard.toastPaymentConfirmed"));
        utils.dashboard.enrollments.invalidate();
        utils.dashboard.orders.invalidate();
        utils.cart.count.invalidate();
        utils.cart.list.invalidate();
      } else if (r?.status === "pending") {
        toast.info(t("dashboard.toastPaymentPending"));
      }
    },
    // The Stripe webhook still activates access; say so instead of staying silent after payment.
    onError: () => { toast.info(t("dashboard.toastPaymentPending")); void utils.dashboard.orders.invalidate(); },
  });
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      const orderId = Number(params.get("order"));
      if (orderId) confirmPayment.mutate({ orderId });
      // Clean the URL so a refresh doesn't re-trigger.
      window.history.replaceState({}, "", "/dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Filters state — Formations ──
  const [tab, setTab] = useUrlTab("formations");
  const [formSearch, setFormSearch] = useState("");
  const [formDateFrom, setFormDateFrom] = useState("");
  const [formDateTo, setFormDateTo] = useState("");
  const [formStatus, setFormStatus] = useState("");
  const [formSort, setFormSort] = useState<SortDir>("desc");

  // ── Filters state — Certificats ──
  const [certSearch, setCertSearch] = useState("");
  const [certDateFrom, setCertDateFrom] = useState("");
  const [certDateTo, setCertDateTo] = useState("");
  const [certSort, setCertSort] = useState<SortDir>("desc");

  // ── Filters state — Commandes ──
  const [orderSearch, setOrderSearch] = useState("");
  const [orderDateFrom, setOrderDateFrom] = useState("");
  const [orderDateTo, setOrderDateTo] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [orderSort, setOrderSort] = useState<SortDir>("desc");

  const [invoiceOrderId,setInvoiceOrderId]=useState<number|null>(null);

  // ── Filtered & sorted formations ──
  const filteredEnrollments = useMemo(() => {
    let list = [...enrollments];
    if (formSearch) {
      const s = formSearch.toLowerCase();
      list = list.filter((e) => (e.training?.title ?? "").toLowerCase().includes(s));
    }
    if (formStatus) list = list.filter((e) => e.status === formStatus);
    if (formDateFrom) list = list.filter((e) => new Date(e.createdAt) >= new Date(formDateFrom));
    if (formDateTo) list = list.filter((e) => new Date(e.createdAt) <= new Date(formDateTo + "T23:59:59"));
    list.sort((a, b) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return formSort === "desc" ? db - da : da - db;
    });
    return list;
  }, [enrollments, formSearch, formStatus, formDateFrom, formDateTo, formSort]);

  // ── Filtered & sorted certificats ──
  const filteredCertificates = useMemo(() => {
    let list = [...certificates];
    if (certSearch) {
      const s = certSearch.toLowerCase();
      list = list.filter((c) =>
        (c.training?.title ?? "").toLowerCase().includes(s) ||
        c.certificateNumber.toLowerCase().includes(s)
      );
    }
    if (certDateFrom) list = list.filter((c) => new Date(c.issuedAt) >= new Date(certDateFrom));
    if (certDateTo) list = list.filter((c) => new Date(c.issuedAt) <= new Date(certDateTo + "T23:59:59"));
    list.sort((a, b) => {
      const da = new Date(a.issuedAt).getTime();
      const db = new Date(b.issuedAt).getTime();
      return certSort === "desc" ? db - da : da - db;
    });
    return list;
  }, [certificates, certSearch, certDateFrom, certDateTo, certSort]);

  // ── Filtered & sorted commandes ──
  const filteredOrders = useMemo(() => {
    let list = [...(userOrders as any[])];
    if (orderSearch) {
      const s = orderSearch.toLowerCase();
      list = list.filter((o) =>
        (o.invoiceNumber ?? "").toLowerCase().includes(s) ||
        String(o.id).includes(s)
      );
    }
    if (orderStatus) list = list.filter((o) => o.status === orderStatus);
    if (orderDateFrom) list = list.filter((o) => new Date(o.createdAt) >= new Date(orderDateFrom));
    if (orderDateTo) list = list.filter((o) => new Date(o.createdAt) <= new Date(orderDateTo + "T23:59:59"));
    list.sort((a, b) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return orderSort === "desc" ? db - da : da - db;
    });
    return list;
  }, [userOrders, orderSearch, orderStatus, orderDateFrom, orderDateTo, orderSort]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--link)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  // Admins belong on the admin back-office, never the learner dashboard.
  if (user && (user as any).role === "admin") return <Redirect to="/admin" />;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "color-mix(in srgb, var(--link) 10%, transparent)" }}>
            <LogIn className="w-8 h-8" style={{ color: "var(--link)" }} />
          </div>
          <h2 className="font-sans text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>{t("dashboard.loginRequiredTitle")}</h2>
          <p className="text-sm mb-6" style={{ color: "var(--muted-foreground)" }}>{t("dashboard.loginRequiredText")}</p>
          <a href={getLoginUrl()}>
            <Button size="lg" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>{t("dashboard.loginButton")}</Button>
          </a>
        </div>
      </div>
    );
  }

  const completedCount = enrollments.filter((e) => e.status === "completed").length;
  const inProgressCount = enrollments.filter((e) => e.status === "in_progress").length;

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* PDF Preview Modal */}
      {invoiceOrderId!=null&&<InvoiceRequestDialog orderId={invoiceOrderId} initialName={user?.name??""} onClose={()=>setInvoiceOrderId(null)} onGenerated={url=>{setInvoiceOrderId(null);openPreview({pdfUrl:url,title:t("dashboard.invoiceModalTitle"),downloadFilename:"facture.pdf"});}}/>}
      <PDFPreviewModal
        open={pdfState.open}
        onClose={closePreview}
        pdfUrl={pdfState.pdfUrl}
        title={pdfState.title}
        subtitle={pdfState.subtitle}
        onGenerate={pdfState.onGenerate}
        downloadFilename={pdfState.downloadFilename}
      />

      {/* Header */}
      <div style={{ background: "var(--surface-strong)" }}>
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <BackButton dark />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-1 basis-64 items-center gap-4">
              <div className="w-14 h-14 shrink-0 rounded-full flex items-center justify-center text-xl font-bold" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                {user?.name?.[0]?.toUpperCase() ?? "U"}
              </div>
              <div className="min-w-0 break-words">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-sans text-2xl font-bold text-white">{t("dashboard.greeting", { name: user?.name ?? t("dashboard.defaultLearnerName") })}</h1>
                  {myOrgs.map((o: any) => (
                    <span key={o.orgId} className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: "color-mix(in srgb, var(--link) 18%, transparent)", color: "var(--link)" }}
                      title={o.role === "MANAGER" ? t("org.roleManager") : t("org.roleMember")}>
                      <Building2 className="w-3 h-3" /> {o.name}
                    </span>
                  ))}
                </div>
                <p className="text-muted-foreground text-sm">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CartButton dark />
              <NotificationBell dark />
              <LanguageSwitcher />
              <UserMenu />
            </div>
          </div>

          {organizationQuery.isError && <DashboardLoadError busy={organizationQuery.isFetching} retry={() => { void organizationQuery.refetch(); }} />}
          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 mt-8">
            {[
              { value: enrollmentQuery.isError || !enrollmentQuery.data ? '—' : enrollments.length, label: t("dashboard.statEnrolledCourses"), icon: BookOpen },
              { value: enrollmentQuery.isError || !enrollmentQuery.data ? '—' : inProgressCount, label: t("dashboard.statInProgress"), icon: PlayCircle },
              { value: certificateQuery.isError || !certificateQuery.data ? '—' : certificates.length, label: t("dashboard.statCertificatesEarned"), icon: Award },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl p-4" style={{ background: "color-mix(in srgb, var(--foreground) 7%, transparent)", border: "1px solid color-mix(in srgb, var(--foreground) 10%, transparent)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <stat.icon className="w-4 h-4" style={{ color: "var(--link)" }} />
                  <span className="font-sans text-2xl font-bold" style={{ color: "var(--link)" }}>{stat.value}</span>
                </div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex flex-col md:flex-row gap-4 md:gap-6 md:items-start">
            <DashboardSidebar active={tab} onSelect={setTab} heading={t("dashboard.sidebarHeading")} items={[
              ...(user?.role === "instructor" ? [{key:"teaching",label:lang === "fr" ? "Mes classes à animer" : lang === "ar" ? "الفصول الموكلة إليّ" : "My teaching classes",icon:Calendar}] : []),
              { key: "id", label: t("dashboard.navPassport"), icon: IdCard },
              { key: "formations", label: t("dashboard.navMyCourses"), icon: BookOpen, badge: enrollments.length },
              { key: "certificates", label: t("dashboard.navMyCertificates"), icon: Award, badge: certificates.length },
              { key: "orders", label: t("dashboard.navMyOrders"), icon: ShoppingCart, badge: userOrders.length },
            ]} />
            <div className="flex-1 min-w-0">

          {user?.role === "instructor" && <TabsContent value="teaching"><InstructorAgenda /></TabsContent>}
          {/* ── Formations ── */}
          <TabsContent value="formations">
            <FilterBar
              search={formSearch} onSearch={setFormSearch}
              dateFrom={formDateFrom} onDateFrom={setFormDateFrom}
              dateTo={formDateTo} onDateTo={setFormDateTo}
              statusFilter={formStatus} onStatusFilter={setFormStatus}
              statusOptions={[
                { value: "not_started", label: t("dashboard.statusNotStarted") },
                { value: "in_progress", label: t("dashboard.statusInProgress") },
                { value: "completed", label: t("dashboard.statusCompleted") },
                { value: "expired", label: t("dashboard.statusExpired") },
                { value: "failed", label: t("dashboard.statusFailed") },
              ]}
              sortDir={formSort} onSortDir={setFormSort}
              resultCount={filteredEnrollments.length}
              totalCount={enrollments.length}
              onReset={() => { setFormSearch(""); setFormDateFrom(""); setFormDateTo(""); setFormStatus(""); setFormSort("desc"); }}
            />

            {enrollmentQuery.isError ? <DashboardLoadError busy={enrollmentQuery.isFetching} retry={() => { void enrollmentQuery.refetch(); }} /> : loadingEnrollments ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: "var(--border)" }} />
                ))}
              </div>
            ) : enrollments.length === 0 ? (
              <div className="text-center py-16">
                <GraduationCap className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--link)" }} />
                <div className="font-semibold text-lg mb-2" style={{ color: "var(--foreground)" }}>{t("dashboard.noCoursesTitle")}</div>
                <p className="text-sm mb-6" style={{ color: "var(--muted-foreground)" }}>{t("dashboard.noCoursesText")}</p>
                <Link href="/catalogue">
                  <Button style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>{t("dashboard.viewCatalog")}</Button>
                </Link>
              </div>
            ) : filteredEnrollments.length === 0 ? (
              <div className="text-center py-12 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <Search className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--link)" }} />
                <div className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>{t("dashboard.noResultsTitle")}</div>
                <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("dashboard.noResultsCoursesText")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredEnrollments.map((enrollment) => {
                  const statusConf = STATUS_CONFIG[enrollment.status] ?? STATUS_CONFIG.not_started;
                  const StatusIcon = statusConf.icon;
                  return (
                    <div key={enrollment.id} className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>
                              {enrollment.training?.title ?? t("dashboard.courseFallback")}
                            </h3>
                            <span className="flex items-center gap-1 text-xs font-medium" style={{ color: statusConf.color }}>
                              <StatusIcon className="w-3 h-3" />
                              {t(statusConf.labelKey)}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>
                            <span>{t("dashboard.progressLabel", { percent: enrollment.progressPercent ?? 0 })}</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {t("dashboard.enrolledOn", { date: new Date(enrollment.createdAt).toLocaleDateString(lang) })}
                            </span>
                            {enrollment.expiresAt && (
                              <span>{t("dashboard.expiresOn", { date: new Date(enrollment.expiresAt).toLocaleDateString(lang) })}</span>
                            )}
                          </div>
                          <Progress value={enrollment.progressPercent ?? 0} className="h-1.5" />
                        </div>
                        <Link href={`/formation/${enrollment.training?.slug ?? ""}/apprendre?enrollment=${enrollment.id}`}>
                          <Button size="sm" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                            {enrollment.status === "not_started" ? t("dashboard.btnStart") : enrollment.status === "completed" ? t("dashboard.btnReview") : t("dashboard.btnContinue")}
                            <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Certificats ── */}
          <TabsContent value="certificates">
            <FilterBar
              search={certSearch} onSearch={setCertSearch}
              dateFrom={certDateFrom} onDateFrom={setCertDateFrom}
              dateTo={certDateTo} onDateTo={setCertDateTo}
              statusFilter="" onStatusFilter={() => {}}
              sortDir={certSort} onSortDir={setCertSort}
              resultCount={filteredCertificates.length}
              totalCount={certificates.length}
              onReset={() => { setCertSearch(""); setCertDateFrom(""); setCertDateTo(""); setCertSort("desc"); }}
            />

            {certificateQuery.isError ? <DashboardLoadError busy={certificateQuery.isFetching} retry={() => { void certificateQuery.refetch(); }} /> : loadingCerts ? (
              <div className="space-y-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "var(--border)" }} />
                ))}
              </div>
            ) : certificates.length === 0 ? (
              <div className="text-center py-16">
                <Award className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--link)" }} />
                <div className="font-semibold text-lg mb-2" style={{ color: "var(--foreground)" }}>{t("dashboard.noCertificatesTitle")}</div>
                <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("dashboard.noCertificatesText")}</p>
              </div>
            ) : filteredCertificates.length === 0 ? (
              <div className="text-center py-12 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <Search className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--link)" }} />
                <div className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>{t("dashboard.noResultsTitle")}</div>
                <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("dashboard.noResultsCertificatesText")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredCertificates.map((cert) => {
                  const status = certificateStatus(cert);
                  return (
                  <div key={cert.id} className="rounded-xl p-5 flex flex-wrap items-center justify-between gap-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "color-mix(in srgb, var(--link) 10%, transparent)" }}>
                        <Award className="w-5 h-5" style={{ color: "var(--link)" }} />
                      </div>
                      <div>
                        <div className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>
                          {cert.training?.title ?? t("dashboard.courseFallback")}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                          <span className="font-mono">{t("dashboard.certNumber", { number: cert.certificateNumber })}</span>
                          <span className={`rounded px-2 py-1 font-semibold ${status === 'valid' ? "bg-success/10 text-success" : status === 'expired' ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"}`}>{certificateReportLabels[lang][status]}</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {t("dashboard.issuedOn", { date: new Date(cert.issuedAt).toLocaleDateString(lang) })}
                          </span>
                          {cert.expiresAt && (
                            <span style={{ color: new Date(cert.expiresAt) < new Date() ? "var(--destructive)" : "var(--muted-foreground)" }}>
                              {t("dashboard.expiresOn", { date: new Date(cert.expiresAt).toLocaleDateString(lang) })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openPreview({
                          pdfUrl: cert.pdfUrl,
                          title: t("dashboard.certPreviewTitle", { title: cert.training?.title ?? t("dashboard.courseFallback") }),
                          subtitle: t("dashboard.certNumber", { number: cert.certificateNumber }),
                          downloadFilename: `certificat-${cert.certificateNumber}.pdf`,
                        })}
                      >
                        <Eye className="w-3 h-3 mr-1" /> {t("dashboard.btnPreview")}
                      </Button>
                      <Link href={`/verification/${cert.verificationCode}`}>
                        <Button variant="outline" size="sm">{t("dashboard.btnVerify")}</Button>
                      </Link>
                      {cert.pdfUrl && (
                        <a href={cert.pdfUrl} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                            <Download className="w-3 h-3 mr-1" /> PDF
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                ); })}
              </div>
            )}
          </TabsContent>

          {/* ── Commandes ── */}
          <TabsContent value="orders">
            <FilterBar
              search={orderSearch} onSearch={setOrderSearch}
              dateFrom={orderDateFrom} onDateFrom={setOrderDateFrom}
              dateTo={orderDateTo} onDateTo={setOrderDateTo}
              statusFilter={orderStatus} onStatusFilter={setOrderStatus}
              statusOptions={[
                { value: "paid", label: t("dashboard.orderStatusPaid") },
                { value: "pending", label: t("dashboard.orderStatusPending") },
                { value: "failed", label: t("dashboard.orderStatusFailed") },
                { value: "refunded", label: t("dashboard.orderStatusRefunded") },
                { value: "cancelled", label: t("dashboard.orderStatusCancelled") },
              ]}
              sortDir={orderSort} onSortDir={setOrderSort}
              resultCount={filteredOrders.length}
              totalCount={userOrders.length}
              onReset={() => { setOrderSearch(""); setOrderDateFrom(""); setOrderDateTo(""); setOrderStatus(""); setOrderSort("desc"); }}
            />

            {orderQuery.isError ? <DashboardLoadError busy={orderQuery.isFetching} retry={() => { void orderQuery.refetch(); }} /> : orderQuery.isLoading ? <p role="status">{t("common.loading")}</p> : (userOrders as any[]).length === 0 ? (
              <div className="text-center py-16">
                <ShoppingCart className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--link)" }} />
                <div className="font-semibold text-lg mb-2" style={{ color: "var(--foreground)" }}>{t("dashboard.noOrdersTitle")}</div>
                <Link href="/catalogue">
                  <Button style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>{t("dashboard.viewCatalog")}</Button>
                </Link>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <Search className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--link)" }} />
                <div className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>{t("dashboard.noResultsTitle")}</div>
                <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("dashboard.noResultsOrdersText")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order: any) => (
                  <div key={order.id} className="rounded-xl p-5 flex flex-wrap items-center justify-between gap-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    <div>
                      <div className="font-semibold text-sm mb-1" style={{ color: "var(--foreground)" }}>
                        {t("dashboard.orderLabel", { ref: order.invoiceNumber ?? `#${order.id}` })}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(order.createdAt).toLocaleDateString(lang)}
                        </span>
                        <span className="font-medium" style={{ color: "var(--foreground)" }}>
                          {t("dashboard.amountInclTax", { amount: Number(order.totalTtc).toFixed(2) })}
                          {order.refundedAmountCents > 0 && <span className="block text-xs">{t("refund.amount", { amount: (order.refundedAmountCents / 100).toFixed(2) })}</span>}
                        </span>
                      </div>
                      {order.refundedAmountCents > 0 && <RefundHistory orderId={order.id} />}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{
                        color: order.status === "paid" ? "var(--success)" : order.status === "failed" ? "var(--destructive)" : "var(--link)",
                        background: order.status === "paid" ? "color-mix(in srgb, var(--success) 10%, transparent)" : order.status === "failed" ? "color-mix(in srgb, var(--destructive) 10%, transparent)" : "color-mix(in srgb, var(--link) 10%, transparent)",
                      }}>
                        {order.status === "paid" ? t("dashboard.orderStatusPaid") : order.status === "pending" ? t("dashboard.orderStatusPending") : order.status === "failed" ? t("dashboard.orderStatusFailed") : order.status === "refunded" ? t("dashboard.orderStatusRefunded") : order.status}
                      </span>

                      {order.status === "pending" && <Button variant="outline" size="sm" disabled={resumePayment.isPending} onClick={() => resumePayment.mutate({ orderId: order.id })}>{t("checkout.resume")}</Button>}
                      {order.invoiceUrl ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPreview({
                            pdfUrl: order.invoiceUrl,
                            title: t("dashboard.invoiceTitle", { ref: order.invoiceNumber ?? `#${order.id}` }),
                            subtitle: `${t("dashboard.amountInclTax", { amount: Number(order.totalTtc).toFixed(2) })} · ${new Date(order.createdAt).toLocaleDateString(lang)}`,
                            downloadFilename: `facture-${order.invoiceNumber ?? order.id}.pdf`,
                          })}
                        >
                          <Eye className="w-3 h-3 mr-1" /> {t("dashboard.btnPreview")}
                        </Button>
                      ) : order.status === "paid" ? (
                        <Button variant="outline" size="sm" onClick={()=>setInvoiceOrderId(order.id)}><Eye className="w-3 h-3 mr-1" />{t("dashboard.btnViewInvoice")}</Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── ID / Passeport (person-owned uploaded documents + R-AERO aggregate) ── */}
          <TabsContent value="id">
            <Passport />
          </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
