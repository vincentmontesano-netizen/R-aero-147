# Paiements vérifiés

Les chemins panier, devis et abonnement ne simulent plus de paiement quand Stripe n’est pas configuré. Ils échouent avant de créer une commande ou d’activer un abonnement. Les anciens enregistrements de démonstration restent à auditer ; ils ne sont pas transformés rétroactivement en règlements réels.

## Paiement ponctuel

Le retour navigateur et les événements signés `checkout.session.completed` / `checkout.session.async_payment_succeeded` utilisent la même fonction de règlement. Elle exige : mode paiement, `payment_status = paid`, session enregistrée sur la commande, propriétaire/client de référence cohérents, montant exact et devise EUR. Un statut Checkout « complete » sans paiement reste en attente.

L’enregistrement du règlement et de l’accès se fait dans une transaction, avec verrou sur la commande et marqueur `fulfilledAt`. Les répétitions et appels concurrents ne créent pas de doubles inscriptions. Un événement tardif ne remet pas une commande annulée ou remboursée en état payé.

La ligne de commande conserve l’identifiant de version achetée. L’inscription issue du paiement reçoit cette version, même si la formation a depuis été republiée ou archivée. Le trigger exige une commande payée appartenant au candidat avant ce rattachement.

Les webhooks exigent une configuration et une signature valides. Une configuration manquante ne produit plus une réponse de succès silencieuse. Les erreurs de traitement empêchent l’enregistrement de l’événement comme traité.

## Configuration et retours

`STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` proviennent de la configuration existante. `PUBLIC_APP_URL` désigne l’origine HTTPS canonique des retours de paiement/portail ; aucune origine étrangère fournie par le navigateur n’est acceptée. En développement seulement, une origine HTTP loopback est autorisée sans cette variable. Les identifiants de prix d’abonnement restent configurés par `STRIPE_PRICE_*`.

Le lancement d’abonnement et du portail, ainsi que la confirmation d’abonnement, exigent une affiliation manager active. La page compagnie n’affiche plus un succès d’activation sur la seule présence d’un paramètre URL.

## Validation et limites restantes

Les tests utilisent PostgreSQL jetable et le générateur de signatures du SDK Stripe, sans appel à un compte Stripe ni débit. Ils couvrent données incohérentes, session non payée, concurrence, répétition, signature invalide, paiement différé, version achetée et absence de simulation sans configuration.

Il reste à développer : création transactionnelle/reprise de checkout, rapprochement des abonnements hors ordre chronologique, quotas, révocation adaptée aux remboursements, persistance des factures Stripe et numérotation fiscale, suivi des paiements abandonnés et envoi durable des confirmations. Les achats compagnie acceptent maintenant plusieurs places et alimentent un registre de licences attribuables ; voir `training-licenses.md`. Les achats individuels restent limités à une place par ligne. Les codes promotionnels du panier sont temporairement désactivés tant que les remises ne sont pas rapprochées au total enregistré.

La délivrance d’accès ne vide plus tout le panier ni n’envoie de courriel dans la transaction ; une file durable de notifications et le retrait ciblé des lignes achetées restent à ajouter. Les commandes historiques sans version de ligne exigent une revue, pas une attribution arbitraire de la version courante. Ces changements ne prouvent pas encore le cycle financier complet opérationnel.

Sources officielles consultées : [Stripe — Fulfill orders](https://docs.stripe.com/checkout/fulfillment), [Stripe — Verify webhook signatures](https://docs.stripe.com/webhooks/handling-payment-events?lang=node). Migration : `20260913_payment_fulfillment.sql`.
