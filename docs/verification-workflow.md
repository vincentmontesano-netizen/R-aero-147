# Revue documentaire KYC / KYB

Accès : `/verifications`, depuis le menu utilisateur. L’administrateur dispose du bouton « File de revue ADMIN ».

## Parcours

1. Le client choisit particulier (KYC) ou une organisation dont il est responsable actif (KYB), puis renseigne le nom légal, le pays et l’adresse. Le KYB demande aussi le numéro d’immatriculation.
2. Il enregistre le brouillon et joint ses pièces : identité pour le KYC ; immatriculation et mandat du représentant pour le KYB. PDF, PNG et JPEG jusqu’à 8 Mo ; vérification du type et de la signature du fichier.
3. L’envoi verrouille les informations et les documents pendant l’examen.
4. Un ADMIN indépendant du déposant, des contributeurs et de la compagnie donne une décision motivée : validation, refus, ou demande de complément.
5. Un refus ou une demande de complément permet la correction et un nouvel envoi. Une validation verrouille le dossier.
6. Les pièces retirées avant l’envoi sont archivées et leurs anciens liens sont refusés. Aucun endpoint ne détruit le dossier ou son historique.

Les pièces ne sont visibles que par la personne concernée (KYC), les managers actifs de l’organisation (KYB) et les ADMIN. La révocation d’une affiliation supprime aussi l’accès aux anciens liens KYB. Elles ne sont pas liées au consentement de partage du passeport personnel.

## Installation et tests

Sur une installation existante, `pnpm db:migrate` applique la migration additive `drizzle/migrations/20260913_verification.sql` en transaction. Sur une base neuve, commencer par `pnpm db:push`, puis `pnpm db:migrate`. L’entrée Docker exécute ces deux étapes. Le journal `raero_migrations` conserve le checksum des migrations déjà appliquées et empêche leur modification silencieuse.

La migration installe le trigger qui refuse UPDATE, DELETE et TRUNCATE sur `verification_events`. `db:push` seul ne suffit pas à installer ce trigger. Les services enregistrent les snapshots précédents et suivants dans la même transaction que les décisions. Une transaction verrouille le dossier pour éviter deux décisions concurrentes.

Tests PostgreSQL : `RAERO_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55477/raero_test pnpm test`. Cette URL est réservée à la base locale jetable créée pendant la refonte. Les tests ajoutent des comptes et pièces factices ; ne pas les lancer sur une base client.

## Portée et suite

Ce workflow est une revue interne de justificatifs. Il ne réalise pas encore de contrôle automatisé auprès d’un registre, de preuve de présence, de screening, ni de vérification d’identité par un prestataire. Il ne délivre aucun agrément Part-147 et ne conditionne pas encore les achats ou inscriptions à son résultat.

À compléter selon le processus opérationnel retenu : renouvellement et expiration des décisions, règles de conservation des pièces, notifications, recherche/pagination de la file (actuellement les 200 dossiers les plus récents), analyse antivirus des pièces et intégration éventuelle d’un prestataire spécialisé. Les fichiers PDF ne sont pas assainis ; ils sont servis en téléchargement privé avec nosniff et sandbox.
