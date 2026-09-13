# Registre administratif Part-147

Accès : `/admin/approval`, par le menu ADMIN. Les utilisateurs, formateurs et responsables de compagnies clientes ne peuvent consulter ni les API ni les fichiers de cet espace.

## Fonctionnement

- **Organisme** : raison sociale, autorité, référence, périmètre/limitations, sites et trois responsables nommés. Les personnes doivent être actives ; formation et qualité doivent être confiées à des personnes distinctes, conformément à la règle de gouvernance du projet CLAUDE. Ce contrôle applicatif n’est pas une interprétation exhaustive des exceptions réglementaires.
- **Statut** : préparation, transmis, agrément enregistré, suspendu, retiré. Chaque changement demande un motif. Enregistrer un agrément demande une référence et la sélection explicite d’une décision de l’autorité et d’une version du MTOE. Modifier le périmètre ou les responsables remet le registre en préparation et retire ces liens d’approbation.
- **Documents** : ajout de versions pour décision, MTOE, périmètre, personnel, audit et preuve d’action. Aucun remplacement ou effacement d’une version par l’application. Téléchargement réservé ADMIN ; une nouvelle version ne remplace pas automatiquement la référence documentaire d’un agrément déjà enregistré.
- **Écarts** : constat et référence, classification, responsable, échéance. L’action comprend cause racine, action corrective et preuve issue d’un document d’audit ou de preuve. La clôture exige un autre administrateur que le responsable et les contributeurs au plan d’action, avec une note de vérification d’efficacité. Deux clôtures concurrentes ne peuvent produire deux résultats.
- **Historique** : versions précédentes/suivantes enregistrées dans la transaction métier. Triggers PostgreSQL refusant UPDATE, DELETE et TRUNCATE sur les événements et versions documentaires. Affichage des différences dans l’interface.

Installation : `pnpm db:migrate` après le schéma de base. Les migrations `20260913_approval.sql` et `20260913_approval_evidence.sql` sont additives et suivies par checksum.

## Références consultées le 13 septembre 2026

- [EASA — Easy Access Rules for Continuing Airworthiness, Part-147](https://www.easa.europa.eu/en/document-library/easy-access-rules/online-publications/easy-access-rules-continuing-airworthiness?erules-id=ERULES-1963177438-481) : repères 147.A.105 (personnel), 147.A.130 (procédures et système qualité), 147.A.140 (MTOE). La publication identifiée est la révision de septembre 2025 ; aucune affirmation n’est faite ici sur l’exhaustivité des amendements ultérieurs.
- [EASA — audit du système qualité Part-147](https://www.easa.europa.eu/en/faq/19076) : fonction d’audit indépendante et remontée des constats.
- [EASA — FAQ Part-147](https://www.easa.europa.eu/en/the-agency/faqs/part-147) : distinction entre les privilèges de l’organisme et les qualifications des personnes.

Les contrôles de ce registre aident à organiser les preuves. Ils ne délivrent pas d’agrément, ne remplacent pas une décision de l’autorité et ne démontrent pas à eux seuls la conformité de l’organisme.

## Travail restant

Périmètres structurés par catégorie/type/site, matrice des privilèges instructeurs/examinateurs, dossiers et acceptations de nomination, programme d’audit périodique, processus d’amendement/revue documentaire, notifications d’échéance, export du dossier et intégration aux conditions de publication des cours/certificats. Le stockage local n’est pas un archivage WORM ; sauvegarde, restauration et conservation opérationnelles restent à valider.
