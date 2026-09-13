# Rapprochement manuel des commandes Stripe

Dans ADMIN → Commandes, « Rapprocher le paiement » récupère la session Checkout déjà liée à la commande. Si son identifiant n’a pas été enregistré après une coupure réseau, l’administrateur peut renseigner l’identifiant retrouvé dans Stripe. Le navigateur ne fournit ni état payé ni montant : le serveur les récupère auprès de Stripe.

Contrôles obligatoires : mode paiement ponctuel, identifiant de session, références commande et acheteur, devise EUR, montant exact. Une session déjà liée ne peut être remplacée. Les conflits avec une autre commande sont refusés sous verrou. Seul ADMIN peut rapprocher une commande ou consulter les 50 dernières observations.

Une session payée est récupérée avec `payment_intent.latest_charge`. La charge doit correspondre au PaymentIntent réussi et au montant. Les remboursements cumulés sont relus : un remboursement intégral empêche la délivrance de licences et révoque les licences déjà délivrées, un partiel conserve l’accès suivant la politique actuelle. Une contestation signalée par Stripe empêche une nouvelle activation par ce parcours ; son cycle complet reste à implémenter.

Une session expirée confirmée par Stripe annule uniquement une commande encore en attente. Une session ouverte ou un paiement encore non réglé n’accorde aucun accès. Un paiement confirmé utilise le vérificateur et l’attribution idempotente existants, y compris sous concurrence. Ce rapprochement ne crée aucune nouvelle session Stripe et n’initie aucun débit.

`payment_reconciliations` conserve les observations validées avec acteur, date, session, états Stripe, montant/devise et état précédent de la commande. UPDATE/DELETE/TRUNCATE interdits. Ce journal prouve l’observation, pas à lui seul la réussite de l’activation : les preuves de règlement/attribution restent `orders.fulfilledAt`, les licences et inscriptions. Si une étape ultérieure échoue, l’opération peut être relancée.

Référence : [récupération d’une session Checkout](https://docs.stripe.com/api/checkout/sessions/retrieve).

## Validation et limites

Tests PostgreSQL avec adaptateur Stripe simulé : session perdue récupérée, accès accordé une fois sous concurrence, contrôle ADMIN, références/montants/devise/mode erronés refusés, historique immuable, expiration, refus de remplacement de session, remboursement sans webhook, partiel puis intégral et contestation. Aucun appel réel Stripe, débit ou remboursement déclenché pendant le développement.

La découverte automatique des sessions, la preuve d’absence de session (nécessaire avant d’abandonner une requête inconnue), l’expiration explicite d’une session ouverte, les contestations, les remboursements échoués et la pagination au-delà des 50 observations restent à traiter. Les anciennes commandes sans version pédagogique sont refusées par le vérificateur existant ; ce module ne fabrique pas de version rétrospective. Les demandes de rapprochement qui échouent avant validation ne sont pas inscrites dans ce journal d’observations.
