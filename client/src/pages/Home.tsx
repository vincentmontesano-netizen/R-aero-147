import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n, type Lang } from "@/i18n";
import { Button } from "@/components/ui/button";
import { LOGO_EMBLEM, BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import {
  Plane, Shield, Award, Users, BookOpen, CheckCircle, Building2, BarChart3,
  Zap, Brain, Menu, X, ShoppingCart, LogIn, GraduationCap, ArrowRight, Globe,
  Mail, MapPin, BadgeCheck, Wallet, Download, Sparkles, Calendar,
  Loader2, ShieldCheck, FileCheck2, MonitorPlay, RefreshCw, Plus, Minus, Star, ChevronRight,
} from "lucide-react";

// ─── Brand color system (Chaud et élégant · light · bleu nuit + or) ───────────
const C = {
  blue: "#002554", blueDark: "#001833", blueAccent: "#0A6E8A",
  gold: "#C9A55A", goldDark: "#A8843E", goldSoft: "#FBF6EA",
  ivory: "#F7F5EF", surface: "#FFFFFF", border: "#E7E1D4",
  text: "#16202E", muted: "#566070", faint: "#8A9099",
};
const HEADING = "'Playfair Display', Georgia, serif";

// ─── Bilingual landing content (EN default + FR) ──────────────────────────────
type PlanCopy = { name: string; price: string; desc: string; features: string[]; cta: string; href: string; highlight: boolean };
// AR falls back to FR landing copy for now (UI chrome/nav are fully translated + RTL).
const COPY: Partial<Record<Lang, any>> = {
  en: {
    nav: { formations: "Trainings", platform: "Platform", companies: "Companies", pricing: "Pricing", faq: "FAQ", myspace: "My space", login: "Log in", demo: "Request a demo", demoShort: "Demo", catalogue: "Catalogue" },
    hero: {
      badge: "EASA PART-147 APPROVED ORGANISATION",
      titleMain: "Aircraft maintenance training,", titleAccent: "finally online.",
      sub: "E-learning catalogue (HF, FTS, EWIS, QT…), scheduled sessions and a recurrency-management platform for MROs, airlines and CAMOs. Instant purchase and access, verifiable certificates, guaranteed EASA compliance.",
      demo: "Request a demo", viewCatalogue: "View the catalogue",
      t1: "Part-147 approved", t2: "Qualiopi certified", t3: "CPF / OPCO eligible",
      stats: [{ v: "500+", l: "Learners trained" }, { v: "8", l: "Domains covered" }, { v: "100%", l: "EASA compliance" }],
    },
    trust: ["EASA Part-147", "Part-66 licences", "EN & FR", "Verifiable certificates"],
    about: {
      eyebrow: "WHO WE ARE", title: "A Part-147 organisation that thinks like an operator",
      sub: "R-AERO Training Academy designs regulatory training with field experts and delivers it on a modern platform. Technicians, MROs, airlines and CAMOs manage all their obligations from a single place.",
      bullets: ["Content validated by Part-147 experts", "PDF certificates with a verification QR code", "Automated recurrency tracking", "Audit reporting exportable to CSV"],
      cards: [{ v: "8", l: "Training domains", s: "HF, FTS, EWIS, QT, SMS…" }, { v: "500+", l: "Certified learners", s: "Technicians & companies" }, { v: "30+", l: "Client companies", s: "MRO, Part-145, CAMO" }, { v: "100%", l: "EASA compliance", s: "Part-147 validated training" }],
    },
    comp: {
      eyebrow: "COMPLIANCE & APPROVALS", title: "Built to pass your audits, not just your exams",
      sub: "Every path aligns with current EASA requirements and produces full traceability, ready for your Part-145 and CAMO audits.",
      cards: [{ t: "Part-147 & Part-66 approval", d: "Basic regulatory training and type ratings, compliant with the EASA framework." }, { t: "Full traceability", d: "Time spent, completed modules, exam scores and completion dates recorded per learner." }, { t: "Verifiable certificates", d: "Each certificate carries a number and a QR code, publicly verifiable online by an auditor." }],
      verify: "Verify a certificate",
    },
    cat: {
      eyebrow: "CATALOGUE", title: "Part-147 regulatory training",
      sub: "E-learning, type ratings and classroom sessions, compliant with current EASA requirements.", all: "Full catalogue",
      domains: [
        { name: "Human Factors", tag: "Recurrent 24 months", desc: "Initial and recurrent human factors training, compliant with Part-145 / Part-147." },
        { name: "Fuel Tank Safety", tag: "CDCCL", desc: "Fuel tank safety and critical design configuration control limitations." },
        { name: "EWIS", tag: "AMC 20-22", desc: "Electrical Wiring Interconnection Systems: wiring inspection and maintenance." },
        { name: "SMS", tag: "Safety", desc: "Safety Management System: policy, risk management and safety culture." },
        { name: "Type Rating (QT)", tag: "A320 · B737 · ATR…", desc: "Theoretical type ratings for certifying staff." },
        { name: "Part-66 modules", tag: "Licence", desc: "Preparation for the Part-66 basic theoretical exams." },
      ],
    },
    feat: {
      eyebrow: "THE PLATFORM", title: "More than a catalogue: a real platform",
      sub: "Where traditional providers stop at a PDF, R-AERO digitalises the entire Part-147 training journey.",
      items: [
        { t: "E-learning player", d: "Slide-based courses: image, video, narration and mini-quiz. Progress saved automatically." },
        { t: "AI course maker", d: "Produce complete modules in minutes — outline, text, images and voice generated, then reviewed." },
        { t: "Exams & certificates", d: "Configurable graded exams and numbered PDF certificates, publicly verifiable by QR code." },
        { t: "Automated recurrencies", d: "HF / FTS / EWIS deadlines tracked per employee, with OK / due-soon / overdue indicators." },
        { t: "Sessions & webinars", d: "Calendar of classroom sessions, virtual classes and webinars with online registration." },
        { t: "Compliance reporting", d: "Training records exportable to CSV for your Part-145 / CAMO audits." },
      ],
    },
    ent: {
      rows: [{ e: "OK", t: "Human Factors", n: "Amélie R. — B2", d: "up to date · due in 8 months" }, { e: "DUE SOON", t: "EWIS", n: "Marc L. — B1", d: "renew within 30 days" }, { e: "OVERDUE", t: "Fuel Tank Safety", n: "Karim B. — Support", d: "deadline passed" }],
      preview: "Recurrency dashboard — preview",
      eyebrow: "FOR COMPANIES", title: "Steer the compliance of all your teams",
      sub: "Import your employees, assign mandatory trainings and let the platform track recurrencies. One dashboard, alerts, and an audit export in one click.",
      items: [{ t: "Employee management", d: "Manual creation or bulk CSV import." }, { t: "Automatic recurrencies", d: "Deadlines per profile with colour indicators." }, { t: "All-inclusive plan", d: "Annual subscription, unlimited catalogue access." }, { t: "Audit reporting", d: "CSV export of completed trainings." }],
      cta: "Request a company demo",
    },
    price: {
      eyebrow: "PRICING", title: "Plans for every organisation",
      sub: "From single purchases for a technician to an all-inclusive subscription for a whole workforce.", recommended: "RECOMMENDED",
      plans: [
        { name: "Individual", price: "per training", desc: "For technicians and freelancers.", features: ["Access to the e-learning catalogue", "Quiz & final exam", "Verifiable PDF certificate", "Secure online payment"], cta: "View the catalogue", href: "/catalogue", highlight: false },
        { name: "Company", price: "per licence", desc: "For MROs, Part-145 and CAMOs.", features: ["Employee management + CSV import", "Training assignment", "Recurrency tracking", "CSV audit reporting", "Inter-company sessions"], cta: "Request a demo", href: "#demo", highlight: true },
        { name: "All-inclusive", price: "annual subscription", desc: "Unlimited access for the whole team.", features: ["Everything in Company", "Unlimited catalogue", "Automatic renewal", "Webinars included", "Dedicated account manager"], cta: "Contact us", href: "/devis", highlight: false },
      ] as PlanCopy[],
      note: "Company pricing and volumes on quote. Trainings eligible for CPF / OPCO funding where applicable.",
    },
    test: {
      eyebrow: "TRUSTED BY", title: "Adopted by maintenance teams",
      items: [
        { q: "Recurrency tracking saved us huge time before audits. Everything is centralised and exportable.", n: "Sophie M.", r: "Training Manager, MRO Part-145" },
        { q: "I took my Human Factors course on a Sunday evening and got my certificate instantly. Unbeatable.", n: "Marc L.", r: "B1 technician" },
        { q: "The AI course maker lets us produce our internal modules in a few hours.", n: "Claire M.", r: "Head of training" },
      ],
      sectors: ["MRO / Part-145", "Airlines", "CAMO", "Part-147 schools", "Helicopter workshops"],
    },
    faq: {
      eyebrow: "FAQ", title: "Frequently asked questions",
      items: [
        { q: "Are your trainings EASA-recognised?", a: "Yes. R-AERO Training Academy is an EASA Part-147 approved organisation. Our trainings align with current requirements (Part-145, Part-66) and each certificate is numbered and verifiable." },
        { q: "What training formats do you offer?", a: "Self-paced e-learning, live virtual classes, webinars and inter-company classroom sessions. Some trainings combine several formats." },
        { q: "In which language are the trainings?", a: "The interface and content are available in English and French. The language switcher is at the top of the page." },
        { q: "How do recurrencies work?", a: "For each employee, the platform computes the next deadline of a recurrent training (e.g. HF every 24 months) and shows an OK / due-soon / overdue indicator, with export for your audits." },
        { q: "Are trainings fundable (CPF / OPCO)?", a: "We are Qualiopi certified. Some trainings are eligible for CPF or OPCO funding. Contact us to review your funding options." },
        { q: "What happens to my data?", a: "Data is hosted in the European Union and processed in accordance with the GDPR. You have rights of access, rectification and erasure." },
      ],
    },
    cta: { title: "Ready to digitalise your training obligations?", sub: "Book a demo of the company platform, or explore the e-learning catalogue right now.", demo: "Request a demo" },
    footer: {
      tagline: "EASA Part-147 approved training organisation. Excellence in regulatory aviation training.",
      platformTitle: "Platform", resourcesTitle: "Resources",
      platformLinks: [{ l: "Catalogue", h: "/catalogue" }, { l: "Upcoming sessions", h: "/sessions" }, { l: "News", h: "/actualites" }, { l: "Webinars", h: "/webinars" }, { l: "Companies", h: "/entreprise" }],
      resourceLinks: [{ l: "Glossary", h: "/glossaire" }, { l: "Verify a certificate", h: "/verification" }, { l: "About", h: "/about" }, { l: "Request a quote", h: "/devis" }, { l: "Legal notice", h: "/legal" }],
      legalLinks: [{ l: "Legal notice", h: "/legal" }, { l: "GDPR", h: "/legal" }, { l: "Contact", h: "/contact" }],
      copyright: "All rights reserved. EASA Part-147 approved organisation.",
    },
    catalogueDownload: "Download the catalogue (PDF)",
  },
  fr: {
    nav: { formations: "Formations", platform: "Plateforme", companies: "Entreprises", pricing: "Tarifs", faq: "FAQ", myspace: "Mon espace", login: "Connexion", demo: "Demander une démo", demoShort: "Démo", catalogue: "Catalogue" },
    hero: {
      badge: "ORGANISME AGRÉÉ EASA PART-147",
      titleMain: "La formation maintenance aéronautique,", titleAccent: "enfin en ligne.",
      sub: "Catalogue e-learning (HF, FTS, EWIS, QT…), sessions programmées et plateforme de gestion des récurrences pour MRO, compagnies et CAMO. Achat et accès instantanés, certificats vérifiables, conformité EASA garantie.",
      demo: "Demander une démo", viewCatalogue: "Voir le catalogue",
      t1: "Agréé Part-147", t2: "Certifié Qualiopi", t3: "Éligible CPF / OPCO",
      stats: [{ v: "500+", l: "Apprenants formés" }, { v: "8", l: "Domaines couverts" }, { v: "100%", l: "Conformité EASA" }],
    },
    trust: ["EASA Part-147", "Licences Part-66", "FR & EN", "Certificats vérifiables"],
    about: {
      eyebrow: "QUI SOMMES-NOUS", title: "Un organisme Part-147 qui pense comme un opérateur",
      sub: "R-AERO Training Academy conçoit des formations réglementaires avec des experts terrain, et les délivre sur une plateforme moderne. Techniciens, MRO, compagnies et CAMO gèrent l'intégralité de leurs obligations depuis un seul espace.",
      bullets: ["Contenu validé par des experts Part-147", "Certificats PDF avec QR de vérification", "Suivi des récurrences automatisé", "Reporting d'audit exportable en CSV"],
      cards: [{ v: "8", l: "Domaines de formation", s: "HF, FTS, EWIS, QT, SMS…" }, { v: "500+", l: "Apprenants certifiés", s: "Techniciens & entreprises" }, { v: "30+", l: "Entreprises clientes", s: "MRO, Part-145, CAMO" }, { v: "100%", l: "Conformité EASA", s: "Formations validées Part-147" }],
    },
    comp: {
      eyebrow: "CONFORMITÉ & AGRÉMENTS", title: "Conçu pour passer vos audits, pas seulement vos examens",
      sub: "Chaque parcours est aligné sur les exigences EASA en vigueur et produit une traçabilité complète, prête pour vos audits Part-145 et CAMO.",
      cards: [{ t: "Agrément Part-147 & Part-66", d: "Formations réglementaires de base et qualifications de type, conformes au référentiel EASA." }, { t: "Traçabilité totale", d: "Temps passé, modules complétés, scores d'examen et dates de complétion enregistrés par apprenant." }, { t: "Certificats vérifiables", d: "Chaque certificat porte un numéro et un QR code, vérifiables publiquement en ligne par un auditeur." }],
      verify: "Vérifier un certificat",
    },
    cat: {
      eyebrow: "CATALOGUE", title: "Des formations réglementaires Part-147",
      sub: "E-learning, qualifications de type et sessions présentielles, conformes aux exigences EASA en vigueur.", all: "Tout le catalogue",
      domains: [
        { name: "Human Factors", tag: "Récurrent 24 mois", desc: "Formation initiale et recyclage facteurs humains, conforme Part-145 / Part-147." },
        { name: "Fuel Tank Safety", tag: "CDCCL", desc: "Sécurité des réservoirs de carburant et limitations de conception critiques." },
        { name: "EWIS", tag: "AMC 20-22", desc: "Electrical Wiring Interconnection Systems : inspection et maintenance du câblage." },
        { name: "SMS", tag: "Sécurité", desc: "Safety Management System : politique, gestion du risque et culture sécurité." },
        { name: "Type Rating (QT)", tag: "A320 · B737 · ATR…", desc: "Qualifications de type théoriques pour personnel certifiant." },
        { name: "Modules Part-66", tag: "Licence", desc: "Préparation aux examens théoriques de base de la licence Part-66." },
      ],
    },
    feat: {
      eyebrow: "LA PLATEFORME", title: "Plus qu'un catalogue : une vraie plateforme",
      sub: "Là où les organismes classiques s'arrêtent au PDF, R-AERO digitalise tout le parcours de formation Part-147.",
      items: [
        { t: "Lecteur e-learning", d: "Cours en slides : image, vidéo, narration et mini-quiz. Progression sauvegardée automatiquement." },
        { t: "Créateur de cours par IA", d: "Produisez des modules complets en minutes — plans, textes, images et voix générés puis validés." },
        { t: "Examens & certificats", d: "Examens notés paramétrables et certificats PDF numérotés, vérifiables publiquement par QR code." },
        { t: "Récurrences automatisées", d: "Échéances HF / FTS / EWIS suivies par employé, avec indicateurs OK / bientôt dû / en retard." },
        { t: "Sessions & webinars", d: "Calendrier de sessions présentielles, classes virtuelles et webinars avec inscription en ligne." },
        { t: "Reporting de conformité", d: "Dossiers de formation exportables en CSV pour vos audits Part-145 / CAMO." },
      ],
    },
    ent: {
      rows: [{ e: "OK", t: "Human Factors", n: "Amélie R. — B2", d: "à jour · échéance dans 8 mois" }, { e: "BIENTÔT", t: "EWIS", n: "Marc L. — B1", d: "à renouveler dans 30 jours" }, { e: "EN RETARD", t: "Fuel Tank Safety", n: "Karim B. — Support", d: "échéance dépassée" }],
      preview: "Tableau de bord des récurrences — aperçu",
      eyebrow: "POUR LES ENTREPRISES", title: "Pilotez la conformité de toutes vos équipes",
      sub: "Importez vos employés, attribuez les formations obligatoires et laissez la plateforme suivre les récurrences. Un tableau de bord, des alertes, et un export d'audit en un clic.",
      items: [{ t: "Gestion des employés", d: "Création manuelle ou import CSV en masse." }, { t: "Récurrences automatiques", d: "Échéances par profil et indicateurs de couleur." }, { t: "Offre all-inclusive", d: "Abonnement annuel, accès illimité au catalogue." }, { t: "Reporting d'audit", d: "Export CSV des formations réalisées." }],
      cta: "Demander une démo entreprise",
    },
    price: {
      eyebrow: "TARIFS", title: "Des offres pour chaque structure",
      sub: "De l'achat à l'unité pour un technicien à l'abonnement all-inclusive pour toute une flotte de personnels.", recommended: "RECOMMANDÉ",
      plans: [
        { name: "Individuel", price: "à la formation", desc: "Pour les techniciens et freelances.", features: ["Accès au catalogue e-learning", "Quiz & examen final", "Certificat PDF vérifiable", "Paiement sécurisé en ligne"], cta: "Voir le catalogue", href: "/catalogue", highlight: false },
        { name: "Entreprise", price: "par licence", desc: "Pour les MRO, Part-145 et CAMO.", features: ["Gestion des employés + import CSV", "Attribution de formations", "Suivi des récurrences", "Reporting d'audit CSV", "Sessions inter-entreprises"], cta: "Demander une démo", href: "#demo", highlight: true },
        { name: "All-inclusive", price: "abonnement annuel", desc: "Accès illimité pour toute l'équipe.", features: ["Tout le plan Entreprise", "Catalogue illimité", "Renouvellement automatique", "Webinars inclus", "Account manager dédié"], cta: "Nous contacter", href: "/devis", highlight: false },
      ] as PlanCopy[],
      note: "Tarifs entreprise et volumes sur devis. Formations éligibles à un financement CPF / OPCO selon dispositifs.",
    },
    test: {
      eyebrow: "ILS NOUS FONT CONFIANCE", title: "Adopté par les équipes de maintenance",
      items: [
        { q: "Le suivi des récurrences nous a fait gagner un temps fou avant nos audits. Tout est centralisé et exportable.", n: "Sophie M.", r: "Training Manager, MRO Part-145" },
        { q: "J'ai passé ma formation Human Factors un dimanche soir et reçu mon certificat immédiatement. Imbattable.", n: "Marc L.", r: "Technicien B1" },
        { q: "Le créateur de cours par IA nous permet de produire nos modules internes en quelques heures.", n: "Claire M.", r: "Responsable pédagogique" },
      ],
      sectors: ["MRO / Part-145", "Compagnies aériennes", "CAMO", "Écoles Part-147", "Ateliers hélicoptères"],
    },
    faq: {
      eyebrow: "FAQ", title: "Questions fréquentes",
      items: [
        { q: "Vos formations sont-elles reconnues EASA ?", a: "Oui. R-AERO Training Academy est un organisme agréé EASA Part-147. Nos formations sont alignées sur les exigences réglementaires en vigueur (Part-145, Part-66) et chaque certificat est numéroté et vérifiable." },
        { q: "Quels formats de formation proposez-vous ?", a: "E-learning auto-rythmé, classes virtuelles en direct, webinars et sessions présentielles inter-entreprises. Certaines formations combinent plusieurs formats." },
        { q: "En quelle langue sont les formations ?", a: "L'interface et les contenus sont disponibles en français et en anglais. Le sélecteur de langue est accessible en haut de page." },
        { q: "Comment fonctionnent les récurrences ?", a: "Pour chaque employé, la plateforme calcule la prochaine échéance d'une formation récurrente (ex. HF tous les 24 mois) et affiche un indicateur OK / bientôt dû / en retard, avec export pour vos audits." },
        { q: "Les formations sont-elles finançables (CPF / OPCO) ?", a: "Nous sommes certifiés Qualiopi. Certaines formations sont éligibles au CPF ou à une prise en charge OPCO. Contactez-nous pour étudier votre financement." },
        { q: "Que deviennent mes données ?", a: "Les données sont hébergées dans l'Union Européenne et traitées conformément au RGPD. Vous disposez d'un droit d'accès, de rectification et d'effacement." },
      ],
    },
    cta: { title: "Prêt à digitaliser vos obligations de formation ?", sub: "Réservez une démo de la plateforme entreprise, ou explorez le catalogue e-learning dès maintenant.", demo: "Demander une démo" },
    footer: {
      tagline: "Organisme de formation agréé EASA Part-147. Excellence en formation aéronautique réglementaire.",
      platformTitle: "Plateforme", resourcesTitle: "Ressources",
      platformLinks: [{ l: "Catalogue", h: "/catalogue" }, { l: "Sessions à venir", h: "/sessions" }, { l: "Actualités", h: "/actualites" }, { l: "Webinars", h: "/webinars" }, { l: "Entreprises", h: "/entreprise" }],
      resourceLinks: [{ l: "Glossaire", h: "/glossaire" }, { l: "Vérifier un certificat", h: "/verification" }, { l: "À propos", h: "/about" }, { l: "Demander un devis", h: "/devis" }, { l: "Mentions légales", h: "/legal" }],
      legalLinks: [{ l: "Mentions légales", h: "/legal" }, { l: "RGPD", h: "/legal" }, { l: "Contact", h: "/contact" }],
      copyright: "Tous droits réservés. Organisme agréé EASA Part-147.",
    },
    catalogueDownload: "Télécharger le catalogue (PDF)",
  },
};

const TRUST_ICONS = [Award, BadgeCheck, Shield, GraduationCap, Wallet, Globe, ShieldCheck];
const DOMAIN_ICONS = [Brain, Shield, Zap, BarChart3, Plane, BookOpen];
const FEAT_ICONS = [MonitorPlay, Sparkles, FileCheck2, RefreshCw, Calendar, ShieldCheck];
const COMP_ICONS = [Award, FileCheck2, ShieldCheck];
const ABOUT_ICONS = [BookOpen, Users, Building2, Award];
const ENT_ICONS = [Users, RefreshCw, Wallet, BarChart3];
const ENT_ROW_COLORS = ["#3aa76d", C.gold, "#d9534f"];

function smoothTo(id: string) {
  return (e: React.MouseEvent) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); };
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar({ cartCount }: { cartCount: number }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { isAuthenticated } = useAuth();
  const { lang, setLang } = useI18n();
  const c = COPY[lang] ?? COPY.fr;
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const links = [
    { label: c.nav.formations, id: "formations" },
    { label: c.nav.platform, id: "plateforme" },
    { label: c.nav.companies, id: "entreprises" },
    { label: c.nav.pricing, id: "tarifs" },
    { label: c.nav.faq, id: "faq" },
  ];
  return (
    <nav className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
      style={{ background: scrolled ? "rgba(0,37,84,0.97)" : "rgba(0,37,84,0.6)", backdropFilter: "blur(14px)", borderBottom: scrolled ? `1px solid ${C.gold}33` : "1px solid transparent" }}>
      <div className="mx-auto max-w-[1280px] px-5 flex items-center justify-between h-16">
        <a href="#top" onClick={smoothTo("top")} className="flex items-center gap-3 cursor-pointer">
          <img src={LOGO_EMBLEM} alt={BRAND_NAME} className="h-10 w-auto" />
          <span className="hidden sm:block leading-tight">
            <span className="block font-bold text-white tracking-wide" style={{ fontFamily: HEADING }}>{BRAND_NAME}</span>
            <span className="block text-[10px] tracking-[0.2em]" style={{ color: C.gold }}>TRAINING ACADEMY</span>
          </span>
        </a>
        <div className="hidden lg:flex items-center gap-7">
          {links.map((l) => (
            <a key={l.id} href={`#${l.id}`} onClick={smoothTo(l.id)} className="text-sm text-white/80 hover:text-white transition-colors">{l.label}</a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center rounded-lg overflow-hidden" style={{ border: `1px solid ${C.gold}66` }}>
            {(["en", "fr"] as const).map((l) => (
              <button key={l} onClick={() => setLang(l)} className="px-2 py-1 text-[11px] font-bold transition-colors"
                style={{ background: lang === l ? C.gold : "transparent", color: lang === l ? C.blue : "rgba(255,255,255,0.8)" }}>{l.toUpperCase()}</button>
            ))}
          </div>
          <Link href="/cart">
            <button className="relative p-2 text-white/80 hover:text-white"><ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: C.gold, color: C.blue }}>{cartCount}</span>}
            </button>
          </Link>
          {isAuthenticated ? (
            <Link href="/dashboard"><Button size="sm" style={{ background: C.gold, color: C.blue }}>{c.nav.myspace}</Button></Link>
          ) : (
            <>
              <Link href="/login"><Button variant="ghost" size="sm" className="hidden sm:inline-flex text-white/80 hover:text-white hover:bg-white/10"><LogIn className="w-4 h-4 mr-1" /> {c.nav.login}</Button></Link>
            </>
          )}
          <button className="lg:hidden text-white p-1" onClick={() => setOpen(!open)}>{open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}</button>
        </div>
      </div>
      {open && (
        <div className="lg:hidden border-t px-5 py-4 flex flex-col gap-3" style={{ background: C.blue, borderColor: `${C.gold}33` }}>
          {links.map((l) => <a key={l.id} href={`#${l.id}`} onClick={(e) => { smoothTo(l.id)(e); setOpen(false); }} className="text-white/80 py-1">{l.label}</a>)}
          <Link href="/catalogue"><span className="block text-white/80 py-1">{c.nav.catalogue}</span></Link>
          <div className="flex items-center gap-2 pt-1">
            {(["en", "fr"] as const).map((l) => (
              <button key={l} onClick={() => setLang(l)} className="px-3 py-1 text-xs font-bold rounded-md"
                style={{ background: lang === l ? C.gold : "transparent", color: lang === l ? C.blue : "rgba(255,255,255,0.8)", border: `1px solid ${C.gold}66` }}>{l.toUpperCase()}</button>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <Link href="/login" className="flex-1"><Button variant="outline" size="sm" className="w-full text-white border-white/30">{c.nav.login}</Button></Link>
            <a href="#demo" onClick={(e) => { smoothTo("demo")(e); setOpen(false); }} className="flex-1"><Button size="sm" className="w-full" style={{ background: C.gold, color: C.blue }}>{c.nav.demoShort}</Button></a>
          </div>
        </div>
      )}
    </nav>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-bold tracking-[0.18em] mb-3" style={{ color: C.goldDark }}>{children}</div>;
}
function SectionHead({ eyebrow, title, sub, light }: { eyebrow: string; title: string; sub?: string; light?: boolean }) {
  return (
    <div className="max-w-2xl" data-reveal>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="text-3xl md:text-4xl font-bold leading-tight" style={{ fontFamily: HEADING, color: light ? "#fff" : C.blue }}>{title}</h2>
      {sub && <p className="mt-4 text-base md:text-lg leading-relaxed" style={{ color: light ? "rgba(255,255,255,0.7)" : C.muted }}>{sub}</p>}
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-4 text-left px-5 py-4">
        <span className="font-semibold" style={{ color: C.blue }}>{q}</span>
        {open ? <Minus className="w-4 h-4 shrink-0" style={{ color: C.goldDark }} /> : <Plus className="w-4 h-4 shrink-0" style={{ color: C.goldDark }} />}
      </button>
      {open && <div className="px-5 pb-4 text-sm leading-relaxed" style={{ color: C.muted }}>{a}</div>}
    </div>
  );
}

function CataloguePdfButton({ label }: { label: string }) {
  const gen = trpc.public.cataloguePdf.useMutation({ onSuccess: (r) => { if (r?.url) window.open(r.url, "_blank"); } });
  return (
    <Button size="lg" disabled={gen.isPending} onClick={() => gen.mutate()} variant="outline"
      style={{ borderColor: "rgba(255,255,255,0.35)", color: "#fff", background: "transparent" }}>
      {gen.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
      {label}
    </Button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const { isAuthenticated } = useAuth();
  const { lang, t } = useI18n();
  const c = COPY[lang] ?? COPY.fr;
  const { data: cartData } = trpc.cart.count.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const cartCount = cartData ?? 0;
  const root = useRef<HTMLDivElement>(null);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    const SEL = "[data-hero] > *, [data-reveal], [data-stagger] > *";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.from("[data-hero] > *", { y: 24, opacity: 0, duration: 0.7, stagger: 0.12, ease: "power2.out", delay: 0.05 });
      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
        gsap.from(el, { scrollTrigger: { trigger: el, start: "top 88%" }, y: 30, opacity: 0, duration: 0.6, ease: "power2.out" });
      });
      gsap.utils.toArray<HTMLElement>("[data-stagger]").forEach((grid) => {
        gsap.from(grid.children, { scrollTrigger: { trigger: grid, start: "top 88%" }, y: 30, opacity: 0, duration: 0.6, stagger: 0.1, ease: "power2.out" });
      });
    }, root);
    // Fail-safe: if rAF is throttled (background tab) and tweens don't progress,
    // force the final visible state so content is never stuck hidden.
    const failsafe = window.setTimeout(() => {
      try { gsap.set(SEL, { opacity: 1, y: 0, clearProps: "transform" }); } catch { /* noop */ }
    }, 1600);
    return () => { window.clearTimeout(failsafe); ctx.revert(); };
  }, []);

  return (
    <div ref={root} id="top" style={{ background: C.ivory, color: C.text, fontFamily: "'Lato', system-ui, sans-serif" }}>
      <Navbar cartCount={cartCount} />

      {/* ── Hero ── */}
      <header className="relative overflow-hidden" style={{ background: `linear-gradient(160deg, ${C.blue} 0%, ${C.blueDark} 60%, #00264f 100%)` }}>
        <video
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-out"
          style={{ opacity: videoReady ? 1 : 0 }}
          autoPlay muted loop playsInline preload="auto" aria-hidden="true"
          onLoadedData={() => setVideoReady(true)}
          onCanPlay={() => setVideoReady(true)}
        >
          <source src="/video/hereo.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,37,84,0.70) 0%, rgba(0,37,84,0.20) 26%, rgba(0,37,84,0.12) 62%, rgba(0,24,51,0.55) 100%)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(0,37,84,0.78) 0%, rgba(0,37,84,0.40) 46%, rgba(0,37,84,0) 82%)" }} />
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: `radial-gradient(${C.gold} 1px, transparent 1px)`, backgroundSize: "30px 30px" }} />
        <div className="relative z-10 mx-auto max-w-[1280px] px-5 pt-28 pb-24 grid lg:grid-cols-2 gap-12 items-center">
          <div data-hero>
            <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold tracking-wide mb-6" style={{ background: `${C.gold}1f`, color: C.gold, border: `1px solid ${C.gold}55` }}>
              <Award className="w-3.5 h-3.5" /> {c.hero.badge}
            </span>
            <h1 className="text-4xl md:text-5xl xl:text-6xl font-bold text-white leading-[1.05]" style={{ fontFamily: HEADING }}>
              {c.hero.titleMain} <span style={{ color: C.gold }}>{c.hero.titleAccent}</span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-white/75 max-w-xl">{c.hero.sub}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#demo" onClick={smoothTo("demo")}><Button size="lg" className="font-semibold" style={{ background: C.gold, color: C.blue }}>{c.hero.demo} <ArrowRight className="w-4 h-4 ml-2" /></Button></a>
              <Link href="/catalogue"><Button size="lg" variant="outline" className="font-semibold text-white border-white/30 hover:bg-white/10">{c.hero.viewCatalogue}</Button></Link>
            </div>
          </div>
          <div className="hidden lg:flex flex-col items-center gap-6" data-hero>
            <img src={LOGO_EMBLEM} alt={BRAND_NAME} className="w-44" style={{ filter: `drop-shadow(0 12px 40px ${C.gold}40)` }} />
            <div className="grid grid-cols-3 gap-4 w-full">
              {c.hero.stats.map((s: any) => (
                <div key={s.l} className="rounded-xl p-4 text-center" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <div className="text-2xl font-bold" style={{ fontFamily: HEADING, color: C.gold }}>{s.v}</div>
                  <div className="text-[11px] text-white/55 mt-1">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 inset-x-0 leading-none z-10">
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" style={{ width: "100%", height: 56, display: "block" }}><path d="M0 60L1440 60L1440 18C1180 58 720 0 0 38Z" fill={C.ivory} /></svg>
        </div>
      </header>

      {/* ── Trust strip ── */}
      <section className="py-8 border-b" style={{ borderColor: C.border }}>
        <div className="mx-auto max-w-[1280px] px-5 flex flex-wrap justify-center items-center gap-x-8 gap-y-3" data-stagger>
          {c.trust.map((label: string, i: number) => {
            const Icon = TRUST_ICONS[i];
            return <div key={label} className="flex items-center gap-2"><Icon className="w-4 h-4" style={{ color: C.goldDark }} /><span className="text-sm font-semibold" style={{ color: C.blue }}>{label}</span></div>;
          })}
        </div>
      </section>

      {/* ── About ── */}
      <section className="py-20 md:py-24">
        <div className="mx-auto max-w-[1280px] px-5 grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <SectionHead eyebrow={c.about.eyebrow} title={c.about.title} sub={c.about.sub} />
            <div className="mt-8 grid sm:grid-cols-2 gap-4" data-stagger>
              {c.about.bullets.map((t: string) => (
                <div key={t} className="flex items-start gap-2"><CheckCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: C.goldDark }} /><span className="text-sm" style={{ color: C.muted }}>{t}</span></div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4" data-stagger>
            {c.about.cards.map((card: any, i: number) => {
              const Icon = ABOUT_ICONS[i];
              return (
                <div key={card.l} className="rounded-2xl p-6" style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 4px 20px rgba(0,37,84,0.05)" }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: C.goldSoft }}><Icon className="w-5 h-5" style={{ color: C.goldDark }} /></div>
                  <div className="text-3xl font-bold" style={{ fontFamily: HEADING, color: C.blue }}>{card.v}</div>
                  <div className="text-sm font-semibold mt-1" style={{ color: C.text }}>{card.l}</div>
                  <div className="text-xs mt-0.5" style={{ color: C.faint }}>{card.s}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Compliance ── */}
      <section className="py-20 md:py-24" style={{ background: C.blue }}>
        <div className="mx-auto max-w-[1280px] px-5">
          <div className="text-center max-w-2xl mx-auto" data-reveal>
            <Eyebrow>{c.comp.eyebrow}</Eyebrow>
            <h2 className="text-3xl md:text-4xl font-bold text-white" style={{ fontFamily: HEADING }}>{c.comp.title}</h2>
            <p className="mt-4 text-white/70">{c.comp.sub}</p>
          </div>
          <div className="mt-12 grid md:grid-cols-3 gap-5" data-stagger>
            {c.comp.cards.map((card: any, i: number) => {
              const Icon = COMP_ICONS[i];
              return (
                <div key={card.t} className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <div className="w-11 h-11 rounded-lg flex items-center justify-center mb-4" style={{ background: `${C.gold}26` }}><Icon className="w-5 h-5" style={{ color: C.gold }} /></div>
                  <h3 className="font-bold text-white mb-2" style={{ fontFamily: HEADING }}>{card.t}</h3>
                  <p className="text-sm text-white/65 leading-relaxed">{card.d}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-8 text-center" data-reveal>
            <Link href="/verification" className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: C.gold }}>{c.comp.verify} <ChevronRight className="w-4 h-4" /></Link>
          </div>
        </div>
      </section>

      {/* ── Formations ── */}
      <section id="formations" className="py-20 md:py-24">
        <div className="mx-auto max-w-[1280px] px-5">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-12">
            <SectionHead eyebrow={c.cat.eyebrow} title={c.cat.title} sub={c.cat.sub} />
            <Link href="/catalogue"><Button variant="outline" style={{ borderColor: C.blue, color: C.blue }}>{c.cat.all} <ArrowRight className="w-4 h-4 ml-1" /></Button></Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5" data-stagger>
            {c.cat.domains.map((d: any, i: number) => {
              const Icon = DOMAIN_ICONS[i];
              return (
                <Link key={d.name} href="/catalogue">
                  <div className="group rounded-2xl p-6 h-full cursor-pointer transition-all" style={{ background: C.surface, border: `1px solid ${C.border}` }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.boxShadow = "0 10px 30px rgba(0,37,84,0.08)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = "none"; }}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-11 h-11 rounded-lg flex items-center justify-center" style={{ background: C.goldSoft }}><Icon className="w-5 h-5" style={{ color: C.goldDark }} /></div>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${C.blue}0d`, color: C.blueAccent }}>{d.tag}</span>
                    </div>
                    <h3 className="text-lg font-bold mb-1" style={{ fontFamily: HEADING, color: C.blue }}>{d.name}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{d.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Plateforme / features ── */}
      <section id="plateforme" className="py-20 md:py-24" style={{ background: C.surface }}>
        <div className="mx-auto max-w-[1280px] px-5">
          <div className="text-center max-w-2xl mx-auto mb-14"><SectionHead eyebrow={c.feat.eyebrow} title={c.feat.title} sub={c.feat.sub} /></div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5" data-stagger>
            {c.feat.items.map((f: any, i: number) => {
              const Icon = FEAT_ICONS[i];
              return (
                <div key={f.t} className="rounded-2xl p-6" style={{ background: C.ivory, border: `1px solid ${C.border}` }}>
                  <div className="w-11 h-11 rounded-lg flex items-center justify-center mb-4" style={{ background: C.goldSoft }}><Icon className="w-5 h-5" style={{ color: C.goldDark }} /></div>
                  <h3 className="font-bold mb-2" style={{ fontFamily: HEADING, color: C.blue }}>{f.t}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{f.d}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Entreprises ── */}
      <section id="entreprises" className="py-20 md:py-24">
        <div className="mx-auto max-w-[1280px] px-5 grid lg:grid-cols-2 gap-14 items-center">
          <div className="rounded-2xl p-8 order-2 lg:order-1" style={{ background: `linear-gradient(160deg, ${C.blue}, ${C.blueDark})` }} data-reveal>
            <div className="space-y-3" data-stagger>
              {c.ent.rows.map((r: any, i: number) => (
                <div key={r.n} className="flex items-center gap-3 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-md shrink-0" style={{ background: `${ENT_ROW_COLORS[i]}26`, color: ENT_ROW_COLORS[i] }}>{r.e}</span>
                  <div className="flex-1 min-w-0"><div className="text-sm font-semibold text-white">{r.t}</div><div className="text-xs text-white/55">{r.n} · {r.d}</div></div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-xs text-white/50 text-center">{c.ent.preview}</div>
          </div>
          <div className="order-1 lg:order-2">
            <SectionHead eyebrow={c.ent.eyebrow} title={c.ent.title} sub={c.ent.sub} />
            <div className="mt-8 grid sm:grid-cols-2 gap-4" data-stagger>
              {c.ent.items.map((it: any, i: number) => {
                const Icon = ENT_ICONS[i];
                return (
                  <div key={it.t} className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: C.goldSoft }}><Icon className="w-4 h-4" style={{ color: C.goldDark }} /></div>
                    <div><div className="font-semibold text-sm" style={{ color: C.blue }}>{it.t}</div><div className="text-xs mt-0.5" style={{ color: C.muted }}>{it.d}</div></div>
                  </div>
                );
              })}
            </div>
            <a href="#demo" onClick={smoothTo("demo")}><Button size="lg" className="mt-8 font-semibold" style={{ background: C.blue, color: "#fff" }}>{c.ent.cta} <ArrowRight className="w-4 h-4 ml-2" /></Button></a>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="tarifs" className="py-20 md:py-24" style={{ background: C.surface }}>
        <div className="mx-auto max-w-[1280px] px-5">
          <div className="text-center max-w-2xl mx-auto mb-14"><SectionHead eyebrow={c.price.eyebrow} title={c.price.title} sub={c.price.sub} /></div>
          <div className="grid md:grid-cols-3 gap-6 items-stretch" data-stagger>
            {c.price.plans.map((p: PlanCopy) => (
              <div key={p.name} className="rounded-2xl p-7 flex flex-col" style={{ background: p.highlight ? C.blue : C.ivory, border: `1px solid ${p.highlight ? C.blue : C.border}`, boxShadow: p.highlight ? "0 16px 40px rgba(0,37,84,0.18)" : "none", transform: p.highlight ? "scale(1.02)" : "none" }}>
                {p.highlight && <span className="self-start text-[11px] font-bold px-2 py-0.5 rounded-full mb-3" style={{ background: C.gold, color: C.blue }}>{c.price.recommended}</span>}
                <h3 className="text-xl font-bold" style={{ fontFamily: HEADING, color: p.highlight ? "#fff" : C.blue }}>{p.name}</h3>
                <div className="mt-1 text-sm" style={{ color: p.highlight ? "rgba(255,255,255,0.7)" : C.faint }}>{p.desc}</div>
                <div className="mt-4 mb-5 text-lg font-bold" style={{ color: p.highlight ? C.gold : C.goldDark }}>{p.price}</div>
                <ul className="space-y-2.5 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm" style={{ color: p.highlight ? "rgba(255,255,255,0.85)" : C.muted }}>
                      <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: p.highlight ? C.gold : C.goldDark }} /> {f}
                    </li>
                  ))}
                </ul>
                {p.href.startsWith("#")
                  ? <a href={p.href} onClick={smoothTo(p.href.slice(1))} className="mt-6"><Button className="w-full font-semibold" style={{ background: p.highlight ? C.gold : C.blue, color: p.highlight ? C.blue : "#fff" }}>{p.cta}</Button></a>
                  : <Link href={p.href} className="mt-6"><Button className="w-full font-semibold" style={{ background: p.highlight ? C.gold : C.blue, color: p.highlight ? C.blue : "#fff" }}>{p.cta}</Button></Link>}
              </div>
            ))}
          </div>
          <p className="text-center text-xs mt-6" style={{ color: C.faint }}>{c.price.note}</p>
        </div>
      </section>

      {/* ── Testimonials + sectors ── */}
      <section className="py-20 md:py-24">
        <div className="mx-auto max-w-[1280px] px-5">
          <div className="text-center max-w-2xl mx-auto mb-14"><SectionHead eyebrow={c.test.eyebrow} title={c.test.title} /></div>
          <div className="grid md:grid-cols-3 gap-6" data-stagger>
            {c.test.items.map((t: any) => (
              <div key={t.n} className="rounded-2xl p-6" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <div className="flex gap-0.5 mb-3">{[0, 1, 2, 3, 4].map((i) => <Star key={i} className="w-4 h-4" style={{ color: C.gold, fill: C.gold }} />)}</div>
                <p className="text-sm leading-relaxed mb-4" style={{ color: C.text }}>« {t.q} »</p>
                <div className="text-sm font-semibold" style={{ color: C.blue }}>{t.n}</div>
                <div className="text-xs" style={{ color: C.faint }}>{t.r}</div>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3" data-stagger>
            {c.test.sectors.map((l: string) => (
              <span key={l} className="text-sm font-semibold px-4 py-2 rounded-full" style={{ color: C.muted, background: C.surface, border: `1px solid ${C.border}` }}>{l}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-20 md:py-24" style={{ background: C.surface }}>
        <div className="mx-auto max-w-3xl px-5">
          <div className="text-center mb-12"><SectionHead eyebrow={c.faq.eyebrow} title={c.faq.title} /></div>
          <div className="space-y-3" data-stagger>
            {c.faq.items.map((f: any) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
          </div>
        </div>
      </section>

      {/* ── Final CTA / demo ── */}
      <section id="demo" className="py-20 md:py-24 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${C.blue}, ${C.blueAccent})` }}>
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: `radial-gradient(${C.gold} 1px, transparent 1px)`, backgroundSize: "32px 32px" }} />
        <div className="relative mx-auto max-w-2xl px-5 text-center" data-reveal>
          <img src={LOGO_EMBLEM} alt={BRAND_NAME} className="w-20 mx-auto mb-6 opacity-95" />
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4" style={{ fontFamily: HEADING }}>{c.cta.title}</h2>
          <p className="text-white/75 mb-8">{c.cta.sub}</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/devis"><Button size="lg" className="font-semibold" style={{ background: C.gold, color: C.blue }}>{c.cta.demo}</Button></Link>
            <CataloguePdfButton label={c.catalogueDownload} />
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: C.blueDark, borderTop: `1px solid ${C.gold}26` }}>
        <div className="mx-auto max-w-[1280px] px-5 py-14">
          <div className="grid md:grid-cols-4 gap-10 mb-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <img src={LOGO_EMBLEM} alt={BRAND_NAME} className="h-12 w-auto" />
                <div>
                  <div className="font-bold text-white" style={{ fontFamily: HEADING }}>{BRAND_NAME}</div>
                  <div className="text-[10px] tracking-[0.2em]" style={{ color: C.gold }}>TRAINING ACADEMY</div>
                  <div className="text-[11px] italic mt-0.5" style={{ color: C.faint }}>{BRAND_TAGLINE}</div>
                </div>
              </div>
              <p className="text-sm text-white/50 leading-relaxed max-w-xs mb-4">{c.footer.tagline}</p>
              <div className="space-y-1.5 text-sm text-white/50">
                <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> contact@r-aero-academy.com</div>
                <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> {t("home.footerLocation")}</div>
              </div>
            </div>
            <div>
              <div className="font-semibold text-white text-sm mb-4">{c.footer.platformTitle}</div>
              <ul className="space-y-2 text-sm">
                {c.footer.platformLinks.map((i: any) => (
                  <li key={i.l}><Link href={i.h}><span className="text-white/50 hover:text-white transition-colors cursor-pointer">{i.l}</span></Link></li>
                ))}
              </ul>
            </div>
            <div>
              <div className="font-semibold text-white text-sm mb-4">{c.footer.resourcesTitle}</div>
              <ul className="space-y-2 text-sm">
                {c.footer.resourceLinks.map((i: any) => (
                  <li key={i.l}><Link href={i.h}><span className="text-white/50 hover:text-white transition-colors cursor-pointer">{i.l}</span></Link></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-3" style={{ borderTop: `1px solid rgba(255,255,255,0.08)` }}>
            <div className="text-xs text-white/30">© 2026 {BRAND_NAME} Training Academy. {c.footer.copyright}</div>
            <div className="flex gap-5">
              {c.footer.legalLinks.map((i: any) => (
                <Link key={i.l + i.h} href={i.h}><span className="text-xs text-white/30 hover:text-white/60 transition-colors cursor-pointer">{i.l}</span></Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
