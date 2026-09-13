import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import ChatWidget from "@/components/ChatWidget";
import CartWidget from "@/components/CartWidget";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { I18nProvider, useI18n } from "./i18n";
import Home from "./pages/Home";
const Catalogue = lazy(() => import("./pages/Catalogue"));
const TrainingDetail = lazy(() => import("./pages/TrainingDetail"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const LearningPlayer = lazy(() => import("./pages/LearningPlayer"));
const LiveRoom = lazy(() => import("./pages/LiveRoom"));
const CompanyDashboard = lazy(() => import("./pages/CompanyDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const QuoteRequest = lazy(() => import("./pages/QuoteRequest"));
const CertificateVerification = lazy(() => import("./pages/CertificateVerification"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const MyQuotes = lazy(() => import("./pages/MyQuotes"));
const SupportTicket = lazy(() => import("./pages/SupportTicket"));
const Support = lazy(() => import("./pages/Support"));
const Login = lazy(() => import("./pages/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Register = lazy(() => import("./pages/Register"));
const Webinars = lazy(() => import("./pages/Webinars"));
const About = lazy(() => import("./pages/About"));
const Legal = lazy(() => import("./pages/Legal"));
const CourseMaker = lazy(() => import("./pages/CourseMaker"));
const Sessions = lazy(() => import("./pages/Sessions"));
const News = lazy(() => import("./pages/News"));
const ArticleDetail = lazy(() => import("./pages/ArticleDetail"));
const Glossary = lazy(() => import("./pages/Glossary"));

const ApprovalCenter = lazy(() => import("./pages/ApprovalCenter"));
const Subscriptions = lazy(() => import("./pages/Subscriptions"));
const Licenses = lazy(() => import("./pages/Licenses"));
const VerificationCenter = lazy(() => import("./pages/VerificationCenter"));

function Router() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/" component={Home} />
      <Route path="/catalogue" component={Catalogue} />
      <Route path="/formation/:slug" component={TrainingDetail} />
      <Route path="/verification/:code" component={CertificateVerification} />
      <Route path="/verification" component={CertificateVerification} />
      <Route path="/devis" component={QuoteRequest} />
      <Route path="/contact" component={QuoteRequest} />
      <Route path="/webinars" component={Webinars} />
      <Route path="/sessions" component={Sessions} />
      <Route path="/actualites" component={News} />
      <Route path="/actualites/:slug" component={ArticleDetail} />
      <Route path="/glossaire" component={Glossary} />
      <Route path="/about" component={About} />
      <Route path="/legal" component={Legal} />
      <Route path="/login" component={Login} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/register" component={Register} />

      {/* Authenticated */}
      <Route path="/abonnements" component={Subscriptions} />
      <Route path="/licences" component={Licenses} />
      <Route path="/verifications" component={VerificationCenter} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/mes-devis" component={MyQuotes} />
      <Route path="/support/ticket/:id" component={SupportTicket} />
      <Route path="/support" component={Support} />
      <Route path="/profil" component={UserProfile} />
      <Route path="/formation/:slug/apprendre" component={LearningPlayer} />
      <Route path="/live/:type/:id" component={LiveRoom} />
      <Route path="/cart" component={Cart} />
      <Route path="/checkout" component={Checkout} />

      {/* B2B */}
      <Route path="/entreprise" component={CompanyDashboard} />

      {/* Admin */}
      <Route path="/admin/approval" component={ApprovalCenter} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/maker" component={CourseMaker} />
      <Route path="/maker/:trainingId" component={CourseMaker} />

      {/* Fallback */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function PageLoading() {
  const { t } = useI18n();
  return <div role="status" className="min-h-screen flex flex-col gap-4 items-center justify-center">
    <div aria-hidden="true" className="h-8 w-8 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin motion-reduce:animate-none" />
    <p>{t('common.loading')}</p>
  </div>;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <I18nProvider>
          <TooltipProvider>
            <Toaster />
            <Suspense fallback={<PageLoading />}><Router /></Suspense>
            <ChatWidget />
            <CartWidget />
          </TooltipProvider>
        </I18nProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
