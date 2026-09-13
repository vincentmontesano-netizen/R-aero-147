# Archivage pédagogique

Les actions de suppression des formations, chapitres, objectifs, questions et diapositives archivent désormais leur ligne. Aucun dossier apprenant, résultat, objectif de certificat ou rattachement n’est supprimé en cascade. PostgreSQL refuse DELETE et TRUNCATE sur ces cinq tables, ainsi que les modifications de leurs lignes archivées.

## Comportement

- Une formation archivée est dépubliée et retirée des listes actives. Ses inscrits conservent les supports et peuvent terminer une session d’examen. Aucune nouvelle inscription n’est acceptée.
- Un élément individuel ne peut être archivé que dans une formation non publiée, sans inscription historique dépourvue de version. Les inscriptions versionnées conservent leur snapshot même après cet archivage ; voir `curriculum-versions.md`.
- Un chapitre ou objectif portant des liens actifs doit d’abord être libéré de ces liens par réaffectation ou archivage des éléments concernés. Les anciens rattachements archivés sont conservés.
- Les contenus archivés sont exclus des banques et listes actives. La reprise historique d’une ancienne session sans snapshot conserve son accès à la banque historique, avec les limites déjà documentées.
- La base vérifie les liens actifs vers les chapitres/objectifs et sérialise les rattachements et inscriptions sur la ligne formation. Les ajouts vers des chapitres/objectifs archivés ou étrangers sont refusés.
- Le studio et l’administration nomment les actions « Archiver ». Un archivage de formation est également disponible aux auteurs autorisés dans le studio.

## Preuves

Chaque archivage applicatif écrit un événement avec auteur, date, nature/identifiant de l’élément et états avant/après dans la même transaction. L’historique refuse modification, suppression et TRUNCATE. Une répétition du service d’archivage ne duplique pas l’événement. La route de consultation `maker.history` vérifie les droits de l’auteur, y compris pour une formation déjà archivée.

Il s’agit de l’historique des archivages, pas encore de l’audit de toutes les modifications pédagogiques. Les opérations directes de maintenance de base ne sont pas attribuées artificiellement à un utilisateur. Les mises à jour applicatives ordinaires ne peuvent pas écrire `archivedAt` pour contourner l’action dédiée.

## Suite

Revue/versionnement du contenu utilisé, interface de consultation/recherche des archives, historique général de création/modification, gestion du cycle de conservation, sauvegardes et restauration restent à compléter. Les archives sont verrouillées ; aucune restauration en place n’est proposée. Le vault et d’autres tables hors contenu pédagogique doivent également être audités séparément pour les suppressions historiques.

Migrations : `20260913_content_archive.sql`, `20260913_archive_links.sql`. Tests PostgreSQL : conservation des lignes et liens, verrouillage, historique immuable, idempotence, refus inter-compagnie, refus d’archiver un élément déjà suivi, maintien d’un examen après archivage de formation et refus de nouvelles inscriptions/rattachements.
