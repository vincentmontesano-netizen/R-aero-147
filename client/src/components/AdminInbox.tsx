import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { RefreshCw, Mail, MailOpen, Loader2, X } from "lucide-react";

const BLUE = "oklch(19% 0.08 252)";
const GOLD = "oklch(68% 0.1 78)";
const MUTED = "oklch(45% 0.02 240)";
const BORDER = "oklch(88% 0.015 88)";
const dt = (v: any) => (v ? new Date(v).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "");

/** Read-only IMAP inbox (admin → Emails → Réception). */
export default function AdminInbox({ configured }: { configured: boolean }) {
  const { t } = useI18n();
  const [openUid, setOpenUid] = useState<number | null>(null);
  const list = trpc.admin.inbox.list.useQuery({ limit: 25 }, { enabled: configured, retry: false });
  const message = trpc.admin.inbox.message.useQuery({ uid: openUid! }, { enabled: openUid != null, retry: false });

  if (!configured) {
    return <p className="text-sm py-6" style={{ color: "oklch(55% 0.22 27)" }}>{t("adminInbox.notConfigured")}</p>;
  }

  return (
    <div className="rounded-xl p-5 max-w-3xl" style={{ background: "white", border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2"><Mail className="w-4 h-4" style={{ color: GOLD }} /><h3 className="font-semibold text-sm" style={{ color: BLUE }}>{t("adminInbox.title")}</h3></div>
        <Button size="sm" variant="outline" disabled={list.isFetching} onClick={() => list.refetch()}>
          {list.isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} <span className="ml-1">{t("adminInbox.refresh")}</span>
        </Button>
      </div>

      {list.isLoading && <p className="text-sm" style={{ color: MUTED }}>{t("adminInbox.loading")}</p>}
      {list.error && <p className="text-sm" style={{ color: "oklch(55% 0.22 27)" }}>{list.error.message}</p>}
      {list.data && list.data.length === 0 && <p className="text-sm" style={{ color: MUTED }}>{t("adminInbox.empty")}</p>}

      <div className="space-y-1.5">
        {(list.data ?? []).map((m: any) => (
          <div key={m.uid}>
            <button onClick={() => setOpenUid(openUid === m.uid ? null : m.uid)}
              className="w-full text-left flex items-start gap-3 p-3 rounded-lg transition-colors hover:bg-black/[0.02]"
              style={{ background: "oklch(97% 0.01 88)" }}>
              {m.seen ? <MailOpen className="w-4 h-4 mt-0.5 shrink-0" style={{ color: MUTED }} /> : <Mail className="w-4 h-4 mt-0.5 shrink-0" style={{ color: GOLD }} />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate" style={{ color: BLUE }}>{m.fromName || m.from || "—"}</span>
                  <span className="text-[11px] shrink-0" style={{ color: MUTED }}>{dt(m.date)}</span>
                </div>
                <div className="text-sm truncate" style={{ color: BLUE }}>{m.subject}</div>
                <div className="text-xs truncate" style={{ color: MUTED }}>{m.snippet}</div>
              </div>
            </button>

            {openUid === m.uid && (
              <div className="mt-1 mb-2 rounded-lg p-4" style={{ border: `1px solid ${BORDER}` }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs" style={{ color: MUTED }}>{m.from} · {dt(m.date)}</div>
                  <button onClick={() => setOpenUid(null)} className="p-1 rounded hover:bg-black/5" style={{ color: MUTED }}><X className="w-4 h-4" /></button>
                </div>
                <div className="font-semibold text-sm mb-2" style={{ color: BLUE }}>{m.subject}</div>
                {message.isLoading && <p className="text-sm" style={{ color: MUTED }}>{t("adminInbox.loading")}</p>}
                {message.error && <p className="text-sm" style={{ color: "oklch(55% 0.22 27)" }}>{message.error.message}</p>}
                {message.data && (
                  message.data.html
                    ? <div className="text-sm prose max-w-none" style={{ color: BLUE }} dangerouslySetInnerHTML={{ __html: message.data.html }} />
                    : <div className="text-sm whitespace-pre-wrap" style={{ color: BLUE }}>{message.data.text || t("adminInbox.empty")}</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
