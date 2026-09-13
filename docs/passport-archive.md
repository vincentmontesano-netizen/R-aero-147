# Coffre documentaire : archivage et traçabilité

Les documents déposés dans le passeport ne sont plus supprimés physiquement. L’action « Archiver » les retire du dossier actif et du partage compagnie, tout en les conservant en lecture seule dans l’onglet Archives du propriétaire. L’administrateur conserve son accès documentaire existant. Un ancien lien de manager est refusé après archivage ; le partage exige toujours le consentement, les affiliations actives et désormais une compagnie active.

Les données d’un document sont immuables après dépôt. Pour corriger ou renouveler une pièce, l’utilisateur dépose un nouveau document et archive l’ancien. L’archivage est définitif pour cette ligne : pas de remise en circulation silencieuse d’une preuve retirée. La base interdit DELETE/TRUNCATE des documents, modification de leur contenu, désarchivage, modification ou suppression des événements. Deux demandes d’archivage simultanées produisent un seul événement.

Les dépôts acceptent PDF, PNG et JPEG, jusqu’à 10 Mio. Le serveur vérifie l’encodage Base64, la taille décodée, la signature de format et la cohérence des dates. Il calcule une empreinte SHA-256 sur les octets déposés. Le nom stocké prend une extension issue du format validé. Les fichiers sont écrits en création exclusive : une collision de nom échoue sans écraser un fichier existant.

`passport_events` journalise le dépôt (titre, empreinte, taille), l’archivage (document, date, empreinte) et les changements de partage (avant/après), avec propriétaire, acteur et horodatage. Les écritures métier et leur événement sont transactionnels. Les activations de partage répétées sans changement ne multiplient pas les événements. Le propriétaire dispose des 100 dernières actions dans ses Archives ; les routes d’archives/historique sont strictement personnelles.

La route historique `deleteDocument` est conservée pour compatibilité, avec sémantique d’archivage. Le dossier compagnie utilise uniquement la liste active. Les documents existants n’obtiennent pas de fausse empreinte rétrospective : SHA-256 reste nul tant qu’aucune procédure contrôlée de vérification des anciens fichiers n’est exécutée.

## Vérification et limites

Tests PostgreSQL : conservation, concurrence, propriétaire étranger refusé, retrait des liens managers, compagnie suspendue refusée, contenus et événements immuables, consentement sans doublons. Tests de validation des fichiers et test réel sur disque d’une collision de clé de stockage, démontrant la conservation des octets initiaux. Les tests de dépôt utilisent un stockage simulé et aucune pièce personnelle réelle.

La signature de format n’est pas une analyse antivirus ni une preuve d’authenticité du justificatif. Restent notamment analyse de contenu/quarantaine, preuve de consultation, remplacement explicitement lié, contrôles métier d’authenticité, export personnel intégrant tout le coffre, pagination de l’historique et gestion des fichiers orphelins en cas d’échec d’insertion. La politique de conservation par catégorie, les purges autorisées et la pseudonymisation doivent être définies et implémentées avant exploitation avec des données réelles ; cet archivage ne prétend pas fixer à lui seul les durées réglementaires ou RGPD.
