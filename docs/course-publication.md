# Préparation des formations et édition B2B

Le studio comprend désormais l’éditeur partagé de chapitres, d’objectifs et de QCM. Les API `maker.content` exigent l’autorisation sur la formation pour chaque liste, création, mise à jour et réordonnancement. Les mises à jour suivent les schémas Zod des créations, avec champs partiels et identifiant strict. Les rattachements étrangers sont refusés. Les anciennes routes ADMIN restent présentes pour compatibilité mais l’éditeur utilise les routes cloisonnées.

Les diapositives peuvent être affectées à un chapitre depuis leur fenêtre d’édition. Les questions sans chapitre sont réservées au final. Les exercices incorporés aux diapositives sont des exercices d’apprentissage : ils ne remplacent pas une question de la banque d’examen.

## Contrôles avant publication

Pour les formations e-learning, `updateTraining` vérifie le contenu avant une publication, y compris depuis la route ADMIN. Une création ne peut pas demander une publication immédiate. Le rapport visible dans le studio, traduit en FR/EN/AR, contrôle :

- Présence de chapitres et de supports pédagogiques pour chacun.
- QCM de chaque chapitre, y compris facultatif, et banque du final distincte.
- Seuils, tentatives, durées et nombre de questions du final cohérents.
- Questions renseignées, points positifs, options et corrigés cohérents pour QCU/QCM/vrai-faux/appariement.
- Réponses libres avec mots-clés renseignés ; expressions régulières arbitraires refusées à la publication.
- Absence de questions rattachées à un chapitre étranger et de diapositives sans chapitre.

Les erreurs sont affichées avec le chapitre ou la question concernés. Le rapport se recharge après les modifications de contenu et peut être revérifié manuellement. Le serveur refait le contrôle au moment de publier ; l’interface seule n’autorise pas la publication.

## Limites à traiter dans la suite

Ce contrôle de préparation ne remplace ni la revue pédagogique ni une approbation réglementaire. Les nouvelles inscriptions à une version publiée utilisent désormais un snapshot du cursus ; voir `curriculum-versions.md`. Les dossiers historiques sans version et la revue indépendante restent à traiter.

Les actions de suppression pédagogique ont été remplacées par un archivage verrouillé, y compris les anciennes routes ADMIN et celles des diapositives ; voir `content-archive.md`. La génération IA crée actuellement des diapositives à structurer en chapitres avant publication.

Validation : tests PostgreSQL du parcours compagnie, refus des accès étrangers et des rattachements croisés, publication prématurée refusée via studio et service commun, publication d’un contenu préparé et identification des corrigés invalides.

La publication e-learning est désormais également soumise à une approbation correspondant à la copie courante : voir [Revue pédagogique](pedagogical-review.md). La préparation technique seule et le statut éditorial historique ne suffisent plus.
