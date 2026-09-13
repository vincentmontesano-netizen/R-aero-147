# Audit opérationnel — 13 septembre 2026, lot 200

**Conclusion : refonte non achevée.** L’aperçu local répond, mais la plateforme n’est pas validée pour une exploitation complète. Les 403 tests du lot 199 prouvent des propriétés ciblées ; ils ne prouvent pas l’ensemble des parcours navigateur ni la disponibilité des fournisseurs.

## Preuves relues et relevé actuel

- Journaux de la dernière suite : `/tmp/raero-lot199-tests.log` (403 tests), TypeScript/build et `/tmp/raero-lot199-smoke.log` (démarrage, arrêt/reprise PostgreSQL, session et sauvegarde/restauration). Ces fichiers temporaires ne constituent pas un archivage externe durable.
- Source de la suite : [configuration Vitest](../vitest.config.ts), exécutée en environnement Node sur fichiers serveur. Elle n’est pas une suite de parcours navigateur.
- Lecture authentifiée de `admin.settings.get` sur l’aperçu : Stripe non configuré, secret de webhook absent, SMTP non configuré ; fonctions texte/image/voix des quatre fournisseurs IA toutes indisponibles. Seuls ces indicateurs ont été conservés ; aucune clé, adresse SMTP ou valeur masquée recopiée.
- Variables initiales du conteneur : `JAAS_APP_ID`, `JAAS_API_KEY_ID`, `JAAS_PRIVATE_KEY` et `INVOICE_ISSUER_JSON` absentes. Ce relevé décrit l’environnement du conteneur, pas une preuve de configuration ou de validation chez le fournisseur.
- Adresse privée actuelle : http://macstudio-de-sano.tailbdfa51.ts.net:3174. Le contrôle HTTP ne vaut pas recette visuelle ou d’accessibilité. Aucun paiement, message SMTP, appel IA ou appel JaaS réel déclenché par cet audit.

## Exigences du projet et niveau de preuve

| Exigence initiale | Éléments présents et preuves ciblées | Ce qui manque pour conclure |
| --- | --- | --- |
| Landing, présentation claire, catalogue | Routes et pages Home/Catalogue/TrainingDetail dans [App.tsx](../client/src/App.tsx), libellés FR/EN/AR ; réponse HTTP locale déjà vérifiée | Recette réelle de navigation, recherche, contenus, mobile, clavier/lecteur d’écran et RTL ; absence de promesses non étayées à contrôler sur tout le contenu administrable |
| Gestion des utilisateurs | Authentification/session, rôles, affiliations, suspension ; tests de sessions et [fermeture de compte](../server/accountClosure.integration.test.ts) | Parcours utilisateur complet inscription, récupération, 2FA, suspension et multi-appareils ; SMTP réel indisponible |
| E-learning complexe, QCM de chapitre et final | [Tests d’examens](../server/exams.integration.test.ts) : délais serveur, corrections conservées, reprise des réponses, tentatives ; versions publiées et inscription rattachée | Recette apprenant de bout en bout sur programme représentatif, cas d’échec/reprise/expiration ; contenu aéronautique approuvé et périmètre pédagogique réels |
| Création et maintenance de formations | Studio, médias privés, revues, révisions, comparaison des conflits et déplacements de chapitres/diapositives ; tests de réordonnancement et de rapprochement | Recette auteur complète sur tous types de questions et médias ; objectifs/catalogue encore sans protection équivalente de tous leurs changements concurrents |
| Création interne et pour les compagnies | [Tests B2B](../server/companyTraining.integration.test.ts), espace auteur par organisation, affectation de version publiée aux membres actifs | Recette multi-compagnies avec administrateur, auteur, responsable et apprenant ; cycle commercial et gestion opérationnelle des clients |
| IA plan, texte, image, voix, vidéo et QCM | [Quotas/reprises](../server/aiRequests.integration.test.ts), [plans conservés](../server/aiOutlines.integration.test.ts), [vidéo durable](../server/aiVideoJobs.integration.test.ts) ; simulations de fournisseurs | Configuration fournisseur, générations réelles contrôlées, qualité de sortie, coûts, droits d’usage, délais et échecs réseau ; validation pédagogique de chaque résultat |
| Conférences et formation à distance | Salle privée, admission, jetons RSA, chat/sondages et présence ; [tests vidéo](../server/liveVideo.integration.test.ts), [limites documentées](private-live-video.md) | JaaS réel, origine HTTPS adaptée, connexion de deux participants, micro/caméra, rôle formateur, expulsion/révocation, reconnexion, preuve d’assiduité et replay privé |
| Vault personnel | Pièces privées, empreintes, archivage, partage et historique ; [tests passport](../server/passport.integration.test.ts) | Recette dépôt/consultation/partage/retrait par rôles, gros fichiers et appareils ; analyse de fichiers et politique de conservation à finaliser |
| Paiement Stripe | [Vérification du paiement](../server/paymentVerification.integration.test.ts) et rapprochement ; montants, devise, webhook signé, accès et remboursements contrôlés sur fixtures | Configuration Stripe et webhook, cycle Checkout complet avec cartes de test Stripe, échecs et remboursements réels en environnement de test ; activation commerciale ultérieure |
| Formules et abonnements | [Tests d’abonnement](../server/subscription.integration.test.ts), capacité, rattachement et portail | Price IDs et offres validés, souscription/renouvellement/annulation/échec de paiement via Stripe test, règles commerciales vérifiées |
| Factures | Génération/archivage et [tests d’intégrité](../server/invoiceArchive.integration.test.ts), langues et pagination ; émetteur absent refusé | Identité et mentions d’émetteur configurées et validées, cycle complet depuis paiement réel de test, traitement des avoirs/corrections et exigences locales applicables |
| KYC/KYB | Dépôt, contrôle d’accès, revue indépendante, historique, pièces archivées et pagination ; [tests verification](../server/verification.integration.test.ts) | Validation du processus d’identification, pièces requises, accès après fermeture, conservation et recette navigateur par rôles ; aucun agrément implicite |
| Agrément Part-147 réservé aux admins | [Tests approval](../server/approval.integration.test.ts) : fonctions indépendantes, preuves d’autorité/MTOE, historique ; [revue pédagogique](../server/pedagogicalReview.integration.test.ts) | Documents et périmètre d’agrément réels, revue réglementaire et organisationnelle par personnes habilitées ; une règle applicative ne prouve pas un agrément |
| S’inspirer d’autres acteurs | [Repères produit existants](product-references.md) et décisions de conception consignées | Benchmark détaillé des parcours/B2B/distanciel, évaluation comparative de l’utilisabilité ; aucune supériorité démontrée |
| Exploitation opérationnelle | Aperçu Docker privé ; sauvegarde/restauration locale ; [pipeline prévu](continuous-validation.md) | Hébergement de production, TLS, surveillance, alertes, sauvegardes hors machine et restauration périodique, charge, sécurité et chaîne de déploiement réellement exécutée |
| Protection des données et gouvernance CLAUDE | Conservation d’archives, fermeture avec réauthentification, export et support privé ; [limites des demandes](privacy-requests.md) | Audit transversal des données nouvelles (notamment corps de diffusions), rétention et procédures réelles, exports exhaustifs, accès post-fermeture ; aucune conformité juridique globale établie |

