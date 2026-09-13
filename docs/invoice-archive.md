# Factures archivées — lot 84

La première émission d’une commande payée conserve le PDF et un instantané immuable : identité déclarée de l’acheteur, identité configurée de l’émetteur, lignes, quantités, montants et date réelle d’émission. Les consultations suivantes rendent le même fichier après modification du catalogue ou du profil. Le titre vient de la version achetée lorsqu’elle existe ; une ancienne ligne non versionnée utilise le titre disponible lors de l’émission.

Les prix sont ceux enregistrés dans la commande. Les sommes HT/TTC des lignes, quantités comprises, doivent correspondre aux totaux de commande. Le compteur annuel transactionnel attribue `RA-AAAA-NNNNNN`. Le verrou de commande sérialise les demandes concurrentes. L’archive SQL interdit modification, suppression et TRUNCATE ; sa clé privée, sa taille et son SHA-256 permettent de refuser un fichier altéré lors de la lecture. Les droits restent liés au propriétaire de l’archive, indépendamment du lien modifiable de commande.

## Configuration

`INVOICE_ISSUER_JSON` est transmis par les deux fichiers Compose et reste vide dans l’exemple de production. Fournir un objet JSON à partir des informations réelles de l’émetteur :

| Champ | Contenu |
| --- | --- |
| `name` | Dénomination, 2 à 255 caractères |
| `address` | Adresse complète, 5 à 1000 caractères |
| `country` | Code pays de deux lettres majuscules |
| `registration` | Immatriculation applicable, maximum 128 caractères |
| `taxId` | Identification fiscale applicable, maximum 128 caractères |
| `email` | Adresse de contact valide |
| `legalDetails` | Mentions juridiques réelles, 5 à 1000 caractères |
| `paymentTerms` | Conditions applicables, 5 à 1000 caractères |
| `taxStatement` | Mention fiscale applicable, 2 à 500 caractères |

Le schéma vérifie la structure, pas l’authenticité ni la suffisance juridique des mentions. Les identifiants d’immatriculation et fiscaux peuvent être vides : leur caractère obligatoire selon le cas doit être vérifié avant exploitation. Aucun identifiant ou agrément fictif n’est ajouté par le générateur. Une configuration absente ou invalide bloque une nouvelle émission sans empêcher la lecture d’une archive existante.

Le tableau de bord recueille nom, adresse, pays et identifiants facultatifs avant première émission. Le formulaire FR/EN/AR annonce leur conservation sur le document. Ces coordonnées déclaratives ne constituent pas une validation KYC/KYB.

## Vérification

253 tests réussis, dont 188 PostgreSQL ; TypeScript et build réussis. Deux nouveaux scénarios SQL couvrent émission concurrente unique, conservation après changement de profil/catalogue/configuration, intégrité, droits persistants, immutabilité, coordonnées manquantes, commande étrangère et totaux incohérents. Le stockage est simulé dans ces tests SQL.

Un spécimen synthétique de 60 lignes longues a été rendu par PDFKit puis Poppler : six pages inspectées visuellement, 60 lignes, total et pagination vérifiés par extraction. Le tableau répète ses en-têtes, affiche les montants multipliés par la quantité et conserve la dernière ligne avec les totaux. Aucun document commercial réel n’a été émis.

Compose, construction Docker et recette installation, panne/reprise PostgreSQL, redémarrage, sauvegarde froide et restauration réussis. Image validée : `sha256:865dcd726178e10ad4ab2d97a99d18588de40575d5dd2135bfd58816339baf07`. Aucun déploiement.

## Limites et suites

- Fichiers historiques conservés sans remplacement ni empreinte rétrospective inventée. Un numéro historique sans document demande un rapprochement.
- Une panne après écriture du fichier et avant commit SQL peut laisser un fichier orphelin ; sa clé UUID empêche sa réutilisation. Le stockage n’est pas un archivage légal certifié.
- Le lot 85 ajoute une police embarquée couvrant les fixtures latines et arabes. Le lot 87 permet de choisir les libellés FR/EN/AR ; les contenus déclarés restent dans leur langue d’origine. La couverture d’autres écritures reste à réaliser.
- Première émission réservée aux commandes payées ; archive existante conservée après remboursement. Avoirs, corrections comptables, dates de prestation/échéance structurées et règles fiscales restent à réaliser.
- Ni Factur-X ni raccordement à une plateforme de facturation électronique. Un PDF et des mentions configurables ne démontrent pas une conformité fiscale.

