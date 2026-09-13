# Duplication complète dans le studio

Sélectionner une formation et l’espace de destination, puis « Dupliquer la formation sélectionnée ». Le dialogue FR/EN/AR affiche explicitement la destination, demande le titre et annonce la création d’un brouillon à revoir. Après réussite, le studio ouvre la copie. Les erreurs restent dans le dialogue et l’action est désactivée pendant la requête.

La copie reprend les métadonnées pédagogiques et commerciales, les chapitres actifs et leurs politiques de QCM, les objectifs actifs, les diapositives avec mini-QCM et interactions vidéo, ainsi que les questions de chapitre et d’examen final avec leurs barèmes et clés. Les identifiants sont nouveaux ; les liens entre éléments sont remappés, y compris les liens circulaires chapitre/objectif. Un lien à un élément archivé ou étranger provoque un rollback complet. Les éléments archivés sont exclus.

La destination appartient à l’auteur connecté et à l’organisation choisie, ou à son espace opérateur lorsqu’il y est autorisé. L’acteur actif, les droits sur la source et ceux sur la destination sont relus/verrouillés dans la transaction. Le rôle global de manager ne suffit pas. Les compagnies source et destination doivent être actives, même pour un administrateur. La transaction utilise repeatable read afin de lire un état cohérent du cours ; une modification concurrente conflictuelle peut nécessiter une nouvelle tentative.

La copie est non publiée, non mise en avant, en version de travail 1 avec revue draft, sans lien vers une publication ou un groupe de traduction antérieur. Elle ne reprend ni décisions de revue, ni versions publiées, ni inscriptions, ni résultats, ni certificats. L’exigence de revue avant publication du e-learning reste applicable. Le titre peut ensuite être adapté, ainsi que prix, contenu et paramètres avant publication.

## Médias et provenance

Les fichiers privés déjà conservés sont réutilisés sans dupliquer leurs octets. La migration `20260913_course_copies.sql` conserve un instantané immuable de la source au moment de la copie, son identifiant et l’auteur. Elle enregistre uniquement les clés de médias référencées dans cette source et déjà autorisées pour celle-ci. Le collage d’une URL privée étrangère ne crée pas de droit. Les copies de copies fonctionnent avec le même contrôle.

Les auteurs de la destination obtiennent accès aux médias référencés. Les apprenants restent soumis à une inscription valide et à la présence du média dans leur version publiée figée. La vérification d’empreinte des fichiers course-media reste celle de l’enregistrement original immuable. Aucun octet ni fournisseur n’est appelé pour dupliquer ; cette action ne vérifie pas l’existence physique ou l’état actuel de chaque fichier. Les anciens supports courses n’acquièrent pas rétroactivement une empreinte ; les URL externes restent externes. Une opération de restauration/migration de stockage doit conserver ces fichiers partagés avec toutes leurs copies.

## Validation

190 tests réussis, dont 141 PostgreSQL. Les nouveaux scénarios couvrent copie intégrale/remappage, mini-QCM/interactions vidéo, quiz final matching et corrigés, exclusion des questions archivées, modification indépendante, absence de publications/inscriptions héritées, provenance immuable, médias d’une copie de copie, droits source/destination, URL privée étrangère et rollback après insertion partielle avec objectif archivé. Un apprenant accède au média de la copie seulement après inscription à sa version et perd l’accès à expiration ; le scénario de publication utilise une formation webinar, tandis que le premier scénario vérifie le brouillon elearning.

Le premier test de rattachement invalide a été adapté : PostgreSQL refuse déjà d’insérer un identifiant étranger, donc le scénario reproduit un objectif archivé après rattachement. TypeScript/build réussis après adaptation de l’itération Set à la cible du projet. Construction Docker et recette installation/panne/reprise/redémarrage/sauvegarde/restauration réussies, ressources jetables nettoyées. Recette visuelle navigateur à effectuer ; avertissement de bundle persistant. Aucun déploiement.
