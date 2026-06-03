import PublicNav from "@/components/PublicNav";
import BackButton from "@/components/BackButton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Shield, Award, BookOpen, Users, CheckCircle, Plane } from "lucide-react";
import { useI18n } from "@/i18n";

const DEEP_BLUE = "oklch(19% 0.08 252)";
const GOLD = "oklch(68% 0.1 78)";
const IVORY = "oklch(97% 0.01 88)";
const MUTED = "oklch(45% 0.02 240)";

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
    <div className="min-h-screen" style={{ background: IVORY }}>
      <PublicNav />
      <div style={{ background: DEEP_BLUE, paddingTop: "5rem" }}>
        <div className="container py-12">
          <BackButton dark />
          <div className="text-xs font-semibold tracking-widest mb-2" style={{ color: GOLD }}>{t("about.eyebrow")}</div>
          <h1 className="font-serif text-3xl font-bold text-white mb-3 max-w-2xl">{t("about.heroTitle")}</h1>
          <p className="text-white/60 text-sm max-w-2xl">{t("about.heroSubtitle")}</p>
        </div>
      </div>

      <div className="container py-10">
        <div className="grid md:grid-cols-2 gap-4 mb-12">
          {GUARANTEES.map((g) => (
            <div key={g.title} className="rounded-xl p-6 flex gap-4" style={{ background: "white", border: "1px solid oklch(88% 0.015 88)" }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "oklch(68% 0.1 78 / 0.12)" }}>
                <g.icon className="w-5 h-5" style={{ color: GOLD }} />
              </div>
              <div>
                <h3 className="font-semibold mb-1" style={{ color: DEEP_BLUE }}>{g.title}</h3>
                <p className="text-sm" style={{ color: MUTED }}>{g.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl p-8 mb-12" style={{ background: DEEP_BLUE }}>
          <div className="flex items-center gap-2 mb-4">
            <Plane className="w-5 h-5" style={{ color: GOLD }} />
            <h2 className="font-serif text-xl font-bold text-white">{t("about.domainsTitle")}</h2>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {DOMAINS.map((d) => (
              <div key={d} className="flex items-center gap-2 text-sm text-white/80">
                <CheckCircle className="w-4 h-4 shrink-0" style={{ color: GOLD }} /> {d}
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <h2 className="font-serif text-2xl font-bold mb-3" style={{ color: DEEP_BLUE }}>{t("about.ctaTitle")}</h2>
          <p className="text-sm mb-5" style={{ color: MUTED }}>{t("about.ctaSubtitle")}</p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/catalogue"><Button style={{ background: DEEP_BLUE, color: IVORY }}>{t("about.ctaCatalogue")}</Button></Link>
            <Link href="/devis"><Button variant="outline" style={{ borderColor: GOLD, color: DEEP_BLUE }}>{t("about.ctaDemo")}</Button></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