Les liens ci-dessus désignent des sources de code et tests, non une preuve suffisante d’achèvement de toute la ligne. Les modèles et contraintes de la documentation CLAUDE restent à rapprocher des documents d’exploitation réels ; cet audit ne les interprète pas comme une validation juridique.

## Actions suivantes, sans réduire le périmètre

1. Corriger les écarts encore locaux du studio et des parcours, puis vérifier un scénario métier complet par rôle. La suite Node et les contrôles HTTP ne remplacent pas la recette navigateur.
2. Préparer des scénarios de recette fournisseur avec résultats attendus pour Stripe, SMTP, IA et JaaS ; les exécuter seulement dans un environnement configuré et autorisé. Aucun faux mode « paiement réussi » ne doit compenser une configuration absente.
3. Faire valider contenu, identité de facturation, processus KYC/KYB, MTOE/agrément et règles de conservation par les responsables concernés.
4. Vérifier exploitation et déploiement sur leur environnement réel ; relier chaque preuve au scénario et à la version testés. Mettre à jour cette matrice avant toute déclaration de disponibilité complète.

## Documentation historique

`todo.md` conserve les listes V1 à titre historique. Sa mention globale de validation et ses anciens mots de passe de démonstration ont été retirés : ils ne représentent pas l’aperçu actuel. `plan.md` et `docs/local-preview.md` décrivent les lots successifs, mais aucun nombre de lots ou de tests ne vaut clôture du périmètre demandé.

## Complément lot 261 — comparaison produit

La comparaison initiale est complétée par [six pages officielles de trois acteurs](benchmark-training-journeys.md). Elle met en évidence les écarts de portée structurée des programmes et de présentation de runTNA (règles de récurrence, pas analyse pédagogique complète). La ligne « S’inspirer d’autres acteurs » dispose désormais de cette preuve documentaire ; parcours privés, inscription réelle, UX comparative et efficacité pédagogique restent non vérifiés. Les autres lignes de cet audit historique ne sont pas revalidées par ce complément.


## Complément lot 266 — recette fournisseur préparée

Le [relevé horodaté du lot 266](provider-status-lot266.json) conserve les indicateurs de configuration sans secrets : Stripe/webhook, SMTP et capacités IA texte/image/voix indisponibles ; variables initiales JaaS et émetteur absentes. Il ne vérifie pas la configuration vidéo IA ni le fonctionnement réel d’un fournisseur.

Le [protocole de recette fournisseur](provider-acceptance.md) définit maintenant les préconditions, scénarios et preuves attendues pour les paiements, abonnements, e-mails, IA, classes distantes et factures. Aucun de ces scénarios n’est exécuté contre un fournisseur réel. Les lignes correspondantes restent ouvertes ; les preuves historiques des autres lignes ne sont pas revalidées par ce complément. L’aperçu Tailscale répond HTTP 200 et son conteneur est healthy lors du contrôle demandé par l’utilisateur.


## Complement lot 277 - Inscriptions successives du meme apprenant

Le [scenario de versions publiees](../server/makerAccess.integration.test.ts) couvre maintenant deux inscriptions du meme compte sur deux versions d'un cours, reliees au [selecteur du lecteur](../shared/learningEnrollment.ts). Contenus distincts, prerequis et tentatives separes, refus d'une session soumise sous une autre inscription et maintien du nouveau chapitre obligatoire sont verifies sur PostgreSQL isole. Treize tests cibles et TypeScript passent ; ce complement ne remplace pas une recette navigateur et ne revalide pas les autres lignes de la matrice.


### Mesure complementaire - lot308

Export de conformite admin par250 lignes (defaut API50). Sur17974 inscriptions isolees,72 appels au lieu de360 ; trois exports mesures1002-1100ms, quatre simultanes1151ms au total. Resultats detailles dans report-performance-lot308-page50.json et report-performance-lot308-page250.json. Verification du nombre total et unicite,492 tests passent. Mesure tRPC en processus incluant audit, sans reseau/navigateur/CSV ; ne prouve ni performance production ni coherence transactionnelle entre pages.
