# R-AERO Training Academy — Plateforme e-learning Part-147

Plateforme de formation aéronautique réglementaire pour un organisme agréé **EASA Part-147** : catalogue de formations, e-learning (modules + quiz + examen), certificats PDF vérifiables, espace entreprise B2B (employés, récurrences), devis, et back-office d'administration.

Stack : **React 19 + Tailwind 4 + Express 4 + tRPC 11 + PostgreSQL (Drizzle ORM)**. Authentification **email / mot de passe** intégrée.

## 🚀 Démarrage rapide (Docker, tout-en-un)

Front-end + back-end + base PostgreSQL dans **un seul container** :

```bash
docker compose up --build
# puis ouvrez http://localhost:3000
```

**Comptes de démonstration :**

| Rôle | Email | Mot de passe |
|---|---|---|
| Administrateur | `admin@r-aero.academy` | `Admin1234!` |
| Apprenant | `jean.dupont@example.com` | `Learner1234!` |
| Manager B2B | `manager@demo.example` | `Manager1234!` |

Détails de déploiement, variables d'environnement et base externe (Supabase) : voir [`DOCKER_SUPABASE.md`](DOCKER_SUPABASE.md).
**Mise en production sur Hostinger (VPS + Docker, domaine + HTTPS + Stripe)** : voir [`DEPLOY_HOSTINGER.md`](DEPLOY_HOSTINGER.md).

> **Paiement Stripe** : renseignez `STRIPE_SECRET_KEY` (+ `VITE_STRIPE_PUBLISHABLE_KEY`) dans `.env`. Le paiement est confirmé au retour du Checkout (et via webhook si `STRIPE_WEBHOOK_SECRET` est défini). Sans clé Stripe, le checkout reste en **mode démo**.

## 💻 Développement local

```bash
pnpm install
# Démarrer un PostgreSQL (ex. Docker) et renseigner .env :
#   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/raero
#   JWT_SECRET=...  VITE_APP_ID=r-aero-training-academy
pnpm db:push     # applique le schéma
pnpm db:seed     # données de démonstration
pnpm dev         # http://localhost:3000
```

> **Paiement** : sans `STRIPE_SECRET_KEY`, le checkout fonctionne en **mode démo** (accès activé instantanément), ce qui permet de tester tout le parcours e-learning sans Stripe.

## 🗺️ Périmètre fonctionnel

- **Espace public** : accueil, catalogue filtrable + recherche (**FR/EN**), fiche formation, panier, paiement (Stripe ou démo), **calendrier de sessions** (présentiel/virtuel/webinar + inscription), **webinars + classe virtuelle live**, **actualités/blog**, **glossaire**, **catalogue PDF**, devis/contact, **vérification publique de certificat**. Interface **trilingue EN/FR/AR (RTL)**.
- **Espace apprenant** : inscription/connexion, tableau de bord + **notifications/rappels d'échéance**, lecteur e-learning (modules + slides + progression + **objectifs Part-66**), **vidéo interactive** (quiz sur timeline, branches adaptatives, hotspots), **examen sécurisé** (timer + tirage aléatoire dans la banque + feedback), **certificats PDF** (QR, couverture d'objectifs), profil (licence Part-66).
- **Espace entreprise (B2B)** : profil société, employés (création + **import CSV**), **dossier unique technicien** (interne + formations externes), **récurrences** + **vue consolidée multi-sites/pays**, **TNA automatisée** (obligations par poste/licence), **abonnement « conformité-as-a-subscription »** (Stripe récurrent), **preuve de conformité** (export CSV).
- **Back-office admin** : CRUD formations, **gestion de contenu** (modules + **objectifs Part-66** + banque QCM/QCU/V-F), **templates Part-66 pré-mappés**, **versioning + suivi des évolutions réglementaires**, utilisateurs (rôles, suspension), commandes, devis, **intégrité des examens**, rapport de conformité Part-147.
- **Classe virtuelle live** (`/live`, **Jitsi** embarqué) : vidéo/audio/partage d'écran + **engagement** (chat, Q&A, sondages, **quiz live**), **scoring d'engagement** par apprenant, **replay + Q&A asynchrone**.
- **Créateur d'e-learning assisté par IA** (`/maker`, admin · formateur · **manager**) : formations **en slides** (image / vidéo+son / texte + mini-quiz). L'IA génère plan, texte, **images**, **narration (TTS)** et quiz. Multi-fournisseurs : **OpenAI · Anthropic · Google · Mistral**.

## 🤖 Clés API IA (optionnelles)

Le créateur d'e-learning fonctionne sans clé (édition manuelle) ; les boutons IA s'activent dès qu'une clé est fournie. Texte : les 4 fournisseurs. Image + voix : OpenAI ou Google.

| Variable | Fournisseur | Capacités |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI | texte · image · voix (TTS) |
| `GEMINI_API_KEY` | Google | texte · image (Imagen) · voix (Cloud TTS) |
| `ANTHROPIC_API_KEY` | Anthropic (Claude) | texte |
| `MISTRAL_API_KEY` | Mistral | texte |

Modèles surchargeables via `OPENAI_TEXT_MODEL`, `ANTHROPIC_MODEL`, `GEMINI_MODEL`, `MISTRAL_MODEL`, `OPENAI_IMAGE_MODEL`, `OPENAI_TTS_MODEL`, etc.
