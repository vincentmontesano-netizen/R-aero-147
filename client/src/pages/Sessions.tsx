import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";
import { useAuth } from "@/_core/hooks/useAuth";
import PublicNav from "@/components/PublicNav";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Users, Monitor, Video, Building2, BadgeCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

const DEEP_BLUE = "oklch(19% 0.08 252)";
const GOLD = "oklch(68% 0.1 78)";
const IVORY = "oklch(97% 0.01 88)";
const MUTED = "oklch(45% 0.02 240)";

const FORMAT = {
  in_person: { labelKey: "sessions.formatInPerson", icon: Building2, color: "oklch(42% 0.1 218)" },
  virtual: { labelKey: "sessions.formatVirtual", icon: Monitor, color: "oklch(52% 0.12 290)" },
  webinar: { labelKey: "sessions.formatWebinar", icon: Video, color: "oklch(55% 0.18 145)" },
} as const;

export default function Sessions() {
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<string>("all");
  const { data: sessions = [], isLoading } = trpc.public.sessions.useQuery();

  const register = trpc.sessions.register.useMutation({
    onSuccess: (r: any) => { r?.success ? toast.success(r.message ?? t("sessions.registrationConfirmed")) : toast.error(r?.message ?? t("sessions.error")); utils.public.sessions.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const onRegister = (id: number) => { if (!isAuthenticated) { setLocation("/login"); return; } register.mutate({ sessionId: id }); };

  const filtered = (sessions as any[]).filter((s) => filter === "all" || s.format === filter);
  const groups: Record<string, any[]> = {};
  for (const s of filtered) {
    const key = new Date(s.startDate).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    (groups[key] ??= []).push(s);
  }

  return (
    <div className="min-h-screen" style={{ background: IVORY }}>
      <PublicNav />
      <div style={{ background: DEEP_BLUE, paddingTop: "5rem" }}>
        <div className="container py-10">
          <BackButton dark />
          <div className="text-xs font-semibold tracking-widest mb-2" style={{ color: GOLD }}>{t("sessions.eyebrow")}</div>
          <h1 className="font-serif text-3xl font-bold text-white mb-2">{t("sessions.heroTitle")}</h1>
          <p className="text-white/60 text-sm max-w-2xl">{t("sessions.heroSubtitle")}</p>
        </div>
      </div>

      <div className="container py-8">
        {/* Filters */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {[["all", t("sessions.filterAll")], ["in_person", t("sessions.formatInPerson")], ["virtual", t("sessions.formatVirtual")], ["webinar", t("sessions.formatWebinar")]].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
              style={{ background: filter === v ? DEEP_BLUE : "white", color: filter === v ? IVORY : MUTED, border: "1px solid oklch(88% 0.015 88)" }}>
              {l}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-sm" style={{ color: MUTED }}>{t("sessions.loading")}</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="w-10 h-10 mx-auto mb-3" style={{ color: GOLD }} />
            <p className="font-semibold" style={{ color: DEEP_BLUE }}>{t("sessions.emptyTitle")}</p>
            <p className="text-sm mt-1" style={{ color: MUTED }}>{t("sessions.emptySubtitle")}</p>
          </div>
        ) : (
          Object.entries(groups).map(([month, items]) => (
            <div key={month} className="mb-8">
              <h2 className="font-serif text-lg font-bold mb-3 capitalize" style={{ color: DEEP_BLUE }}>{month}</h2>
              <div className="space-y-3">
                {items.map((s) => {
                  const fmt = (FORMAT as any)[s.format] ?? FORMAT.in_person;
                  const Icon = fmt.icon;
                  const full = (s.seatsTaken ?? 0) >= (s.seats ?? 0) || s.status === "full";
                  const start = new Date(s.startDate);
                  return (
                    <div key={s.id} className="rounded-xl p-5 flex flex-col md:flex-row md:items-center gap-4" style={{ background: "white", border: "1px solid oklch(88% 0.015 88)" }}>
                      <div className="text-center shrink-0 w-16">
                        <div className="font-serif text-2xl font-bold" style={{ color: DEEP_BLUE }}>{start.getDate()}</div>
                        <div className="text-xs uppercase" style={{ color: MUTED }}>{start.toLocaleDateString("fr-FR", { month: "short" })}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ color: fmt.color, background: fmt.color + " / 0.1" }}>
                            <Icon className="w-3 h-3" /> {t(fmt.labelKey)}
                          </span>
                          {s.cpfEligible && <span className="text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ color: "oklch(45% 0.15 145)", background: "oklch(55% 0.18 145 / 0.1)" }}><BadgeCheck className="w-3 h-3" /> CPF</span>}
                        </div>
                        <h3 className="font-semibold" style={{ color: DEEP_BLUE }}>{s.title}</h3>
                        <div className="flex items-center gap-4 mt-1 text-xs flex-wrap" style={{ color: MUTED }}>
                          {s.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {s.location}</span>}
                          {s.durationDays && <span>{t("sessions.durationDays", { count: Number(s.durationDays) })}</span>}
                          <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {t("sessions.seats", { taken: s.seatsTaken, total: s.seats })}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-serif text-lg font-bold mb-1" style={{ color: DEEP_BLUE }}>
                          {Number(s.priceHt) > 0 ? t("sessions.priceExclTax", { price: Number(s.priceHt).toFixed(0) }) : t("sessions.free")}
                        </div>
                        <Button size="sm" disabled={full || register.isPending} onClick={() => onRegister(s.id)} style={{ background: full ? "oklch(80% 0.02 240)" : GOLD, color: DEEP_BLUE }}>
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
