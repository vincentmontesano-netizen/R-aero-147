import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { RefreshCw, Mail, MailOpen, Loader2, X } from "lucide-react";

const BLUE = "var(--foreground)";
const GOLD = "var(--link)";
const MUTED = "var(--muted-foreground)";
const BORDER = "var(--border)";
const dt = (v: any) => (v ? new Date(v).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "");

/** Read-only IMAP inbox (admin → Emails → Réception). */
export default function AdminInbox({ configured }: { configured: boolean }) {
  const { t } = useI18n();
  const [openUid, setOpenUid] = useState<number | null>(null);
  const list = trpc.admin.inbox.list.useQuery({ limit: 25 }, { enabled: configured, retry: false });
  const message = trpc.admin.inbox.message.useQuery({ uid: openUid! }, { enabled: openUid != null, retry: false });

  if (!configured) {
    return <p className="text-sm py-6" style={{ color: "var(--destructive)" }}>{t("adminInbox.notConfigured")}</p>;
  }

  return (
    <div className="rounded-xl p-5 max-w-3xl" style={{ background: "var(--card)", border: `1px solid ${"var(--border)"}` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2"><Mail className="w-4 h-4" style={{ color: "var(--link)" }} /><h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{t("adminInbox.title")}</h3></div>
        <Button size="sm" variant="outline" disabled={list.isFetching} onClick={() => list.refetch()}>
          {list.isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} <span className="ml-1">{t("adminInbox.refresh")}</span>
        </Button>
      </div>

      {list.isLoading && <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("adminInbox.loading")}</p>}
      {list.error && <p className="text-sm" style={{ color: "var(--destructive)" }}>{list.error.message}</p>}
      {list.data && list.data.length === 0 && <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("adminInbox.empty")}</p>}

      <div className="space-y-1.5">
        {(list.data ?? []).map((m: any) => (
          <div key={m.uid}>
            <button onClick={() => setOpenUid(openUid === m.uid ? null : m.uid)}
              className="w-full text-left flex items-start gap-3 p-3 rounded-lg transition-colors hover:bg-black/[0.02]"
              style={{ background: "var(--background)" }}>
              {m.seen ? <MailOpen className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--muted-foreground)" }} /> : <Mail className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--link)" }} />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{m.fromName || m.from || "—"}</span>
                  <span className="text-xs shrink-0" style={{ color: "var(--muted-foreground)" }}>{dt(m.date)}</span>
                </div>
                <div className="text-sm truncate" style={{ color: "var(--foreground)" }}>{m.subject}</div>
                <div className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>{m.snippet}</div>
              </div>
            </button>

            {openUid === m.uid && (
              <div className="mt-1 mb-2 rounded-lg p-4" style={{ border: `1px solid ${"var(--border)"}` }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{m.from} · {dt(m.date)}</div>
                  <button onClick={() => setOpenUid(null)} className="p-1 rounded hover:bg-foreground/5" style={{ color: "var(--muted-foreground)" }}><X className="w-4 h-4" /></button>
                </div>
                <div className="font-semibold text-sm mb-2" style={{ color: "var(--foreground)" }}>{m.subject}</div>
                {message.isLoading && <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("adminInbox.loading")}</p>}
                {message.error && <p className="text-sm" style={{ color: "var(--destructive)" }}>{message.error.message}</p>}
                {message.data && (
                  message.data.html
                    ? <div className="text-sm prose max-w-none" style={{ color: "var(--foreground)" }} dangerouslySetInnerHTML={{ __html: message.data.html }} />
                    : <div className="text-sm whitespace-pre-wrap" style={{ color: "var(--foreground)" }}>{message.data.text || t("adminInbox.empty")}</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
