# Sélection d'organisation dans le tableau entreprise

## Parcours utilisateur

Le tableau `/entreprise` présente les organisations actives que la personne peut gérer. Un administrateur peut choisir toute organisation active. Les autres personnes doivent avoir une affiliation MANAGER active, indépendamment de leur rôle global.

Le choix initial correspond au rattachement principal autorisé, ou à l'unique affiliation MANAGER active. Si plusieurs organisations sont disponibles sans rattachement principal, l'utilisateur doit choisir. Un `orgId` présent dans l'URL mais indisponible n'est jamais remplacé silencieusement par une autre organisation.

La sélection reste dans l'URL. Le retour arrière et le rechargement la conservent. Chaque organisation possède ses clés de cache ; un changement remonte le composant du tableau et ferme les formulaires, le dossier et les confirmations en cours. Une requête déjà envoyée conserve l'organisation choisie lors de l'envoi. Le compte utilisateur et son `companyId` historique ne sont pas modifiés.

## Contrat serveur

Les nouveaux écrans utilisent `companyWorkspace.*`, avec un `orgId` entier positif. Le serveur vérifie l'organisation active et les droits à chaque requête. La lecture `get` retourne `selectedOrgId` pour confirmer la sélection avant d'afficher les actions. Les dossiers, modifications de salariés et archives doivent appartenir à l'organisation sélectionnée, même si l'acteur est autorisé à gérer une autre organisation.

Employés, imports CSV, affiliations, récurrences, consolidation, abonnement, règles, formations sélectionnables, analyse des besoins et historique utilisent le même périmètre. Les opérations transactionnelles revérifient les droits et la destination avant écriture. Les règles globales restent consultables ; seul un administrateur peut les archiver, avec la confirmation explicite déjà prévue.

Les appels historiques `company.*` sont conservés et partagent les mêmes handlers. Sans `orgId`, ils gardent le comportement précédent : rattachement principal, affiliation unique, ou refus si la sélection est ambiguë. Les clients qui utilisent la sélection explicite doivent appeler `companyWorkspace.*`.

## Livraison et retour arrière

Aucune migration de schéma, copie de données ou modification des rattachements n'est nécessaire. Les clients anciens continuent à utiliser l'API historique sur le nouveau serveur.

La nouvelle route est volontairement distincte : un serveur ancien ne la connaît pas et refuse les requêtes. Il ne peut donc pas ignorer le `orgId` d'une mutation récente et utiliser un ancien rattachement à sa place. Après retour à une ancienne image, une page récente demande à être rechargée ; aucune action ne doit être redirigée automatiquement vers `company.*`.

Le retour arrière reste celui de l'image applicative, avec les précautions de sauvegarde habituelles. Le choix d'organisation ne requiert aucune restauration ou conversion de données.

## Preuves de recette

- `server/companyTraining.integration.test.ts` : appels historiques, double affiliation, sélection concurrente, employés, import, règles et historique, administrateur affilié ailleurs, refus des organisations étrangères et droits révoqués.
- `server/subscriptionCheckout.integration.test.ts` : les URL de retour conservent l'organisation sélectionnée ; aucun fournisseur réel n'est contacté.
- `scripts/e2e/company-scope.mjs` : sélecteur, deux sessions d'un même compte, création et import CSV dans chaque périmètre, cache après changement, retour arrière, mobile, suspension et simulation d'un ancien serveur.
- Les résultats datés et les limites de la recette complète sont conservés dans `../../QA-2026-09-29/`.
