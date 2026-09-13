import {requestId} from "@/lib/requestId";
import {quoteMessageInput} from "../../../shared/quoteMessageInput";
import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { useI18n } from "@/i18n";

const BLUE = "oklch(19% 0.08 252)";
const GOLD = "oklch(68% 0.1 78)";
const MUTED = "oklch(45% 0.02 240)";

/** Reusable admin↔client message thread on a quote (polled, like NotificationBell). */
export default function QuoteThread({ quoteId, meId }: { quoteId: number; meId?: number }) {
  const { t,lang } = useI18n();
  const utils = trpc.useUtils();
  const query = trpc.quotes.messages.list.useQuery({ quoteId }, { refetchInterval: 8000 });
  const msgs=query.data??[];
  const [text, setText] = useState("");
  const sending=useRef(false);
  const pendingMessage=useRef<{signature:string;requestId:string}|null>(null);
  const send = trpc.quotes.messages.send.useMutation({
    onSuccess: async () => { pendingMessage.current=null; setText(""); await utils.quotes.messages.list.invalidate({ quoteId }); },
  });
  const submit = () => {
    if (sending.current || query.isError || query.isPending || !text.trim()) return;
    const parsed=quoteMessageInput.safeParse({quoteId,content:text});
    if(!parsed.success)return;
    const signature=JSON.stringify(parsed.data);
    if(pendingMessage.current?.signature!==signature)pendingMessage.current={signature,requestId:requestId()};
    sending.current=true;
    void send.mutateAsync({...parsed.data,requestId:pendingMessage.current.requestId}).catch(()=>{}).finally(()=>{sending.current=false;});
  };

  return (
    <div>
      {query.isError?<div><p role="alert" className="text-sm">{t("quoteThread.unavailable")}</p><Button variant="outline" disabled={query.isFetching} onClick={()=>void query.refetch()}>{t("quoteThread.retry")}</Button></div>:query.isPending?<p role="status">{t("common.loading")}</p>:<div className="space-y-2 max-h-72 overflow-y-auto mb-3 pr-1">
        {msgs.length === 0 && <p className="text-xs" style={{ color: MUTED }}>{t("quoteThread.empty")}</p>}
        {msgs.map((m: any) => {
          const mine = meId != null && m.fromUserId === meId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className="rounded-lg px-3 py-2 max-w-[80%]" style={{ background: mine ? `${GOLD}22` : "oklch(97% 0.01 88)" }}>
                <div className="text-[11px] mb-0.5" style={{ color: MUTED }}>{m.fromName ?? "—"}{m.fromRole === "admin" ? " · R-AERO" : ""} · {new Date(m.createdAt).toLocaleString(lang,{dateStyle:"short",timeStyle:"short"})}</div>
                <div className="text-sm whitespace-pre-wrap break-words" style={{ color: BLUE }}>{m.content}</div>
              </div>
            </div>
          );
        })}
      </div>}
      {send.isError&&<div role="alert" className="text-sm mb-2"><p>{t("quoteThread.unconfirmed")}</p><Button variant="outline" disabled={query.isFetching} onClick={()=>void query.refetch()}>{t("quoteThread.retry")}</Button></div>}
      <div className="flex gap-2">
        <Input maxLength={10000} disabled={send.isPending || query.isError || query.isPending} aria-label={t("quoteThread.placeholder")} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("quoteThread.placeholder")}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) {e.preventDefault();submit();} }} />
        <Button aria-label={t("quoteThread.send")} disabled={!text.trim() || send.isPending || query.isError || query.isPending} onClick={submit} style={{ background: BLUE, color: "white" }}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
