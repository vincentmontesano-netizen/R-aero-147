# Licences de formation achetées

Le paiement confirmé crée une ligne par place achetée, avec commande, ligne, rang de place, version de formation, acheteur et organisation propriétaire. L’unicité ligne/rang et le verrou de règlement empêchent les doublons. Les origines et attributions réalisées sont immuables ; DELETE/TRUNCATE est refusé.

Un achat individuel d’une place donne automatiquement une inscription à l’acheteur. Un achat compagnie alimente son stock de places disponibles, sans inscrire automatiquement le payeur. Le panier propose l’achat pour soi ou pour une organisation dont on est manager. Le devis ADMIN permet également une organisation explicite, sous réserve que le compte acheteur puisse la gérer. Les quantités entreprise de 1 à 100 par ligne sont désormais acceptées.

## Attribution

La page `/licences`, accessible au menu utilisateur, affiche les places, leur version et leur état. Le manager choisit un compte affilié actif de la compagnie. L’API revérifie le règlement, la compagnie, l’acteur et le bénéficiaire dans une transaction. Les attributions concurrentes d’une même place au même bénéficiaire renvoient la même inscription ; une attribution à une autre personne est refusée.

Un apprenant ayant déjà un accès actif à la formation ne consomme pas une nouvelle place. Les licences individuelles restent attribuées à leur propriétaire. Un acheteur révoqué de sa fonction manager ne garde pas de privilège sur les places appartenant à sa compagnie.

L’inscription conserve la version effectivement achetée, même si la formation est republiée ou archivée. Elle référence sa licence et l’organisation d’attribution. Une commande non payée/remboursée ou une licence révoquée bloque les nouvelles lectures pédagogiques associées, sans supprimer résultats ou certificats.

## Limites et suite

La liste est actuellement limitée aux 1 000 dernières places accessibles ; pagination, filtres et exports restent à développer pour les volumes importants. L’attribution se fait place par place ; import et attribution groupée restent à compléter. Les anciens règlements marqués déjà exécutés ne sont pas réinterprétés automatiquement comme un stock de licences.

Les remboursements partiels, contestations, avoirs, facture et cycle abonnement doivent encore être rapprochés précisément. Le rapprochement de charge distingue désormais remboursement intégral et partiel, avec historique ; voir `refund-reconciliation.md`. Le suivi individuel et les avoirs restent à compléter. La création/reprise de checkout, les notifications durables et les tests Stripe sur compte de test restent nécessaires. Aucun transfert de licence déjà consommée n’est proposé ; un nouveau bénéficiaire exige une autre place.

Migration : `20260913_training_licenses.sql`. Tests PostgreSQL : trois places payées, notification concurrente, liste/candidats cloisonnés, version achetée, attribution concurrente/idempotente, refus d’utilisateur étranger et de seconde place inutile, immutabilité, révocation de manager et commande remboursée.
