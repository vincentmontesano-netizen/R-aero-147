import {rolePeriodOverlaps} from "../../../shared/rolePeriodOverlaps";
import {ruleMatchesEmployee} from "../../../shared/roleMatching";
import RoleRequirementHistory from "@/components/RoleRequirementHistory";
import {roleRequirementInput} from "../../../shared/roleRequirementInput";
import { employeeCsvHeader, employeeCsvTemplate } from "../../../shared/employeeCsvTemplate";
import {spreadsheetCsv} from "../../../shared/csvExport";
import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import BackButton from "@/components/BackButton";
import TechnicianFileDialog from "@/components/TechnicianFileDialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Building2, Users, BarChart3, AlertCircle, CheckCircle, Clock,
  Plus, Download, LogIn, UserPlus, Upload, FileText, CreditCard, UserCog, IdCard
} from "lucide-react";
import DashboardSidebar from "@/components/DashboardSidebar";
import UserMenu from "@/components/UserMenu";
import CartButton from "@/components/CartButton";
import CompanyMembers from "@/components/CompanyMembers";
import Passport from "@/components/Passport";
import { toast } from "sonner";
import { useI18n } from "@/i18n";

const RECURRENCY_STATUS: Record<string, { color: string; bg: string }> = {
  ok: { color: "oklch(55% 0.18 145)", bg: "oklch(55% 0.18 145 / 0.1)" },
  due_soon: { color: "oklch(68% 0.1 78)", bg: "oklch(68% 0.1 78 / 0.1)" },
  overdue: { color: "oklch(55% 0.22 27)", bg: "oklch(55% 0.22 27 / 0.1)" },
  not_started: { color: "oklch(62% 0.02 240)", bg: "oklch(62% 0.02 240 / 0.1)" },
};

