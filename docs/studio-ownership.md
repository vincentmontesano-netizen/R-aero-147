# Espaces de création

Les formations créées dans le studio ont un auteur (`ownerUserId`) et, pour les contenus internes, une compagnie propriétaire (`ownerOrgId`). Un administrateur peut intervenir sur tous les contenus. Un instructeur peut travailler sur ses propres contenus opérateur. Le contenu d’une compagnie exige une affiliation MANAGER active et une compagnie active, même pour son créateur initial. Le rôle historique `company_manager` ne suffit plus à lui seul.

Les listes, lectures de diapositives/objectifs, créations, modifications, suppressions, réordonnancements et publications du studio appliquent ces contrôles. Une diapositive ne peut pas être transférée vers une autre formation par une modification du champ `trainingId`. Les rattachements chapitre/objectif sont vérifiés. Un réordonnancement ne peut pas mêler plusieurs formations.

Les contenus internes ne sont pas publiés au catalogue public, même lorsque leur indicateur de publication est actif. Ils sont exclus des recherches par slug, des sélections de formations publiées, du panier et des sessions publiques liées. Les brouillons opérateur ne sont plus accessibles par leur slug public.

Les formations historiques sans propriétaire restent accessibles aux ADMIN uniquement dans le studio : aucun propriétaire n’a été déduit arbitrairement. Une attribution administrative explicite reste à intégrer à l’interface.

## Travail restant

- Sélecteur d’organisation et accès interface pour les managers par affiliation sans rôle global ; l’API accepte déjà un `orgId` explicite à la création, et déduit l’organisation lorsqu’il n’y en a qu’une.
- Revue et publication versionnée. L’édition B2B des chapitres/objectifs/QCM et les contrôles de préparation sont maintenant disponibles ; voir `course-publication.md`.
- Historique général des modifications. L’archivage pédagogique et son historique immuable sont maintenant disponibles ; voir `content-archive.md`.
- Distribution des formations internes aux salariés et conservation de la version suivie.
- Médias : les fichiers historiques dans les namespaces publics restent publics par URL. La protection des API de contenu ne suffit pas à rendre confidentiel un média déjà public ; stockage privé et rattachement de chaque ressource au cours à compléter.
- Quotas et droits d’usage IA liés à l’abonnement.

Les tests PostgreSQL couvrent les accès entre auteurs/compagnies, les mutations de diapositives, la publication non autorisée, les tentatives de transfert, la révocation d’affiliation, la suspension d’organisation et l’exclusion du catalogue/panier.

## Choix d’espace dans le studio

Le studio et son entrée de menu reconnaissent les affiliations MANAGER actives, y compris pour un compte portant simplement le rôle global `user`. `maker.workspaces` fournit les compagnies actives autorisées ; ADMIN voit les compagnies actives et le catalogue opérateur, un instructeur voit son espace opérateur et les compagnies qu’il gère.

Le sélecteur « Créer une formation pour » indique la destination des créations manuelles et IA. Le nom de l’espace est rappelé dans le formulaire et chaque cours de la liste indique son organisation ou son catalogue opérateur. L’organisation sélectionnée est transmise à `maker.createCourse`, qui réévalue les droits côté serveur. Une compagnie suspendue ou inexistante est refusée même pour une création ADMIN. Si l’espace sélectionné disparaît, la création est désactivée, sans basculer silencieusement vers une autre compagnie.

Le menu connecté donne accès au studio aux instructeurs, administrateurs et managers affiliés. Les organisations inactives sont exclues de `me.organizations`, utilisé aussi pour les sélecteurs d’achat. Le retour depuis le studio respecte l’espace de l’utilisateur, et le sélecteur de langue local propose FR/EN/AR.

Test PostgreSQL : compte sans rôle historique, deux affiliations actives et une compagnie suspendue, obligation de préciser l’organisation, création correctement rattachée et révocation d’une affiliation. L’interface a été vérifiée par TypeScript et build ; contrôle visuel et parcours navigateur restent à effectuer. Les quotas IA, la revue pédagogique indépendante, les médias privés et l’administration multi-organisation des autres modules restent ouverts.
