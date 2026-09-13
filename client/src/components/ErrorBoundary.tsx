import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Keep recovery copy independent of the asynchronously loaded dictionaries.
const recoveryCopy = {
  fr: { title: 'Cette page n’a pas pu être affichée', description: 'Vérifiez votre connexion, puis rechargez la page. Les modifications non enregistrées peuvent être perdues.', reload: 'Recharger la page', home: 'Retour à l’accueil' },
  en: { title: 'This page could not be displayed', description: 'Check your connection, then reload the page. Unsaved changes may be lost.', reload: 'Reload page', home: 'Back to home' },
  ar: { title: 'تعذّر عرض هذه الصفحة', description: 'تحقّق من اتصالك ثم أعد تحميل الصفحة. قد تُفقد التغييرات غير المحفوظة.', reload: 'إعادة تحميل الصفحة', home: 'العودة إلى الرئيسية' },
};

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[Application rendering error]', error);
  }

  render() {
    if (this.state.hasError) {
      const language = document.documentElement.lang;
      const lang = language === 'ar' || language === 'en' ? language : 'fr';
      const copy = recoveryCopy[lang];
      return (
        <main lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'} className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              aria-hidden="true"
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h1 role="alert" className="text-xl mb-4 text-center">{copy.title}</h1>
            <p className="text-muted-foreground mb-6 text-center">{copy.description}</p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} aria-hidden="true" />
              {copy.reload}
            </button>
            <a href="/" className="mt-4 underline">{copy.home}</a>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
