# Jitsi privé sur le VPS Hostinger

Le service utilise la distribution officielle Docker `stable-11248`, publiée le 14 septembre 2026. La licence du logiciel ne nécessite pas de paiement ; CPU, mémoire, stockage et trafic proviennent du VPS existant.

## Installation reproductible

1. Télécharger la distribution depuis [la version officielle](https://github.com/jitsi/docker-jitsi-meet/releases/tag/stable-11248) et conserver son `docker-compose.yml`.
2. Copier `ops/jitsi/compose.override.yml` et préparer un `.env` privé à partir de `ops/jitsi/.env.example`. Générer trois secrets distincts et aléatoires ; ne jamais conserver leurs valeurs dans Git. Le dossier de déploiement est `/opt/r-aero-jitsi`.
3. Créer les répertoires de configuration et de stockage requis par [le guide officiel](https://jitsi.github.io/handbook/docs/devops-guide/devops-guide-docker/), avec droits adaptés à UID/GID 1000. Les conteneurs sont sans privilèges et leurs systèmes de fichiers sont en lecture seule.
4. Vérifier `docker compose -p raero-jitsi -f docker-compose.yml -f compose.override.yml config --quiet`, télécharger les images, puis démarrer avec les mêmes fichiers et `up -d`.
5. Ajouter l'enregistrement A `meet.r-aero-academy.com` vers le VPS sans remplacer les autres enregistrements DNS. Le proxy Caddy utilise `reverse_proxy raero-jitsi-web:8000` sur son réseau `caddy_default`. Valider sa configuration avant un rechargement sans arrêt.
6. N'exposer que le média UDP 10000 sur l'hôte. Les ports HTTP/XMPP/REST des conteneurs restent internes ; HTTPS est terminé par Caddy.
7. Configurer l'application avec `LIVE_VIDEO_PROVIDER=jitsi`, `JITSI_DOMAIN`, `JITSI_APP_ID` et le même secret que `JWT_APP_SECRET`. Les secrets restent côté serveur.

## Contrôles d'admission

JWT est obligatoire (`ENABLE_AUTH=1`, `AUTH_TYPE=jwt`, `ENABLE_GUESTS=0`, `JWT_ALLOW_EMPTY=0`). L'émetteur et l'audience sont restreints ; le sujet doit correspondre au domaine. Le module `token_verification` contrôle la salle, et `token_affiliation` attribue le rôle du ticket. `ENABLE_AUTO_OWNER=0` et `JICOFO_ENABLE_AUTH=0` empêche l'attribution automatique ; `ENABLE_MODERATOR_CHECKS=1` conserve le contrôle du modérateur.

La recette doit prouver : refus sans jeton, mauvaise signature, jeton expiré et mauvaise salle ; connexion des deux rôles ; absence de promotion d'un apprenant arrivé en premier ; médias bidirectionnels via le pont vidéo (P2P désactivé). Un jeton expiré ne coupe pas une réunion déjà établie. Les réseaux bloquant UDP peuvent nécessiter un relais TURN, qui doit être testé avant de déclarer leur prise en charge.

## Exploitation

L'override limite la mémoire des services et conserve les autres applications du VPS. Le proxy existant est sauvegardé avant modification. Une suppression de la seule route Jitsi et un arrêt du projet `raero-jitsi` permettent le retour arrière. Aucune donnée pédagogique de R-AERO n'est stockée dans ces volumes. L'enregistrement vidéo et la transcription sont désactivés.

Les preuves de recette et les sauvegardes sont conservées hors du dépôt. Leur réussite ne remplace pas une recette humaine avec microphone et caméra physiques.
