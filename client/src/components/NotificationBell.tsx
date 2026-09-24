import {Button} from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Bell, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocation } from "wouter";
import { useI18n } from "@/i18n";

const GOLD = "var(--link)";
const RED = "var(--destructive)";

/** Bell with unread badge + dropdown list of in-app notifications. */
export default function NotificationBell({ dark = false }: { dark?: boolean }) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const listQuery = trpc.notifications.list.useQuery(undefined, { refetchInterval: 60000 });
  const notifications = listQuery.data ?? [];
  const countQuery = trpc.notifications.unreadCount.useQuery(undefined, { refetchInterval: 60000 });
  const unread = countQuery.data ?? 0;
  const failed = listQuery.isError || countQuery.isError;
  const [, setLocation] = useLocation();

  const invalidate = () => Promise.all([utils.notifications.list.invalidate(),utils.notifications.unreadCount.invalidate()]);
  const refresh = () => { void listQuery.refetch(); void countQuery.refetch(); };
  const markRead = trpc.notifications.markRead.useMutation({ onSuccess: invalidate });
  const markAll = trpc.notifications.markAllRead.useMutation({ onSuccess: invalidate });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative h-9 w-9 flex items-center justify-center rounded-lg transition-colors"
          style={dark ? { color: "var(--foreground)", border: "1px solid color-mix(in srgb, var(--foreground) 20%, transparent)" } : { color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
          aria-label={t(failed ? "notificationBell.unavailableLabel" : "notificationBell.ariaLabel")}
        >
          <Bell className="w-4 h-4" />
          {failed&&<span aria-hidden="true" className="absolute -top-1 -right-1 rounded-full bg-warning/10 text-foreground text-xs px-1">!</span>}
          {!failed && unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full text-xs font-bold flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--destructive) 16%, transparent)", color: "var(--foreground)" }}>
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-2.5 border-b">
          <span className="font-semibold text-sm">{t("notificationBell.title")}</span>
          {!failed && unread > 0 && (
            <button disabled={markAll.isPending || markRead.isPending || listQuery.isFetching || countQuery.isFetching} onClick={() => markAll.mutate()} className="text-sm flex items-center gap-1 text-muted-foreground hover:text-foreground">
              <Check className="w-3 h-3" /> {t("notificationBell.markAllRead")}
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {listQuery.isLoading&&<p role="status" className="p-4 text-sm">{t('common.loading')}</p>}
          {failed&&<div role="alert" className="p-4 space-y-2 text-sm"><p>{t('notificationBell.loadError')}</p><Button size="sm" variant="outline" disabled={listQuery.isFetching||countQuery.isFetching} onClick={refresh}>{t('learningPlayer.save.retry')}</Button></div>}
          {(markRead.isError||markAll.isError)&&<div role="alert" className="p-4 space-y-2 text-sm"><p>{t('notificationBell.markError')}</p><Button size="sm" variant="outline" disabled={listQuery.isFetching||countQuery.isFetching} onClick={refresh}>{t('learningPlayer.save.retry')}</Button></div>}
          {!listQuery.isLoading && !listQuery.isError && notifications.length === 0 && (
            <p className="px-4 py-8 text-sm text-center text-muted-foreground">{t("notificationBell.empty")}</p>
          )}
          {!listQuery.isError && notifications.map((n) => (
            <button
              key={n.id}
              disabled={markRead.isPending||markAll.isPending}
              onClick={() => { if (!n.isRead) markRead.mutate({ id: n.id }); if (n.link) setLocation(n.link); }}
              className="w-full text-start px-4 py-3 border-b last:border-b-0 hover:bg-accent/50 transition-colors flex gap-2"
            >
              {!n.isRead && <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: "var(--primary)" }} />}
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