Références officielles consultées le 13 septembre 2026 pour préparer la suite : [mentions obligatoires](https://www.economie.gouv.fr/entreprises/gerer-son-entreprise-au-quotidien/gerer-sa-comptabilite-et-ses-demarches/mentions-obligatoires-dune-facture-tout-savoir), [facturation entre professionnels](https://www.service-public.gouv.fr/entreprendre/vosdroits/F31808), [facturation électronique](https://www.economie.gouv.fr/tout-savoir-sur-la-facturation-electronique-pour-les-entreprises). L’identité réelle, la juridiction et le régime applicables restent à confirmer avant mise en service.

## Texte arabe et latin — lot 85

Noto Sans Arabic est livrée avec sa licence SIL OFL dans `assets/fonts`, puis incorporée au PDF. Aucun téléchargement de police lors de l’émission. Sa provenance et son empreinte sont consignées dans le README adjacent.

Le rendu calcule les directions Unicode par paragraphe, coupe les lignes à la largeur disponible puis ordonne les segments visuels. Les segments arabes restent en ordre logique pour la liaison des lettres par Fontkit ; les nombres et références latines gardent leur ordre propre. Les parenthèses sont reflétées individuellement. Le cache de mise en forme par mot de PDFKit est évité avec `features: []`, pour traiter chaque segment entier. Les références sans espace sont coupées aux limites des graphèmes.

255 tests réussis (188 PostgreSQL), TypeScript/build réussis. Deux nouveaux tests couvrent ordre des segments mixtes, parenthèses, conservation des références et largeur des lignes avec référence longue. Spécimen FR/AR sur une page et facture de 60 lignes sur sept pages rendus et inspectés intégralement ; extraction de toutes les lignes et des totaux vérifiée. La nouvelle police modifie la pagination des nouvelles émissions seulement ; les archives existantes restent identiques.

Cette vérification ne couvre pas tous les caractères Unicode ni tous les signes diacritiques. La pagination des blocs hauts est complétée au lot 86 ci-dessous. Ni conformité PDF/A ni accessibilité PDF/UA revendiquées.

Construction et recette Docker complète avec restauration réussies pour l’image `sha256:6d0499952f538f0493aed3fabc67424c623fa6a34cb4ea476eb2b91d0197f2dc`. Un contrôle supplémentaire exécute le rendu mixte arabe/latin sous UID 1000, réseau désactivé : police accessible et PDF produit. Aucun déploiement.

## Blocs dépassant une page — lot 86

Les paragraphes et cellules sont maintenant dessinables par tranches de lignes. Une adresse, mention ou description plus haute qu’une page continue sur la suivante en respectant la zone de contenu. Les cellules numériques ne sont pas répétées après leur dernière ligne ; l’en-tête indique « Prestation (suite) » lorsqu’une même ligne de commande continue. Les blocs ordinaires gardent leur comportement de regroupement.

256 tests réussis (188 PostgreSQL), TypeScript/build réussis. Le nouveau test utilise le vrai moteur PDF et observe ses positions de texte : 70 lignes d’adresse et 70 lignes de description apparaissent chacune une fois, les montants de ligne ne sont pas dupliqués, les positions restent dans la zone autorisée et les continuations sont indiquées. Le spécimen correspondant a été rendu sur quatre pages, inspecté intégralement, puis vérifié par extraction (140 repères, total et pagination). Le spécimen mixte FR/AR a également été régénéré et inspecté sur une page. Pas de changement de dépendance ou de migration ; dernière recette Docker complète au lot 85.

## Choix de langue du document — lot 87

Le formulaire propose Français, English et العربية, avec la langue d’interface comme défaut initial. Il explique que coordonnées, descriptions et mentions ne sont pas traduites automatiquement. La route valide FR/EN/AR ; la première émission conserve cette langue dans l’instantané JSON. Une demande ultérieure avec une autre langue rend toujours le fichier initial. Les anciens instantanés sans langue gardent le défaut français ; aucun PDF historique n’est réécrit.

Titre, dates, destinataire, colonnes, continuations, TVA et totaux utilisent les libellés choisis. Les en-têtes du tableau adaptent leur hauteur au texte. En arabe, les dates ISO, montants EUR et taux sont isolés pour conserver leur ordre ; les contrôles bidirectionnels servent à la mise en forme puis sont retirés des segments dessinés pour éviter des glyphes manquants. Les dates d’émission et de commande occupent des lignes distinctes dans ce cas.

259 tests réussis (188 PostgreSQL), TypeScript/build réussis. Trois nouveaux tests exécutent le rendu de chaque langue et vérifient la conservation du contenu original. Le test SQL existant vérifie désormais la langue arabe archivée et l’absence de réémission après demande anglaise. Le test bidirectionnel couvre une date ISO isolée sans caractères de contrôle dessinés. Spécimens français et anglais d’une page et arabe de deux pages inspectés intégralement. Recette navigateur non réalisée ; aucune nouvelle migration ni dépendance, dernière recette Docker complète au lot 85.
