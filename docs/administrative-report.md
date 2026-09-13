# Suivi administratif des formations et certificats

Le lot 106 distingue l’état pédagogique de l’inscription, sa fin d’accès et l’état du certificat. Un dossier terminé ne rend pas automatiquement son certificat valide. Le tableau et le CSV indiquent valid / expired / revoked / missing / review, avec libellés FR/EN/AR.

L’échéance du certificat est une donnée séparée de la fin d’accès à la formation. Les numéros des certificats expirés ou révoqués restent présents pour lecture historique, accompagnés de leur état explicite. Seul un certificat valide conserve l’affichage vert.

Pour une inscription, un certificat unique doit correspondre au même titulaire et à la même formation. Un rattachement incohérent ou plusieurs certificats liés sont signalés « rattachement à vérifier » ; aucun numéro, titulaire ou échéance ambigu n’est sélectionné. Le rapport garde une seule ligne par inscription.

Lorsqu’une archive de certificat existe, son titre de formation et son titulaire sont repris. Le nom et l’email du compte actuel restent distincts du titulaire de certificat. Pour un certificat ancien sans archive, les libellés restent issus des données actuelles : aucun instantané historique n’est inventé.

La lecture utilise une requête avec jointures et regroupe les éventuels certificats multiples, au lieu de trois requêtes supplémentaires par inscription. La route reste réservée aux administrateurs et sa lecture reste journalisée. Le rapport est encore chargé dans son ensemble : pagination et limites de volume restent à améliorer. Il décrit des données de suivi et ne constitue pas une détermination réglementaire automatique.

Validation : 285 tests réussis (209 PostgreSQL), TypeScript/build réussis. Nouveau scénario SQL : six situations de certificat, fin d’accès expirée distincte de validité, numéros historiques conservés, liens étrangers/multiples signalés sans révéler de certificat étranger, lecture non-admin refusée. Test d’archive renforcé après renommage du compte et de la formation. Pas de recette navigateur ni de nouvelle recette Docker ; dernière recette complète au lot 103.

## Pagination et export complet — lot 107

La route renvoie maintenant `{entries,nextCursor}` et accepte un curseur d’identifiant d’inscription. Chaque page contient au plus 50 inscriptions, triées par identifiant décroissant. Les identifiants sont sélectionnés avant les jointures de certificats : les certificats multiples ne découpent pas une inscription entre deux pages. Le curseur suivant est strictement inférieur au précédent ; les nouvelles inscriptions portant un identifiant plus élevé ne s’insèrent pas dans un parcours déjà commencé.

Le tableau charge une première page et propose « afficher la suite », avec chargement et reprise sur erreur. Le CSV utilise un parcours complet indépendant des pages affichées. Il ne crée le fichier qu’après réception de la page terminale ; une erreur de page ou un curseur qui n’avance pas interrompt l’export. Le bouton indique sa préparation et empêche une seconde demande simultanée depuis l’interface.

Ce parcours stabilise les identifiants traversés mais n’est pas un instantané transactionnel de l’ensemble du rapport : une révocation ou modification d’un enregistrement entre deux pages peut être reflétée dans les données lues plus tard. Le CSV complet reste assemblé en mémoire côté navigateur ; un traitement de gros volumes en arrière-plan reste à envisager.

Validation finale : 288 tests réussis (210 PostgreSQL), TypeScript/build réussis. Nouveau scénario de pagination réelle avec plus de 50 inscriptions, exclusion d’une inscription ajoutée après la première page et absence de doublons. Deux tests d’assemblage couvrent parcours complet, échec de page et curseur bloqué. Les tests précédents de rapport et d’archive sont adaptés au contrat paginé. Construction Docker et recette avec restauration réussies ; image `sha256:3eb142aec0307a1e00aaeb613560d43eb0b426cde36be5e4e841c89c3c5293a6`. Pas de recette navigateur.
