import { useState } from "react";
import PublicNav from "@/components/PublicNav";
import BackButton from "@/components/BackButton";
import { Input } from "@/components/ui/input";
import { Search, BookA } from "lucide-react";
import { useI18n } from "@/i18n";

const DEEP_BLUE = "oklch(19% 0.08 252)";
const GOLD = "oklch(68% 0.1 78)";
const IVORY = "oklch(97% 0.01 88)";
const MUTED = "oklch(45% 0.02 240)";

export default function Glossary() {
  const { t } = useI18n();
  const [q, setQ] = useState("");

  const TERMS: { term: string; def: string }[] = [
    { term: "Part-147", def: t("glossary.defPart147") },
    { term: "Part-66", def: t("glossary.defPart66") },
    { term: "Part-145", def: t("glossary.defPart145") },
    { term: "Human Factors (HF)", def: t("glossary.defHumanFactors") },
    { term: "EWIS", def: t("glossary.defEwis") },
    { term: "FTS / CDCCL", def: t("glossary.defFtsCdccl") },
    { term: "SMS", def: t("glossary.defSms") },
    { term: "QT (Type Rating)", def: t("glossary.defTypeRating") },
    { term: "MRO", def: t("glossary.defMro") },
    { term: "EASA", def: t("glossary.defEasa") },
    { term: "DGAC", def: t("glossary.defDgac") },
    { term: "OSAC", def: t("glossary.defOsac") },
    { term: "Qualiopi", def: t("glossary.defQualiopi") },
    { term: "Récurrence", def: t("glossary.defRecurrence") },
    { term: "SCORM / xAPI", def: t("glossary.defScormXapi") },
  ];

  const filtered = TERMS.filter((item) => item.term.toLowerCase().includes(q.toLowerCase()) || item.def.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.term.localeCompare(b.term));

  return (
    <div className="min-h-screen" style={{ background: IVORY }}>
      <PublicNav />
      <div style={{ background: DEEP_BLUE, paddingTop: "5rem" }}>
        <div className="container py-10">
          <BackButton dark />
          <div className="text-xs font-semibold tracking-widest mb-2" style={{ color: GOLD }}>{t("glossary.eyebrow")}</div>
          <h1 className="font-serif text-3xl font-bold text-white mb-2">{t("glossary.title")}</h1>
          <p className="text-white/60 text-sm max-w-2xl">{t("glossary.subtitle")}</p>
        </div>
      </div>

      <div className="container py-8 max-w-3xl">
        <div className="relative mb-6">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("glossary.searchPlaceholder")} className="pl-9" />
        </div>
        <div className="space-y-3">
          {filtered.map((item) => (
            <div key={item.term} className="rounded-xl p-5 flex gap-4" style={{ background: "white", border: "1px solid oklch(88% 0.015 88)" }}>
              <BookA className="w-5 h-5 shrink-0 mt-0.5" style={{ color: GOLD }} />
              <div>
                <h3 className="font-semibold mb-1" style={{ color: DEEP_BLUE }}>{item.term}</h3>
                <p className="text-sm" style={{ color: MUTED }}>{item.def}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
