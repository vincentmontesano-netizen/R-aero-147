import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";
import { useAuth } from "@/_core/hooks/useAuth";
import PublicNav from "@/components/PublicNav";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Users, Monitor, Video, Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

const DEEP_BLUE = "var(--foreground)";
const GOLD = "var(--link)";
const IVORY = "var(--foreground)";
const MUTED = "var(--muted-foreground)";

const FORMAT = {
  in_person: { labelKey: "sessions.formatInPerson", icon: Building2, color: "var(--info)" },
  virtual: { labelKey: "sessions.formatVirtual", icon: Monitor, color: "var(--chart-4)" },
  webinar: { labelKey: "sessions.formatWebinar", icon: Video, color: "var(--success)" },
} as const;

export default function Sessions() {
  const { t, lang } = useI18n();
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<string>("all");
  const { data: sessions = [], isLoading } = trpc.public.sessions.useQuery();

  const mine = trpc.sessions.mine.useQuery(undefined, { enabled: isAuthenticated });
  const cancel = trpc.sessions.cancel.useMutation({
    onSuccess: () => { toast.success(t("sessions.cancelledReservation")); utils.sessions.mine.invalidate(); utils.public.sessions.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const register = trpc.sessions.register.useMutation({
    onSuccess: (r: any) => { r?.success ? toast.success(r.message ?? t("sessions.registrationConfirmed")) : toast.error(r?.message ?? t("sessions.error")); utils.public.sessions.invalidate(); utils.sessions.mine.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const onRegister = (id: number) => { if (!isAuthenticated) { setLocation(getLoginUrl()); return; } register.mutate({ sessionId: id }); };

  const filtered = (sessions as any[]).filter((s) => filter === "all" || s.format === filter);
  const groups: Record<string, any[]> = {};
  for (const s of filtered) {
    const key = new Date(s.startDate).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    (groups[key] ??= []).push(s);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <PublicNav />
      <div style={{ background: "var(--surface-strong)", paddingTop: "5rem" }}>
        <div className="container py-10">
          <BackButton dark />
          <div className="text-xs font-semibold tracking-widest mb-2" style={{ color: "var(--link)" }}>{t("sessions.eyebrow")}</div>
          <h1 className="font-sans text-3xl font-bold text-foreground mb-2">{t("sessions.heroTitle")}</h1>
          <p className="text-muted-foreground text-sm max-w-2xl">{t("sessions.heroSubtitle")}</p>
        </div>
      </div>

      <div className="container py-8">
        {isAuthenticated && <section className="mb-8">
          <h2 className="font-sans text-xl mb-3">{t("sessions.myReservations")}</h2>
          {mine.isError && <p role="alert">{mine.error.message}</p>}
          {mine.data?.length === 0 && <p className="text-sm mb-3">{t("sessions.noReservations")}</p>}
          <div className="space-y-2">{mine.data?.map(s => <div key={s.registrationId} className="bg-card border rounded-lg p-4 flex gap-3 justify-between items-center">
            <div><p className="font-medium">{s.title}</p><p className="text-xs">{new Date(s.startDate).toLocaleString(lang)} · {s.status === "cancelled" ? t("sessions.cancelledClass") : t(`sessions.reservation.${s.registrationStatus}`)}</p></div>
            {s.status !== "cancelled" && s.registrationStatus === "registered" && new Date(s.startDate).getTime() > Date.now() && <Button size="sm" variant="outline" disabled={cancel.isPending} onClick={() => { if (window.confirm(t("sessions.cancelConfirm"))) cancel.mutate({ sessionId: s.id }); }}>{t("sessions.cancelReservation")}</Button>}
          </div>)}</div>
        </section>}
        {/* Filters */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {[["all", t("sessions.filterAll")], ["in_person", t("sessions.formatInPerson")], ["virtual", t("sessions.formatVirtual")], ["webinar", t("sessions.formatWebinar")]].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
              style={{ background: filter === v ? "var(--primary)" : "var(--card)", color: filter === v ? "var(--primary-foreground)" : "var(--muted-foreground)", border: "1px solid var(--border)" }}>
              {l}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("sessions.loading")}</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--link)" }} />
            <p className="font-semibold" style={{ color: "var(--foreground)" }}>{t("sessions.emptyTitle")}</p>
            <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>{t("sessions.emptySubtitle")}</p>
          </div>
        ) : (
          Object.entries(groups).map(([month, items]) => (
            <div key={month} className="mb-8">
              <h2 className="font-sans text-lg font-bold mb-3 capitalize" style={{ color: "var(--foreground)" }}>{month}</h2>
              <div className="space-y-3">
                {items.map((s) => {
                  const fmt = (FORMAT as any)[s.format] ?? FORMAT.in_person;
                  const Icon = fmt.icon;
                  const full = (s.seatsTaken ?? 0) >= (s.seats ?? 0) || s.status === "full";
                  const start = new Date(s.startDate);
                  return (
                    <div key={s.id} className="rounded-xl p-5 flex flex-col md:flex-row md:items-center gap-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                      <div className="text-center shrink-0 w-16">
                        <div className="font-sans text-2xl font-bold" style={{ color: "var(--foreground)" }}>{start.getDate()}</div>
                        <div className="text-xs uppercase" style={{ color: "var(--muted-foreground)" }}>{start.toLocaleDateString("fr-FR", { month: "short" })}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ color: fmt.color, background: fmt.color + " / 0.1" }}>
                            <Icon className="w-3 h-3" /> {t(fmt.labelKey)}
                          </span>
                        </div>
                        <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>{s.title}</h3>
                        <div className="flex items-center gap-4 mt-1 text-xs flex-wrap" style={{ color: "var(--muted-foreground)" }}>
                          {s.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {s.location}</span>}
                          {s.durationDays && <span>{t("sessions.durationDays", { count: Number(s.durationDays) })}</span>}
                          <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {t("sessions.seats", { taken: s.seatsTaken, total: s.seats })}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-sans text-lg font-bold mb-1" style={{ color: "var(--foreground)" }}>
                          {Number(s.priceHt) > 0 ? t("sessions.priceExclTax", { price: Number(s.priceHt).toFixed(0) }) : t("sessions.free")}
                        </div>
                        <Button size="sm" disabled={full || register.isPending} onClick={() => onRegister(s.id)} style={{ background: full ? "var(--muted)" : "var(--primary)", color: full ? "var(--muted-foreground)" : "var(--primary-foreground)" }}>
                          {register.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : full ? t("sessions.full") : t("sessions.register")}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