function AddEmployeeDialog({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", jobTitle: "", licenseNumber: "", licenseCategories: "", typeRatings: "", department: "", base: "" });
  const createEmployee = trpc.company.createEmployee.useMutation({
    onSuccess: () => { toast.success(t("companyDashboard.toastEmployeeAdded")); setOpen(false); onSuccess(); },
    onError: () => toast.error(t("companyDashboard.toastEmployeeError")),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" style={{ background: "oklch(68% 0.1 78)", color: "oklch(19% 0.08 252)" }}>
          <UserPlus className="w-4 h-4 mr-1" /> {t("companyDashboard.addEmployee")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t("companyDashboard.addEmployee")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 mt-2">
          {[
            { key: "firstName", label: t("companyDashboard.fieldFirstName"), placeholder: "Jean" },
            { key: "lastName", label: t("companyDashboard.fieldLastName"), placeholder: "Dupont" },
            { key: "email", label: t("companyDashboard.fieldEmail"), placeholder: "jean.dupont@mro.com" },
            { key: "jobTitle", label: t("companyDashboard.fieldJobTitle"), placeholder: "Technicien B1" },
            { key: "licenseNumber", label: t("companyDashboard.fieldLicenseNumber"), placeholder: "FR.66.XXXXXXXX" },
            { key: "licenseCategories", label: t("companyDashboard.fieldCategories"), placeholder: "B1.1, B1.3" },
            { key: "typeRatings", label: t("companyDashboard.fieldTypeRatings"), placeholder: "A320, B737" },
            { key: "department", label: t("companyDashboard.fieldDepartment"), placeholder: "Line Maintenance" },
            { key: "base", label: t("companyDashboard.fieldBase"), placeholder: "CDG" },
          ].map((field) => (
            <div key={field.key}>
              <label className="text-xs font-medium mb-1 block" style={{ color: "oklch(45% 0.02 240)" }}>{field.label}</label>
              <Input placeholder={field.placeholder} value={(form as any)[field.key]} onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))} />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>{t("companyDashboard.cancel")}</Button>
          <Button onClick={() => createEmployee.mutate(form)} disabled={!form.firstName || !form.lastName || !form.email || createEmployee.isPending} style={{ background: "oklch(19% 0.08 252)", color: "oklch(97% 0.01 88)" }}>
            {t("companyDashboard.add")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImportCSVDialog({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [prepared, setPrepared] = useState<{ name: string; csvData: string } | null>(null);
  const [problem, setProblem] = useState<"read" | "send" | "size" | null>(null);
  const importLock = useRef(false);
  const mounted = useRef(true);
  const activeReader = useRef<FileReader | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; activeReader.current?.abort(); };
  }, []);
  const importCSV = trpc.company.importCSV.useMutation();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || importLock.current) return;
    setPrepared(null);
    if (file.size > 1024 * 1024) {
      setResult(null);
      setProblem("size");
      e.target.value = "";
      return;
    }
    importLock.current = true;
    setBusy(true);
    setResult(null);
    setProblem(null);
    try {
      const csvData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        activeReader.current = reader;
        reader.onload = () => typeof reader.result === "string" && reader.result.trim()
          ? resolve(reader.result) : reject(new Error("Empty CSV"));
        reader.onerror = () => reject(new Error("CSV read failed"));
        reader.onabort = () => reject(new Error("CSV read aborted"));
        reader.readAsText(file, "UTF-8");
      });
      if (!mounted.current) return;
      setPrepared({ name: file.name, csvData });
    } catch {
      if (mounted.current) setProblem("read");
    } finally {
      activeReader.current = null;
      importLock.current = false;
      if (mounted.current) {
        setBusy(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    }
  };

  const startImport = async () => {
    if (!prepared || importLock.current) return;
    importLock.current = true;
    setBusy(true);
    setProblem(null);
    setResult(null);
    try {
      const data = await importCSV.mutateAsync({ csvData: prepared.csvData });
      if (!mounted.current) return;
      setResult(data);
      if (data.imported > 0) { toast.success(t("companyDashboard.toastImportSuccess", { count: data.imported })); onSuccess(); }
      if (data.errors.length > 0) toast.error(t("companyDashboard.toastImportErrors", { count: data.errors.length }));
    } catch {
      if (mounted.current) { setProblem("send"); onSuccess(); }
    } finally {
      importLock.current = false;
      if (mounted.current) { setBusy(false); setPrepared(null); }
    }
  };
  const changeOpen = (value: boolean) => {
    if (importLock.current) return;
    setOpen(value);
    if (!value) { setPrepared(null); setResult(null); setProblem(null); }
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="w-4 h-4 mr-1" /> {t("companyDashboard.importCsv")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t("companyDashboard.importCsvTitle")}</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="rounded-lg p-4" style={{ background: "oklch(97% 0.01 88)", border: "1px solid oklch(88% 0.015 88)" }}>
            <div className="text-xs font-semibold mb-2" style={{ color: "oklch(45% 0.02 240)" }}>{t("companyDashboard.csvExpectedFormat")}</div>
            <code dir="ltr" className="text-xs block overflow-x-auto" style={{ color: "oklch(19% 0.08 252)" }}>
              {employeeCsvHeader.join(";")}
            </code>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(employeeCsvTemplate)}`} download="r-aero-salaries-modele.csv">
                <Download className="w-4 h-4 mr-1" /> {t("companyDashboard.csvDownloadTemplate")}
              </a>
            </Button>
            <p id="employee-csv-help" className="text-xs mt-3">{t("companyDashboard.csvHelp")}</p>
          </div>
          <div>
            <label htmlFor="employee-csv-file" className="text-xs font-medium mb-2 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("companyDashboard.csvFile")}</label>
            <input id="employee-csv-file" aria-describedby="employee-csv-help" ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="w-full text-sm" disabled={busy} />
          </div>
          {busy && <div className="text-sm text-center" style={{ color: "oklch(45% 0.02 240)" }}>{t(importCSV.isPending ? "companyDashboard.importing" : "companyDashboard.csvReading")}</div>}
          {prepared && !busy && <p role="status" className="text-sm break-words">{t("companyDashboard.csvPrepared", { name: prepared.name })}</p>}
          {problem && <p role="alert" className="text-sm text-red-700">{t(problem === "size" ? "companyDashboard.csvSizeError" : problem === "read" ? "companyDashboard.csvReadError" : "companyDashboard.csvSendError")}</p>}
          {result && (
            <div className="rounded-lg p-4 space-y-2" style={{ background: result.imported > 0 ? "oklch(55% 0.18 145 / 0.08)" : "oklch(55% 0.22 27 / 0.08)", border: `1px solid ${result.imported > 0 ? "oklch(55% 0.18 145 / 0.3)" : "oklch(55% 0.22 27 / 0.3)"}` }}>
              <div className="text-sm font-medium" style={{ color: "oklch(19% 0.08 252)" }}>
                {t("companyDashboard.importResultSuccess", { count: result.imported })}
              </div>
              {result.errors.map((err, i) => (
                <div key={i} className="text-xs" style={{ color: "oklch(55% 0.22 27)" }}>{err}</div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button disabled={busy} variant="outline" onClick={() => changeOpen(false)} style={{ background: "oklch(19% 0.08 252)", color: "oklch(97% 0.01 88)" }}>{t("companyDashboard.close")}</Button>
          <Button disabled={busy || !prepared} onClick={startImport}>{t("companyDashboard.csvStartImport")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CompanyDashboard() {
  const { t, lang } = useI18n();
  const { user, isAuthenticated, loading } = useAuth();
  const companyQuery = trpc.company.get.useQuery(undefined, { enabled: isAuthenticated });
  const employeesQuery = trpc.company.employees.useQuery(undefined, { enabled: isAuthenticated });
  const recurrenciesQuery = trpc.company.recurrencies.useQuery(undefined, { enabled: isAuthenticated });
  const { data: company } = companyQuery;
  const { data: employees = [], refetch: refetchEmployees } = employeesQuery;
  const { data: recurrencies = [] } = recurrenciesQuery;
  const subscriptionQuery = trpc.company.subscription.useQuery(undefined, { enabled: isAuthenticated });
  const { data: subscription, refetch: refetchSubscription } = subscriptionQuery;
  const [fileEmployee, setFileEmployee] = useState<number | null>(null);
  const [tab, setTab] = useState("employees");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [recurrencyFilter, setRecurrencyFilter] = useState("all");
  const consolidatedQuery = trpc.company.consolidated.useQuery(undefined, { enabled: isAuthenticated });
  const requirementsQuery = trpc.company.roleRequirements.useQuery(undefined, { enabled: isAuthenticated });
  const trainingsQuery = trpc.company.roleRequirementCourses.useQuery(undefined, { enabled: isAuthenticated });
  const { data: consolidated } = consolidatedQuery;
  const { data: roleReqs = [] } = requirementsQuery;
  const { data: allTrainings = [] } = trainingsQuery;
  const [ruleForm, setRuleForm] = useState({ label: "", jobTitleContains: "", licenseCategoryContains: "", trainingId: "", periodMonths: 24 });
  const refetchConf = () => Promise.all([utils.company.consolidated.invalidate(), utils.company.roleRequirements.invalidate(), utils.company.roleRequirementHistory.invalidate(), utils.company.recurrencies.invalidate()]);
  const createRule = trpc.company.createRoleRequirement.useMutation({ onSuccess: () => { toast.success(t("companyDashboard.toastRuleAdded")); setRuleForm({ label: "", jobTitleContains: "", licenseCategoryContains: "", trainingId: "", periodMonths: 24 }); return refetchConf(); }, onError: (e) => toast.error(e.message) });
  const archivingRule = useRef(false);
  const [archivedRuleId,setArchivedRuleId] = useState<number | null>(null);
  const deleteRule = trpc.company.deleteRoleRequirement.useMutation({
    onSuccess: async (_, input) => { setArchivedRuleId(input.id); await refetchConf(); },
    onSettled: () => { archivingRule.current = false; },
  });
  const archiveRule = (rule: {id:number;label:string|null;companyId:number|null;trainingId:number}) => {
    if (archivingRule.current || deleteRule.isPending) return;
    const scope = t(rule.companyId == null ? 'companyDashboard.ruleGlobalScope' : 'companyDashboard.ruleCompanyScope');
    if (!window.confirm(t('companyDashboard.confirmArchiveRule',{id:rule.id,label:rule.label || t('companyDashboard.ruleHistoryTraining',{id:rule.trainingId}),scope}))) return;
    archivingRule.current = true;
    setArchivedRuleId(null);
    deleteRule.mutate({id:rule.id});
  };
  const runTNA = trpc.company.runTNA.useMutation({ onSuccess: (r) => { toast.success(t("companyDashboard.toastTna", { count: r.created })); return refetchConf(); }, onError: (e) => toast.error(e.message) });
  const utils = trpc.useUtils();
  const createSubscription = trpc.company.createSubscription.useMutation({
    onSuccess: (r: any) => { if (r?.url) window.location.href = r.url; },
    onError: (e) => toast.error(e.message),
  });
  const createPortal = trpc.company.createPortalSession.useMutation({
    onSuccess: (r: any) => { if (r?.url) window.location.href = r.url; },
    onError: (e) => toast.error(e.message),
  });
  const confirmSub = trpc.company.confirmSubscription.useMutation({
    onSuccess: result => { refetchSubscription(); utils.company.recurrencies.invalidate(); if (result.status === "requires_review") toast.warning(lang === "fr" ? "Abonnement à vérifier." : lang === "ar" ? "يلزم التحقق من الاشتراك." : "Subscription needs review."); else toast.success(lang === "fr" ? "Statut de facturation actualisé." : lang === "ar" ? "تم تحديث حالة الفوترة." : "Billing status refreshed."); },
    onError: error => toast.error(error.message),
  });

  // On return from Checkout (?subscription=success): confirm and refresh.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("subscription") === "success") {
      confirmSub.mutate();
      window.history.replaceState({}, "", "/entreprise");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(97% 0.01 88)" }}><div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "oklch(68% 0.1 78)", borderTopColor: "transparent" }} /></div>;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(97% 0.01 88)" }}>
        <div className="text-center max-w-sm">
          <LogIn className="w-12 h-12 mx-auto mb-4" style={{ color: "oklch(68% 0.1 78)" }} />
          <h2 className="font-serif text-2xl font-bold mb-2" style={{ color: "oklch(19% 0.08 252)" }}>{t("companyDashboard.loginRequired")}</h2>
          <a href={getLoginUrl()}><Button style={{ background: "oklch(19% 0.08 252)", color: "oklch(97% 0.01 88)" }}>{t("companyDashboard.login")}</Button></a>
        </div>
      </div>
    );
  }

  const coreQueries = [companyQuery, employeesQuery, recurrenciesQuery];
  const coreError = coreQueries.some(query => query.isError);
  const corePending = coreQueries.some(query => query.isPending);
  if (coreError || corePending || !company) {
    return (
      <div className="min-h-screen p-6" style={{ background: "oklch(97% 0.01 88)" }}>
        <BackButton />
        <div className="max-w-lg mx-auto mt-12 rounded-xl border bg-white p-6 space-y-4">
          <h1 className="font-serif text-2xl">{t("companyDashboard.companySpace")}</h1>
          {coreError || !corePending ? (
            <>
              <p role="alert">{t(coreError ? "companyDashboard.dataUnavailable" : "companyDashboard.noCompany")}</p>
              <Button disabled={coreQueries.some(query => query.isFetching)} onClick={() => { void Promise.all(coreQueries.map(query => query.refetch())); }}>
                {t("companyDashboard.retryData")}
              </Button>
            </>
          ) : <p role="status">{t("common.loading")}</p>}
        </div>
      </div>
    );
  }

  const parsedRule = roleRequirementInput.safeParse({ ...ruleForm, trainingId: Number(ruleForm.trainingId) });
  const validRule = parsedRule.success;
  const matchingEmployees = parsedRule.success ? employees.filter(employee => employee.isActive !== false && ruleMatchesEmployee(employee,parsedRule.data)) : [];
  const periodOverlaps = parsedRule.success ? rolePeriodOverlaps(employees,roleReqs,parsedRule.data) : [];
  const analysisQueries = [consolidatedQuery, requirementsQuery, trainingsQuery];
  const analysisPending = analysisQueries.some(query => query.isPending);
  const analysisError = analysisQueries.some(query => query.isError);
  const analysisBusy = analysisQueries.some(query => query.isFetching) || createRule.isPending || deleteRule.isPending || runTNA.isPending;

  const overdueCount = recurrencies.filter((r) => r.status === "overdue").length;
  const dueSoonCount = recurrencies.filter((r) => r.status === "due_soon").length;
  const okCount = recurrencies.filter((r) => r.status === "ok").length;

  const visibleRecurrencies = recurrencies.filter(row => recurrencyFilter === "all" || (row.status ?? "not_started") === recurrencyFilter);
  const searchTerms = employeeSearch.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const visibleEmployees = employees.filter(employee => {
    const text = [employee.firstName, employee.lastName, employee.email, employee.jobTitle,
      employee.licenseNumber, employee.licenseCategories, employee.typeRatings, employee.department, employee.base]
      .filter(Boolean).join(" ").toLocaleLowerCase();
    return searchTerms.every(term => text.includes(term));
  });

  const exportEmployeesCSV = () => {
    const headers = [t("companyDashboard.csvHeaderFirstName"), t("companyDashboard.csvHeaderLastName"), t("companyDashboard.csvHeaderEmail"), t("companyDashboard.csvHeaderJobTitle"), t("companyDashboard.csvHeaderLicenseNumber"), t("companyDashboard.csvHeaderCategories"), t("companyDashboard.csvHeaderTypeRatings"), t("companyDashboard.csvHeaderDepartment"), t("companyDashboard.csvHeaderBase")];
    const rows = employees.map((e) => [e.firstName, e.lastName, e.email, e.jobTitle ?? "", e.licenseNumber ?? "", e.licenseCategories ?? "", (e as any).typeRatings ?? "", e.department ?? "", e.base ?? ""]);
    const csv = spreadsheetCsv([headers,...rows]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "employes_r-aero.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success(t("companyDashboard.toastExportCsv"));
  };

  const exportRecurrenciesCSV = () => {
    const headers = [t("companyDashboard.csvRecHeaderEmployee"), t("companyDashboard.csvRecHeaderTraining"), t("companyDashboard.csvRecHeaderPeriodicityMonths"), t("companyDashboard.csvRecHeaderLastCompletion"), t("companyDashboard.csvRecHeaderNextDue"), t("companyDashboard.csvRecHeaderStatus")];
    const rows = recurrencies.map((r) => [
      `${r.employee?.firstName ?? ""} ${r.employee?.lastName ?? ""}`,
      r.training?.title ?? "",
      String(r.periodMonths),
      r.lastCompletedAt ? new Date(r.lastCompletedAt).toLocaleDateString("fr-FR") : "—",
      r.nextDueAt ? new Date(r.nextDueAt).toLocaleDateString("fr-FR") : "—",
      t(`companyDashboard.status_${r.status ?? "not_started"}`),
    ]);
    const csv = spreadsheetCsv([headers,...rows]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "recurrences_r-aero.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success(t("companyDashboard.toastExportRecurrenciesCsv"));
  };

  return (
    <div className="min-h-screen" style={{ background: "oklch(97% 0.01 88)" }}>
      <div style={{ background: "oklch(19% 0.08 252)" }}>
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <BackButton dark />
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <Building2 className="w-6 h-6" style={{ color: "oklch(68% 0.1 78)" }} />
              <div>
                <h1 className="font-serif text-2xl font-bold text-white">{company?.name ?? t("companyDashboard.companySpace")}</h1>
                <p className="text-white/60 text-sm">{t("companyDashboard.headerSubtitle")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CartButton dark />
              <UserMenu />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { status: null, value: employees.length, label: t("companyDashboard.statEmployees"), icon: Users, color: "oklch(68% 0.1 78)" },
              { status: "ok", value: okCount, label: t("companyDashboard.statTrainingsUpToDate"), icon: CheckCircle, color: "oklch(55% 0.18 145)" },
              { status: "due_soon", value: dueSoonCount, label: t("companyDashboard.statDueSoon"), icon: Clock, color: "oklch(68% 0.1 78)" },
              { status: "overdue", value: overdueCount, label: t("companyDashboard.statOverdue"), icon: AlertCircle, color: "oklch(55% 0.22 27)" },
            ].map((stat) => (
              <button key={stat.label} type="button" className="rounded-xl p-4 text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" onClick={() => {
                if (stat.status) { setRecurrencyFilter(stat.status); setTab("recurrencies"); }
                else { setEmployeeSearch(""); setTab("employees"); }
              }} style={{ background: "oklch(97% 0.01 88 / 0.07)", border: "1px solid oklch(97% 0.01 88 / 0.1)" }}>
                <span className="flex items-center gap-2 mb-1">
                  <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                  <span className="font-serif text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</span>
                </span>
                <span className="block text-xs text-white/50">{stat.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex flex-col md:flex-row gap-4 md:gap-6 md:items-start">
            <DashboardSidebar active={tab} onSelect={setTab} heading={t("companyDashboard.sidebarHeading")} items={[
              { key: "id", label: t("dashboard.navPassport"), icon: IdCard },
              { key: "employees", label: t("companyDashboard.navEmployees"), icon: Users, badge: employees.length },
              { key: "recurrencies", label: t("companyDashboard.navRecurrencies"), icon: Clock, badge: recurrencies.length },
              { key: "company", label: t("companyDashboard.navProfile"), icon: Building2 },
              { key: "members", label: t("companyDashboard.navMembers"), icon: UserCog },
              { key: "subscription", label: t("companyDashboard.navSubscription"), icon: CreditCard },
              { key: "conformite", label: t("companyDashboard.navCompliance"), icon: BarChart3 },
            ]} />
            <div className="flex-1 min-w-0">

          <TabsContent value="employees">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="font-semibold" style={{ color: "oklch(19% 0.08 252)" }}>{t("companyDashboard.employeesListTitle")}</h2>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={exportEmployeesCSV}>
                  <Download className="w-4 h-4 mr-1" /> {t("companyDashboard.exportFullRoster")}
                </Button>
                <ImportCSVDialog onSuccess={() => refetchEmployees()} />
                <AddEmployeeDialog onSuccess={() => refetchEmployees()} />
              </div>
            </div>

            <div className="mb-4 space-y-2">
              <label htmlFor="employee-search" className="text-sm font-medium">{t("companyDashboard.searchEmployees")}</label>
              <div className="flex gap-2">
                <Input id="employee-search" type="search" value={employeeSearch} onChange={event=>setEmployeeSearch(event.target.value)} aria-describedby="employee-search-hint" />
                {employeeSearch && <Button variant="outline" onClick={()=>setEmployeeSearch("")}>{t("companyDashboard.clearEmployeeSearch")}</Button>}
              </div>
              <p id="employee-search-hint" className="text-xs">{t("companyDashboard.employeeSearchHint")}</p>
              <p role="status" className="text-sm">{t("companyDashboard.employeeSearchCount",{count:visibleEmployees.length,total:employees.length})}</p>
            </div>

            {employees.length === 0 ? (
              <div className="text-center py-16 rounded-xl" style={{ background: "oklch(100% 0 0)", border: "1px solid oklch(88% 0.015 88)" }}>
                <Users className="w-12 h-12 mx-auto mb-4" style={{ color: "oklch(68% 0.1 78)" }} />
                <div className="font-semibold mb-2" style={{ color: "oklch(19% 0.08 252)" }}>{t("companyDashboard.noEmployees")}</div>
                <p className="text-sm mb-4" style={{ color: "oklch(45% 0.02 240)" }}>{t("companyDashboard.noEmployeesHint")}</p>
              </div>
            ) : visibleEmployees.length === 0 ? (
              <p className="rounded-xl border bg-white p-6">{t("companyDashboard.noEmployeeMatch")}</p>
            ) : (
              <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid oklch(88% 0.015 88)" }}>
                <table className="w-full text-sm min-w-[560px]">
                  <thead style={{ background: "oklch(93% 0.015 88)" }}>
                    <tr>{[t("companyDashboard.thName"), t("companyDashboard.thEmail"), t("companyDashboard.thJobTitle"), t("companyDashboard.thLicense"), t("companyDashboard.thCategories"), t("companyDashboard.thTypeRatings"), t("companyDashboard.thDepartment"), t("companyDashboard.thBase"), t("companyDashboard.thFile")].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-semibold text-xs tracking-wide" style={{ color: "oklch(45% 0.02 240)" }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {visibleEmployees.map((emp, i) => (
                      <tr key={emp.id} style={{ background: i % 2 === 0 ? "oklch(100% 0 0)" : "oklch(97% 0.01 88)", borderTop: "1px solid oklch(93% 0.015 88)" }}>
                        <td className="px-4 py-3 font-medium" style={{ color: "oklch(19% 0.08 252)" }}>{emp.firstName} {emp.lastName}</td>
                        <td className="px-4 py-3" style={{ color: "oklch(45% 0.02 240)" }}>{emp.email}</td>
                        <td className="px-4 py-3" style={{ color: "oklch(45% 0.02 240)" }}>{emp.jobTitle ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: "oklch(45% 0.02 240)" }}>{emp.licenseNumber ?? "—"}</td>
                        <td className="px-4 py-3" style={{ color: "oklch(45% 0.02 240)" }}>{emp.licenseCategories ?? "—"}</td>
                        <td className="px-4 py-3" style={{ color: "oklch(45% 0.02 240)" }}>{(emp as any).typeRatings ?? "—"}</td>
                        <td className="px-4 py-3" style={{ color: "oklch(45% 0.02 240)" }}>{emp.department ?? "—"}</td>
                        <td className="px-4 py-3" style={{ color: "oklch(45% 0.02 240)" }}>{emp.base ?? "—"}</td>
                        <td className="px-4 py-3"><button onClick={() => setFileEmployee(emp.id)} className="text-xs font-semibold" style={{ color: "oklch(42% 0.1 218)" }}>{t("companyDashboard.open")}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="recurrencies">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="font-semibold" style={{ color: "oklch(19% 0.08 252)" }}>{t("companyDashboard.recurrenciesTitle")}</h2>
              <Button variant="outline" size="sm" onClick={exportRecurrenciesCSV}>
                <Download className="w-4 h-4 mr-1" /> {t("companyDashboard.exportAllRecurrencies")}
              </Button>
            </div>
            <div className="mb-4 space-y-2">
              <label htmlFor="recurrency-filter" className="text-sm font-medium block">{t("companyDashboard.filterRecurrencyStatus")}</label>
              <select id="recurrency-filter" value={recurrencyFilter} onChange={event=>setRecurrencyFilter(event.target.value)} className="rounded-md border p-2 text-sm bg-white">
                <option value="all">{t("companyDashboard.allRecurrencyStatuses")}</option>
                {["ok", "due_soon", "overdue", "not_started"].map(status=><option key={status} value={status}>{t(`companyDashboard.status_${status}`)}</option>)}
              </select>
              <p role="status" className="text-sm">{t("companyDashboard.recurrencyFilterCount",{count:visibleRecurrencies.length,total:recurrencies.length})}</p>
            </div>

            {recurrencies.length === 0 ? (
              <div className="text-center py-16 rounded-xl" style={{ background: "oklch(100% 0 0)", border: "1px solid oklch(88% 0.015 88)" }}>
                <BarChart3 className="w-12 h-12 mx-auto mb-4" style={{ color: "oklch(68% 0.1 78)" }} />
                <div className="font-semibold mb-2" style={{ color: "oklch(19% 0.08 252)" }}>{t("companyDashboard.noRecurrencies")}</div>
                <p className="text-sm" style={{ color: "oklch(45% 0.02 240)" }}>{t("companyDashboard.noRecurrenciesHint")}</p>
              </div>
            ) : visibleRecurrencies.length === 0 ? (
              <p className="rounded-xl border bg-white p-6">{t("companyDashboard.noRecurrencyMatch")}</p>
            ) : (
              <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid oklch(88% 0.015 88)" }}>
                <table className="w-full text-sm min-w-[560px]">
                  <thead style={{ background: "oklch(93% 0.015 88)" }}>
                    <tr>{[t("companyDashboard.thEmployee"), t("companyDashboard.thTraining"), t("companyDashboard.thPeriodicity"), t("companyDashboard.thLastCompletion"), t("companyDashboard.thNextDue"), t("companyDashboard.thStatus")].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-semibold text-xs tracking-wide" style={{ color: "oklch(45% 0.02 240)" }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {visibleRecurrencies.map((rec, i) => {
                      const statusConf = RECURRENCY_STATUS[rec.status ?? "not_started"];
                      return (
                        <tr key={rec.id} style={{ background: i % 2 === 0 ? "oklch(100% 0 0)" : "oklch(97% 0.01 88)", borderTop: "1px solid oklch(93% 0.015 88)" }}>
                          <td className="px-4 py-3 font-medium" style={{ color: "oklch(19% 0.08 252)" }}>{rec.employee?.firstName} {rec.employee?.lastName}</td>
                          <td className="px-4 py-3" style={{ color: "oklch(45% 0.02 240)" }}>{rec.training?.title ?? "—"}</td>
                          <td className="px-4 py-3" style={{ color: "oklch(45% 0.02 240)" }}>{t("companyDashboard.periodMonths", { count: rec.periodMonths })}</td>
                          <td className="px-4 py-3" style={{ color: "oklch(45% 0.02 240)" }}>{rec.lastCompletedAt ? new Date(rec.lastCompletedAt).toLocaleDateString("fr-FR") : "—"}</td>
                          <td className="px-4 py-3" style={{ color: "oklch(45% 0.02 240)" }}>{rec.nextDueAt ? new Date(rec.nextDueAt).toLocaleDateString("fr-FR") : "—"}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ color: statusConf.color, background: statusConf.bg }}>{t(`companyDashboard.status_${rec.status ?? "not_started"}`)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="company">
            <div className="rounded-xl p-6 max-w-lg" style={{ background: "oklch(100% 0 0)", border: "1px solid oklch(88% 0.015 88)" }}>
              <h2 className="font-semibold mb-4" style={{ color: "oklch(19% 0.08 252)" }}>{t("companyDashboard.companyInfoTitle")}</h2>
              {company ? (
                <div className="space-y-3">
                  {[
                    { label: t("companyDashboard.companyLegalName"), value: company.name },
                    { label: t("companyDashboard.companySiret"), value: company.siret ?? "—" },
                    { label: t("companyDashboard.companyVat"), value: company.vatNumber ?? "—" },
                    { label: t("companyDashboard.companyAddress"), value: company.address ?? "—" },
                    { label: t("companyDashboard.companyMainContact"), value: company.contactName ?? "—" },
                    { label: t("companyDashboard.companyContactEmail"), value: company.contactEmail ?? "—" },
                    { label: t("companyDashboard.companyPhone"), value: company.contactPhone ?? "—" },
                    { label: t("companyDashboard.companySubscription"), value: company.subscriptionType ?? "none" },
                  ].map((field) => (
                    <div key={field.label} className="flex justify-between py-2 border-b" style={{ borderColor: "oklch(93% 0.015 88)" }}>
                      <span className="text-sm font-medium" style={{ color: "oklch(45% 0.02 240)" }}>{field.label}</span>
                      <span className="text-sm" style={{ color: "oklch(19% 0.08 252)" }}>{field.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm" style={{ color: "oklch(45% 0.02 240)" }}>{t("companyDashboard.noCompanyProfile")}</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="members">
            <CompanyMembers meId={user?.id} />
          </TabsContent>

          <TabsContent value="id">
            <Passport />
          </TabsContent>

          <TabsContent value="subscription">
            <div className="rounded-2xl p-6" style={{ background: "white", border: "1px solid oklch(88% 0.015 88)" }}>
              {subscriptionQuery.isError || subscriptionQuery.isPending || !subscription ? (
                <div className="space-y-3">
                  {subscriptionQuery.isError || !subscriptionQuery.isPending ? <>
                    <p role="alert">{t("companyDashboard.subscriptionUnavailable")}</p>
                    <Button variant="outline" disabled={subscriptionQuery.isFetching} onClick={() => { void refetchSubscription(); }}>{t("companyDashboard.retryData")}</Button>
                  </> : <p role="status">{t("common.loading")}</p>}
                </div>
              ) : subscription.subscriptionType !== "none" ? (
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <div>
                      <div className="font-serif text-xl font-bold" style={{ color: "oklch(19% 0.08 252)" }}>
                        {t("companyDashboard.subscriptionPlanTitle", { plan: subscription.subscriptionType === "all_inclusive" ? "All Inclusive" : "Standard" })}
                      </div>
                      <div className="text-sm" style={{ color: "oklch(45% 0.02 240)" }}>
                        {t("companyDashboard.subscriptionStatusLabel", { status: subscription.subscriptionStatus ?? t("companyDashboard.subscriptionStatusUnknown") })}
                        {subscription.subscriptionExpiresAt ? t("companyDashboard.subscriptionNextDue", { date: new Date(subscription.subscriptionExpiresAt).toLocaleDateString("fr-FR") }) : ""}
                      </div>
                    </div>
                  </div>
                  {subscription.subscriptionType === "standard" && <div className={`rounded-xl p-4 mb-5 text-sm ${subscription.capacityAvailable ? "bg-slate-50" : "bg-amber-50 text-amber-900"}`}>
                    <p>{lang === "fr" ? "Salariés actifs / places payées" : lang === "ar" ? "الموظفون النشطون / المقاعد المدفوعة" : "Active employees / paid seats"} : {subscription.employeeCount} / {subscription.subscriptionQuantity ?? "—"}</p>
                    {!subscription.capacityAvailable && <p className="mt-2">{lang === "fr" ? "L’effectif dépasse les places vérifiées, ou leur nombre reste à vérifier. Les accès liés à cet abonnement sont suspendus. Ajustez votre formule dans le portail de facturation, puis actualisez l’abonnement." : lang === "ar" ? "يتجاوز العدد المقاعد المتحقق منها أو يلزم التحقق منها. الوصول المرتبط بالاشتراك معلق. عدّل الخطة في بوابة الفوترة ثم حدّث الاشتراك." : "The roster exceeds verified seats, or the seat count needs verification. Subscription access is suspended. Adjust your plan in the billing portal, then refresh the subscription."}</p>}
                  </div>}
                  <div className="grid sm:grid-cols-2 gap-4 mb-5">
                    <div className="rounded-xl p-4" style={{ background: "oklch(97% 0.01 88)" }}>
                      <div className="font-serif text-2xl font-bold" style={{ color: "oklch(68% 0.1 78)" }}>{subscription.employeeCount}</div>
                      <div className="text-xs" style={{ color: "oklch(45% 0.02 240)" }}>{t("companyDashboard.subscriptionActiveRoster")}</div>
                    </div>
                    <div className="rounded-xl p-4" style={{ background: "oklch(97% 0.01 88)" }}>
                      <div className="font-serif text-2xl font-bold" style={{ color: "oklch(68% 0.1 78)" }}>{subscription.regulatoryTrainingCount}</div>
                      <div className="text-xs" style={{ color: "oklch(45% 0.02 240)" }}>{t("companyDashboard.subscriptionCatalogueCount")}</div>
                    </div>
                  </div>
                  <Button onClick={() => createPortal.mutate({ origin: window.location.origin })} disabled={createPortal.isPending || !subscription.hasStripeCustomer} variant="outline">
                    {t("companyDashboard.manageSubscription")}
                  </Button>
                  <Button className="ms-2" variant="outline" disabled={confirmSub.isPending} onClick={() => confirmSub.mutate()}>{lang === "fr" ? "Actualiser l’abonnement" : lang === "ar" ? "تحديث الاشتراك" : "Refresh subscription"}</Button>
                  {!subscription.hasStripeCustomer && <p className="text-xs mt-2" style={{ color: "oklch(45% 0.02 240)" }}>{t("companyDashboard.billingPortalUnavailable")}</p>}
                  <p className="text-xs mt-2" style={{ color: "oklch(45% 0.02 240)" }}>{t("companyDashboard.subscriptionAccessConditions")}</p>
                </div>
              ) : (
                <div>
                  <h3 className="font-serif text-xl font-bold mb-1" style={{ color: "oklch(19% 0.08 252)" }}>{t("companyDashboard.complianceAsSubscription")}</h3>
                  <p className="text-sm mb-5" style={{ color: "oklch(45% 0.02 240)" }}>
                    {t("companyDashboard.complianceAsSubscriptionDesc")}
                  </p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {[
                      { plan: "standard", name: "Standard", desc: t("companyDashboard.planStandardDesc") },
                      { plan: "all_inclusive", name: "All Inclusive", desc: t("companyDashboard.planAllInclusiveDesc") },
                    ].map((p) => (
                      <div key={p.plan} className="rounded-xl p-5 flex flex-col" style={{ border: "1px solid oklch(88% 0.015 88)" }}>
                        <div className="font-serif text-lg font-bold" style={{ color: "oklch(19% 0.08 252)" }}>{p.name}</div>
                        <p className="text-sm flex-1 mt-1 mb-4" style={{ color: "oklch(45% 0.02 240)" }}>{p.desc}</p>
                        <Button
                          onClick={() => createSubscription.mutate({ plan: p.plan as "standard" | "all_inclusive", origin: window.location.origin })}
                          disabled={createSubscription.isPending}
                          style={{ background: "oklch(19% 0.08 252)", color: "white" }}
                        >
                          {t("companyDashboard.subscribe")}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="conformite">
            {analysisError || analysisPending || !consolidated ? (
              <div className="rounded-2xl border bg-white p-6 space-y-3">
                {analysisError || !analysisPending ? <>
                  <p role="alert">{t("companyDashboard.analysisUnavailable")}</p>
                  <Button variant="outline" disabled={analysisQueries.some(query => query.isFetching)} onClick={() => { void Promise.all(analysisQueries.map(query => query.refetch())); }}>{t("companyDashboard.retryData")}</Button>
                </> : <p role="status">{t("common.loading")}</p>}
              </div>
            ) : <fieldset disabled={analysisBusy} className="space-y-6 min-w-0">
              {archivedRuleId != null && <p role="status" className="rounded-xl bg-green-50 p-4 text-sm">{t('companyDashboard.ruleArchivedConfirmation',{id:archivedRuleId})}</p>}
              {(createRule.isError || deleteRule.isError || runTNA.isError) && <div className="rounded-xl bg-amber-50 p-4 text-sm space-y-3">
                <p role="alert">{t(runTNA.error?.data?.code === "PRECONDITION_FAILED" && runTNA.error.message.startsWith("Périodes contradictoires pour le salarié #") ? "companyDashboard.analysisRuleConflict" : "companyDashboard.analysisActionError")}</p>
                {runTNA.error?.data?.code === "PRECONDITION_FAILED" && runTNA.error.message.startsWith("Périodes contradictoires pour le salarié #") && <p>{runTNA.error.message}</p>}
                {runTNA.error?.data?.code === "PRECONDITION_FAILED" && runTNA.error.message.startsWith("Formation indisponible pour le suivi #") && <div className="space-y-2"><p>{t("companyDashboard.ruleCourseUnavailable")}</p><p>{runTNA.error.message}</p></div>}
                {runTNA.error?.data?.code === "PRECONDITION_FAILED" && runTNA.error.message.startsWith("Période invalide pour la règle #") && <div className="space-y-2"><p>{t("companyDashboard.rulePeriodInvalid")}</p><p>{runTNA.error.message}</p></div>}
                <Button variant="outline" onClick={async () => {
                  const results = await Promise.all([...analysisQueries, recurrenciesQuery].map(query => query.refetch()));
                  if (results.every(result => result.isSuccess)) { createRule.reset(); deleteRule.reset(); runTNA.reset(); }
                }}>{t("companyDashboard.retryData")}</Button>
              </div>}
              <div className="rounded-2xl p-6" style={{ background: "white", border: "1px solid oklch(88% 0.015 88)" }}>
                <h2 className="font-serif text-lg font-bold mb-1" style={{ color: "oklch(19% 0.08 252)" }}>{t("companyDashboard.consolidatedView")}</h2>
                <p className="text-sm mb-4" style={{ color: "oklch(45% 0.02 240)" }}>
                  {t("companyDashboard.consolidatedSummary", { country: consolidated?.country ?? "—", employees: consolidated?.employeeCount ?? 0, recurrencies: consolidated?.recurrencyCount ?? 0 })}
                </p>
                <div className="grid md:grid-cols-2 gap-6">
                  {([[t("companyDashboard.bySite"), consolidated?.byBase], [t("companyDashboard.byDepartment"), consolidated?.byDepartment]] as const).map(([label, groups]) => (
                    <div key={label}>
                      <div className="text-xs font-semibold tracking-wide mb-2" style={{ color: "oklch(45% 0.02 240)" }}>{label.toUpperCase()}</div>
                      <div className="space-y-1.5">
                        {groups && Object.keys(groups).length > 0 ? Object.entries(groups).map(([k, v]: any) => (
                          <div key={k} className="flex items-center gap-2 p-2 rounded-lg text-sm" style={{ background: "oklch(97% 0.01 88)" }}>
                            <span className="flex-1 font-medium" style={{ color: "oklch(19% 0.08 252)" }}>{k}</span>
                            <span style={{ color: "oklch(55% 0.18 145)" }}>{t("companyDashboard.countOk", { count: v.ok })}</span>
                            <span style={{ color: "oklch(60% 0.12 78)" }}>{t("companyDashboard.countDue", { count: v.due_soon })}</span>
                            <span style={{ color: "oklch(55% 0.22 27)" }}>{t("companyDashboard.countOverdue", { count: v.overdue })}</span>
                          </div>
                        )) : <p className="text-xs" style={{ color: "oklch(45% 0.02 240)" }}>{t("companyDashboard.noData")}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl p-6" style={{ background: "white", border: "1px solid oklch(88% 0.015 88)" }}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-serif text-lg font-bold" style={{ color: "oklch(19% 0.08 252)" }}>{t("companyDashboard.tnaTitle")}</h2>
                  <Button size="sm" onClick={() => runTNA.mutate()} disabled={runTNA.isPending} style={{ background: "oklch(19% 0.08 252)", color: "white" }}>{t("companyDashboard.runTna")}</Button>
                </div>
                <p className="text-sm mb-4" style={{ color: "oklch(45% 0.02 240)" }}>{t("companyDashboard.tnaDesc")}</p>
                <p className="text-sm mb-4">{t("companyDashboard.tnaEffect")}</p>
                {runTNA.isSuccess&&<p role="status" className="text-sm mb-4 rounded-lg border p-3">{t(runTNA.data.created===0?"companyDashboard.tnaNothingAdded":"companyDashboard.toastTna",{count:runTNA.data.created})}</p>}
                <div className="space-y-1.5 mb-4">
                  {roleReqs.length === 0 && <p className="text-xs" style={{ color: "oklch(45% 0.02 240)" }}>{t("companyDashboard.noRule")}</p>}
                  {roleReqs.map((r: any) => (
                    <div key={r.id} className="flex items-center gap-2 p-2 rounded-lg text-sm" style={{ background: "oklch(97% 0.01 88)" }}>
                      <div className="flex-1">
                        <div className="font-medium" style={{ color: "oklch(19% 0.08 252)" }}>{r.label ?? r.training?.title}</div>
                        <div className="text-xs">{t(r.companyId == null ? "companyDashboard.ruleGlobalScope" : "companyDashboard.ruleCompanyScope")}</div>
                        <p className="text-xs">{r.createdBy == null ? t('companyDashboard.ruleCreatorUnknown') : t('companyDashboard.ruleCreator',{id:r.createdBy,date:new Date(r.createdAt).toLocaleString(lang)})}</p>
                        {!roleRequirementInput.shape.periodMonths.safeParse(r.periodMonths).success&&<p className="text-xs text-amber-800">{t("companyDashboard.rulePeriodReview")}</p>}
                        {(!r.training || !r.training.isPublished || r.training.archivedAt)&&<p className="text-xs text-amber-800">{t("companyDashboard.ruleCourseReview")}</p>}
                        <div className="text-xs" style={{ color: "oklch(45% 0.02 240)" }}>
                          {r.jobTitleContains && r.licenseCategoryContains ? t("companyDashboard.ruleEither", { job: r.jobTitleContains, license: r.licenseCategoryContains }) : r.jobTitleContains ? t("companyDashboard.ruleJobTitleMatch", { value: r.jobTitleContains }) : r.licenseCategoryContains ? t("companyDashboard.ruleLicenseMatch", { value: r.licenseCategoryContains }) : t("companyDashboard.ruleAll")} → {r.training?.title ?? `#${r.trainingId}`} · {t("companyDashboard.periodMonths", { count: r.periodMonths })}
                        </div>
                      </div>
                      {(r.companyId === company.id || user?.role === "admin") && <button disabled={deleteRule.isPending} onClick={() => archiveRule(r)} className="text-red-500 text-xs font-semibold">{t("companyDashboard.archiveRule")}</button>}
                    </div>
                  ))}
                </div>
                <p id="rule-input-help" className="text-xs mb-3">{t("companyDashboard.ruleCompanyCreation", { name: company.name })} {t("companyDashboard.ruleInputLimits")} {t("companyDashboard.ruleMatchHelp")} {t("companyDashboard.ruleCourseScope")}</p>
                <div className="rounded-lg p-3 grid sm:grid-cols-2 gap-2" style={{ background: "oklch(97% 0.01 88)", border: "1px solid oklch(88% 0.015 88)" }}>
                  <div><label htmlFor="rule-label" className="text-xs block mb-1">{t("companyDashboard.ruleLabelPlaceholder")}</label><Input id="rule-label" maxLength={255} aria-describedby="rule-input-help" value={ruleForm.label} onChange={(e) => setRuleForm((f) => ({ ...f, label: e.target.value }))} className="h-8" /></div>
                  <div><label htmlFor="rule-training" className="text-xs block mb-1">{t("companyDashboard.trainingPlaceholder")}</label><select id="rule-training" aria-describedby="rule-input-help" value={ruleForm.trainingId} onChange={(e) => setRuleForm((f) => ({ ...f, trainingId: e.target.value }))} className="h-8 rounded-md border px-2 text-sm" style={{ borderColor: "oklch(88% 0.015 88)" }}>
                    <option value="">{t("companyDashboard.trainingPlaceholder")}</option>
                    <optgroup label={t("companyDashboard.ruleInternalCourses")}>
                      {allTrainings.filter(course=>course.ownerOrgId!=null).map(course=><option key={course.id} value={course.id}>{course.title}</option>)}
                    </optgroup>
                    <optgroup label={t("companyDashboard.rulePublicCourses")}>
                      {allTrainings.filter(course=>course.ownerOrgId==null).map(course=><option key={course.id} value={course.id}>{course.title}</option>)}
                    </optgroup>
                  </select></div>
                  <div><label htmlFor="rule-jobTitleContains" className="text-xs block mb-1">{t("companyDashboard.ruleJobTitlePlaceholder")}</label><Input id="rule-jobTitleContains" maxLength={128} aria-describedby="rule-input-help" value={ruleForm.jobTitleContains} onChange={(e) => setRuleForm((f) => ({ ...f, jobTitleContains: e.target.value }))} className="h-8" /></div>
                  <div><label htmlFor="rule-licenseCategoryContains" className="text-xs block mb-1">{t("companyDashboard.ruleLicensePlaceholder")}</label><Input id="rule-licenseCategoryContains" maxLength={64} aria-describedby="rule-input-help" value={ruleForm.licenseCategoryContains} onChange={(e) => setRuleForm((f) => ({ ...f, licenseCategoryContains: e.target.value }))} className="h-8" /></div>
                  <div className="flex items-center gap-2"><label htmlFor="rule-period" className="text-xs" style={{ color: "oklch(45% 0.02 240)" }}>{t("companyDashboard.periodMonthsLabel")}</label><Input id="rule-period" aria-describedby="rule-input-help" type="number" min={1} max={120} step={1} value={ruleForm.periodMonths} onChange={(e) => setRuleForm((f) => ({ ...f, periodMonths: Number(e.target.value) }))} className="h-8 w-20" /></div>
                  <div className="col-span-full rounded-lg border p-3 text-sm space-y-2">
                    {!validRule ? <p>{t('companyDashboard.rulePreviewInput')}</p> : employeesQuery.isFetching || requirementsQuery.isFetching ? <p role="status">{t('common.loading')}</p> : <>
                      <p role="status">{t('companyDashboard.rulePreviewCount',{count:matchingEmployees.length})}</p>
                      <p className="text-muted-foreground">{t('companyDashboard.rulePreviewHint')}</p>
                      {periodOverlaps.length > 0 && <div className="rounded border border-amber-300 bg-amber-50 p-3 space-y-2">
                        <p>{t('companyDashboard.ruleOverlapHint',{count:periodOverlaps.length})}</p>
                        <ul className="space-y-1">{periodOverlaps.slice(0,20).map(rule=><li key={rule.id}>{t('companyDashboard.ruleOverlapRow',{id:rule.id,months:rule.periodMonths,count:rule.employeeCount})}</li>)}</ul>
                        {periodOverlaps.length > 20 && <p>{t('companyDashboard.ruleOverlapMore',{count:periodOverlaps.length-20})}</p>}
                      </div>}
                      {matchingEmployees.length > 0 && <details><summary className="cursor-pointer">{t('companyDashboard.rulePreviewNames')}</summary><ul className="mt-2 max-h-48 overflow-auto space-y-1">
                        {matchingEmployees.slice(0,20).map(employee=><li key={employee.id}>#{employee.id} · {employee.firstName} {employee.lastName}{employee.jobTitle ? ` · ${employee.jobTitle}` : ''}</li>)}
                      </ul>{matchingEmployees.length > 20 && <p>{t('companyDashboard.rulePreviewMore',{count:matchingEmployees.length-20})}</p>}</details>}
                    </>}
                  </div>
                  <Button size="sm" disabled={!validRule || createRule.isPending} onClick={() => createRule.mutate({ label: ruleForm.label || undefined, jobTitleContains: ruleForm.jobTitleContains || undefined, licenseCategoryContains: ruleForm.licenseCategoryContains || undefined, trainingId: Number(ruleForm.trainingId), periodMonths: ruleForm.periodMonths })} style={{ background: "oklch(19% 0.08 252)", color: "white" }}>{t("companyDashboard.addRule")}</Button>
                </div>
              </div>
            </fieldset>}
            <RoleRequirementHistory />
          </TabsContent>
            </div>
          </div>
        </Tabs>

        <TechnicianFileDialog employeeId={fileEmployee} onClose={() => setFileEmployee(null)} />
      </div>
    </div>
  );
}
