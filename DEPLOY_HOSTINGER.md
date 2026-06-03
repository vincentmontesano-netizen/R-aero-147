# Déploiement sur Hostinger (VPS) via Docker

L'application est **un seul container** (front + back + PostgreSQL). Ce guide la met en production sur un **VPS Hostinger** avec un nom de domaine et HTTPS.

> ⚠️ Le **Web Hosting** mutualisé Hostinger n'exécute pas Docker. Il faut un **VPS Hostinger** (KVM) avec Docker — ou la solution « Docker / Coolify » proposée sur VPS.

---

## 1. Prérequis

- Un **VPS Hostinger** (Ubuntu 22.04+ recommandé), accès SSH.
- Un **nom de domaine** pointant vers l'IP du VPS (enregistrement A `@` et `www`).
- Docker + Docker Compose installés :
  ```bash
  curl -fsSL https://get.docker.com | sh
  ```
- Ports **80** et **443** ouverts dans le pare-feu Hostinger (hPanel → VPS → Firewall).

---

## 2. Récupérer le projet

```bash
# via git
git clone <votre-repo> r-aero && cd r-aero
# …ou uploadez le dossier du projet par SFTP, puis: cd r-aero
```

## 3. Configurer les variables (`.env`)

Créez un fichier `.env` **à côté de `docker-compose.yml`** (modèle dans `.env.example`) :

```env
# Laisser vide = secret stable auto-généré et persisté dans le volume
JWT_SECRET=
APP_PORT=3000

# Stripe (passez en clés live le moment venu)
STRIPE_SECRET_KEY=sk_test_xxx
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=        # voir étape 6

# IA (optionnel)
OPENAI_API_KEY=
GEMINI_API_KEY=
```

> Le `.env` n'est ni commité ni inclus dans l'image (il est dans `.gitignore` et `.dockerignore`). Docker Compose le lit pour injecter les variables au runtime.

## 4. Lancer

```bash
docker compose up -d --build
docker compose logs -f app    # suivre le démarrage (init DB + seed + start)
```

Au 1ᵉʳ démarrage : PostgreSQL est initialisé, le schéma est appliqué, les données de démo sont insérées, puis l'app écoute sur le port 3000. Les volumes `raero-db` et `raero-storage` **persistent** vos données et PDF.

Comptes de démo : `admin@r-aero.academy / Admin1234!`.

## 5. HTTPS + domaine (reverse proxy)

Le container sert l'app en HTTP sur 3000. Placez un reverse proxy en façade pour le HTTPS. **Caddy** (HTTPS automatique Let's Encrypt) est le plus simple :

`/etc/caddy/Caddyfile` :
```
votre-domaine.com {
    reverse_proxy localhost:3000
}
```
```bash
sudo apt install -y caddy && sudo systemctl restart caddy
```
Caddy obtient le certificat automatiquement et transmet `X-Forwarded-Proto: https`. L'app a `trust proxy` activé → les cookies de session passent en `Secure`/`SameSite=None` et fonctionnent.

> Alternative : Nginx Proxy Manager, Traefik, ou le proxy intégré si vous utilisez Coolify sur le VPS.

## 6. Webhook Stripe (recommandé)

Le paiement est **aussi confirmé au retour** sur l'app (fallback), mais en production configurez le webhook :

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**.
2. URL : `https://votre-domaine.com/api/stripe/webhook`.
3. Événements : `checkout.session.completed`, `payment_intent.payment_failed`, `charge.refunded`.
4. Copiez le **Signing secret** (`whsec_…`) → mettez-le dans `.env` (`STRIPE_WEBHOOK_SECRET=`).
5. `docker compose up -d` (redémarre avec la variable).

## 7. Vérifier le paiement de bout en bout (test)

1. Ouvrez `https://votre-domaine.com`, créez un compte.
2. Ajoutez une formation au panier → **Payer**.
3. Sur Stripe Checkout, carte de test **4242 4242 4242 4242**, date future, CVC quelconque.
4. Retour au tableau de bord → toast « Paiement confirmé — accès activé », la formation apparaît, facture disponible.

## 8. Passage en production réelle

- Remplacez `STRIPE_SECRET_KEY` / `VITE_STRIPE_PUBLISHABLE_KEY` par les clés **live** (`sk_live_…`, `pk_live_…`) et recréez le webhook en mode live.
- Définissez un `JWT_SECRET` fort et fixe (ou laissez l'auto-généré persistant).
- **Régénérez toute clé secrète ayant transité en clair.**

## 9. Exploitation

```bash
docker compose ps                 # état
docker compose logs -f app        # logs
docker compose pull && docker compose up -d --build   # mise à jour
# Sauvegarde de la base (volume) :
docker run --rm -v r-aero_raero-db:/v -v "$PWD":/b alpine tar czf /b/raero-db-backup.tgz -C /v .
```

## Checklist « ça va marcher sur Hostinger »

- [x] Image unique, démarre seule (DB + schéma + seed + app) — vérifié.
- [x] Données persistées (volumes `raero-db`, `raero-storage`).
- [x] `JWT_SECRET` stable même si non fourni (persisté).
- [x] HTTPS géré par le reverse proxy ; cookies `Secure` grâce à `trust proxy`.
- [x] Stripe : création de session validée avec la clé fournie ; fulfillment au retour + webhook.
- [x] Aucun secret dans l'image ni dans le code (uniquement via `.env`/env runtime).
