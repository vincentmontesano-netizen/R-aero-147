import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { useI18n } from "@/i18n";

const BLUE = "oklch(19% 0.08 252)";
const GOLD = "oklch(68% 0.1 78)";
const MUTED = "oklch(45% 0.02 240)";
const dt = (v: any) => new Date(v).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

/** Reusable admin↔client message thread on a quote (polled, like NotificationBell). */
export default function QuoteThread({ quoteId, meId }: { quoteId: number; meId?: number }) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data: msgs = [] } = trpc.quotes.messages.list.useQuery({ quoteId }, { refetchInterval: 8000 });
  const [text, setText] = useState("");
  const send = trpc.quotes.messages.send.useMutation({
    onSuccess: () => { setText(""); utils.quotes.messages.list.invalidate({ quoteId }); },
  });
  const submit = () => { if (text.trim()) send.mutate({ quoteId, content: text.trim() }); };

  return (
    <div>
      <div className="space-y-2 max-h-72 overflow-y-auto mb-3 pr-1">
        {msgs.length === 0 && <p className="text-xs" style={{ color: MUTED }}>{t("quoteThread.empty")}</p>}
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
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("quoteThread.placeholder")}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
        <Button disabled={!text.trim() || send.isPending} onClick={submit} style={{ background: BLUE, color: "white" }}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
