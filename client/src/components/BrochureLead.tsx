import { useRef, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { ArrowUpRight, CheckCircle2, Download } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { requestId } from "@/lib/requestId";
import { useI18n } from "@/i18n";
import { landingCopy } from "@/content/landing";
import { Input } from "@/components/ui/input";
import { quoteRequestInput } from "../../../shared/quoteRequestInput";

export default function BrochureLead() {
  const { lang } = useI18n();
  const c = landingCopy[lang];
  const [reference, setReference] = useState<number | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);
  const pending = useRef<{ signature: string; id: string } | null>(null);
  const sending = useRef(false);
  const create = trpc.quotes.create.useMutation();
  const pdf = trpc.public.cataloguePdf.useMutation();
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending.current) return;
    const form = new FormData(event.currentTarget);
    const profile = String(form.get("profile"));
    const parsed = quoteRequestInput.safeParse({
      contactName: form.get("name"),
      contactEmail: form.get("email"),
      companyName: String(form.get("company") || "").trim() || profile,
      trainingTypes: `Brochure R-AERO · ${profile}`,
      message: `Demande de brochure depuis la landing page. Profil : ${profile}. Langue : ${lang}. Accord de contact pour cette demande : oui. Aucun abonnement marketing.`,
    });
    if (!parsed.success || form.get("consent") !== "on") {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    const signature = JSON.stringify(parsed.data);
    if (pending.current?.signature !== signature)
      pending.current = { signature, id: requestId() };
    sending.current = true;
    try {
      const result = await create.mutateAsync({
        ...parsed.data,
        requestId: pending.current.id,
      });
      setReference(result.quoteId);
    } catch {
      /* Inline error preserves entered data and the idempotency key for retry. */
    } finally {
      sending.current = false;
    }
  };
  const download = async () => {
    setDownloadFailed(false);
    try {
      const result = await pdf.mutateAsync();
      if (!result.url) throw new Error("Missing catalogue URL");
      window.location.assign(result.url);
    } catch {
      setDownloadFailed(true);
    }
  };
  return (
    <section id="brochure" className="academy-lead">
      <div className="academy-wrap academy-section academy-lead-grid">
        <div>
          <p className="academy-eyebrow">{c.formLabel}</p>
          <h2>{c.formTitle}</h2>
          <p className="academy-lead-intro">{c.formIntro}</p>
          <p className="academy-lead-privacy">{c.privacy}</p>
          <Link className="academy-text-link" href="/legal">
            {c.legal}
            <ArrowUpRight size={18} />
          </Link>
        </div>
        {reference !== null ? (
          <div className="academy-lead-form" role="status">
            <CheckCircle2 size={36} />
            <h3>{c.success}</h3>
            <p>{c.successText}</p>
            <p>
              {c.reference} #{reference}
            </p>
            <button
              className="academy-button academy-button-dark"
              disabled={pdf.isPending}
              onClick={download}
            >
              <Download size={18} />
              {pdf.isPending ? c.pending : c.download}
            </button>
            {downloadFailed && <p role="alert">{c.pdfError}</p>}
          </div>
        ) : (
          <form className="academy-lead-form" onSubmit={submit}>
            <fieldset disabled={create.isPending}>
              <label htmlFor="lead-name">
                {c.name}
                <Input
                  id="lead-name"
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={128}
                />
              </label>
              <label htmlFor="lead-email">
                {c.email}
                <Input
                  id="lead-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={320}
                />
              </label>
              <label htmlFor="lead-profile">
                {c.profile}
                <select
                  id="lead-profile"
                  name="profile"
                  defaultValue="freelance"
                >
                  {c.profiles.map((p, i) => (
                    <option
                      key={i}
                      value={
                        [
                          "freelance",
                          "Part-145 / MRO",
                          "CAMO",
                          "airline",
                          "other",
                        ][i]
                      }
                    >
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="lead-company">
                {c.company}
                <Input
                  id="lead-company"
                  name="company"
                  autoComplete="organization"
                  maxLength={255}
                />
              </label>
              <label className="academy-consent" htmlFor="lead-consent">
                <input
                  id="lead-consent"
                  name="consent"
                  type="checkbox"
                  required
                />
                {c.consent}
              </label>
              {(invalid || create.isError) && (
                <p role="alert">{invalid ? c.invalid : c.error}</p>
              )}
              <button
                className="academy-button academy-button-dark"
                type="submit"
              >
                {create.isPending ? c.pending : c.submit}
                <ArrowUpRight size={20} />
              </button>
            </fieldset>
          </form>
        )}
      </div>
    </section>
  );
}
