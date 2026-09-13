# Création depuis un modèle

Les modèles actuels sont des structures communes de chapitres et d’objectifs. Ils ne constituent pas une copie complète de cours et ne génèrent pas des évaluations validées.

L’instanciation vérifie auteur actif, compagnie active et management courant dans sa transaction PostgreSQL. Titre, domaine, structure, tailles et niveaux de connaissance sont contrôlés avant toute création. Formation, chapitres, objectifs, révision éditoriale et copie du modèle sont enregistrés atomiquement ; aucun brouillon partiel ne reste si la transaction échoue.

La migration `20260913_template_instantiations.sql` conserve une copie immuable du modèle et l’identité du créateur, indépendamment des modifications ultérieures de la source. Chaque création explicite produit un nouveau brouillon, non publié et non approuvé, avec ses propres liens chapitre/objectif. Les contrôles de préparation et la revue pédagogique restent nécessaires avant publication.

Un modèle global ne peut pas accorder les médias privés d’un autre cours : les références `/storage/courses/` et `/storage/course-media/` y sont refusées avant instanciation. Une duplication complète avec copie autorisée des médias, questions et repères vidéo reste à développer ; les nouveaux supports peuvent actuellement être importés dans le brouillon.

Trois tests PostgreSQL : créations indépendantes/liens/copie immuable, objectif invalide tardif ou référence privée sans cours partiel, autorisation de destination/révocation. TypeScript valide également le domaine sans conversion permissive. Aucun appel externe.
