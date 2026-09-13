# Versions publiées et inscriptions

Une publication applicative enregistre désormais un snapshot immuable contenant la fiche de formation, ses chapitres, diapositives, objectifs et questions actives. Les chapitres et supports sont ordonnés. La version reçoit un numéro séquentiel par formation, un auteur de publication et une date. Les contenus sont lus sous le verrou formation partagé avec les écritures pédagogiques.

PostgreSQL interdit la modification, la suppression et le TRUNCATE des versions. À l’insertion d’une inscription, un trigger fixe la version publiée courante ; son rattachement formation/version ne peut plus être modifié. Une republication crée une nouvelle version et ne déplace pas les inscriptions existantes.

## Parcours apprenant

- Fiche et supports provenant de la version inscrite, y compris pour une formation interne ou archivée. Le lecteur résout sa formation depuis les inscriptions du compte, sans dépendre du catalogue public.
- Chapitres obligatoires, banques, seuils, durées et tentatives provenant de cette même version pour chaque démarrage et nouvelle tentative.
- Snapshot de session toujours utilisé pour les réponses et la notation de la session elle-même.
- Projection explicite des questions avant envoi au navigateur : les corrigés des versions restent côté serveur.
- Objectifs évalués avec les résultats de leur périmètre chapitre/final ; un résultat du final ne remplace pas les réponses des chapitres.
- Production et consultation de certificat utilisant les métadonnées et objectifs de la version de l’inscription. Ceci ne constitue pas une validation réglementaire du document généré.

Le studio affiche les numéros publiés et permet une nouvelle publication. Le lecteur affiche sa version ou la mention « Parcours historique ».

## Héritage et limites

Les inscriptions sans version restent explicitement historiques. Elles continuent le mécanisme existant de lecture du contenu courant : aucune version passée n’a été reconstruite arbitrairement. Une première publication moderne ne rattache pas rétroactivement ces dossiers. Les chemins anciens d’inscription à une formation sans version restent à réconcilier avec le futur contrôle de distribution/publication ; le trigger n’invente pas de version pour un brouillon ou une ancienne formation.

Un élément de contenu peut désormais être archivé dans une formation dépubliée lorsque toutes ses inscriptions disposent de versions. Des inscriptions historiques sans version continuent de bloquer cette opération. Les versions conservent l’élément archivé pour leurs apprenants.

La revue pédagogique indépendante et son cycle de demandes de corrections restent à développer. Les métadonnées affichées au catalogue utilisent encore la fiche éditoriale courante ; elles doivent être alignées sur la publication validée. Les URLs de médias sont figées, mais pas encore tous les octets servis par ces URLs : le stockage média privé, immuable et versionné reste nécessaire. L’historique général de toute édition, la comparaison visuelle des versions et la procédure de traitement des dossiers historiques restent à compléter.

Migration : `20260913_course_versions.sql`. Test PostgreSQL : deux publications, modification des supports/questions/paramètres, ajout d’un chapitre obligatoire, inscriptions à chaque version, reprises/tentatives indépendantes du live, clés de réponse non exposées, maintien d’un élément ensuite archivé, objectifs et immutabilité des rattachements/versions.
