import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, BookOpen, Building2, Check, Download, FileCheck2, Layers, Pause, Play, Radio, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";
import { useAuth } from "@/_core/hooks/useAuth";
import PublicNav from "@/components/PublicNav";
import { homeCopy } from "@/content/home";
import "./home.css";

export default function Home() {
  const { lang, t } = useI18n();
  const c = homeCopy[lang];
  const { isAuthenticated } = useAuth();
  const featured = trpc.public.featuredTrainings.useQuery();
  const offers = trpc.public.offers.useQuery({ language: lang });
  const faq = trpc.public.faq.useQuery({ language: lang });
  const pdf = trpc.public.cataloguePdf.useMutation();
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const media = video.current;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const respectMotionPreference = () => {
      if (motion.matches) media?.pause();
    };
    motion.addEventListener("change", respectMotionPreference);
    if (!motion.matches) void media?.play().catch(() => {});
    return () => {
      motion.removeEventListener("change", respectMotionPreference);
      media?.pause();
    };
  }, []);
  const roleIcons = [BookOpen, Building2, Sparkles];
  const roleLinks = [isAuthenticated ? "/dashboard" : "/login", "/devis", isAuthenticated ? "/maker" : "/register"];
  const stepIcons = [Layers, Radio, FileCheck2];
  const stepLinks = ["/catalogue", "/sessions", isAuthenticated ? "/dashboard" : "/register"];
  const faqItems = faq.data?.length ? faq.data : c.faqItems;
  const downloadPdf = async () => {
    const result = await pdf.mutateAsync().catch(() => null);
    if (result?.url) window.location.assign(result.url);
  };
  return <div className="academy-home">
    <a className="academy-skip" href="#main-content">{c.skip}</a>
    <PublicNav />
    <main id="main-content">
      <section className="academy-hero">
        <div className="academy-hero-media" aria-hidden="true">
          <video ref={video} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onEmptied={() => setPlaying(false)} muted loop playsInline preload="none" poster="/brand/training-hero.jpg"><source src="/video/hereo.mp4" type="video/mp4" /></video>
        </div>
        <div className="academy-wrap academy-hero-content">
          <p className="academy-eyebrow">{c.eyebrow}</p>
          <h1>{c.title}<br /><span>{c.accent}</span></h1>
          <p className="academy-intro">{c.intro}</p>
          <div className="academy-actions">
            <Link className="academy-button" href="/catalogue">{c.catalogue}<ArrowUpRight size={20} /></Link>
            <Link className="academy-button academy-button-outline" href="/devis">{c.company}</Link>
          </div>
          <div className="academy-hero-bottom"><p>{c.formats}</p><button className="academy-video-control" aria-label={playing ? c.pause : c.play} onClick={() => {
            const media = video.current;
            if (!media) return;
            if (!media.paused) media.pause();
            else void media.play().catch(() => {});
          }}>{playing ? <Pause size={18} /> : <Play size={18} />}</button></div>
        </div>
      </section>
      <section className="academy-wrap academy-paths" aria-label={c.journey}>
        {c.roles.map((title, i) => { const Icon = roleIcons[i]; return <Link href={roleLinks[i]} className="academy-path" key={title}>
          <Icon size={25} /><div><h2>{title}</h2><p>{c.roleDescriptions[i]}</p><span>{c.roleActions[i]} <ArrowUpRight size={17} /></span></div>
        </Link>; })}
      </section>
      <section className="academy-wrap academy-section" id="formations">
        <div className="academy-section-heading"><div><p className="academy-eyebrow">{c.selection}</p><h2>{c.selectionTitle}</h2></div><Link className="academy-text-link" href="/catalogue">{c.all}<ArrowUpRight size={20} /></Link></div>
        {featured.isLoading ? <p role="status">{c.loading}</p> : featured.isError ? <div role="alert" className="academy-empty"><p>{c.unavailable}</p><button onClick={() => featured.refetch()}>{c.retry}</button></div> : featured.data?.length ? <div className="academy-course-grid">
          {featured.data.slice(0, 3).map((course, index) => <Link key={course.id} className="academy-course" href={`/formation/${course.slug}`}>
            <div className="academy-course-top"><span>{String(index + 1).padStart(2, "0")}</span><BookOpen size={32} /><span>{course.language?.toUpperCase()}</span></div>
            <div className="academy-course-body"><p className="academy-course-meta">{course.type === "elearning" ? "E-learning" : course.type} {course.durationHours ? ` / ${Number(course.durationHours)} ${c.hours}` : ""}</p><h3>{course.title}</h3><p className="academy-course-description">{course.description}</p><div className="academy-course-footer"><strong>{course.priceTtc ? `${new Intl.NumberFormat(lang, { style: "currency", currency: "EUR" }).format(Number(course.priceTtc))} ${c.vat}` : c.price}</strong><ArrowUpRight size={22} aria-label={c.details} /></div></div>
          </Link>)}
        </div> : <div className="academy-empty"><p>{c.empty}</p><Link className="academy-text-link" href="/devis">{c.contact}<ArrowUpRight size={20} /></Link></div>}
      </section>
      <section className="academy-platform" id="plateforme"><div className="academy-wrap academy-section">
        <p className="academy-eyebrow">{c.platform}</p><h2>{c.platformTitle}</h2>
        <div className="academy-steps">{c.steps.map((title, i) => { const Icon = stepIcons[i]; return <Link href={stepLinks[i]} key={title} className="academy-step"><div><span>0{i + 1}</span><Icon size={28} /></div><h3>{title}</h3><p>{c.stepDescriptions[i]}</p><ArrowUpRight size={22} /></Link>; })}</div>
      </div></section>
      <section className="academy-wrap academy-section academy-company" id="entreprises">
        <div><p className="academy-eyebrow">{c.companyEyebrow}</p><h2>{c.companyTitle}</h2><p className="academy-company-copy">{c.companyText}</p><Link className="academy-button academy-button-dark" href="/devis">{c.company}<ArrowUpRight size={20} /></Link></div>
        <div className="academy-company-list">{c.companyFeatures.map((feature, i) => <div key={feature}><span>0{i + 1}</span><h3>{feature}</h3><Check size={20} /></div>)}</div>
      </section>
      <section className="academy-offers" id="tarifs"><div className="academy-wrap academy-section">
        <div className="academy-section-heading"><div><p className="academy-eyebrow">{c.offers}</p><h2>{c.offersTitle}</h2><p>{c.offersIntro}</p></div><button className="academy-text-link" disabled={pdf.isPending} onClick={downloadPdf}><Download size={18} />{c.pdf}</button></div>
        {pdf.isError && <p role="alert">{c.downloadError}</p>}
        {offers.isError ? <div role="alert" className="academy-empty"><p>{c.offersUnavailable}</p><button disabled={offers.isFetching} onClick={() => { void offers.refetch(); }}>{c.retry}</button></div> : offers.isPending ? <p role="status">{t("common.loading")}</p> : offers.data?.length ? <div className="academy-course-grid">{offers.data.map(offer => <article className={`academy-offer ${offer.highlight ? "academy-offer-highlight" : ""}`} key={offer.id}><h3>{offer.name}</h3><p>{offer.description}</p><strong>{offer.price}</strong><ul>{(offer.features ?? []).map(feature => <li key={feature}><Check size={17} />{feature}</li>)}</ul><Link className="academy-button academy-button-dark" href={offer.ctaHref?.startsWith("/") && !offer.ctaHref.startsWith("//") ? offer.ctaHref : "/devis"}>{offer.ctaLabel || c.quote}<ArrowUpRight size={18} /></Link></article>)}</div> : <Link className="academy-button academy-button-dark" href="/devis">{c.quote}<ArrowUpRight size={20} /></Link>}
      </div></section>
      <section className="academy-wrap academy-section academy-faq" id="faq"><h2>{c.faq}</h2>
        {faq.isError ? <div role="alert" className="academy-empty"><p>{c.faqUnavailable}</p><button disabled={faq.isFetching} onClick={() => { void faq.refetch(); }}>{c.retry}</button></div> : faq.isPending ? <p role="status">{t("common.loading")}</p> : <div>{faqItems.map((item, i) => <details key={i}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div>}
      </section>
      <section className="academy-end"><div className="academy-wrap"><p className="academy-eyebrow">R-AERO TRAINING ACADEMY</p><h2>{c.endTitle}</h2><p>{c.endText}</p><Link className="academy-button" href="/devis">{c.contact}<ArrowUpRight size={20} /></Link></div></section>
    </main>
    <footer className="academy-wrap academy-footer"><div><Link href="/" className="academy-wordmark">R-AERO<span>TRAINING ACADEMY</span></Link><p>© {new Date().getFullYear()} R-AERO</p></div><div><h2>{c.resources}</h2><Link href="/verification">{c.verify}</Link><Link href="/sessions">{c.sessions}</Link><Link href="/webinars">Webinars</Link><Link href="/glossaire">{c.glossary}</Link></div><div><h2>{c.about}</h2><Link href="/about">{c.about}</Link><Link href="/actualites">{c.news}</Link><Link href="/legal">{c.legal}</Link><Link href="/contact">{c.contact}</Link></div></footer>
  </div>;
}
