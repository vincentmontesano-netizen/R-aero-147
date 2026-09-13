# Revue pédagogique avant publication e-learning

Le statut historique `reviewStatus` ne suffit plus à publier un parcours e-learning. Une nouvelle publication requiert une décision d’approbation rattachée à une copie dont l’empreinte correspond exactement au contenu publié.

## Parcours

1. L’auteur complète la préparation technique du cours puis demande une revue dans le studio. Le serveur conserve une copie des métadonnées, chapitres, questions, diapositives et objectifs. Une demande répétée pour le même contenu encore en attente ou déjà approuvé réutilise la copie existante.
2. Un autre administrateur, ou un autre manager actif de la compagnie du cours, examine la copie depuis sa liste de revues. Le propriétaire du cours et le demandeur ne peuvent décider de leur propre revue. L’accès au contenu reste limité au périmètre auteur courant.
3. Le réviseur approuve ou demande des corrections avec une note obligatoire. La décision et la copie sont immuables ; une décision ne peut être remplacée. Après un refus, une nouvelle revue peut être soumise, même si la clarification ne modifie pas les octets du contenu.
4. Le serveur recalcule l’empreinte avant publication e-learning. Une copie différente exige une nouvelle revue. La version publiée conserve `reviewId`, avec son auteur de publication et la copie du parcours déjà versionnée.

Le studio affiche les chapitres, supports, objectifs, politiques de quiz, diapositives et questions/corrigés de la copie, puis la conclusion du réviseur. Le traitement des médias reste soumis à leur disponibilité et à leurs droits de téléchargement. Les listes de revues à examiner sont limitées aux espaces autorisés et aux 100 demandes les plus récentes sélectionnées avant exclusion des revues personnelles.

L’empreinte canonique ignore uniquement les dates de création/mise à jour et les champs techniques de publication/version/statut/présentation en vedette. Elle conserve notamment prix, propriété, politiques d’évaluation, ordre des contenus, questions et corrigés. Les collections de documents sont normalisées par identifiant, avec leurs champs de tri conservés. Les copies historiques ne sont pas réécrites lorsqu’un auteur modifie ensuite le brouillon.

## Conservation et compatibilité

`pedagogical_reviews` et `pedagogical_decisions` interdisent UPDATE/DELETE/TRUNCATE. Les nouvelles formations ont un statut de revue par défaut `draft`. Les anciens statuts « approuvé » ne constituent pas une décision dans ce nouveau registre ; aucun historique de revue n’est inventé. Les versions déjà publiées restent disponibles aux inscrits suivant les règles de versionnement existantes, mais une prochaine publication e-learning passe par cette revue.

Les autres types de formation, notamment les simples fiches de webinaire, ne sont pas soumis à cette nouvelle porte de publication e-learning. L’ancien outil de statut éditorial peut encore modifier ses métadonnées, mais ne crée aucune approbation valable pour cette porte.

## Validation et limites

Tests PostgreSQL : demande concurrente idempotente, auto-approbation refusée, lecture hors périmètre refusée, copie et décision immuables, rattachement de publication, changement de corrigé invalidant l’approbation, refus conservé et nouvelle revue possible. Les tests existants de publication/distribution/versionnement suivent désormais le parcours réel d’approbation au lieu d’un contournement de test.

Restent la qualification formelle des réviseurs, le suivi de tous les contributeurs (l’indépendance est ici contrôlée contre propriétaire et demandeur), la révocation d’une approbation pour motif externe, les notifications durables, la pagination, les médias figés par octets et le contrôle visuel du parcours. Une revue interne n’est ni un agrément d’autorité ni une déclaration de conformité Part-147.

## Retrait d’une approbation

Un acteur disposant des droits d’auteur sur le cours peut retirer une approbation avec un motif d’au moins dix caractères. Le propriétaire peut arrêter une diffusion incorrecte, même s’il n’aurait pas le droit d’approuver sa propre copie. La copie et la décision initiale ne changent pas : `pedagogical_withdrawals` ajoute une trace immuable, une seule par revue, avec acteur, motif et date.

Le retrait prend le même verrou de cours que la publication. Il empêche l’utilisation de cette approbation pour publier un parcours e-learning. Si la version actuellement publiée dépend de cette revue, le cours est dépublié et signalé comme nécessitant une revue. Un retrait historique ne dépublie pas une version plus récente dépendant d’une autre approbation. Une nouvelle demande peut créer une nouvelle copie à examiner après retrait ; elle nécessite une nouvelle décision indépendante.

Les versions, inscriptions, résultats et décisions existants sont conservés. Le retrait ne révoque pas automatiquement les accès déjà accordés, les licences déjà achetées ni les paiements préparés sur une ancienne version. La gestion d’un rappel pédagogique auprès des apprenants concernés, les mesures correctives et les notifications restent à implémenter. L’interface explique cette portée avant confirmation.

Test PostgreSQL : acteur étranger refusé, retrait concurrent idempotent, dépublication, blocage de republication, conservation de l’approbation et de l’inscription, retrait immuable, nouvelle revue/republication et absence d’effet d’un retrait historique répété sur la nouvelle version.
