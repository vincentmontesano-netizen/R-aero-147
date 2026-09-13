# Facturation de plusieurs compagnies

`/abonnements`, accessible depuis le menu du compte aux managers et ADMIN, permet de sélectionner explicitement une compagnie. Les managers voient les organisations actives liées par une affiliation MANAGER active, indépendamment du champ historique `user.companyId` et du rôle global du compte. Les ADMIN voient les compagnies actives.

Le routeur `billing` vérifie cette autorisation en base pour chaque lecture, création Checkout, portail et rapprochement. Les vues ne renvoient pas les identifiants Stripe. L’ancienne lecture `company.subscription` exige désormais également le management de la compagnie principale : un simple membre ne reçoit plus la vue de facturation.

La page affiche statut, échéance vérifiée, effectif/places, alerte de capacité et actions. Le portail et Checkout reviennent sur l’organisation choisie. Au retour, une action d’actualisation relit le statut ; l’URL seule n’est jamais une preuve de paiement. Les tarifs/taxes/périodicité restent présentés dans Stripe avant confirmation. Un abonnement déjà rattaché interdit de démarrer un second Checkout, même résilié : un remplacement doit passer par une procédure contrôlée encore à construire.

## Validation

Tests routeur PostgreSQL : deux organisations gérées par un même utilisateur au rôle global ordinaire, sélection de la seconde, minimisation, refus membre/rôle historique seul/compagnie étrangère, révocation immédiate. Fournisseur simulé, aucune création de session réelle. Test du service Stripe sur les URL de retour et le refus de Checkout lorsque déjà rattaché.

## Travail restant

Les tentatives Checkout sans abonnement encore rattaché ne sont pas encore persistées/idempotentes ; une première confirmation sans webhook et sans identifiant d’abonnement reste `requires_review`. Restent journal de rapprochement, remplacement contrôlé, portail configuré/testé, états traduits plus détaillés et recette visuelle. Le reste de l’ancien espace compagnie emploie encore la compagnie principale ; ce lot ne prétend pas avoir migré toutes les fonctions B2B. Aucune publication ni configuration Stripe de production effectuée.

## Souscription durable — complément

La migration `20260913_subscription_checkout.sql` enregistre la tentative avant le premier appel Stripe : compagnie, demandeur si fourni, formule, quantité, requête exacte, clé d’idempotence et limite de reprise. Ces éléments sont immuables ; identifiant de session fixé une seule fois, statut terminal conservé et aucune suppression possible.

La création est sérialisée par compagnie. Une tentative non expirée est reprise au lieu d’en créer une nouvelle ; changer de formule exige d’abord de résoudre la précédente. La quantité et le tarif de la tentative restent figés même si l’effectif ou les réglages évoluent ensuite. L’écran affiche cette tentative et permet de reprendre ou vérifier le paiement. Le serveur n’ouvre pas une nouvelle session lorsqu’un autre abonnement est déjà rattaché entre-temps.

Une réponse perdue se reprend avec la même requête et clé pendant trois heures ; l’expiration demandée de la session est de quatre heures. Après la fenêtre de reprise, une tentative sans identifiant Stripe exige un rapprochement manuel. La session connue est relue, et seule son expiration vérifiée autorise une nouvelle tentative. La durée conservatrice de reprise reste inférieure au délai après lequel Stripe peut supprimer une clé : [idempotence Stripe](https://docs.stripe.com/api/idempotent_requests), consulté le 13 septembre 2026.

Une session terminée déclenche le rapprochement de l’abonnement courant, sans déduire le paiement de l’URL de retour. Si cette lecture échoue, la tentative terminée reste disponible pour une nouvelle vérification. La confirmation navigateur peut maintenant retrouver la première session connue, même avant réception du webhook. Un état `incomplete` ne donne pas d’accès actif.

Quatre tests PostgreSQL dédiés vérifient concurrence, réponse perdue, paramètres exacts, immutabilité, changement de formule, expiration vérifiée, références étrangères, reprise après erreur de lecture et refus hors fenêtre. SDK simulé uniquement.

Ces changements remplacent les limites précédentes concernant la persistance et la reprise d’une session connue. Restent expiration volontaire d’une session encore ouverte, rapprochement d’une tentative sans identifiant hors fenêtre, journal des observations fournisseur, remplacement contrôlé d’abonnement, configuration du portail et recette Stripe/visuelle.

## Fermer une session en attente

L’action « Fermer la session », après confirmation, expire uniquement une session Checkout connue et ouverte. Elle ne résilie pas un abonnement et ne demande aucun remboursement. L’autorisation manager/ADMIN est revalidée sur la compagnie. Aucune nouvelle session n’est créée pour cette action ; une tentative sans identifiant reste à rapprocher.

Le serveur vérifie la référence avant l’appel d’expiration, puis la réponse. En cas d’erreur, il relit la même session : si elle est encore ouverte, aucune fermeture n’est enregistrée ; si elle est terminée, l’abonnement est rapproché au lieu d’afficher une annulation. L’état local et une trace immuable du demandeur/résultat sont enregistrés ensemble. Les demandes concurrentes ne multiplient pas l’action sur une session déjà expirée.

Migration `20260913_subscription_checkout_closure.sql`, deux nouveaux tests PostgreSQL (concurrence/trace et course avec paiement/échec fournisseur), refus d’accès ajouté aux tests routeur. Les appels Stripe sont simulés. Référence : [expiration d’une session Checkout](https://docs.stripe.com/api/checkout/sessions/expire), consultée le 13 septembre 2026. Le fournisseur accepte l’expiration d’une session ouverte et refuse les états non expirables.
