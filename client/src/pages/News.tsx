import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";
import PublicNav from "@/components/PublicNav";
import BackButton from "@/components/BackButton";
import { Newspaper, ArrowRight } from "lucide-react";

const DEEP_BLUE = "oklch(19% 0.08 252)";
const GOLD = "oklch(68% 0.1 78)";
const IVORY = "oklch(97% 0.01 88)";
const MUTED = "oklch(45% 0.02 240)";

export default function News() {
  const { t, lang } = useI18n();
  const { data: articles = [], isLoading } = trpc.public.articles.useQuery();

  return (
    <div className="min-h-screen" style={{ background: IVORY }}>
      <PublicNav />
      <div style={{ background: DEEP_BLUE, paddingTop: "5rem" }}>
        <div className="container py-10">
          <BackButton dark />
          <div className="text-xs font-semibold tracking-widest mb-2" style={{ color: GOLD }}>{t("news.eyebrow")}</div>
          <h1 className="font-serif text-3xl font-bold text-white mb-2">{t("news.title")}</h1>
          <p className="text-white/60 text-sm max-w-2xl">{t("news.subtitle")}</p>
        </div>
      </div>

      <div className="container py-8">
        {isLoading ? (
          <p className="text-sm" style={{ color: MUTED }}>{t("news.loading")}</p>
        ) : articles.length === 0 ? (
          <div className="text-center py-16">
            <Newspaper className="w-10 h-10 mx-auto mb-3" style={{ color: GOLD }} />
            <p className="font-semibold" style={{ color: DEEP_BLUE }}>{t("news.empty")}</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {(articles as any[]).map((a) => (
              <Link key={a.id} href={`/actualites/${a.slug}`}>
                <div className="rounded-xl overflow-hidden cursor-pointer h-full flex flex-col transition-shadow hover:shadow-lg" style={{ background: "white", border: "1px solid oklch(88% 0.015 88)" }}>
                  <div className="h-40 flex items-center justify-center" style={{ background: a.coverImageUrl ? undefined : DEEP_BLUE }}>
                    {a.coverImageUrl ? <img src={a.coverImageUrl} className="w-full h-full object-cover" /> : <Newspaper className="w-10 h-10" style={{ color: GOLD }} />}
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    {a.category && <span className="text-xs font-semibold mb-2" style={{ color: GOLD }}>{a.category.toUpperCase()}</span>}
                    <h3 className="font-serif text-lg font-bold mb-2 leading-snug" style={{ color: DEEP_BLUE }}>{a.title}</h3>
                    {a.excerpt && <p className="text-sm flex-1" style={{ color: MUTED }}>{a.excerpt}</p>}
                    <div className="flex items-center justify-between mt-4 text-xs" style={{ color: "oklch(62% 0.02 240)" }}>
                      <span>{a.publishedAt ? new Date(a.publishedAt).toLocaleDateString(lang) : ""}</span>
                      <span className="inline-flex items-center gap-1 font-medium" style={{ color: DEEP_BLUE }}>{t("news.read")} <ArrowRight className="w-3 h-3" /></span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
