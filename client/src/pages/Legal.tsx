import PublicNav from "@/components/PublicNav";
import BackButton from "@/components/BackButton";
import { useI18n } from "@/i18n";

const DEEP_BLUE = "var(--foreground)";
const GOLD = "var(--link)";
const IVORY = "var(--foreground)";
const MUTED = "var(--muted-foreground)";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="font-sans text-lg font-bold mb-2" style={{ color: "var(--foreground)" }}>{title}</h2>
      <div className="text-sm leading-relaxed space-y-2" style={{ color: "var(--muted-foreground)" }}>{children}</div>
    </div>
  );
}

export default function Legal() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <PublicNav />
      <div style={{ background: "var(--surface-strong)", paddingTop: "5rem" }}>
        <div className="container py-10">
          <BackButton dark />
          <div className="text-xs font-semibold tracking-widest mb-2" style={{ color: "var(--link)" }}>{t("legal.eyebrow")}</div>
          <h1 className="font-sans text-3xl font-bold text-foreground">{t("legal.pageTitle")}</h1>
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
