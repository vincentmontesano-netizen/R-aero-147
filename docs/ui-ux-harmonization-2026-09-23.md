# Harmonisation UI/UX et recette de bout en bout

Mise à jour : 24 septembre 2026 (Europe/Paris).

## Objectif et périmètre

Synchroniser l’UI et l’UX pour un même style dans toute l’application R-AERO.

L’ajout explicite de l’utilisateur — tester l’application de bout en bout, notamment compte, administration, création de formation et achat simulé — fait partie des conditions de fin du goal. Ce document en conserve le périmètre élargi ; le libellé initial du goal reste inchangé dans l’outil, qui ne permet que des changements de statut.

## Conditions de fin

- [x] Thème bleu nuit, cyan et orange commun aux routes publiques et connectées ; typographie Inter et Noto Sans Arabic, surfaces et composants harmonisés.
- [x] Contrôles, alertes, chargements et erreurs adaptés au thème ; focus clavier visible.
- [x] Contrôles navigateur sur ordinateur et mobile ; FR/EN/AR et RTL ; fermeture clavier et retour du focus de l’aperçu PDF.
- [x] Landing sans prix ni mention visible Airbus/A320 ; avion sans déplacement ou zoom manuel ; parcours des cinq vues retenu jusqu’au panneau supérieur.
- [x] Photographies aéronautiques intégrées et optimisées ; provenance dans `docs/cockpit-landing-2026-09-23.md`.
- [x] Inventaire des fonctions et parcours de recette exécutés, résultats conservés.
- [x] Inscription, authentification, récupération du mot de passe, double authentification et révocation des sessions.
- [x] Administration, création de formation, révision pédagogique indépendante et publication.
- [x] Panier, paiement simulé, facturation, devis et ouverture des accès.
- [x] Apprentissage, quiz de chapitre, examen final, progression, certificat et vérification publique.
- [x] Entreprise, collaborateurs, import CSV, récurrences TNA, achat de places et attribution.
- [x] Profil, consentements, export personnel, support, dossier professionnel, vérifications, contenus publics, sessions et live.
- [x] Intégrations testées selon configuration ; limites des fournisseurs externes identifiées ci-dessous.
- [x] Recette finale consolidée et aperçu Tailscale actualisé.

## Corrections issues de la recette

- Le panier conservait les articles après paiement. La confirmation vérifiée du paiement consomme maintenant les quantités achetées, dans la même transaction que les droits d’accès. Les notifications répétées ne les consomment qu’une fois ; les autres produits, les ajouts postérieurs et le panier d’un acheteur sur devis restent préservés. Trois tests de régression couvrent ces cas.
- La prévisualisation des PDF générés affichait une fenêtre vide, car le stockage imposait le téléchargement. Une demande explicite de prévisualisation autorise maintenant l’affichage intégré des seules factures et attestations PDF générées. L’autorisation, le contrôle d’intégrité, le cache privé et le sandbox restent actifs ; les pièces téléversées ne deviennent pas affichables ainsi. Le téléchargement normal reste disponible. Test de régression dédié et inspection visuelle ordinateur/mobile.
- La fenêtre PDF dispose de libellés FR/EN/AR, d’un titre accessible, d’un format mobile et d’un retour du focus après fermeture.
- Débordements mobiles corrigés dans les espaces apprenant/entreprise et l’éditeur de formation, notamment avec les libellés longs et les données réelles de recette. Le haut de la page abonnements n’est plus masqué par la navigation fixe.
- Contraste de la confirmation d’attestation et fonds des badges live/administration corrigés ; dates des webinaires adaptées à la langue sélectionnée.

## Couverture fonctionnelle

Le navigateur manipule l’interface réelle, reliée à l’API et à PostgreSQL. Seuls les fournisseurs Stripe et SMTP sont remplacés dans le conteneur de recette. Les tests automatiques de serveur complètent les parcours navigateur ; ils ne sont pas présentés comme des manipulations exhaustives de chaque bouton.

| Domaine | Preuve navigateur | Compléments automatiques |
| --- | --- | --- |
| Comptes et rôles | Inscription apprenant et responsable, connexion admin, création de l’auteur | Enregistrement, autorisations, cloisonnement organisations |
| Sécurité | Réinitialisation via e-mail capturé, nouveau mot de passe, activation 2FA, connexion dans un autre navigateur, révocation des sessions | Récupération, déconnexion, sécurité des sessions et en-têtes |
| Formation | Création, chapitre, questions, diapositive, revue pédagogique indépendante et publication | Révisions concurrentes, brouillons, copies, médias, modèles, réordonnancement |
| Achat | Ajout/retrait/réajout au panier, commande, paiement simulé et webhook signé, panier vidé, accès créé | Rapprochement, idempotence, tentatives de paiement, licences |
| Entreprise | Collaborateur manuel, import CSV, rattachement, règles TNA, récurrences, export, achat et attribution d’une place | Concurrence TNA, historique, visibilité, périodes et obligations |
| Apprentissage | Blocage de l’examen avant quiz de chapitre, réussite du quiz puis de l’examen final | Progression, activités, tentatives, évaluation et version de formation |
| Documents | Certificat, vérification publique, facture PDF, accès anonyme refusé, aperçu et téléchargement | Intégrité, révocation, archivage, pagination, langues et contrôle d’accès |
| Profil et vie privée | Mise à jour, consentement/retrait, export JSON | Clôture de compte, minimisation des données |
| Support et devis | Ticket, réponse admin, clôture/historique ; demande de devis et échange | Création, statuts, accès, listes et notifications |
| Passeport | Téléversement synthétique privé, archivage/historique, partage et retrait d’un certificat | Validité, historique des partages, portée entreprise |
| Vérification de dossier | Brouillon, pièce synthétique, soumission, revue admin et décision visible | Autorisations, workflow, justificatifs et stockage |
| Contenus admin | FAQ créée/modifiée/publiée/retirée, article publié puis retiré, offre créée | Catalogue, routes et contrats de données |
| Présentiel | Création, réservation, changement d’horaires tracé, annulation apprenant puis admin | Admissions, historique des horaires et règles de réservation |
| Live | Webinaire, réservation, ouverture, chat, sondage, vote/résultats, question et présence | Droits, intervenants, replay, vidéo et admission |
| Abonnements | Écran et refus explicite d’une souscription sans prix configuré | Cycle d’abonnement, capacité, droits et checkout avec fournisseurs simulés |
| IA | Réponse explicite d’indisponibilité sans clé fournisseur | Quotas, plans, demandes, formats de sortie, audio, tâches vidéo |
| Approbation | Écran admin sur ordinateur et mobile | Workflow d’approbation, disponibilité et preuves de validation |

