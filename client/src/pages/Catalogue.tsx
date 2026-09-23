import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Clock, Search, Filter, ShoppingCart, ChevronRight, BookOpen, Award } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import PublicNav from "@/components/PublicNav";
import { formatHours } from "@/lib/utils";

export default function Catalogue() {
  const { t,lang } = useI18n();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [domain, setDomain] = useState("");
  const [language, setLanguage] = useState("");

  const TYPE_OPTIONS = [
    { value: "", label: t("catalogue.typeAll") },
    { value: "elearning", label: t("catalogue.typeElearning") },
    { value: "webinar", label: t("catalogue.typeWebinar") },
    { value: "qt", label: t("catalogue.typeQt") },
    { value: "seminar", label: t("catalogue.typeSeminar") },
  ];

  const DOMAIN_OPTIONS = [
    { value: "", label: t("catalogue.domainAll") },
    { value: "b1", label: t("catalogue.domainB1") },
    { value: "b2", label: t("catalogue.domainB2") },
    { value: "b1b2", label: t("catalogue.domainB1b2") },
    { value: "part66", label: t("catalogue.domainPart66") },
    { value: "general", label: t("catalogue.domainGeneral") },
    { value: "management", label: t("catalogue.domainManagement") },
  ];

  const LANG_OPTIONS = [
    { value: "", label: t("catalogue.langAll") },
    { value: "fr", label: t("catalogue.langFr") },
    { value: "en", label: t("catalogue.langEn") },
    { value: "ar", label: t("catalogue.langAr") },
  ];

  const TYPE_LABELS: Record<string, string> = {
    elearning: t("catalogue.typeElearning"), webinar: t("catalogue.typeWebinar"), qt: t("catalogue.typeQt"),
    seminar: t("catalogue.typeSeminar"), event: t("catalogue.typeEvent"),
  };

  const query = trpc.public.trainings.useQuery({ type, domain, language, search });
  const {data:trainings=[],isLoading}=query;
  const utils=trpc.useUtils();
  const { data: categories = [] } = trpc.public.categories.useQuery();
  const addToCart = trpc.cart.add.useMutation({
    onSuccess: async () => {toast.success(t("catalogue.toastAdded"));await utils.cart.invalidate();},
    onError: error => toast.error(t(error.data?.code==="UNAUTHORIZED"?"catalogue.toastLoginRequired":"catalogue.cartError")),
  });

  return (
    <div className="min-h-screen" style={{ background: "oklch(97% 0.01 88)" }}>
      <PublicNav />
      {/* Header */}
      <div style={{ background: "oklch(19% 0.08 252)", paddingTop: "5rem" }}>
        <div className="container py-12">
          <BackButton dark />
          <div className="text-xs font-semibold tracking-widest mb-3" style={{ color: "oklch(68% 0.1 78)" }}>{t("catalogue.eyebrow")}</div>
          <h1 className="font-serif text-4xl font-bold text-white mb-3">{t("catalogue.title")}</h1>
          <p className="text-white/60 max-w-xl">
            {t("catalogue.subtitle")}
          </p>
        </div>
      </div>

      <div className="container py-10">
        {/* Filters */}
        <div className="rounded-xl p-6 mb-8 flex flex-wrap gap-4 items-end" style={{ background: "oklch(100% 0 0)", border: "1px solid oklch(88% 0.015 88)" }}>
          <div className="flex-1 min-w-48">
            <label htmlFor="catalogue-search" className="text-xs font-semibold mb-1.5 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("catalogue.searchLabel")}</label>
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "oklch(62% 0.02 240)" }} />
              <Input id="catalogue-search" maxLength={255}
                placeholder={t("catalogue.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ps-9"
              />
            </div>
          </div>
          <div className="min-w-40">
            <label htmlFor="catalogue-type" className="text-xs font-semibold mb-1.5 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("catalogue.typeLabel")}</label>
            <select id="catalogue-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full h-9 rounded-md border px-3 text-sm"
              style={{ borderColor: "oklch(88% 0.015 88)", background: "oklch(100% 0 0)", color: "oklch(19% 0.08 252)" }}
            >
              {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="min-w-40">
            <label htmlFor="catalogue-domain" className="text-xs font-semibold mb-1.5 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("catalogue.domainLabel")}</label>
            <select id="catalogue-domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="w-full h-9 rounded-md border px-3 text-sm"
              style={{ borderColor: "oklch(88% 0.015 88)", background: "oklch(100% 0 0)", color: "oklch(19% 0.08 252)" }}
            >
              {DOMAIN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="min-w-36">
            <label htmlFor="catalogue-lang" className="text-xs font-semibold mb-1.5 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("catalogue.langLabel")}</label>
            <select id="catalogue-lang"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full h-9 rounded-md border px-3 text-sm"
              style={{ borderColor: "oklch(88% 0.015 88)", background: "oklch(100% 0 0)", color: "oklch(19% 0.08 252)" }}
            >
              {LANG_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <Button
            variant="outline"
            onClick={() => { setSearch(""); setType(""); setDomain(""); setLanguage(""); }}
            className="h-9"
          >
            {t("catalogue.reset")}
          </Button>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-6">
          <div className="text-sm" style={{ color: "oklch(45% 0.02 240)" }}>
            {query.isError ? t("catalogue.unavailable") : isLoading ? t("catalogue.loading") : t("catalogue.resultsCount", { count: trainings.length, plural: trainings.length > 1 ? "s" : "" })}
          </div>
        </div>

        {/* Grid */}
        {addToCart.isError&&<p role="alert" className="text-sm mb-4">{t(addToCart.error.data?.code==="UNAUTHORIZED"?"catalogue.toastLoginRequired":"catalogue.cartError")}</p>}
        {query.isError ? (
          <div role="alert" className="text-center py-12"><p className="mb-3">{t("catalogue.unavailable")}</p><Button variant="outline" disabled={query.isFetching} onClick={()=>void query.refetch()}>{t("quoteThread.retry")}</Button></div>
        ) : isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl h-64 animate-pulse" style={{ background: "oklch(88% 0.015 88)" }} />
            ))}
          </div>
        ) : trainings.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-12 h-12 mx-auto mb-4" style={{ color: "oklch(68% 0.1 78)" }} />
            <div className="font-semibold text-lg mb-2" style={{ color: "oklch(19% 0.08 252)" }}>{t("catalogue.emptyTitle")}</div>
            <div className="text-sm" style={{ color: "oklch(45% 0.02 240)" }}>{t("catalogue.emptyDescription")}</div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trainings.map((training) => (
              <div
                key={training.id}
                className="rounded-xl overflow-hidden card-hover flex flex-col"
                style={{ background: "oklch(100% 0 0)", border: "1px solid oklch(88% 0.015 88)" }}
              >
                <div className="p-5 flex-1">
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: "oklch(19% 0.08 252 / 0.08)", color: "oklch(19% 0.08 252)" }}>
                      {TYPE_LABELS[training.type] ?? training.type}
                    </span>
                    <div className="flex gap-1.5 flex-wrap justify-end">
                      {(training as any).variant && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "oklch(42% 0.1 218 / 0.12)", color: "oklch(42% 0.1 218)" }}>
                          {(training as any).variant === "recurrent" ? t("catalogue.variantRecurrent") : t("catalogue.variantInitial")}
                        </span>
                      )}
                      {training.recurrencyMonths && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "oklch(68% 0.1 78 / 0.12)", color: "oklch(52% 0.09 78)" }}>
                          {t("catalogue.recurrentMonths", { months: training.recurrencyMonths })}
                        </span>
                      )}
                    </div>
                  </div>
                  <h3 className="font-semibold text-base mb-2 leading-snug" style={{ color: "oklch(19% 0.08 252)" }}>
                    {training.title}
                  </h3>
                  <p className="text-sm leading-relaxed line-clamp-3 mb-3" style={{ color: "oklch(45% 0.02 240)" }}>
                    {training.description}
                  </p>
                  {training.part147Reference && (
                    <div className="flex items-center gap-1 text-xs" style={{ color: "oklch(42% 0.1 218)" }}>
                      <Award className="w-3 h-3" />
                      {training.part147Reference}
                    </div>
                  )}
                </div>

                <div className="px-5 py-4 border-t" style={{ borderColor: "oklch(88% 0.015 88)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-xs" style={{ color: "oklch(45% 0.02 240)" }}>
                        <Clock className="w-3 h-3" />
                        {formatHours(training.durationHours, lang)}
                      </div>
                      <div className="text-xs px-2 py-0.5 rounded" style={{ background: "oklch(93% 0.015 88)", color: "oklch(45% 0.02 240)" }}>
                        {training.language?.toUpperCase()}
                      </div>
                    </div>
                    <div className="font-bold text-base" style={{ color: "oklch(19% 0.08 252)" }}>
                      {training.priceTtc ? Number(training.priceTtc).toLocaleString(lang,{style:"currency",currency:"EUR"}) : t("catalogue.onQuote")}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/formation/${training.slug}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        {t("catalogue.details")} <ChevronRight className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                    {training.priceTtc && (
                      <Button
                        size="sm"
                        aria-label={t("trainingDetail.addToCart")}
                        className="btn-press"
                        style={{ background: "oklch(68% 0.1 78)", color: "oklch(19% 0.08 252)" }}
                        onClick={() => addToCart.mutate({ trainingId: training.id })}
                        disabled={addToCart.isPending}
                      >
                        <ShoppingCart className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
