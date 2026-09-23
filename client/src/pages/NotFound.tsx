import { Button } from "@/components/ui/button";
import { Compass, Home, Search } from "lucide-react";
import { Link } from "wouter";
import { useI18n } from "@/i18n";
import PublicNav from "@/components/PublicNav";

const DEEP_BLUE = "oklch(19% 0.08 252)";
const GOLD = "oklch(68% 0.1 78)";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen w-full" style={{ background: "oklch(97% 0.01 88)" }}>
      <PublicNav />
      <main className="container flex items-center justify-center min-h-screen pt-16">
        <div className="w-full max-w-lg text-center rounded-xl bg-white p-8" style={{ border: "1px solid oklch(88% 0.015 88)" }}>
          <Compass className="h-12 w-12 mx-auto mb-4" style={{ color: GOLD }} aria-hidden="true" />
          <h1 className="font-serif text-4xl font-bold mb-2" style={{ color: DEEP_BLUE }}>404</h1>
          <h2 className="text-xl font-semibold mb-4" style={{ color: DEEP_BLUE }}>{t("notFound.title")}</h2>
          <p className="mb-8 leading-relaxed" style={{ color: "oklch(45% 0.02 240)" }}>
            {t("notFound.description")}
            <br />
            {t("notFound.descriptionSecondary")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/"><Button className="w-full" style={{ background: DEEP_BLUE, color: "white" }}><Home className="w-4 h-4 mr-2" />{t("notFound.goHome")}</Button></Link>
            <Link href="/catalogue"><Button variant="outline" className="w-full"><Search className="w-4 h-4 mr-2" />{t("nav.catalogue")}</Button></Link>
          </div>
        </div>
      </main>
    </div>
  );
}