## Résultats et preuves

- `pnpm check` : réussi après les dernières modifications.
- Build de production via le script Sites : réussi. Avertissement informatif de Vite sur les bundles dépassant 500 kB ; aucune erreur de compilation.
- Suite Vitest avec PostgreSQL de recette : **127 fichiers, 505 tests réussis, aucun échec ni test ignoré**. Résultat : `tmp/e2e/final-integration-results.json` ; journal : `tmp/e2e/final-integration.log`.
- Recette finale consolidée depuis une base neuve, après toutes les corrections : **16 suites réussies**, du 24 septembre 2026 à 00:28:41 à 00:31:30 (Paris). Résultat : `tmp/e2e/run-20260923222841/run.json` ; journal : `tmp/e2e/final-acceptance.log`. Comprend comptes, création/publication, achat, apprentissage, documents, services, entreprise, passeport, vérification, contenus admin, live, sécurité, présentiel, contrôles UI et défilement de l’avion.
- 15 routes publiques × 3 langues sur mobile : 45 contrôles sans débordement ni erreur JavaScript (`tmp/e2e/public-full-results.json`).
- 26 onglets des espaces apprenant, entreprise et administration : contrôles réussis (`tmp/e2e/workspaces-results.json`).
- Quatre rôles × trois langues avec données de recette : 12 contrôles mobiles, sans débordement ; aperçu PDF réel à 1440 et 390 px (`tmp/e2e/run-20260923221245/final-ui-results.json`).
- Sept routes connectées complémentaires à 1440 et 390 px, dont abonnements, licences et approbation : 14 contrôles réussis (`remaining-routes-results.json` dans ce dossier).
- Animation WebGL réelle à 1440 et 390 px : cinq vues dans l’ordre, maintien avant la vue 05, puis libération du défilement (`tmp/e2e/landing-scroll-results.json`).
- Les captures et JSON de recette sont locaux ; les états de connexion, identifiants synthétiques et fichiers d’environnement ont des permissions restreintes. Ils ne doivent pas être publiés.

## Limites précises

- Les paiements testés sont simulés localement, avec webhook Stripe signé et traitement applicatif réel. Aucun débit bancaire. La page hébergée par Stripe, 3-D Secure et les paiements réels ne sont pas validés par cette recette.
- Les messages de récupération/2FA sont capturés localement. Leur contenu et leur utilisation sont testés, pas leur livraison par un serveur SMTP externe.
- Les prix d’abonnement, les clés IA et la visioconférence externe ne sont pas configurés dans la recette. Les états d’indisponibilité et les contrats applicatifs sont vérifiés ; aucune génération IA distante ni communication audio/vidéo entre participants n’est déclarée validée.
- Le navigateur utilisé est Chrome sur macOS, avec viewports ordinateur et mobile. Il ne s’agit pas d’un test Safari/iOS ou Android sur appareil physique.
- Une recette réussie sur ces scénarios n’est pas une preuve d’absence de tout défaut possible. Les détails et limites ci-dessus définissent exactement la couverture obtenue.

## Rejouer la recette

Prérequis : Docker lancé, dépendances installées avec pnpm et Chrome disponible. Depuis la racine R-AERO :

```sh
RAERO_E2E_PORT=3181 node scripts/e2e/run.mjs
```

Choisir un port libre. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` permet d’indiquer un autre chemin Chrome. Le lanceur construit une image et crée un conteneur/PostgreSQL séparés, expose uniquement `127.0.0.1`, charge les simulateurs uniquement dans cet environnement et exécute les suites dans l’ordre. Les résultats sont dans `tmp/e2e/run-<date>/run.json`. Le conteneur identifié dans ce fichier reste disponible pour inspecter la recette ; il peut ensuite être supprimé explicitement. Aucune donnée de recette n’est injectée dans l’aperçu Tailscale.

## Aperçu

Adresse de revue : http://100.123.204.41:3175/.

Mise à jour vérifiée le 24 septembre 2026 à 00:31 (Paris) : santé HTTP 200, HTML et ressources d’entrée identiques au build local, six images WebP identiques et empreinte du serveur confirmée. Preuve : `tmp/e2e/preview-delivery.json`. La base existante est conservée et les simulateurs de paiement ou d’e-mail ne sont pas chargés.
