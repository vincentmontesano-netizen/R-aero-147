# Validation avant publication

`.github/workflows/ci.yml` exécute la validation sur pull request, manuellement ou comme workflow réutilisable. Il démarre un PostgreSQL 16 vide, installe le verrou pnpm avec Node 20, vérifie TypeScript, lance toute la suite Vitest, les tests Python de frontière des archives et la syntaxe Bash/Compose, puis construit et teste l’image intégrée.

`.github/workflows/docker-publish.yml` dépend de ce workflow. Le job de publication construit ensuite son candidat linux/amd64, le charge localement et exécute la recette sur son identifiant d’image exact avant tout docker push. Le workflow ne publie plus de tag latest implicite : le tag contient le SHA complet du commit. Le digest de registre est reporté dans le résumé du job pour configurer RAERO_IMAGE. Les tags de commit restent des noms de registre ; utiliser le digest pour identifier exactement une publication.

Le workflow de validation n’a que contents:read et ne reçoit pas de secrets fournisseur. Seul le job de publication dispose de packages:write. Les identifiants administrateur de recette sont aléatoires et temporaires. Les conteneurs applicatifs utilisent `--network none` et aucun port publié ; Stripe, JaaS, IA et SMTP ne sont pas contactés par cette recette.

## Recette commune

```sh
docker build -t raero-local-validation .
bash scripts/ci-container-smoke.sh raero-local-validation
```

Le script crée ses propres volumes et vérifie : démarrage sans démonstration, connexion et cookies, droits SQL réduits, utilisateur système non privilégié, fichiers protégés, disponibilité pendant une panne PostgreSQL puis récupération, session après redémarrage. Il sauvegarde ensuite à froid, restaure dans deux nouveaux volumes et vérifie à nouveau session, données et droits SQL. Un piège de sortie arrête/supprime ses conteneurs, volumes et fichiers temporaires. Il ne doit pas être remplacé par une exécution des scripts destructifs de panne sur une instance de production.

## Preuves et limites

YAML des workflows analysé localement ; syntaxe Bash et Compose validées. Construction Docker et exécution locale complète du script commun réussies, y compris restauration et nettoyage. Les trois tests Python des archives passent. La suite applicative reste celle du lot 47 : 156 tests réussis, dont 108 PostgreSQL ; aucune logique métier n’a changé dans ce lot.

Aucun workflow GitHub distant n’a été déclenché et aucune image n’a été publiée pendant cette intervention. Le dossier de travail n’est pas actuellement un dépôt Git connecté. Le premier passage GitHub doit encore confirmer les runners linux/amd64, permissions et accès au registre. Les règles de branche exigeant la validation ne sont pas configurées par ces fichiers. Recette navigateur, fournisseurs réels, contrôle des dépendances/images et déploiement restent distincts.

Références de syntaxe : [workflows réutilisables GitHub](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows), [service PostgreSQL dans Actions](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers).
