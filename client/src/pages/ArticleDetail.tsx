import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import PublicNav from "@/components/PublicNav";
import { ArrowLeft, Newspaper } from "lucide-react";
import { useI18n } from "@/i18n";

const DEEP_BLUE = "var(--foreground)";
const GOLD = "var(--link)";
const IVORY = "var(--foreground)";
const MUTED = "var(--muted-foreground)";

export default function ArticleDetail() {
  const { t } = useI18n();
  const { slug } = useParams<{ slug: string }>();
  const { data: article, isLoading } = trpc.public.articleBySlug.useQuery({ slug: slug ?? "" });

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <PublicNav />
      <div style={{ background: "var(--surface-strong)", paddingTop: "5rem" }}>
        <div className="container py-10 max-w-3xl">
          <Link href="/actualites">
            <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-white mb-4 transition-colors"><ArrowLeft className="w-4 h-4" /> {t("articleDetail.backToNews")}</button>
          </Link>
          {article && (
            <>
              {article.category && <div className="text-xs font-semibold tracking-widest mb-2" style={{ color: "var(--link)" }}>{article.category.toUpperCase()}</div>}
              <h1 className="font-sans text-3xl font-bold text-white mb-3">{article.title}</h1>
              <div className="text-muted-foreground text-sm">{article.author ?? "R-AERO"} · {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : ""}</div>
            </>
          )}
        </div>
      </div>

      <div className="container py-8 max-w-3xl">
        {isLoading ? (
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("articleDetail.loading")}</p>
        ) : !article ? (
          <div className="text-center py-16">
            <Newspaper className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--link)" }} />
            <p className="font-semibold" style={{ color: "var(--foreground)" }}>{t("articleDetail.notFound")}</p>
            <Link href="/actualites"><span className="text-sm cursor-pointer hover:underline" style={{ color: "var(--link)" }}>{t("articleDetail.backToNewsLink")}</span></Link>
          </div>
        ) : (
          <article>
            {article.coverImageUrl && <img src={article.coverImageUrl} className="w-full rounded-xl mb-6 max-h-80 object-cover" />}
            {article.excerpt && <p className="text-lg font-medium mb-6" style={{ color: "var(--foreground)" }}>{article.excerpt}</p>}
            <div className="text-base leading-relaxed whitespace-pre-line" style={{ color: "var(--muted-foreground)" }}>{article.content}</div>
          </article>
        )}
      </div>
    </div>
  );
}
