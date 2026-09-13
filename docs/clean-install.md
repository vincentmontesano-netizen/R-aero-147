# Installation neuve et migrations

`pnpm db:migrate` initialise désormais une base PostgreSQL vide à partir de `drizzle/baseline/20260913.sql`, puis applique les migrations ultérieures. Cette base de schéma est un export sans données, propriétaires ni privilèges de la base d’intégration PostgreSQL 16, après les migrations du 13 septembre. Les directives propres à psql ont été retirées pour permettre l’exécution transactionnelle par le pilote.

Le manifeste `20260913.json` fixe les empreintes des migrations incorporées. L’initialisation vérifie leurs fichiers et enregistre les reçus correspondants, ainsi que les empreintes du SQL et du manifeste. Les bases déjà existantes poursuivent leur historique habituel ; aucun schéma de base n’y est réappliqué. Un schéma partiel sans table users est refusé. Le verrou transactionnel de migration reste commun aux démarrages concurrents.

Le SQL de base et son manifeste sont désormais immuables : toute évolution doit devenir une nouvelle migration, jamais une retouche de ce point de départ. `db:push` reste un outil de développement dans package.json, mais n’est plus exécuté au démarrage Docker.

## Premier administrateur

`pnpm db:bootstrap-admin` crée un premier administrateur seulement si aucun ADMIN actif n’existe. Il exige `ADMIN_EMAIL` et `ADMIN_PASSWORD` (au moins 14 caractères), stocke le mot de passe haché et ne l’affiche pas. Un compte existant n’est ni promu ni réinitialisé implicitement ; un administrateur actif existant est conservé. Le traitement est sérialisé en base.

L’entrée Docker exécute migrations puis initialisation administrateur. Les données de démonstration sont désormais désactivées par défaut ; `SEED_DEMO_DATA=true` les active explicitement. Les variables de prix Stripe, JaaS et PUBLIC_APP_URL sont relayées par Compose.

## Vérification réalisée

Une nouvelle base locale dédiée `raero_install_20260913_v1` a été créée dans le conteneur PostgreSQL de test. Première migration réussie sans `db:push`, deuxième migration sans réapplication, zéro utilisateur initial, identifiants administrateur absents refusés, deux initialisations concurrentes donnant un seul administrateur. Les 148 tests ont ensuite réussi sur cette nouvelle base, ainsi que TypeScript, build applicatif, syntaxe du script Bash et validation Compose avec le fichier d’exemple. La migration sur la base d’intégration historique a également réussi sans réinitialisation.

Restent séparation des services et privilèges du rôle PostgreSQL intégré, gestion de son mot de passe historique, contrôle de santé applicatif/base, sauvegardes et restauration, secrets de production, supervision et déploiement. Ces vérifications ne constituent pas une validation d’exploitation en production.

## Vérification Docker réelle (lot 42)

Image `raero-refonte-validation:20260913` construite et exécutée sans réseau externe, sur deux volumes de test dédiés. L’image embarque Node 20 et PostgreSQL 15.19 : initialisation du schéma, migrations et création du premier administrateur réussies sur cette version également. Après redémarrage, la base conserve un utilisateur, zéro formation de démonstration et 33 reçus de migration.

Le script `scripts/docker-smoke.mjs`, exécuté dans le conteneur, vérifie la page HTML, le refus d’accès HTTP au secret de session, l’absence de compte pour une requête anonyme, la connexion administrateur et la conservation de sa session après redémarrage. Il utilise exclusivement les identifiants de test fournis par environnement et n’affiche ni mot de passe ni cookie.

Un premier essai a révélé un arrêt PostgreSQL brutal. L’entrée Bash supervise désormais Node et arrête PostgreSQL à la réception du signal de terminaison ; Compose prévoit 30 secondes de grâce. Après reconstruction, les journaux confirment un arrêt propre puis un démarrage sans récupération après incident. Le contrôle Docker était healthy avant l’arrêt final propre du conteneur de test. Les volumes isolés sont conservés ; aucun service externe ni déploiement n’a été utilisé.

Ces essais complètent les 148 tests du lot 41. Le contrôle de santé actuel vérifie encore HTTP uniquement ; les privilèges et secrets PostgreSQL intégrés, la sauvegarde/restauration et la supervision restent à traiter avant exploitation.

## Identifiants et droits PostgreSQL intégrés (lot 43)

Le conteneur tout-en-un génère désormais un mot de passe aléatoire de 48 octets, conservé sous forme hexadécimale dans `PGDATA/.raero-password` avec permissions 0600. Ce fichier fait partie du volume de base et ne se trouve pas dans le stockage HTTP. La valeur n’est ni passée à psql en argument ni affichée. Le fichier existant doit être valide ; une valeur corrompue interrompt le démarrage.

`scripts/provision-embedded-db.mjs` configure le rôle raero avant les migrations. Il retire SUPERUSER, CREATEDB, CREATEROLE, REPLICATION et BYPASSRLS, y compris sur un ancien volume. Le rôle reste propriétaire de sa base et de son schéma pour les migrations : il dispose donc encore de droits DDL, ce qui ne remplace pas une séparation future entre rôle de migration et rôle applicatif.

