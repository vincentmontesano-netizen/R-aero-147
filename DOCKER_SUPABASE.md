# R-AERO Training Academy — Déploiement Docker

La plateforme se déploie comme **un seul container tout-en-un** : front-end, back-end et base de données **PostgreSQL** sont embarqués dans la même image. Aucun service externe n'est requis pour démarrer.

---

## Démarrage rapide (1 commande)

```bash
docker compose up --build
```

Puis ouvrez **http://localhost:3000**.

Au premier démarrage, le container :
1. initialise une base PostgreSQL interne ;
2. applique le schéma (`drizzle-kit push`) ;
3. insère des données de démonstration (catalogue, comptes) ;
4. lance l'application sur le port 3000.

### Comptes de démonstration

| Rôle | Email | Mot de passe |
|---|---|---|
| Administrateur | `admin@r-aero.academy` | `Admin1234!` |
| Apprenant | `jean.dupont@example.com` | `Learner1234!` |
| Manager entreprise | `manager@demo.example` | `Manager1234!` |

### Sans Docker Compose

```bash
docker build -t r-aero-academy .
docker run -p 3000:3000 -e JWT_SECRET="$(openssl rand -hex 32)" r-aero-academy
```

---

## Persistance des données

`docker-compose.yml` monte deux volumes nommés :

- `raero-db` → `/var/lib/postgresql/data` (base de données) ;
- `raero-storage` → `/app/storage` (factures et certificats PDF générés).

Les données survivent donc aux redémarrages. Le seed est idempotent : il ne duplique pas le catalogue s'il existe déjà.

---

## Variables d'environnement

| Variable | Rôle | Défaut |
|---|---|---|
| `JWT_SECRET` | **À définir en production.** Signe les cookies de session. | valeur de dev |
| `PORT` | Port d'écoute de l'application. | `3000` |
| `STRIPE_SECRET_KEY` | Active le paiement Stripe réel. Si absent → **mode démo** (accès accordé immédiatement après « paiement »). | vide |
| `STRIPE_WEBHOOK_SECRET` | Vérification des webhooks Stripe. | vide |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Clé publique Stripe (front). | vide |
| `DATABASE_URL` | Pour utiliser une base **externe** (Supabase/RDS…) au lieu de celle embarquée. | interne |
| `OPENAI_API_KEY` | IA — texte, image (gpt-image-1) et voix (TTS) pour le créateur d'e-learning. | vide |
| `GEMINI_API_KEY` | IA — texte (Gemini), image (Imagen), voix (Cloud TTS). | vide |
| `ANTHROPIC_API_KEY` | IA — texte (Claude). | vide |
| `MISTRAL_API_KEY` | IA — texte (Mistral). | vide |

> **Mode démo** : sans clé Stripe, le tunnel d'achat fonctionne de bout en bout (commande créée, accès e-learning activé, certificat générable) sans paiement réel — idéal pour démonstration.
>
> **Créateur d'e-learning IA** : sans clé IA, l'édition de slides reste manuelle ; chaque clé ajoutée active les boutons de génération correspondants (texte / image / voix / quiz).

---

## Utiliser une base externe (Supabase / managed Postgres)

Le schéma est en **PostgreSQL standard** (Drizzle ORM), compatible Supabase et tout Postgres managé.

1. Récupérez la *connection string* (`postgresql://…`).
2. Lancez le container avec `DATABASE_URL` pointant vers cette base — la base interne est alors ignorée :

```bash
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  r-aero-academy
```

> Pour Supabase, utilisez le **Session Pooler** (port 5432) pour une connexion persistante.

---

## Sécurité production (rappels)

- Définir un `JWT_SECRET` fort et unique.
- Servir derrière HTTPS (les cookies passent alors en `Secure` + `SameSite=None`).
- Configurer Stripe (clés + webhook `/api/stripe/webhook`).
- Sauvegarder régulièrement le volume `raero-db`.
