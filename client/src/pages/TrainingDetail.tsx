import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  Clock, Award, Users, BookOpen, CheckCircle, ShoppingCart,
  FileText, Globe, BarChart2, ChevronLeft, ArrowRight
} from "lucide-react";
import { toast } from "sonner";

export default function TrainingDetail() {
  const { t } = useI18n();
  const { slug } = useParams<{ slug: string }>();
  const { isAuthenticated } = useAuth();
  const { data: training, isLoading } = trpc.public.trainingBySlug.useQuery({ slug: slug ?? "" });

  const TYPE_LABELS: Record<string, string> = {
    elearning: t("trainingDetail.typeElearning"), webinar: t("trainingDetail.typeWebinar"), qt: t("trainingDetail.typeQt"),
    seminar: t("trainingDetail.typeSeminar"), event: t("trainingDetail.typeEvent"),
  };
  const DOMAIN_LABELS: Record<string, string> = {
    b1: t("trainingDetail.domainB1"), b2: t("trainingDetail.domainB2"), b1b2: t("trainingDetail.domainB1b2"),
    part66: t("trainingDetail.domainPart66"), general: t("trainingDetail.domainGeneral"), management: t("trainingDetail.domainManagement"),
  };
  const LEVEL_LABELS: Record<string, string> = {
    beginner: t("trainingDetail.levelBeginner"), intermediate: t("trainingDetail.levelIntermediate"), advanced: t("trainingDetail.levelAdvanced"),
  };

  const addToCart = trpc.cart.add.useMutation({
    onSuccess: () => toast.success(t("trainingDetail.toastAddedToCart")),
    onError: () => toast.error(t("trainingDetail.toastLoginRequired")),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(97% 0.01 88)" }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "oklch(68% 0.1 78)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!training) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(97% 0.01 88)" }}>
        <div className="text-center">
          <BookOpen className="w-12 h-12 mx-auto mb-4" style={{ color: "oklch(68% 0.1 78)" }} />
          <h2 className="font-serif text-2xl font-bold mb-2" style={{ color: "oklch(19% 0.08 252)" }}>{t("trainingDetail.notFoundTitle")}</h2>
          <Link href="/catalogue"><Button variant="outline">{t("trainingDetail.backToCatalogue")}</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "oklch(97% 0.01 88)" }}>
      {/* Header */}
      <div style={{ background: "oklch(19% 0.08 252)", paddingTop: "5rem" }}>
        <div className="container py-10">
          <Link href="/catalogue">
            <button className="flex items-center gap-1 text-sm text-white/60 hover:text-white mb-4 transition-colors">
              <ChevronLeft className="w-4 h-4" /> {t("trainingDetail.backToCatalogue")}
            </button>
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: "oklch(68% 0.1 78 / 0.15)", color: "oklch(82% 0.08 78)" }}>
                  {TYPE_LABELS[training.type] ?? training.type}
                </span>
                {training.recurrencyMonths && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: "oklch(55% 0.18 145 / 0.15)", color: "oklch(72% 0.15 145)" }}>
                    {t("trainingDetail.recurrentEvery", { months: training.recurrencyMonths })}
                  </span>
                )}
              </div>
              <h1 className="font-serif text-3xl font-bold text-white mb-3">{training.title}</h1>
              {training.part147Reference && (
                <div className="flex items-center gap-1 text-sm" style={{ color: "oklch(68% 0.1 78)" }}>
                  <Award className="w-4 h-4" />
                  {t("trainingDetail.reference", { ref: training.part147Reference })}
                </div>
              )}
            </div>
            {/* Price card */}
            <div className="rounded-xl p-6 min-w-64" style={{ background: "oklch(97% 0.01 88 / 0.07)", border: "1px solid oklch(97% 0.01 88 / 0.15)" }}>
              <div className="font-serif text-3xl font-bold text-white mb-1">
                {training.priceTtc ? `${Number(training.priceTtc).toFixed(0)} €` : t("trainingDetail.onQuote")}
              </div>
              {training.priceHt && (
                <div className="text-xs text-white/50 mb-4">{t("trainingDetail.priceHtVat", { amount: Number(training.priceHt).toFixed(2) })}</div>
              )}
              {training.priceTtc ? (
                <Button
                  size="lg"
                  className="w-full btn-press font-semibold mb-2"
                  style={{ background: "oklch(68% 0.1 78)", color: "oklch(19% 0.08 252)" }}
                  onClick={() => addToCart.mutate({ trainingId: training.id })}
                  disabled={addToCart.isPending}
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  {t("trainingDetail.addToCart")}
                </Button>
              ) : (
                <Link href="/devis">
                  <Button size="lg" className="w-full btn-press font-semibold mb-2" style={{ background: "oklch(68% 0.1 78)", color: "oklch(19% 0.08 252)" }}>
                    {t("trainingDetail.requestQuote")} <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              )}
              {training.priceEnterprise && (
                <div className="text-xs text-center text-white/50">
                  {t("trainingDetail.enterprisePrice", { amount: Number(training.priceEnterprise).toFixed(0) })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container py-10">
        <div className="grid lg:grid-cols-3 gap-10">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            {training.description && (
              <div className="rounded-xl p-6" style={{ background: "oklch(100% 0 0)", border: "1px solid oklch(88% 0.015 88)" }}>
                <h2 className="font-semibold text-lg mb-3" style={{ color: "oklch(19% 0.08 252)" }}>{t("trainingDetail.descriptionTitle")}</h2>
                <p className="text-sm leading-relaxed" style={{ color: "oklch(45% 0.02 240)" }}>{training.description}</p>
              </div>
            )}

            {/* Objectives */}
            {training.objectives && (
              <div className="rounded-xl p-6" style={{ background: "oklch(100% 0 0)", border: "1px solid oklch(88% 0.015 88)" }}>
                <h2 className="font-semibold text-lg mb-3" style={{ color: "oklch(19% 0.08 252)" }}>{t("trainingDetail.objectivesTitle")}</h2>
                <p className="text-sm leading-relaxed" style={{ color: "oklch(45% 0.02 240)" }}>{training.objectives}</p>
              </div>
            )}

            {/* Prerequisites */}
            {training.prerequisites && (
              <div className="rounded-xl p-6" style={{ background: "oklch(100% 0 0)", border: "1px solid oklch(88% 0.015 88)" }}>
                <h2 className="font-semibold text-lg mb-3" style={{ color: "oklch(19% 0.08 252)" }}>{t("trainingDetail.prerequisitesTitle")}</h2>
                <p className="text-sm leading-relaxed" style={{ color: "oklch(45% 0.02 240)" }}>{training.prerequisites}</p>
              </div>
            )}

            {/* Target audience */}
            {training.targetAudience && (
              <div className="rounded-xl p-6" style={{ background: "oklch(100% 0 0)", border: "1px solid oklch(88% 0.015 88)" }}>
                <h2 className="font-semibold text-lg mb-3" style={{ color: "oklch(19% 0.08 252)" }}>{t("trainingDetail.targetAudienceTitle")}</h2>
                <p className="text-sm leading-relaxed" style={{ color: "oklch(45% 0.02 240)" }}>{training.targetAudience}</p>
              </div>
            )}

            {/* Evaluation */}
            <div className="rounded-xl p-6" style={{ background: "oklch(100% 0 0)", border: "1px solid oklch(88% 0.015 88)" }}>
              <h2 className="font-semibold text-lg mb-4" style={{ color: "oklch(19% 0.08 252)" }}>{t("trainingDetail.evaluationTitle")}</h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: t("trainingDetail.passingScoreLabel"), value: `${training.passingScore ?? 75}%` },
                  { label: t("trainingDetail.maxAttemptsLabel"), value: t("trainingDetail.attemptsValue", { count: training.maxAttempts ?? 3 }) },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" style={{ color: "oklch(68% 0.1 78)" }} />
                    <div>
                      <div className="text-xs" style={{ color: "oklch(62% 0.02 240)" }}>{item.label}</div>
                      <div className="font-semibold text-sm" style={{ color: "oklch(19% 0.08 252)" }}>{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Details */}
            <div className="rounded-xl p-6" style={{ background: "oklch(100% 0 0)", border: "1px solid oklch(88% 0.015 88)" }}>
              <h3 className="font-semibold mb-4" style={{ color: "oklch(19% 0.08 252)" }}>{t("trainingDetail.infoTitle")}</h3>
              <div className="space-y-3">
                {[
                  { icon: Clock, label: t("trainingDetail.durationLabel"), value: training.durationHours ? `${training.durationHours}h` : "—" },
                  { icon: Globe, label: t("trainingDetail.languageLabel"), value: training.language === "fr" ? t("trainingDetail.languageFr") : t("trainingDetail.languageEn") },
                  { icon: BarChart2, label: t("trainingDetail.levelLabel"), value: LEVEL_LABELS[training.level ?? "intermediate"] ?? "—" },
                  { icon: Users, label: t("trainingDetail.domainLabel"), value: DOMAIN_LABELS[training.domain ?? "general"] ?? "—" },
                  { icon: FileText, label: t("trainingDetail.typeLabel"), value: TYPE_LABELS[training.type] ?? training.type },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "oklch(68% 0.1 78 / 0.1)" }}>
                      <item.icon className="w-4 h-4" style={{ color: "oklch(68% 0.1 78)" }} />
                    </div>
                    <div>
                      <div className="text-xs" style={{ color: "oklch(62% 0.02 240)" }}>{item.label}</div>
                      <div className="font-medium text-sm" style={{ color: "oklch(19% 0.08 252)" }}>{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Certificate */}
            <div className="rounded-xl p-5" style={{ background: "oklch(68% 0.1 78 / 0.08)", border: "1px solid oklch(68% 0.1 78 / 0.2)" }}>
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-5 h-5" style={{ color: "oklch(68% 0.1 78)" }} />
                <span className="font-semibold text-sm" style={{ color: "oklch(19% 0.08 252)" }}>{t("trainingDetail.certificateIncluded")}</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "oklch(45% 0.02 240)" }}>
                {t("trainingDetail.certificateDescription")}
              </p>
            </div>

            {/* Enterprise quote */}
            <div className="rounded-xl p-5" style={{ background: "oklch(19% 0.08 252)" }}>
              <h3 className="font-semibold text-white text-sm mb-2">{t("trainingDetail.teamNeedTitle")}</h3>
              <p className="text-xs text-white/60 mb-3">{t("trainingDetail.teamNeedDescription")}</p>
              <Link href="/devis">
                <Button size="sm" className="w-full" style={{ background: "oklch(68% 0.1 78)", color: "oklch(19% 0.08 252)" }}>
                  {t("trainingDetail.requestQuote")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
