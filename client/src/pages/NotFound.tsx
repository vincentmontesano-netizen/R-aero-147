import { Button } from "@/components/ui/button";
import { Compass, Home, Search } from "lucide-react";
import { Link } from "wouter";
import { useI18n } from "@/i18n";
import PublicNav from "@/components/PublicNav";

const DEEP_BLUE = "var(--foreground)";
const GOLD = "var(--link)";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen w-full" style={{ background: "var(--background)" }}>
      <PublicNav />
      <main className="container flex items-center justify-center min-h-screen pt-16">
        <div className="w-full max-w-lg text-center rounded-xl bg-card p-8" style={{ border: "1px solid var(--border)" }}>
          <Compass className="h-12 w-12 mx-auto mb-4" style={{ color: "var(--link)" }} aria-hidden="true" />
          <h1 className="font-sans text-4xl font-bold mb-2" style={{ color: "var(--foreground)" }}>404</h1>
          <h2 className="text-xl font-semibold mb-4" style={{ color: "var(--foreground)" }}>{t("notFound.title")}</h2>
          <p className="mb-8 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            {t("notFound.description")}
            <br />
            {t("notFound.descriptionSecondary")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/"><Button className="w-full" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}><Home className="w-4 h-4 mr-2" />{t("notFound.goHome")}</Button></Link>
            <Link href="/catalogue"><Button variant="outline" className="w-full"><Search className="w-4 h-4 mr-2" />{t("nav.catalogue")}</Button></Link>
          </div>
        </div>
      </main>
    </div>
  );
}
