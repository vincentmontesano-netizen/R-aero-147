import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";
import PublicNav from "@/components/PublicNav";
import BackButton from "@/components/BackButton";
import { Newspaper, ArrowRight } from "lucide-react";

const DEEP_BLUE = "var(--foreground)";
const GOLD = "var(--link)";
const IVORY = "var(--foreground)";
const MUTED = "var(--muted-foreground)";

export default function News() {
  const { t, lang } = useI18n();
  const { data: articles = [], isLoading } = trpc.public.articles.useQuery();

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <PublicNav />
      <div style={{ background: "var(--surface-strong)", paddingTop: "5rem" }}>
        <div className="container py-10">
          <BackButton dark />
          <div className="text-xs font-semibold tracking-widest mb-2" style={{ color: "var(--link)" }}>{t("news.eyebrow")}</div>
          <h1 className="font-sans text-3xl font-bold text-foreground mb-2">{t("news.title")}</h1>
          <p className="text-muted-foreground text-sm max-w-2xl">{t("news.subtitle")}</p>
        </div>
      </div>

      <div className="container py-8">
        {isLoading ? (
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("news.loading")}</p>
        ) : articles.length === 0 ? (
          <div className="text-center py-16">
            <Newspaper className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--link)" }} />
            <p className="font-semibold" style={{ color: "var(--foreground)" }}>{t("news.empty")}</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {(articles as any[]).map((a) => (
              <Link key={a.id} href={`/actualites/${a.slug}`}>
                <div className="rounded-xl overflow-hidden cursor-pointer h-full flex flex-col transition-shadow hover:shadow-lg" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="h-40 flex items-center justify-center" style={{ background: a.coverImageUrl ? undefined : "var(--surface-strong)" }}>
                    {a.coverImageUrl ? <img src={a.coverImageUrl} className="w-full h-full object-cover" /> : <Newspaper className="w-10 h-10" style={{ color: "var(--link)" }} />}
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    {a.category && <span className="text-xs font-semibold mb-2" style={{ color: "var(--link)" }}>{a.category.toUpperCase()}</span>}
                    <h3 className="font-sans text-lg font-bold mb-2 leading-snug" style={{ color: "var(--foreground)" }}>{a.title}</h3>
                    {a.excerpt && <p className="text-sm flex-1" style={{ color: "var(--muted-foreground)" }}>{a.excerpt}</p>}
                    <div className="flex items-center justify-between mt-4 text-xs" style={{ color: "var(--muted-foreground)" }}>
                      <span>{a.publishedAt ? new Date(a.publishedAt).toLocaleDateString(lang) : ""}</span>
                      <span className="inline-flex items-center gap-1 font-medium" style={{ color: "var(--foreground)" }}>{t("news.read")} <ArrowRight className="w-3 h-3" /></span>
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
