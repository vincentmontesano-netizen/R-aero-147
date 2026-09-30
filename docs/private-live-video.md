# Admission aux classes vidéo privées

La salle intégrée n’utilise plus `meet.jit.si`. Le bouton « Rejoindre la visioconférence privée » demande au serveur un jeton après relecture du compte et des droits de classe. Sans configuration valide, le serveur refuse l’admission et l’interface affiche l’erreur, sans ouvrir une salle publique.

## Jitsi auto-hébergé

Choix retenu pour R-AERO le 29 septembre 2026. `LIVE_VIDEO_PROVIDER=jitsi` sélectionne le serveur privé ; `JITSI_DOMAIN` contient uniquement son nom DNS, `JITSI_APP_ID` l'émetteur autorisé et `JITSI_APP_SECRET` un secret aléatoire partagé avec Prosody (32 octets minimum). Aucune clé n'est transmise au navigateur. Un réglage incomplet refuse l'admission, même si des accès JaaS sont encore présents.

Le ticket HS256 utilise l'audience `jitsi`, le domaine comme sujet, la salle littérale, le rôle issu du serveur et la même fenêtre maximale de dix minutes. L'API iframe existante charge `https://<domaine>/external_api.js`. Prosody doit imposer JWT, refuser les invités et les jetons vides, vérifier le domaine et activer `token_affiliation`. Jicofo doit désactiver l'attribution automatique du rôle propriétaire. La recette doit vérifier qu'un apprenant arrivé avant le formateur ne devient jamais modérateur.

Les tests PostgreSQL couvrent signatures HS256/RS256, rôles, expiration, refus des tiers et configurations invalides. La configuration de déploiement et les contrôles du serveur sont décrits dans [Jitsi auto-hébergé](jitsi-self-hosted.md).

## Compatibilité JaaS

Configuration serveur : `JAAS_APP_ID`, `JAAS_API_KEY_ID` complet (`AppID/key-id`), `JAAS_PRIVATE_KEY` PEM RSA d’au moins 2048 bits, avec clé publique correspondante enregistrée dans JaaS. Les exemples d’environnement contiennent seulement des champs vides. Le choix technique de JaaS ne crée aucun compte ni engagement commercial ; la configuration et la recette fournisseur restent à réaliser.

Le jeton RS256 dure au maximum dix minutes pour l’admission, porte un identifiant unique, l’audience `jitsi`, l’émetteur `chat`, l’AppID et une salle littérale `raero-{type}-{id}`. Les anciens noms de salle personnalisés sont ignorés pour empêcher collisions et jokers. Le rôle modérateur provient du contrôle serveur existant (ADMIN ou instructeur explicitement affecté à la classe) ; le client ne peut pas le demander. Identifiant et nom d’affichage sont transmis, sans email. Enregistrement, transcription, diffusion et appels sortants ne sont pas accordés par le jeton.

Une trace immuable conserve qui a reçu un jeton, la salle, le rôle et l’expiration. Le JWT et la clé privée ne sont pas stockés dans ce journal. Le navigateur garde le jeton pour charger l’iframe du fournisseur ; la sortie de réunion permet de demander une nouvelle admission. La présence de l’application commence toujours après l’événement de connexion à la vidéo.

## Vérification et limites

Migration `20260913_live_video_tickets.sql`. Deux tests PostgreSQL avec une paire RSA locale temporaire vérifient la signature réelle, audience/émetteur/salle/expiration/rôle, absence d’email, journal, refus tiers/compte suspendu/classe terminée ou annulée et configuration absente. Aucun appel JaaS ni conférence réelle effectué.

Le jeton est un secret porteur utilisable pendant sa fenêtre d’admission. Son expiration ne prouve pas l’expulsion d’une connexion déjà établie. Restent révocation fournisseur/ban, validation des qualifications des instructeurs, événements fournisseur signés pour l’assiduité, replays privés, supervision et recette navigateur/réseau/audio/vidéo. Les anciens liens de salles publiques éventuellement déjà partagés ne sont pas supprimés chez l’ancien fournisseur. La configuration du compte JaaS doit être testée pour refuser l’accès sans jeton et toute élévation de privilège.

Sources officielles consultées le 13 septembre 2026 : [structure JWT JaaS](https://developer.8x8.com/jaas/docs/api-keys-jwt/), [intégration iframe](https://developer.8x8.com/jaas/docs/iframe-api-integration/). Le jeton de dix minutes et la désactivation des fonctionnalités citées sont les choix de cette application.


## Horaires d’admission (lot 60)

Le serveur ouvre la vidéo 15 minutes avant le début pour les participants et 30 minutes avant pour le modérateur, puis ferme les admissions 15 minutes après la fin prévue. L’ouverture est inclusive, la fermeture exclusive ; les statuts terminé/annulé ferment aussi l’accès. Ce sont des choix de fonctionnement de la plateforme, sans prétention réglementaire.

Une session nécessite endDate strictement après startDate. Un webinar nécessite une durée positive ajoutée à scheduledAt. Sans ces données, le ticket et les heartbeats de présence sont refusés avec une explication ; les organisateurs doivent compléter les horaires historiques. Aucune durée manquante n’est inventée à partir de durationDays. Pour les sessions de plusieurs jours, cette fenêtre reste continue : les créneaux quotidiens et interruptions pédagogiques restent à modéliser.

L’expiration du JWT est plafonnée à la fermeture prévue. La lecture de l’accès expose les deux bornes et l’état early/open/closed/unscheduled. Le navigateur les affiche en FR/EN/AR et dans le fuseau local, désactive le bouton hors fenêtre et relit les droits toutes les 15 secondes. Un changement d’état ou une perte d’inscription détruit l’iframe locale ; un ancien ticket expiré n’est pas réutilisé pour une nouvelle ouverture. Les consultations de discussion/historique et le replay autorisé conservent leurs règles distinctes.

La fermeture locale suppose un navigateur connecté qui reçoit le nouvel état. Elle ne prouve pas une expulsion chez le fournisseur, et un changement d’horaire après délivrance ne révoque pas un JWT déjà émis. La fenêtre borne les nouvelles admissions et les crédits de présence applicatifs ; événements et révocation fournisseur restent nécessaires pour une attestation d’assiduité plus forte.

193 tests réussis, dont 143 PostgreSQL : fenêtres distinctes participant/modérateur, bornes exactes, fin manquante/invalide, durée webinar, expiration JWT plafonnée et refus de présence hors fenêtre. Les fixtures de présence antérieures ont reçu des fins explicites. TypeScript/build réussis ; pas de migration ni modification de l’infrastructure, donc pas de nouvelle recette Docker pour ce lot. Recette navigateur et conférence réelle toujours à effectuer. Aucun fournisseur appelé ni déploiement.

Les affectations explicites et le changement de comportement pour les anciens auteurs sont détaillés dans `docs/live-instructors.md` (lot 66).
