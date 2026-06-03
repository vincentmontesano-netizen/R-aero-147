import { Toaster } from "@/components/ui/sonner";
import ChatWidget from "@/components/ChatWidget";
import CartWidget from "@/components/CartWidget";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { I18nProvider } from "./i18n";
import Home from "./pages/Home";
import Catalogue from "./pages/Catalogue";
import TrainingDetail from "./pages/TrainingDetail";
import Dashboard from "./pages/Dashboard";
import LearningPlayer from "./pages/LearningPlayer";
import LiveRoom from "./pages/LiveRoom";
import CompanyDashboard from "./pages/CompanyDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import QuoteRequest from "./pages/QuoteRequest";
import CertificateVerification from "./pages/CertificateVerification";
import UserProfile from "./pages/UserProfile";
import MyQuotes from "./pages/MyQuotes";
import Support from "./pages/Support";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Register from "./pages/Register";
import Webinars from "./pages/Webinars";
import About from "./pages/About";
import Legal from "./pages/Legal";
import CourseMaker from "./pages/CourseMaker";
import Sessions from "./pages/Sessions";
import News from "./pages/News";
import ArticleDetail from "./pages/ArticleDetail";
import Glossary from "./pages/Glossary";

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
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/mes-devis" component={MyQuotes} />
      <Route path="/support" component={Support} />
      <Route path="/profil" component={UserProfile} />
      <Route path="/formation/:slug/apprendre" component={LearningPlayer} />
      <Route path="/live/:type/:id" component={LiveRoom} />
      <Route path="/cart" component={Cart} />
      <Route path="/checkout" component={Checkout} />

      {/* B2B */}
      <Route path="/entreprise" component={CompanyDashboard} />

      {/* Admin */}
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/maker" component={CourseMaker} />
      <Route path="/maker/:trainingId" component={CourseMaker} />

      {/* Fallback */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <I18nProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
            <ChatWidget />
            <CartWidget />
          </TooltipProvider>
        </I18nProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
