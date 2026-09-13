# Création et reprise du paiement panier

Le panier crée désormais la commande, toutes ses lignes et la requête Stripe figée dans une transaction PostgreSQL. Les formations sont relues et verrouillées en lecture : un prix ou une version changé depuis la lecture du panier impose son actualisation. Une ligne indisponible annule toute la création. Les calculs utilisent des centimes entiers et contrôlent les plafonds de montant.

Un verrou par acheteur et une empreinte du contenu, des prix, des quantités et de la compagnie réutilisent la commande identique encore en attente. Les paramètres Stripe et une clé aléatoire sont conservés dans `checkout_attempts`, avec interdiction de modification/suppression. Aucun appel réseau n'est effectué sous transaction PostgreSQL.

Une réponse réseau perdue peut être retentée avec exactement la même clé et le même corps. Après enregistrement de l'identifiant Stripe, la reprise récupère la session existante. Le bouton du tableau de bord est réservé à l'acheteur, avec nouvelle vérification de son autorisation compagnie. Une session terminée passe par le rapprochement du paiement existant ; une session expirée confirmée par Stripe annule la commande en attente et permet un nouvel achat depuis le panier.

La session demandée expire après quatre heures. La création d'une session sans identifiant local est retentable pendant trois heures seulement : au-delà, elle nécessite un rapprochement par le support. Ce choix conservateur évite de recréer aveuglément une session si Stripe a déjà traité une requête dont la réponse a été perdue. Le rapprochement ADMIN par identifiant de session est disponible ; voir [le parcours de rapprochement](payment-reconciliation.md). Les sessions anciennes disposant déjà d'un identifiant Stripe peuvent être reprises.

Référence : [requêtes idempotentes Stripe](https://docs.stripe.com/api/idempotent_requests) ; les clés peuvent être supprimées après au moins 24 heures, d'où l'absence de réutilisation illimitée d'une clé locale.

## Validation et limites

Tests PostgreSQL : demandes concurrentes, annulation atomique du panier invalide, prix obsolètes, requête immuable, réponse Stripe perdue, clé/corps inchangés, lecture de la session déjà créée, confidentialité acheteur, arrêt des reprises trop anciennes, expiration vérifiée et nouvelle commande. Le SDK Stripe est remplacé par un adaptateur simulé dans ces tests : aucun débit ou appel réseau Stripe.

La conversion de devis utilise le même chemin transactionnel et la même reprise Stripe. Les reprises d'abonnements, l'annulation explicite d'une session ouverte, les modifications de panier laissant une autre commande en attente, le nettoyage ciblé du panier et la recherche automatique des requêtes non rapprochées restent à traiter. La facturation fiscale et le calcul de TVA restent un chantier distinct ; les nouvelles commandes panier n'inventent plus de numéro de facture aléatoire avant paiement, et affichent leur identifiant de commande.

## Devis négociés

La conversion ADMIN verrouille le devis, vérifie le compte acheteur actif (identifiant déjà lié, ou correspondance de l’adresse du contact), la compagnie éventuelle et les conditions négociées. Les prix doivent être des montants exacts en centimes ; aucune troisième décimale n’est arrondie silencieusement. Les formations et quantités doivent être achetables, avec une seule ligne par formation.

Une commande en attente pour ce devis est réutilisée seulement si les conditions sont identiques. Une modification est refusée tant que la session précédente n’est pas rapprochée ou expirée. Une version publiée ultérieurement ne remplace pas la version de la commande existante. Un devis réglé ou remboursé ne peut produire une nouvelle commande : un nouvel achat nécessite un nouveau devis.

La commande, ses lignes, sa requête Stripe, le rattachement du devis au compte et un message de préparation sont enregistrés ensemble. Le message est créé une seule fois et renvoie au tableau de bord ; les nouvelles tentatives ne publient plus de liens Stripe périssables en double. « Mes devis » propose l’accès à la reprise du paiement pour les devis acceptés. Aucun email automatique n’est ajouté par cette conversion.

Les devis historiques ayant déjà une commande en attente sans requête figée nécessitent un rapprochement avant reconversion. Le bouton de reprise du tableau de bord peut récupérer leur session si son identifiant Stripe est présent. Le rapprochement ADMIN par identifiant de session est disponible. La modification/expiration opérateur reste à réaliser.
