import { useEffect } from "react";
import { Link } from "wouter";
import {
  ArrowUpRight,
  BookOpen,
  Building2,
  Check,
  FileCheck2,
  Layers,
  Radio,
  Sparkles,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";
import { useAuth } from "@/_core/hooks/useAuth";
import PublicNav from "@/components/PublicNav";
import { homeCopy } from "@/content/home";
import { landingCopy } from "@/content/landing";
import { aviationCopy, aviationImages } from "@/content/aviation";
import CockpitExperience from "@/components/CockpitExperience";
import BrochureLead from "@/components/BrochureLead";
import { getLoginUrl } from "@/const";
import "./home.css";
import "./home-immersive.css";

function AviationPhoto({
  index,
  alt,
  className = "",
  sizes = "(max-width: 760px) 90vw, 45vw",
}: {
  index: number;
  alt: string;
  className?: string;
  sizes?: string;
}) {
  const source = `/images/aviation/${aviationImages[index]}`;
  return (
    <img
      className={`academy-aviation-photo ${className}`}
      src={`${source}.webp`}
      srcSet={`${source}-768.webp 768w, ${source}.webp 1536w`}
      sizes={sizes}
      width={1536}
      height={1024}
      alt={alt}
      loading="lazy"
      decoding="async"
    />
  );
}

export default function Home() {
  const { lang } = useI18n();
  const c = homeCopy[lang];
  const l = landingCopy[lang];
  const aviation = aviationCopy[lang];
  const { isAuthenticated } = useAuth();
  const featured = trpc.public.featuredTrainings.useQuery();
  // The landing presents general aviation training, without manufacturer/model mentions.
  const selection = featured.data
    ?.filter(
      course =>
        !/\b(?:airbus|a\s*320)\b/i.test(
          `${course.title} ${course.description ?? ""}`
        )
    )
    .slice(0, 3);
  const faq = trpc.public.faq.useQuery({ language: lang });
  // Section links from other pages (e.g. the "Entreprises" nav entry → /#entreprises) arrive
  // before the section is laid out, so the browser's native anchor scroll misses it.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    // "instant" overrides the global smooth scroll-behavior, which would otherwise animate from the top.
    if (id)
      setTimeout(
        () =>
          document
            .getElementById(id)
            ?.scrollIntoView({ block: "start", behavior: "instant" }),
        0
      );
  }, []);
  const roleIcons = [BookOpen, Building2, Sparkles];
  const roleLinks = [
    isAuthenticated ? "/dashboard" : getLoginUrl(),
    "/devis",
    isAuthenticated ? "/maker" : "/register",
  ];
  const stepIcons = [Layers, Radio, FileCheck2];
  const stepLinks = [
    "/catalogue",
    "/sessions",
    isAuthenticated ? "/dashboard" : "/register",
  ];
  const faqItems = l.faq;
  return (
    <div className="academy-home">
      <a className="academy-skip" href="#main-content">
        {c.skip}
      </a>
      <PublicNav />
      <main id="main-content">
        <CockpitExperience authenticated={isAuthenticated} />
        <section className="academy-audience">
          <div className="academy-wrap">
            <p>{l.audience}</p>
            <div>
              <span>PART-145 / MRO</span>
              <span>CAMO</span>
              <span>AIRLINES</span>
              <span>FREELANCE</span>
            </div>
          </div>
        </section>
        <section className="academy-wrap academy-metrics">
          {l.metrics.map(([value, title, description]) => (
            <div key={title}>
              <strong>{value}</strong>
              <h2>{title}</h2>
              <p>{description}</p>
            </div>
          ))}
        </section>
        <section className="academy-wrap academy-section academy-problem">
          <AviationPhoto index={0} alt={aviation.alts[0]} />
          <div>
            <p className="academy-eyebrow">{l.problemLabel}</p>
            <h2>{l.problemTitle}</h2>
            <p className="academy-problem-copy">{l.problem}</p>
            <p className="academy-solution">{l.solution}</p>
          </div>
        </section>
        <section className="academy-benefits">
          <div className="academy-wrap academy-section">
            <p className="academy-eyebrow">{l.benefitsLabel}</p>
            <h2>{l.benefitsTitle}</h2>
            <div className="academy-benefit-grid">
              {l.benefits.map(([title, description], i) => (
                <article key={title}>
                  <span>0{i + 1}</span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="academy-wrap academy-paths" aria-label={c.journey}>
          {c.roles.map((title, i) => {
            const Icon = roleIcons[i];
            return (
              <Link href={roleLinks[i]} className="academy-path" key={title}>
                <Icon size={25} />
                <div>
                  <h2>{title}</h2>
                  <p>{c.roleDescriptions[i]}</p>
                  <span>
                    {c.roleActions[i]} <ArrowUpRight size={17} />
                  </span>
                </div>
              </Link>
            );
          })}
        </section>
        <section className="academy-wrap academy-section" id="formations">
          <div className="academy-section-heading">
            <div>
              <p className="academy-eyebrow">{c.selection}</p>
              <h2>{c.selectionTitle}</h2>
            </div>
            <Link className="academy-text-link" href="/catalogue">
              {c.all}
              <ArrowUpRight size={20} />
            </Link>
          </div>
          {featured.isLoading ? (
            <p role="status">{c.loading}</p>
          ) : featured.isError ? (
            <div role="alert" className="academy-empty">
              <p>{c.unavailable}</p>
              <button onClick={() => featured.refetch()}>{c.retry}</button>
            </div>
          ) : selection?.length ? (
            <div className="academy-course-grid">
              {selection.map((course, index) => (
                <Link
                  key={course.id}
                  className="academy-course"
                  href={`/formation/${course.slug}`}
                >
                  <div className="academy-course-top">
                    <AviationPhoto
                      index={index}
                      alt=""
                      sizes="(max-width: 760px) 90vw, 30vw"
                    />
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <span>{course.language?.toUpperCase()}</span>
                  </div>
                  <div className="academy-course-body">
                    <p className="academy-course-meta">
                      {course.type === "elearning" ? "E-learning" : course.type}{" "}
                      {course.durationHours
                        ? ` / ${Number(course.durationHours)} ${c.hours}`
                        : ""}
                    </p>
                    <h3>{course.title}</h3>
                    <p className="academy-course-description">
                      {course.description}
                    </p>
                    <div className="academy-course-footer">
                      <strong>{c.details}</strong>
                      <ArrowUpRight size={22} aria-label={c.details} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="academy-empty">
              <p>{c.empty}</p>
              <Link className="academy-text-link" href="/devis">
                {c.contact}
                <ArrowUpRight size={20} />
              </Link>
            </div>
          )}
        </section>
        <section className="academy-platform" id="plateforme">
          <div className="academy-wrap academy-section">
            <p className="academy-eyebrow">{c.platform}</p>
            <h2>{c.platformTitle}</h2>
            <AviationPhoto
              index={2}
              alt={aviation.alts[2]}
              className="academy-platform-photo"
              sizes="90vw"
            />
            <div className="academy-steps">
              {c.steps.map((title, i) => {
                const Icon = stepIcons[i];
                return (
                  <Link
                    href={stepLinks[i]}
                    key={title}
                    className="academy-step"
                  >
                    <div>
                      <span>0{i + 1}</span>
                      <Icon size={28} />
                    </div>
                    <h3>{title}</h3>
                    <p>{c.stepDescriptions[i]}</p>
                    <ArrowUpRight size={22} />
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
        <section
          className="academy-wrap academy-section academy-company"
          id="entreprises"
        >
          <div>
            <p className="academy-eyebrow">{c.companyEyebrow}</p>
            <h2>{c.companyTitle}</h2>
            <p className="academy-company-copy">{c.companyText}</p>
            <Link className="academy-button academy-button-dark" href="/devis">
              {c.company}
              <ArrowUpRight size={20} />
            </Link>
          </div>
          <div>
            <AviationPhoto index={1} alt={aviation.alts[1]} />
            <div className="academy-company-list">
              {c.companyFeatures.map((feature, i) => (
                <div key={feature}>
                  <span>0{i + 1}</span>
                  <h3>{feature}</h3>
                  <Check size={20} />
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="academy-story">
          <div className="academy-wrap academy-section">
            <p className="academy-eyebrow">{l.storyLabel}</p>
            <blockquote>{l.story}</blockquote>
            <p className="academy-story-author">{l.storyAuthor}</p>
            <p className="academy-story-note">{l.storyNote}</p>
          </div>
        </section>
        <section className="academy-wrap academy-section academy-faq" id="faq">
          <h2>{c.faq}</h2>
          <div>
            {faqItems.map((item, i) => (
              <details key={i}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
            {!!faq.data?.length && (
              <details>
                <summary>{c.about}</summary>
                {faq.data.map(item => (
                  <div className="academy-faq-extra" key={item.id}>
                    <h3>{item.question}</h3>
                    <p>{item.answer}</p>
                  </div>
                ))}
              </details>
            )}
          </div>
        </section>
        <BrochureLead />
      </main>
      <footer className="academy-wrap academy-footer">
        <div>
          <Link href="/" className="academy-wordmark">
            R-AERO<span>TRAINING ACADEMY</span>
          </Link>
          <p>© {new Date().getFullYear()} R-AERO</p>
          <p className="academy-image-credit">{aviation.note}</p>
        </div>
        <div>
          <h2>{c.resources}</h2>
          <Link href="/verification">{c.verify}</Link>
          <Link href="/sessions">{c.sessions}</Link>
          <Link href="/webinars">Webinars</Link>
          <Link href="/glossaire">{c.glossary}</Link>
        </div>
        <div>
          <h2>{c.about}</h2>
          <Link href="/about">{c.about}</Link>
          <Link href="/actualites">{c.news}</Link>
          <Link href="/legal">{c.legal}</Link>
          <Link href="/contact">{c.contact}</Link>
        </div>
      </footer>
    </div>
  );
}
