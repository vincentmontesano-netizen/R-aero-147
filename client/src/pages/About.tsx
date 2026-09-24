import PublicNav from "@/components/PublicNav";
import BackButton from "@/components/BackButton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Shield, Award, BookOpen, Users, CheckCircle, Plane } from "lucide-react";
import { useI18n } from "@/i18n";

const DEEP_BLUE = "var(--foreground)";
const GOLD = "var(--link)";
const IVORY = "var(--foreground)";
const MUTED = "var(--muted-foreground)";

export default function About() {
  const { t } = useI18n();

  const GUARANTEES = [
    { icon: Award, title: t("about.guaranteeApprovedTitle"), desc: t("about.guaranteeApprovedDesc") },
    { icon: Shield, title: t("about.guaranteeTraceabilityTitle"), desc: t("about.guaranteeTraceabilityDesc") },
    { icon: BookOpen, title: t("about.guaranteeContentTitle"), desc: t("about.guaranteeContentDesc") },
    { icon: Users, title: t("about.guaranteeAudienceTitle"), desc: t("about.guaranteeAudienceDesc") },
  ];

  const DOMAINS = [
    t("about.domainHumanFactors"),
    t("about.domainFuelTankSafety"),
    t("about.domainEwis"),
    t("about.domainSms"),
    t("about.domainTypeRating"),
    t("about.domainPart66"),
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <PublicNav />
      <div style={{ background: "var(--surface-strong)", paddingTop: "5rem" }}>
        <div className="container py-12">
          <BackButton dark />
          <div className="text-xs font-semibold tracking-widest mb-2" style={{ color: "var(--link)" }}>{t("about.eyebrow")}</div>
          <h1 className="font-sans text-3xl font-bold text-white mb-3 max-w-2xl">{t("about.heroTitle")}</h1>
          <p className="text-muted-foreground text-sm max-w-2xl">{t("about.heroSubtitle")}</p>
        </div>
      </div>

      <div className="container py-10">
        <div className="grid md:grid-cols-2 gap-4 mb-12">
          {GUARANTEES.map((g) => (
            <div key={g.title} className="rounded-xl p-6 flex gap-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--link) 12%, transparent)" }}>
                <g.icon className="w-5 h-5" style={{ color: "var(--link)" }} />
              </div>
              <div>
                <h3 className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>{g.title}</h3>
                <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{g.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl p-8 mb-12" style={{ background: "var(--surface-strong)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Plane className="w-5 h-5" style={{ color: "var(--link)" }} />
            <h2 className="font-sans text-xl font-bold text-white">{t("about.domainsTitle")}</h2>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {DOMAINS.map((d) => (
              <div key={d} className="flex items-center gap-2 text-sm text-white/80">
                <CheckCircle className="w-4 h-4 shrink-0" style={{ color: "var(--link)" }} /> {d}
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <h2 className="font-sans text-2xl font-bold mb-3" style={{ color: "var(--foreground)" }}>{t("about.ctaTitle")}</h2>
          <p className="text-sm mb-5" style={{ color: "var(--muted-foreground)" }}>{t("about.ctaSubtitle")}</p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/catalogue"><Button style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>{t("about.ctaCatalogue")}</Button></Link>
            <Link href="/devis"><Button variant="outline" style={{ borderColor: "var(--link)", color: "var(--foreground)" }}>{t("about.ctaDemo")}</Button></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
