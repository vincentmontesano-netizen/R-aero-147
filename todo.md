# R-AERO Training Academy — TODO / État

> Resynchronisé sur le code réel. Tout ce qui est ✅ est implémenté **et vérifié** (typecheck + 21 tests tRPC + vérifs tRPC/DB de bout en bout). Démo testable en local : `docker start raero-pg` puis `pnpm dev` → http://localhost:3000. Comptes : `admin@r-aero.academy` / `Admin1234!`, `jean.dupont@example.com` / `Learner1234!`, `manager@demo.example` / `Manager1234!`.

## ✅ MVP / V1
- [x] Design system, schéma DB (Drizzle/PostgreSQL), migrations, tRPC, auth email/mot de passe
- [x] Landing, catalogue filtrable + recherche, fiche formation, panier (HT/TTC/TVA)
- [x] Sessions inter-entreprises (calendrier + inscription), webinars, actualités/blog, glossaire, catalogue PDF
- [x] Espace apprenant : dashboard, lecteur (modules + slides + progression), **quiz/examen** (seuil, tentatives, feedback), **certificats PDF** (QR + mentions Part-147), profil Part-66
- [x] Espace B2B : profil société, employés (manuel + **import CSV**), récurrences (indicateurs couleur), exports CSV
- [x] **Paiement Stripe** (réel + **mode démo**) + webhook + activation des accès + **facture PDF**
- [x] Back-office admin : CRUD formations, **gestion de contenu** (modules + banque QCM/QCU/V-F), utilisateurs (rôles/suspension), commandes, devis, **rapport de conformité Part-147 (CSV)**
- [x] Créateur e-learning **assisté IA** (`/maker`) : plan/texte/image/voix(TTS)/quiz · OpenAI/Anthropic/Google/Mistral
- [x] **Vérification publique** des certificats (`/verification/:code`)

## ✅ V1+ « grade Part-66 » (sprints suivants)
- [x] **Modèle Part-66** : objectifs/sous-modules comme entités ; slides·questions·certificats rattachables ; tracking par objectif
- [x] **Alertes d'expiration automatiques** : statut d'échéance recalculé dynamiquement + table `notifications` + cloche + générateur d'alertes idempotent
- [x] **Email SMTP** (`server/email.ts`, no-op sans clé) : confirmation de commande + rappels d'échéance
- [x] **Abonnement « conformité-as-a-subscription »** : Stripe subscription (+ mode démo), activation/renouvellement auto des accès, webhooks, Customer Portal, onglet Abonnement B2B
- [x] **Catalogue bilingue** (variantes EN des 4 modules réglementaires) + distinction **initial/récurrent**
- [x] **Vidéo interactive** : quiz sur la timeline (+saut), **branches adaptatives**, **hotspots**

## ✅ V2 (moat + distanciel crédible)
- [x] **Examens sécurisés** (niveau minimal) : timer serveur + auto-soumission + journal d'événements (onglet/focus) + panneau intégrité admin
- [x] **Banque de questions + génération aléatoire** (tirage N parmi M, scoring sur le sous-ensemble servi)
- [x] **Dossier unique technicien** (interne + formations **externes**) + **preuve de conformité** (export CSV consolidé)
- [x] **Vue corporate consolidée** multi-sites / pays / département
- [x] **TNA automatisée** : règles poste/licence → recyclages, création des échéances manquantes
- [x] **Trilingue Arabe + RTL** (i18n EN/FR/AR, `dir=rtl`)
- [x] **Authoring client** (manager) + **templates Part-66 pré-mappés** (création de cours depuis template)
- [x] **Versioning / maintenance** : `reviewStatus`/`version` + révisions + **évolutions réglementaires** qui flaguent le contenu impacté

## ✅ TIER 2 (différenciation UX)
- [x] **Classe virtuelle live** (Jitsi Meet embarqué) — salle par webinar/session, accès contrôlé, présence
- [x] **Engagement live** (polling tRPC) : chat, Q&A (modération), sondages, **quiz live**
- [x] **Scoring d'engagement** par apprenant (présence + chat + Q&A + votes + quiz correct)
- [x] **Replay + Q&A asynchrone** (mode replay de `/live`, fil Q&A persistant)

## ⏳ Reste à faire / reporté (signalé)
- [ ] **Messagerie interne** admin ↔ client sur les devis (table `messages` présente, non câblée) + conversion devis→commande
- [ ] **Drag & drop** dans la vidéo interactive (les autres interactions sont livrées)
- [ ] **Traduction AR complète du contenu marketing** (landing) — l'UI/nav sont en AR + RTL ; le hero retombe sur le FR
- [ ] **RGPD** (consentements, droit à l'oubli, export des données perso) — §7.2 du cahier des charges
- [ ] **SCORM/xAPI** (import de packages) — optionnel (§6.3/§7.1)
- [ ] **Quiz « réponses libres / matching »** (actuellement QCM/QCU/V-F)
- [ ] **Tickets de support / notifications globales** (§6.7)
- [ ] **Engagement live en WebSocket** (actuellement polling ~4 s) — upgrade possible
- [ ] **Prod** : clés réelles **Stripe** (sk + Price IDs) & **SMTP**, instance **Jitsi dédiée / 8x8 JaaS**

## Tests / qualité
- [x] Tests unitaires tRPC (21 passés) + `pnpm check` (typecheck) propre à chaque sous-phase
- [ ] Tests e2e des parcours critiques (examen proctoré, abonnement, classe live)
