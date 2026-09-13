# Archivage des formations externes héritées

Le dossier technicien conserve ses entrées externes après retrait. Le bouton Archiver demande un motif de 3 à 1000 caractères et annonce le caractère définitif de l’action. Le formulaire, les erreurs et l’état en cours sont gérés dans le dialogue existant ; les libellés nouveaux sont FR/EN/AR. Une entrée archivée reste visible avec date, identifiant de l’auteur et motif. L’export CSV la marque comme archivée au lieu de terminée et conserve ces métadonnées.

La route `company.archiveExternalTraining` relit le compte actif et les droits dans une transaction. Un manager doit avoir une affiliation MANAGER active dans la compagnie active de l’entrée. Le technicien doit encore appartenir à cette même compagnie ; les entrées ambiguës ou réaffectées nécessitent un administrateur. Aucun repli sur le rôle global ou la compagnie du compte. Les lignes participant à la décision sont verrouillées. Deux demandes concurrentes ne changent qu’une fois l’entrée ; répéter l’archivage ne remplace ni motif ni auteur.

La migration `20260913_external_training_archive.sql` ajoute archivedAt, archivedBy et archiveReason avec contrainte de cohérence. Les déclencheurs interdisent DELETE/TRUNCATE et les modifications de la pièce initiale. Seule la transition vers l’archivage est autorisée ; une entrée archivée est verrouillée, sans réactivation ni modification du motif. Les corrections passent par une nouvelle entrée. L’ancien service de mise à jour non utilisé est retiré. L’ancienne route de suppression répond PRECONDITION_FAILED sans écrire, pour les clients non rafraîchis.

Les lignes historiques ne reçoivent pas de fausse date ou de faux auteur d’origine. Cet archivage conserve la référence documentaire existante, sans prétendre garantir le contenu d’une ancienne URL externe ni lui inventer une empreinte. La déclaration personnelle moderne de qualifications reste un parcours distinct ; cette évolution porte sur external_trainings. Le propriétaire SQL peut encore modifier les déclencheurs : la séparation des rôles de migration/exécution reste à compléter.

## Validation

187 tests réussis, dont 138 PostgreSQL. Trois nouveaux scénarios couvrent concurrence, preuve conservée dans le dossier, immutabilité et non-effacement, manager d’une autre compagnie, suspension, réaffectation du technicien, administration des cas historiques, ancien endpoint, motif vide et compte suspendu. TypeScript et build vérifiés ; avertissement de taille de bundle persistant. Recette visuelle navigateur à effectuer.

Tentative TRUNCATE séparée sur la base synthétique après la suite : refus explicite du déclencheur et transaction annulée. Construction Docker et recette installation/panne/reprise/redémarrage/sauvegarde/restauration réussies ; ressources jetables nettoyées. Aucun fournisseur appelé ni déploiement.
