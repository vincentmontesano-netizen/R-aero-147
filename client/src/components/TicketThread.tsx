import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";

const BLUE = "oklch(19% 0.08 252)";
const GOLD = "oklch(68% 0.1 78)";
const MUTED = "oklch(45% 0.02 240)";
const dt = (v: any) => new Date(v).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

/** Support ticket message thread (polled). Authorised server-side to owner or staff. */
export default function TicketThread({ ticketId, meId }: { ticketId: number; meId?: number }) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data: msgs = [] } = trpc.support.thread.useQuery({ ticketId }, { refetchInterval: 8000 });
  const [text, setText] = useState("");
  const reply = trpc.support.reply.useMutation({
    onSuccess: () => { setText(""); utils.support.thread.invalidate({ ticketId }); },
  });
  const submit = () => { if (text.trim()) reply.mutate({ ticketId, content: text.trim() }); };

  return (
    <div>
      <div className="space-y-2 max-h-72 overflow-y-auto mb-3 pr-1">
        {msgs.length === 0 && <p className="text-xs" style={{ color: MUTED }}>{t("ticketThread.noMessages")}</p>}
        {msgs.map((m: any) => {
          const mine = meId != null && m.fromUserId === meId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className="rounded-lg px-3 py-2 max-w-[80%]" style={{ background: mine ? `${GOLD}22` : "oklch(97% 0.01 88)" }}>
                <div className="text-[11px] mb-0.5" style={{ color: MUTED }}>{m.fromName ?? "—"}{m.fromRole === "admin" ? " · R-AERO" : ""} · {dt(m.createdAt)}</div>
                <div className="text-sm whitespace-pre-wrap break-words" style={{ color: BLUE }}>{m.content}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("ticketThread.messagePlaceholder")} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
        <Button disabled={!text.trim() || reply.isPending} onClick={submit} style={{ background: BLUE, color: "white" }}><Send className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}
