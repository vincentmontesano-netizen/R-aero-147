import {requestId as createRequestId} from "@/lib/requestId";
import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";

const BLUE = "var(--foreground)";
const MUTED = "var(--muted-foreground)";

/** Support ticket message thread (polled). Authorised server-side to owner or staff. */
export default function TicketThread({ ticketId, meId }: { ticketId: number; meId?: number }) {
  const { t,lang } = useI18n();
  const [historyOpen,setHistoryOpen]=useState(false);
  const history=trpc.support.statusHistory.useInfiniteQuery({ticketId},{enabled:historyOpen,refetchInterval:8000,getNextPageParam:page=>page.nextCursor??undefined});
  const labels=lang==='fr'?{history:'Historique du traitement',empty:'Aucun changement enregistré depuis la mise en place de cet historique.',more:'Afficher la suite',error:'Historique indisponible.',loading:'Chargement…',OPEN:'Ouvert',PENDING:'En cours',CLOSED:'Clôturé'}:lang==='ar'?{history:'سجل معالجة الطلب',empty:'لا توجد تغييرات مسجلة منذ بدء هذا السجل.',more:'عرض المزيد',error:'السجل غير متاح.',loading:'جارٍ التحميل…',OPEN:'مفتوح',PENDING:'قيد المعالجة',CLOSED:'مغلق'}:{history:'Request history',empty:'No changes recorded since this history was introduced.',more:'Show more',error:'History unavailable.',loading:'Loading…',OPEN:'Open',PENDING:'In progress',CLOSED:'Closed'};
  const utils = trpc.useUtils();
  const thread = trpc.support.thread.useQuery({ ticketId }, { refetchInterval: 8000 });
  const msgs = thread.data ?? [];
  const [text, setText] = useState("");
  const sending = useRef(false);
  const pendingMessage = useRef<{signature:string;requestId:string} | null>(null);
  const [sendError, setSendError] = useState(false);
  const reply = trpc.support.reply.useMutation({
    onSuccess: async () => { pendingMessage.current = null; setText(""); setSendError(false); await utils.support.thread.invalidate({ ticketId }); },
    onError: () => setSendError(true),
    onSettled: () => { sending.current = false; },
  });
  const submit = () => {
    const content = text.trim();
    if (!content || content.length > 10000 || sending.current || reply.isPending || thread.isPending || thread.isError) return;
    sending.current = true;
    setSendError(false);
    const signature = JSON.stringify({ticketId,content});
    if (pendingMessage.current?.signature !== signature) pendingMessage.current = {signature,requestId:createRequestId()};
    reply.mutate({ ticketId, content, requestId:pendingMessage.current.requestId });
  };

  return (
    <div>
      {thread.isError ? <div role="alert" className="mb-3"><p>{t("ticketThread.loadError")}</p><Button variant="outline" disabled={thread.isFetching} onClick={() => void thread.refetch()}>{t("supportList.retry")}</Button></div> : thread.isPending ? <p role="status">{t("common.loading")}</p> : <div className="space-y-2 max-h-72 overflow-y-auto mb-3 pe-1">
        {msgs.length === 0 && <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{t("ticketThread.noMessages")}</p>}
        {msgs.map((m) => {
          const mine = meId != null && m.fromUserId === meId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className="rounded-lg px-3 py-2 max-w-[80%]" style={{ background: mine ? "color-mix(in srgb, var(--link) 13%, transparent)" : "var(--background)" }}>
                <div className="text-xs mb-0.5" style={{ color: "var(--muted-foreground)" }}>{m.fromName ?? "—"}{m.fromRole === "admin" ? " · R-AERO" : ""} · {new Date(m.createdAt).toLocaleString(lang === "ar" ? "ar" : lang === "en" ? "en-GB" : "fr-FR", {dateStyle:"short",timeStyle:"short"})}</div>
                <div className="text-sm whitespace-pre-wrap break-words" style={{ color: "var(--foreground)" }}>{m.content}</div>
              </div>
            </div>
          );
        })}
      </div>}
      <details className="border-t py-3 mb-2" onToggle={e=>setHistoryOpen(e.currentTarget.open)}>
        <summary className="cursor-pointer text-sm font-medium">{labels.history}</summary>
        {historyOpen&&<div className="mt-2 space-y-3 text-sm" aria-live="polite">
          {history.isLoading?<p>{labels.loading}</p>:history.isError?<div role="alert"><p>{labels.error}</p><Button variant="outline" disabled={history.isFetching} onClick={()=>void history.refetch()}>{t("supportList.retry")}</Button></div>:history.data?.pages[0]?.entries.length===0?<p>{labels.empty}</p>:<ol className="space-y-3">{history.data?.pages.flatMap(p=>p.entries).map(event=><li key={event.id}>
            <div>{labels[event.status as 'OPEN'|'PENDING'|'CLOSED']} · {event.actorName??'—'} · {new Date(event.createdAt).toLocaleString(lang)}</div>
            {event.reason&&<p className="whitespace-pre-wrap break-words">{event.reason}</p>}
          </li>)}</ol>}
          {history.hasNextPage&&<Button variant="outline" disabled={history.isFetchingNextPage} onClick={()=>void history.fetchNextPage()}>{labels.more}</Button>}
        </div>}
      </details>
      {sendError && <div role="alert" className="mb-3"><p className="text-sm">{t("ticketThread.sendUnconfirmed")}</p><Button variant="outline" disabled={thread.isFetching} onClick={() => void thread.refetch()}>{t("ticketThread.refresh")}</Button></div>}
      <div className="flex gap-2" aria-busy={reply.isPending}>
        <Input aria-label={t("ticketThread.messagePlaceholder")} maxLength={10000} disabled={reply.isPending || thread.isPending || thread.isError} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("ticketThread.messagePlaceholder")} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }} />
        <Button aria-label={t("support.send")} disabled={!text.trim() || reply.isPending || thread.isPending || thread.isError} onClick={submit} style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}><Send className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}
