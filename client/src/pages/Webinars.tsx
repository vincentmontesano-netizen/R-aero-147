import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import PublicNav from "@/components/PublicNav";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Users, Video, PlayCircle, Radio } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { getLoginUrl } from "@/const";

const DEEP_BLUE = "oklch(19% 0.08 252)";
const GOLD = "oklch(68% 0.1 78)";
const IVORY = "oklch(97% 0.01 88)";
const MUTED = "oklch(45% 0.02 240)";

const STATUS: Record<string, { labelKey: string; color: string }> = {
  scheduled: { labelKey: "webinars.statusScheduled", color: "oklch(42% 0.1 218)" },
  live: { labelKey: "webinars.statusLive", color: "oklch(55% 0.22 27)" },
  completed: { labelKey: "webinars.statusCompleted", color: "oklch(45% 0.02 240)" },
  cancelled: { labelKey: "webinars.statusCancelled", color: "oklch(62% 0.02 240)" },
};

export default function Webinars() {
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { data: webinars = [], isLoading } = trpc.public.webinars.useQuery();
  const utils = trpc.useUtils();
  const register = trpc.webinars.register.useMutation({
    onSuccess: () => { toast.success(t("webinars.registerSuccess")); utils.public.webinars.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const onRegister = (id: number) => {
    if (!isAuthenticated) { setLocation(getLoginUrl()); return; }
    register.mutate({ webinarId: id });
  };

  return (
    <div className="min-h-screen" style={{ background: IVORY }}>
      <PublicNav />
      <div style={{ background: DEEP_BLUE, paddingTop: "5rem" }}>
        <div className="container py-10">
          <div className="text-xs font-semibold tracking-widest mb-2" style={{ color: GOLD }}>{t("webinars.eyebrow")}</div>
          <h1 className="font-serif text-3xl font-bold text-white mb-2">{t("webinars.heroTitle")}</h1>
          <p className="text-white/60 text-sm max-w-2xl">{t("webinars.heroSubtitle")}</p>
        </div>
      </div>

      <div className="container py-8">
        {isLoading ? (
          <p className="text-sm" style={{ color: MUTED }}>{t("webinars.loading")}</p>
        ) : webinars.length === 0 ? (
          <div className="text-center py-16">
            <Video className="w-10 h-10 mx-auto mb-3" style={{ color: GOLD }} />
            <p className="font-semibold" style={{ color: DEEP_BLUE }}>{t("webinars.emptyTitle")}</p>
            <p className="text-sm mt-1" style={{ color: MUTED }}>{t("webinars.emptySubtitle")}</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {webinars.map((w: any) => {
              const st = STATUS[w.status] ?? STATUS.scheduled;
              const date = new Date(w.scheduledAt);
              const isPast = w.status === "completed";
              return (
                <div key={w.id} className="rounded-xl p-6 flex flex-col" style={{ background: "white", border: "1px solid oklch(88% 0.015 88)" }}>
                  <div className="flex items-center gap-2 mb-3">
                    {w.status === "live" && <Radio className="w-4 h-4" style={{ color: st.color }} />}
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: st.color, background: st.color + " / 0.1" }}>{t(st.labelKey)}</span>
                  </div>
                  <h3 className="font-serif text-lg font-bold mb-2" style={{ color: DEEP_BLUE }}>{w.title}</h3>
                  {w.description && <p className="text-sm mb-4 flex-1" style={{ color: MUTED }}>{w.description}</p>}
                  <div className="space-y-1.5 text-sm mb-4" style={{ color: MUTED }}>
                    <div className="flex items-center gap-2"><Calendar className="w-4 h-4" style={{ color: GOLD }} /> {date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
                    <div className="flex items-center gap-2"><Clock className="w-4 h-4" style={{ color: GOLD }} /> {date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · {w.durationMinutes ?? 60} min</div>
                    {w.instructorName && <div className="flex items-center gap-2"><Users className="w-4 h-4" style={{ color: GOLD }} /> {w.instructorName}</div>}
                  </div>
                  {w.status === "live" ? (
                    <Button onClick={() => setLocation(`/live/webinar/${w.id}`)} className="w-full" style={{ background: "oklch(55% 0.22 27)", color: "white" }}>
                      <Radio className="w-4 h-4 mr-2" /> {t("webinars.joinLive")}
                    </Button>
                  ) : isPast && w.hasReplay ? (
                    <Button onClick={() => setLocation(`/live/webinar/${w.id}`)} variant="outline" className="w-full"><PlayCircle className="w-4 h-4 mr-2" /> {t("webinars.watchReplay")}</Button>
                  ) : isPast ? (
                    <Button disabled variant="outline" className="w-full">{t("webinars.sessionEnded")}</Button>
                  ) : (
                    <Button onClick={() => onRegister(w.id)} disabled={register.isPending} className="w-full" style={{ background: DEEP_BLUE, color: IVORY }}>
                      {t("webinars.register")}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
