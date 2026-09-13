# Tableau de bord apprenant

Le lot 125 distingue les échecs de lecture des listes vides dans les formations, certificats et commandes. Chaque section en erreur propose de relancer sa propre requête ; le bouton est désactivé pendant le chargement. Une erreur de rafraîchissement masque la liste concernée afin de ne pas présenter comme actuelles des données non confirmées. Les filtres locaux restent conservés.

Les requêtes de ces trois sections et des affiliations ne sont activées qu’après authentification. Les affiliations disposent également d’une erreur et d’une reprise. Les statistiques de formations et certificats affichent un tiret quand les données manquent ou que la requête est en erreur. Les commandes ont un état de chargement explicite avant de conclure à une absence de commande.

Les certificats montrent l’état valide/expiré/révoqué, avec texte FR/EN/AR et couleur. Ils utilisent la fonction commune certificateStatus, qui donne priorité à la révocation ; les contrôles et archives serveur ne changent pas. Les documents expirés ou révoqués restent consultables et vérifiables. L’expiration affichée dépend de l’heure du navigateur au rendu ; la vérification publique et les règles serveur restent les références. Le nombre de certificats du tableau de bord compte les documents enregistrés, pas uniquement ceux encore valides.

Les dates du tableau de bord suivent la langue de l’interface. Les cartes de certificats autorisent le retour à la ligne de leurs actions.

Validation : 304 tests réussis, dont les tests existants de statut des certificats ; TypeScript/build réussis. Pas de recette navigateur/lecteur d’écran ou simulation des erreurs de chargement dans le DOM. Pas de migration ou changement de règle métier.

## Lecture groupée des certificats (lot 126)

Le service getUserCertificates utilise une seule requête avec jointures au lieu d’une lecture initiale puis de plusieurs lectures par certificat. Les jointures récupèrent le certificat, le fragment training de son archive, celui de la version inscrite et la formation actuelle. Les questions, corrigés et autres parties du snapshot de version ne sont pas sélectionnés.

La priorité reste : formation conservée dans l’archive du certificat, puis formation de la version inscrite, puis formation actuelle pour un ancien parcours non versionné. Une version inscrite absente sans archive conserve l’erreur explicite de parcours indisponible. Le filtrage par titulaire reste dans SQL. L’ordre par date d’émission est complété par l’identifiant décroissant pour départager des dates identiques.

Validation : scénario PostgreSQL avec trois certificats du même titulaire et un document étranger, archive/version/ancien parcours distincts et renommage du cours actuel. Les titres et l’isolation sont conservés ; les métadonnées de jointure ne sont pas retournées. Le scénario suit le déclencheur SQL qui fixe la version lors de l’inscription. 305 tests réussis (219 PostgreSQL), TypeScript/build réussis. Aucune mesure de latence ou de charge en production ; seule la réduction des requêtes est établie par l’implémentation. Liste toujours non paginée.

## Lecture groupée des inscriptions (lot 127)

La liste des inscriptions utilise également une seule requête avec jointures. Elle sélectionne uniquement le fragment training de la version inscrite et conserve le repli sur la formation actuelle pour un parcours ancien non versionné. Une version référencée mais absente conserve l’erreur explicite ; les autres parties du snapshot, notamment les corrigés, ne sont pas sélectionnées.

Le filtrage de titulaire reste dans SQL et le tri par date est complété par l’identifiant pour départager les égalités. Le test SQL du lot 126 est enrichi pour vérifier la version inscrite après renommage, le repli ancien, l’isolation du compte et l’absence de métadonnées de jointure dans cette liste. 305 tests réussis, TypeScript/build réussis. Les listes restent non paginées et aucune mesure de latence réelle n’a été faite.
