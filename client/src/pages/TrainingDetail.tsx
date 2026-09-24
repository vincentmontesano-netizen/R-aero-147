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
import PublicNav from "@/components/PublicNav";
import { formatHours } from "@/lib/utils";

export default function TrainingDetail() {
  const { t,lang } = useI18n();
  const { slug } = useParams<{ slug: string }>();
  const { isAuthenticated } = useAuth();
  const query = trpc.public.trainingBySlug.useQuery({ slug: slug ?? "" });
  const {data:training,isLoading}=query;
  const utils=trpc.useUtils();

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
    onSuccess: async () => {toast.success(t("trainingDetail.toastAddedToCart"));await utils.cart.invalidate();},
    onError: error => toast.error(t(error.data?.code==="UNAUTHORIZED"?"trainingDetail.toastLoginRequired":"catalogue.cartError")),
  });

  if(query.isError)return <div className="container py-24 text-center"><p role="alert" className="mb-4">{t("trainingDetail.unavailable")}</p><Button variant="outline" disabled={query.isFetching} onClick={()=>void query.refetch()}>{t("quoteThread.retry")}</Button><Link href="/catalogue" className="block mt-4 underline">{t("trainingDetail.backToCatalogue")}</Link></div>;
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--link)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!training) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="text-center">
          <BookOpen className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--link)" }} />
          <h2 className="font-sans text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>{t("trainingDetail.notFoundTitle")}</h2>
          <Link href="/catalogue"><Button variant="outline">{t("trainingDetail.backToCatalogue")}</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <PublicNav />
      {/* Header */}
      <div style={{ background: "var(--surface-strong)", paddingTop: "5rem" }}>
        <div className="container py-10">
          <Link href="/catalogue">
            <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-white mb-4 transition-colors">
              <ChevronLeft className="w-4 h-4" /> {t("trainingDetail.backToCatalogue")}
            </button>
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: "color-mix(in srgb, var(--link) 15%, transparent)", color: "var(--link)" }}>
                  {TYPE_LABELS[training.type] ?? training.type}
                </span>
                {training.recurrencyMonths && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: "color-mix(in srgb, var(--success) 15%, transparent)", color: "var(--success)" }}>
                    {t("trainingDetail.recurrentEvery", { months: training.recurrencyMonths })}
                  </span>
                )}
              </div>
              <h1 className="font-sans text-3xl font-bold text-white mb-3">{training.title}</h1>
              {training.part147Reference && (
                <div className="flex items-center gap-1 text-sm" style={{ color: "var(--link)" }}>
                  <Award className="w-4 h-4" />
                  {t("trainingDetail.reference", { ref: training.part147Reference })}
                </div>
              )}
            </div>
            {/* Price card */}
            <div className="rounded-xl p-6 min-w-64" style={{ background: "color-mix(in srgb, var(--foreground) 7%, transparent)", border: "1px solid color-mix(in srgb, var(--foreground) 15%, transparent)" }}>
              <div className="font-sans text-3xl font-bold text-white mb-1">
                {training.priceTtc ? Number(training.priceTtc).toLocaleString(lang,{style:"currency",currency:"EUR"}) : t("trainingDetail.onQuote")}
              </div>
              {training.priceHt && (
                <div className="text-xs text-muted-foreground mb-4">{t("trainingDetail.priceHtVat", { amount: Number(training.priceHt).toLocaleString(lang,{minimumFractionDigits:2,maximumFractionDigits:2}) })}</div>
              )}
              {addToCart.isError&&<p role="alert" className="text-sm text-white mb-3">{t(addToCart.error.data?.code==="UNAUTHORIZED"?"trainingDetail.toastLoginRequired":"catalogue.cartError")}</p>}
              {training.priceTtc ? (
                <Button
                  size="lg"
                  className="w-full btn-press font-semibold mb-2"
                  style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                  onClick={() => addToCart.mutate({ trainingId: training.id })}
                  disabled={addToCart.isPending}
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  {t("trainingDetail.addToCart")}
                </Button>
              ) : (
                <Link href="/devis">
                  <Button size="lg" className="w-full btn-press font-semibold mb-2" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                    {t("trainingDetail.requestQuote")} <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              )}
              {training.priceEnterprise && (
                <div className="text-xs text-center text-muted-foreground">
                  {t("trainingDetail.enterprisePrice", { amount: Number(training.priceEnterprise).toLocaleString(lang,{minimumFractionDigits:2,maximumFractionDigits:2}) })}
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
              <div className="rounded-xl p-6" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <h2 className="font-semibold text-lg mb-3" style={{ color: "var(--foreground)" }}>{t("trainingDetail.descriptionTitle")}</h2>
                <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--muted-foreground)" }}>{training.description}</p>
              </div>
            )}

            {/* Objectives */}
            {training.objectives && (
              <div className="rounded-xl p-6" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <h2 className="font-semibold text-lg mb-3" style={{ color: "var(--foreground)" }}>{t("trainingDetail.objectivesTitle")}</h2>
                <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--muted-foreground)" }}>{training.objectives}</p>
              </div>
            )}

            {/* Prerequisites */}
            {training.prerequisites && (
              <div className="rounded-xl p-6" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <h2 className="font-semibold text-lg mb-3" style={{ color: "var(--foreground)" }}>{t("trainingDetail.prerequisitesTitle")}</h2>
                <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--muted-foreground)" }}>{training.prerequisites}</p>
              </div>
            )}

            {/* Target audience */}
            {training.targetAudience && (
              <div className="rounded-xl p-6" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <h2 className="font-semibold text-lg mb-3" style={{ color: "var(--foreground)" }}>{t("trainingDetail.targetAudienceTitle")}</h2>
                <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--muted-foreground)" }}>{training.targetAudience}</p>
              </div>
            )}

            {/* Evaluation */}
            <div className="rounded-xl p-6" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <h2 className="font-semibold text-lg mb-4" style={{ color: "var(--foreground)" }}>{t("trainingDetail.evaluationTitle")}</h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: t("trainingDetail.passingScoreLabel"), value: `${training.passingScore ?? 75}%` },
                  { label: t("trainingDetail.maxAttemptsLabel"), value: t("trainingDetail.attemptsValue", { count: training.maxAttempts ?? 3 }) },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" style={{ color: "var(--link)" }} />
                    <div>
                      <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{item.label}</div>
                      <div className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Details */}
            <div className="rounded-xl p-6" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <h3 className="font-semibold mb-4" style={{ color: "var(--foreground)" }}>{t("trainingDetail.infoTitle")}</h3>
              <div className="space-y-3">
                {[
                  { icon: Clock, label: t("trainingDetail.durationLabel"), value: training.durationHours ? formatHours(training.durationHours, lang) : "—" },
                  { icon: Globe, label: t("trainingDetail.languageLabel"), value: training.language === "fr" ? t("trainingDetail.languageFr") : training.language === "en" ? t("trainingDetail.languageEn") : training.language === "ar" ? t("catalogue.langAr") : training.language || t("trainingDetail.unspecified") },
                  { icon: BarChart2, label: t("trainingDetail.levelLabel"), value: training.level ? LEVEL_LABELS[training.level] ?? training.level : t("trainingDetail.unspecified") },
                  { icon: Users, label: t("trainingDetail.domainLabel"), value: training.domain ? DOMAIN_LABELS[training.domain] ?? training.domain : t("trainingDetail.unspecified") },
                  { icon: FileText, label: t("trainingDetail.typeLabel"), value: TYPE_LABELS[training.type] ?? training.type },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "color-mix(in srgb, var(--link) 10%, transparent)" }}>
                      <item.icon className="w-4 h-4" style={{ color: "var(--link)" }} />
                    </div>
                    <div>
                      <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{item.label}</div>
                      <div className="font-medium text-sm" style={{ color: "var(--foreground)" }}>{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Certificate */}
            <div className="rounded-xl p-5" style={{ background: "color-mix(in srgb, var(--link) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--link) 20%, transparent)" }}>
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-5 h-5" style={{ color: "var(--link)" }} />
                <span className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{t("trainingDetail.certificateIncluded")}</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                {t("trainingDetail.certificateDescription")}
              </p>
            </div>

            {/* Enterprise quote */}
            <div className="rounded-xl p-5" style={{ background: "var(--surface-strong)" }}>
              <h3 className="font-semibold text-white text-sm mb-2">{t("trainingDetail.teamNeedTitle")}</h3>
              <p className="text-xs text-muted-foreground mb-3">{t("trainingDetail.teamNeedDescription")}</p>
              <Link href="/devis">
                <Button size="sm" className="w-full" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
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
