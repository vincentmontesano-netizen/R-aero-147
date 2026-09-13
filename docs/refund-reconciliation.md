# Rapprochement des remboursements

Les observations signées `charge.refunded` sont enregistrées avec identifiant d’événement, charge, PaymentIntent, devise, montant initial, cumul remboursé, caractère intégral et date de l’événement. Le journal est immuable ; les notifications répétées ne créent pas de doublon.

Un remboursement partiel met à jour le cumul affiché sans marquer toute la commande remboursée ni révoquer indistinctement ses places. Un remboursement intégral place la commande en état remboursé et révoque ses licences, en conservant inscriptions, résultats et certificats existants. Une ancienne observation reçue après une plus récente ne rétablit pas les accès. La révocation des licences n’est pas effaçable.

Les observations arrivant avant le règlement Checkout sont conservées même si la commande n’a pas encore son identifiant PaymentIntent enregistré. Le règlement les rapproche sous le même verrou PaymentIntent ; s’il trouve un remboursement intégral, il ne délivre pas de places. Le montant initial et la devise doivent correspondre à la commande.

Le montant remboursé et son historique sont visibles dans les commandes du tableau de bord et de l’administration. La lecture est réservée à l’acheteur, à l’ADMIN ou au manager actif de la compagnie concernée. Les montants de l’historique sont des cumuls par observation, et non des lignes d’avoirs à additionner.

## Validation

Tests PostgreSQL : partiel puis intégral, notifications répétées/concurrentes/retardées, remboursement avant règlement, incohérence de montant/devise, historique immuable et privé, licences non réactivables. Les migrations de test sont désormais exécutées une fois avant les workers, avec le journal de checksums. Les anciennes migrations exécutées dans les suites en parallèle provoquaient des attentes de verrous de schéma pendant les transactions applicatives ; ce chemin a été supprimé.

## Suite financière

Ce traitement rapproche les observations de charge ; il ne remplace pas le suivi individuel des remboursements `refund.created`, `refund.updated` et `refund.failed`, les avoirs ou les contestations. La sélection de places à retirer pour un remboursement partiel reste une décision à implémenter dans un parcours explicite ; aucune place arbitraire n’est choisie. La reprise d’accès après remboursement échoué exige un rapprochement audité, pas une suppression de preuve. Les anciennes commandes marquées intégralement remboursées par l’ancien code ne sont pas rétablies sans revue. Aucun remboursement bancaire n’a été émis par ces tests.

Migration : `20260913_refund_observations.sql`. Sources officielles : [Stripe — Refunds](https://docs.stripe.com/refunds), [Stripe — Charge.refunded](https://docs.stripe.com/api/charges/object?api-version=2024-06-20). Stripe précise que l’événement concerne aussi les remboursements partiels, tandis que le booléen de charge `refunded` indique un remboursement intégral.
