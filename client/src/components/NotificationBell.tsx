import { trpc } from "@/lib/trpc";
import { Bell, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocation } from "wouter";
import { useI18n } from "@/i18n";

const GOLD = "oklch(68% 0.1 78)";
const RED = "oklch(55% 0.22 27)";

/** Bell with unread badge + dropdown list of in-app notifications. */
export default function NotificationBell({ dark = false }: { dark?: boolean }) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data: notifications = [] } = trpc.notifications.list.useQuery(undefined, { refetchInterval: 60000 });
  const { data: unread = 0 } = trpc.notifications.unreadCount.useQuery(undefined, { refetchInterval: 60000 });
  const [, setLocation] = useLocation();

  const invalidate = () => {
    utils.notifications.list.invalidate();
    utils.notifications.unreadCount.invalidate();
  };
  const markRead = trpc.notifications.markRead.useMutation({ onSuccess: invalidate });
  const markAll = trpc.notifications.markAllRead.useMutation({ onSuccess: invalidate });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative h-9 w-9 flex items-center justify-center rounded-lg transition-colors"
          style={dark ? { color: "white", border: "1px solid oklch(100% 0 0 / 0.2)" } : { color: "oklch(45% 0.02 240)", border: "1px solid oklch(88% 0.015 88)" }}
          aria-label={t("notificationBell.ariaLabel")}
        >
          <Bell className="w-4 h-4" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: RED, color: "white" }}>
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-2.5 border-b">
          <span className="font-semibold text-sm">{t("notificationBell.title")}</span>
          {unread > 0 && (
            <button onClick={() => markAll.mutate()} className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground">
              <Check className="w-3 h-3" /> {t("notificationBell.markAllRead")}
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 && (
            <p className="px-4 py-8 text-sm text-center text-muted-foreground">{t("notificationBell.empty")}</p>
          )}
          {notifications.map((n: any) => (
            <button
              key={n.id}
              onClick={() => { if (!n.isRead) markRead.mutate({ id: n.id }); if (n.link) setLocation(n.link); }}
              className="w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-accent/50 transition-colors flex gap-2"
            >
              {!n.isRead && <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: GOLD }} />}
              <div className={n.isRead ? "opacity-60" : ""}>
                <div className="text-sm font-medium leading-snug">{n.title}</div>
                {n.body && <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>}
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
