# Rapprochement des abonnements Stripe

Les événements signés identifient l’abonnement à rapprocher. Le serveur relit sa version courante auprès de Stripe, après acquisition d’un verrou PostgreSQL par compagnie. Un événement ancien ne réapplique donc pas son ancien statut. La confirmation navigateur utilise le même traitement ; une erreur fournisseur renvoie `requires_review` sans présenter l’ancien statut comme une confirmation réussie.

La formule provient exclusivement de l’unique prix récurrent EUR configuré par `STRIPE_PRICE_STANDARD_SEAT` ou `STRIPE_PRICE_ALL_INCLUSIVE`. Les identifiants identiques dans les deux variables, prix inconnus, pagination, lignes multiples, quantités invalides et quantité all-inclusive différente de 1 ne donnent aucun droit. Les variables sont lues au moment du traitement, après chargement des réglages serveur.

L’activation nécessite un abonnement `active`, une période d’article non expirée, et une dernière facture étendue `paid` rattachée au même abonnement/client en EUR. Les essais gratuits ne donnent pas de droits payants. Une facture à zéro payée reste admissible (par exemple remise complète). L’API récente place la période sur l’article et l’abonnement de facture dans `parent.subscription_details` ; l’identifiant des anciens événements de facture est également reconnu.

La compagnie indiquée dans les métadonnées de l’abonnement doit correspondre exactement ; les références client existante et fournie sont vérifiées. Un abonnement différent ne remplace jamais silencieusement celui déjà rattaché à la compagnie. Son événement est ignoré avec résultat interne `requires_review` : la procédure de remplacement/réabonnement reste à construire. Une facture indépendante ne renouvelle plus les accès. Les événements de facture payée ou en échec relisent tous deux le statut courant, sans appliquer aveuglément l’ancien état du paiement.

L’attribution automatique vérifie l’activité de la compagnie, du statut et de la période. Chaque nouvelle inscription vérifie à nouveau ces conditions sous verrou compagnie, pour éviter une attribution déclenchée avant une résiliation mais exécutée après celle-ci.

## Vérification et limites

Six tests PostgreSQL, fournisseur simulé : tarif faisant autorité, factures/statuts/périodes invalides, références étrangères, événements retardés, refus de remplacement et rapprochements concurrents. Aucun appel réseau Stripe ni paiement réel effectué.

Ce lot sécurise le rapprochement, pas le cycle commercial entier. Restent : tentatives Checkout durables/idempotentes d’abonnement, retour par identifiant de session pour une première activation sans webhook, remplacement contrôlé d’abonnement, journal de rapprochement et file d’anomalies, limites de places persistées et appliquées, facturation multi-compagnie, expiration supervisée, provenance des accès issus d’un abonnement et suspension dynamique de ces accès. Les inscriptions déjà créées ne sont pas supprimées ni automatiquement révoquées par ce lot. La suspension ne doit pas effacer les preuves pédagogiques. Les abonnements existants sans métadonnées vérifiables nécessitent un rapprochement explicite.

Références officielles consultées le 13 septembre 2026 : [événements Stripe et ordre de livraison](https://docs.stripe.com/webhooks#event-ordering), [cycle des abonnements et factures](https://docs.stripe.com/billing/subscriptions/webhooks). Le choix d’exiger une dernière facture payée est la politique commerciale conservatrice de cette application, pas une propriété implicite du statut Stripe `active`.

## Provenance et suspension des nouvelles inscriptions

Depuis la migration `20260913_subscription_enrollments.sql`, chaque inscription nouvellement attribuée par un abonnement porte un `stripeSubscriptionId` immuable, avec sa compagnie et son salarié. Les inscriptions historiques sans preuve de provenance restent sans identifiant ; aucune origine n’est déduite rétroactivement.

Les portes d’accès apprenant vérifient le même abonnement courant, son statut actif, sa période, la compagnie/affiliation active et le salarié lié toujours actif. Une résiliation, un impayé ou une période arrivée à échéance suspend donc l’accès sans modifier ni supprimer l’inscription, sa progression ou son résultat. Le renouvellement payé du même abonnement peut rétablir cet accès ; un abonnement de remplacement crée une nouvelle inscription, sans réécrire l’origine. Une inscription indépendante demeure indépendante, et la recherche d’accès à une formation essaie les autres inscriptions valides si la première est suspendue.

Deux tests PostgreSQL supplémentaires vérifient attribution concurrente idempotente, origine immuable, suspension/rétablissement, départ salarié, conservation des résultats et accès indépendant. Les limites de places restent à implémenter. Une épreuve déjà ouverte conserve son mécanisme de sauvegarde/finalisation des réponses : ce lot bloque l’accès et le démarrage via les portes apprenant, sans détruire une tentative en cours. La présentation explicite de la suspension sur le tableau de bord reste à compléter.

## Effectif et places payées

La migration `20260913_subscription_quantity.sql` ajoute la quantité vérifiée de l’article Stripe à la compagnie. Aucun chiffre n’est inventé pour les abonnements historiques ; un rapprochement Stripe doit le renseigner.

La formule Standard existante facture l’ensemble de l’effectif actif, y compris les salariés sans compte. La règle appliquée est donc collective : effectif actif inférieur ou égal aux places payées. Si cette condition n’est plus satisfaite, les nouvelles attributions et l’utilisation des inscriptions issues de cet abonnement sont suspendues. Aucun sous-ensemble arbitraire de salariés n’est choisi. Les autres sources d’accès restent indépendantes. L’augmentation de quantité vérifiée ou la réduction réelle de l’effectif actif rétablit l’éligibilité. All Inclusive reste sans limite par salarié dans cette politique commerciale.

L’interface compagnie affiche effectif/places, un message de suspension et un bouton de rapprochement. Le portail de facturation reste le point d’ajustement commercial : sa configuration Stripe doit autoriser les changements de quantité pour permettre ce parcours en production. Aucun débit automatique lors de l’ajout d’un salarié, aucune modification de tarif Stripe dans ce lot. La validation TypeScript et les tests ne remplacent pas cette configuration ni la recette visuelle et le test Stripe en environnement dédié.

Test PostgreSQL supplémentaire : dépassement, refus d’attribution, augmentation puis réduction des places, salarié désactivé, quantité historique inconnue, formule All Inclusive, contrainte SQL positive. Le test de rapprochement vérifie également la quantité provenant de Stripe. Restent gestion explicite de sièges sélectionnés si la politique commerciale évolue, notifications, audit durable des effectifs et validation de la facturation multi-compagnie.
