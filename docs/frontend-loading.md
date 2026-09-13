# Chargement des traductions

Les dictionnaires complets sont dans `client/src/locales/{en,fr,ar}.json`. Chaque fichier contient 1 651 clés, avec les replis anglais déjà présents avant extraction. Ajouter ou corriger les traductions dans ces fichiers ; `i18n.tsx` porte uniquement le fournisseur React.

Le démarrage charge le dictionnaire choisi dans `raero-lang` (français par défaut). L’arabe est désormais restauré au rechargement. Le fournisseur affiche un état de chargement jusqu’à disponibilité du dictionnaire ; en cas d’échec, une action de reprise est proposée. Une nouvelle sélection conserve les écrans montés avec leur langue actuelle jusqu’au chargement réussi. Une réponse ancienne ne remplace pas une sélection plus récente. Les préférences ne sont enregistrées qu’après succès et une indisponibilité du stockage local n’empêche pas le fonctionnement.

Les trois imports sont dynamiques et les requêtes partagent une promesse par langue. Le texte de repli d’une clé absente reste la clé. Les variables répétées sont toutes remplacées et les valeurs contenant `$&` sont traitées littéralement. Les attributs HTML `lang` et `dir` suivent le dictionnaire actif.

## Mesure locale du lot 112

Comparaison du JavaScript minifié produit par Vite, hors CSS et pages ouvertes ensuite :

| Fichiers | Octets | Gzip (octets) |
| --- | ---: | ---: |
| Ancienne entrée, trois langues incluses | 721 563 | environ 215 320 |
| Nouvelle entrée | 527 587 | 162 091 |
| Dictionnaire français | 93 389 | 26 255 |
| Dictionnaire anglais | 87 726 | 24 008 |
| Dictionnaire arabe | 90 532 | 25 523 |
| Entrée + français | 620 976 | 188 346 |

Les quatre nouveaux fichiers n’ont pas d’autres imports statiques. En français, la somme entrée + dictionnaire diminue d’environ 14 % en octets et 12,5 % compressée. Les chiffres gzip additionnent les fichiers compressés séparément ; le chiffre antérieur est arrondi par Vite. Le transfert réel dépend de la compression du serveur et du cache. Il reste une requête supplémentaire au démarrage : aucune amélioration de latence ou des Core Web Vitals n’est mesurée. L’entrée dépasse encore le seuil d’avertissement Vite de 500 kB.

Validation : comparaison exacte des 1 651 valeurs de chaque langue avec les anciens dictionnaires et leurs replis ; tests du choix de langue, du cache et des substitutions ; suite complète 297 tests, TypeScript et build réussis. Pas de recette navigateur, de mesure réseau réelle ni de test DOM des changements concurrents de langue.

## Reprise d’erreur et chargement des pages (lot 113)

La limite d’erreur globale affiche désormais une explication FR/EN/AR, une action de rechargement et un lien vers l’accueil. La langue vient de l’attribut HTML actif ; ces textes minimaux ne dépendent pas des dictionnaires distants. La trace d’erreur reste dans la console de développement, sans affichage dans la page. Le message précise que les changements non enregistrés peuvent être perdus. Aucune relance automatique d’action métier ou sauvegarde des formulaires n’est ajoutée.

Le chargement des routes utilise un texte visible traduit avec `role=status`. Le spinner est décoratif et respecte la préférence de réduction des animations. La déclaration viewport ne limite plus le niveau de zoom mobile.

TypeScript et build validés. Aucun test navigateur de coupure réseau, lecteur d’écran ou zoom réalisé ; aucune couverture globale d’accessibilité revendiquée. Cette limite React ne couvre pas les erreurs survenues avant le chargement du JavaScript initial, ni toutes les erreurs asynchrones.
