import {requestId as createRequestId} from "@/lib/requestId";
import {supportRequestInput,supportRequestKinds,supportRequestLabels} from "../../../shared/supportRequest";
import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import BackButton from "@/components/BackButton";
import TicketThread from "@/components/TicketThread";
import { Plus, LogIn, ChevronDown, ChevronUp } from "lucide-react";
import { useI18n } from "@/i18n";

const BLUE = "oklch(19% 0.08 252)";
const MUTED = "oklch(45% 0.02 240)";
const BORDER = "oklch(88% 0.015 88)";

/** Learner support: create tickets + follow the conversation with R-AERO. */
export default function Support() {
  const { t,lang } = useI18n();
  const requestLabels=supportRequestLabels[lang];
  const STATUS: Record<string, [string, string]> = {
    OPEN: ["oklch(55% 0.18 145)", t("support.statusOpen")],
    PENDING: ["oklch(60% 0.12 78)", t("support.statusPending")],
    CLOSED: ["oklch(60% 0.02 240)", t("support.statusClosed")],
  };
  const { user, isAuthenticated, loading: authLoading, error: authError } = useAuth();
  const utils = trpc.useUtils();
  const [beforeId,setBeforeId] = useState<number | undefined>();
  const [statusFilter,setStatusFilter] = useState<''|'OPEN'|'PENDING'|'CLOSED'>('');
  const [search,setSearch] = useState('');
  const ticketsQuery = trpc.support.myList.useQuery({beforeId,status:statusFilter||undefined,search}, { enabled: !!user });
  const tickets = ticketsQuery.data?.entries ?? [];
  const refreshAll = () => {
    if (beforeId === undefined && !statusFilter && !search) void ticketsQuery.refetch();
    setBeforeId(undefined);setStatusFilter('');setSearch('');
  };
  const [open, setOpen] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(()=>new URLSearchParams(window.location.search).get("request")==="privacy");
  const [requestKind,setRequestKind]=useState<(typeof supportRequestKinds)[number]>(()=>new URLSearchParams(window.location.search).get("request")==="privacy"?"DATA_ACCESS":"GENERAL");
  const [form, setForm] = useState({ subject: "", message: "" });
  const sending = useRef(false);
  const pendingCreation = useRef<{signature:string;requestId:string} | null>(null);
  const [createError, setCreateError] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const create = trpc.support.create.useMutation({
    onSuccess: async (ticket) => { setBeforeId(undefined);setStatusFilter('');setSearch(''); pendingCreation.current = null; setCreatedId(ticket.id); setOpen(ticket.id); setCreateError(false); setShowNew(false); setForm({ subject: "", message: "" }); await utils.support.myList.invalidate(); },
    onError: () => setCreateError(true),
    onSettled: () => { sending.current = false; },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (sending.current || create.isPending) return;
    const parsed = supportRequestInput.safeParse({requestKind, subject: form.subject, message: form.message || undefined});
    if (!parsed.success) return;
    sending.current = true;
    setCreateError(false);
    setCreatedId(null);
    const signature = JSON.stringify({...parsed.data,message:parsed.data.message||''});
    if (pendingCreation.current?.signature !== signature) pendingCreation.current = {signature,requestId:createRequestId()};
    create.mutate({...parsed.data,requestId:pendingCreation.current.requestId});
  };

  if (authLoading) return <div className="container py-20" role="status">{t("common.loading")}</div>;
  if (authError) return <div className="container py-20" role="alert"><p>{t("support.authError")}</p><Button onClick={() => window.location.reload()}>{t("supportList.retry")}</Button></div>;
  if (!isAuthenticated) {
    return (
      <div className="container py-20 text-center">
        <p className="mb-4" style={{ color: MUTED }}>{t("support.loginPrompt")}</p>
        <a href={getLoginUrl()}><Button style={{ background: "oklch(68% 0.1 78)", color: BLUE }}><LogIn className="w-4 h-4 mr-1" /> {t("support.login")}</Button></a>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-3xl">
      <BackButton />
      <div className="flex items-center justify-between mb-1 mt-2">
        <h1 className="text-2xl font-bold" style={{ color: BLUE }}>{t("support.title")}</h1>
        <Button size="sm" disabled={create.isPending} onClick={() => setShowNew((s) => !s)} style={{ background: BLUE, color: "white" }}><Plus className="w-4 h-4 mr-1" /> {t("support.newRequest")}</Button>
      </div>
      <p className="text-sm mb-6" style={{ color: MUTED }}>{t("support.subtitle")}</p>

      {createdId != null && <p role="status" className="mb-4">{t("support.createdReference", {id: String(createdId)})}</p>}
      {showNew && (
        <form onSubmit={submit} aria-busy={create.isPending} className="rounded-xl p-4 mb-5 space-y-2" style={{ background: "white", border: `1px solid ${BORDER}` }}>
          <label className="block text-sm">{requestLabels.type}<select value={requestKind} disabled={create.isPending} onChange={e=>setRequestKind(e.target.value as typeof requestKind)} className="block w-full border rounded-md p-2 mt-1">{supportRequestKinds.map(kind=><option key={kind} value={kind}>{requestLabels[kind]}</option>)}</select></label>
          {requestKind!=='GENERAL'&&<p className="text-sm text-muted-foreground">{requestLabels.notice}</p>}
          <label htmlFor="support-subject" className="block text-sm">{t("support.subjectPlaceholder")}</label>
          <Input id="support-subject" required disabled={create.isPending} maxLength={255} value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder={t("support.subjectPlaceholder")} />
          <label htmlFor="support-message" className="block text-sm">{t("support.messagePlaceholder")}</label>
          <textarea id="support-message" disabled={create.isPending} required={requestKind !== "GENERAL"} minLength={requestKind !== "GENERAL" ? 10 : undefined} maxLength={10000} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder={t("support.messagePlaceholder")} className="w-full rounded-md border px-3 py-2 text-sm h-24 resize-y" style={{ borderColor: BORDER }} />
          {createError && <div role="alert"><p className="text-sm">{t("support.createUnconfirmed")}</p><Button type="button" variant="outline" disabled={ticketsQuery.isFetching} onClick={refreshAll}>{t("support.refreshRequests")}</Button></div>}
          <Button type="submit" size="sm" disabled={!form.subject.trim() || create.isPending || (requestKind!=='GENERAL'&&form.message.trim().length<10)} style={{ background: BLUE, color: "white" }}>{t("support.send")}</Button>
        </form>
      )}

      <p className="text-sm mb-3">{t("support.personalPageInfo")}</p>
      <div className="flex flex-wrap gap-2 mb-3">
        <Input aria-label={t("support.searchSubject")} placeholder={t("support.searchSubject")} maxLength={255} value={search} onChange={e=>{setSearch(e.target.value);setBeforeId(undefined);setOpen(null);}} />
        <select aria-label={t("supportList.status")} value={statusFilter} onChange={e=>{setStatusFilter(e.target.value as typeof statusFilter);setBeforeId(undefined);setOpen(null);}} className="border rounded px-2 py-1">
          <option value="">{t("supportList.allStatuses")}</option><option value="OPEN">{t("support.statusOpen")}</option><option value="PENDING">{t("support.statusPending")}</option><option value="CLOSED">{t("support.statusClosed")}</option>
        </select>
        <Button variant="outline" disabled={ticketsQuery.isFetching} onClick={()=>{setOpen(null);if(beforeId === undefined)void ticketsQuery.refetch();else setBeforeId(undefined);}}>{t("myQuotes.firstPage")}</Button>
      </div>
      {ticketsQuery.isError ? (
        <p role="alert">{t("supportList.loadError")}</p>
      ) : ticketsQuery.isPending ? (
        <div className="h-24 animate-pulse rounded-xl" style={{ background: "oklch(88% 0.015 88)" }} />
      ) : tickets.length === 0 ? (
        <p className="text-sm" style={{ color: MUTED }}>{t(search || statusFilter ? "support.noMatchingRequests" : "support.empty")}</p>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => {
            const [col, lbl] = STATUS[t.status] ?? STATUS.OPEN;
            return (
              <div key={t.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}`, background: "white" }}>
                <button onClick={() => setOpen(open === t.id ? null : t.id)} aria-expanded={open === t.id} className="w-full flex items-center justify-between p-4 text-start">
                  <div>
                    <div className="font-semibold" style={{ color: BLUE }}>{t.subject}</div><div className="text-sm">{requestLabels[t.requestKind as (typeof supportRequestKinds)[number]]}</div>
                    <div className="text-xs" style={{ color: MUTED }}><span style={{ color: col }}>{lbl}</span> · {new Date(t.updatedAt).toLocaleDateString(lang === "ar" ? "ar" : lang === "en" ? "en-GB" : "fr-FR")}</div>
                  </div>
                  {open === t.id ? <ChevronUp className="w-4 h-4" style={{ color: MUTED }} /> : <ChevronDown className="w-4 h-4" style={{ color: MUTED }} />}
                </button>
                {open === t.id && <div className="px-4 pb-4"><TicketThread ticketId={t.id} meId={user?.id} /></div>}
              </div>
            );
          })}
          {ticketsQuery.data?.nextBeforeId != null && <Button variant="outline" disabled={ticketsQuery.isFetching} onClick={()=>{setOpen(null);setBeforeId(ticketsQuery.data!.nextBeforeId!);}}>{t("supportList.next")}</Button>}
        </div>
      )}
    </div>
  );
}