L’authentification du cluster intégré est gérée par le démarrage : accès Unix par peer, TCP limité à la base et au rôle raero sur 127.0.0.1 avec SCRAM-SHA-256. Le fichier pg_hba.conf intégré est réécrit ; ce mécanisme ne s’applique pas à un serveur PostgreSQL externe. Voir la [documentation officielle PostgreSQL 15](https://www.postgresql.org/docs/15/auth-pg-hba-conf.html). Le mot de passe historique fixe est remplacé lors de la première exécution, sans réinitialisation des données.

Vérifications réalisées sur volumes Docker isolés : mise à niveau du volume du lot 42, installation vide, migration et compte administrateur, refus de l’ancien mot de passe, refus de création de rôle et de lecture de fichiers serveur, refus d’usurpation locale de postgres depuis l’utilisateur système node, session HTTP conservée après redémarrage. `scripts/embedded-db-smoke.mjs` reproduit les contrôles de droits sur une base de recette contenant seulement son administrateur. Les 148 tests applicatifs passent aussi dans l’image PostgreSQL 15.19 sous le rôle restreint (NODE_ENV=test). Un premier lancement de tests avait hérité de NODE_ENV=production sans origine publique de test et a été corrigé dans l’environnement de recette.

Restent notamment le processus applicatif exécuté comme root dans l’image, la séparation migration/exécution, la sauvegarde/restauration des secrets et données, la santé de la base et la supervision. Ne pas considérer ce durcissement comme une isolation complète de l’application vis-à-vis de PostgreSQL.

## Processus applicatif sans privilèges système (lot 44)

Après migrations et bootstrap, l’entrée lance Node avec `setpriv` sous l’utilisateur système node (UID/GID 1000), groupes réinitialisés et `no-new-privs`. Le processus serveur n’a aucune capability effective. Son masque de création de fichiers est 0077. Le mot de passe d’initialisation ADMIN_PASSWORD est retiré de son environnement avant lancement ; les identifiants applicatifs nécessaires (base, session et fournisseurs configurés) restent disponibles.

Le volume STORAGE_DIR est attribué à node au démarrage, y compris les anciens fichiers, pour permettre les imports. Le fichier de session persistant reste root/0600 et est chargé par l’entrée avant lancement. Le code et PGDATA ne sont pas attribués au serveur. Le superviseur initial reste root pour préparer les volumes et arrêter PostgreSQL ; le rôle SQL reste propriétaire de sa base. La séparation entre rôle SQL de migration et rôle d’exécution reste à faire.

`scripts/runtime-user-smoke.mjs` contrôle le processus réellement lancé (UID, capabilities, no-new-privs, masque et absence de ADMIN_PASSWORD) et les droits de fichiers depuis le même utilisateur : code non modifiable, données/secrets PostgreSQL et /etc/shadow illisibles, stockage accessible en écriture/lecture. La lecture de l’environnement dans /proc se fait depuis node, car le root du conteneur ne dispose pas de la capability de traçage permettant de lire celui d’un autre utilisateur.

Image reconstruite, contrôles réussis sur le volume existant et sur deux volumes neufs avec un administrateur de recette. Connexion HTTP et contrôles PostgreSQL réussis, session existante conservée après redémarrage, arrêt propre confirmé. Les conteneurs de recette ont ensuite été arrêtés ; leurs volumes isolés sont conservés. La suite applicative de 148 tests du lot 43 n’a pas été répétée pour ce changement de lancement système.

## Santé applicative et panne de base (lot 45)

Deux routes publiques sans détails internes : `/health/live` renvoie 200 tant que le serveur HTTP répond ; `/health/ready` renvoie 200 si une requête sur la table users réussit via le pool applicatif, sinon 503. Les réponses sont no-store. La vérification est limitée à deux secondes côté HTTP, partage une seule requête SQL en cours et réutilise brièvement son résultat (une seconde). Une requête SQL encore bloquée reste unique jusqu’à sa résolution, même si ses appels HTTP ont expiré.

Le HEALTHCHECK Docker utilise désormais `/health/ready`. Il ne vérifie pas encore le stockage, les sauvegardes ni les fournisseurs externes. Docker marque un conteneur unhealthy après les échecs configurés ; la politique restart ne garantit pas à elle seule le redémarrage d’un conteneur simplement unhealthy. La supervision et les alertes restent à configurer.

`scripts/health-smoke.mjs` est réservé à un conteneur de recette isolé : il arrête temporairement PostgreSQL, vérifie accueil/live=200 et ready=503, relance la base et vérifie ready=200 sans redémarrer Node. Cet exercice a réussi sur l’image reconstruite. Le script écrit le journal PostgreSQL de son redémarrage dans /tmp pour que le processus serveur ne conserve pas le tube de sortie du contrôleur. Un premier essai avait rencontré ce blocage du script ; la disponibilité restaurée avait été vérifiée séparément avant correction et réexécution complète.

TypeScript et construction Docker réussis. Suite complète : 151 tests réussis, dont les 108 tests PostgreSQL existants et trois tests HTTP supplémentaires couvrant succès, panne sans fuite de diagnostic, cache et requêtes concurrentes bloquées. Conteneur de recette arrêté après vérification ; aucun déploiement.

## Sauvegarde à froid vérifiée (lot 46)

La [procédure de sauvegarde/restauration](backup-restore.md) et le script `scripts/backup-container.py` couvrent désormais le conteneur intégré arrêté, ses deux volumes et leurs empreintes. Restauration réelle sur volumes neufs validée, y compris donnée SQL, fichier binaire et session existante. Conservation hors serveur, chiffrement du support, automatisation/alertes et restauration sur autre hôte restent à organiser.
