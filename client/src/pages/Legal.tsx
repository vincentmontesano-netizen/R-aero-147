import PublicNav from "@/components/PublicNav";
import BackButton from "@/components/BackButton";
import { useI18n } from "@/i18n";

const DEEP_BLUE = "oklch(19% 0.08 252)";
const GOLD = "oklch(68% 0.1 78)";
const IVORY = "oklch(97% 0.01 88)";
const MUTED = "oklch(45% 0.02 240)";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="font-serif text-lg font-bold mb-2" style={{ color: DEEP_BLUE }}>{title}</h2>
      <div className="text-sm leading-relaxed space-y-2" style={{ color: MUTED }}>{children}</div>
    </div>
  );
}

export default function Legal() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen" style={{ background: IVORY }}>
      <PublicNav />
      <div style={{ background: DEEP_BLUE, paddingTop: "5rem" }}>
        <div className="container py-10">
          <BackButton dark />
          <div className="text-xs font-semibold tracking-widest mb-2" style={{ color: GOLD }}>{t("legal.eyebrow")}</div>
          <h1 className="font-serif text-3xl font-bold text-white">{t("legal.pageTitle")}</h1>
        </div>
      </div>

      <div className="container py-10 max-w-3xl">
        <Section title={t("legal.publisherTitle")}>
          <p>{t("legal.publisherLine1")}</p>
          <p>{t("legal.publisherLine2")}</p>
          <p>{t("legal.publisherLine3")}</p>
        </Section>

        <Section title={t("legal.hostingTitle")}>
          <p>{t("legal.hostingLine1")}</p>
        </Section>

        <Section title={t("legal.gdprTitle")}>
          <p>{t("legal.gdprLine1")}</p>
          <p>{t("legal.gdprLine2")}</p>
          <p>{t("legal.gdprLine3")}</p>
        </Section>

        <Section title={t("legal.cookiesTitle")}>
          <p>{t("legal.cookiesLine1")}</p>
        </Section>

        <Section title={t("legal.fundingTitle")}>
          <p>{t("legal.fundingLine1Pre")}<strong>{t("legal.fundingQualiopi")}</strong>{t("legal.fundingLine1Mid")}<strong>{t("legal.fundingCpf")}</strong>{t("legal.fundingLine1Or")}<strong>{t("legal.fundingOpco")}</strong>{t("legal.fundingLine1End")}</p>
          <p>{t("legal.fundingLine2")}</p>
        </Section>

        <Section title={t("legal.accessibilityTitle")}>
          <p>{t("legal.accessibilityLine1")}</p>
        </Section>

        <Section title={t("legal.ipTitle")}>
          <p>{t("legal.ipLine1")}</p>
        </Section>
      </div>
    </div>
  );
}
