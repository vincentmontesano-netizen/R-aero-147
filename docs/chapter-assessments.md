# QCM de chapitre et examen final

Chaque question appartient à un chapitre (`moduleId`) ou à l’examen final (`moduleId = null`). La banque du final ne mélange plus ces deux populations. L’éditeur de contenu permet de choisir cette affectation et de configurer le seuil, le nombre de tentatives et la durée de chaque chapitre.

Un QCM commence uniquement lorsque l’apprenant clique sur le bouton de démarrage. Le serveur impose les règles, fige les questions et le seuil, sauvegarde les réponses et reprend les sessions existantes. Les tentatives sont comptées séparément pour chaque chapitre et pour le final.

La réussite du chapitre valide sa progression ; elle n’autorise pas un certificat. Tous les chapitres obligatoires doivent avoir un résultat réussi avant le démarrage du final. Le serveur consulte les résultats, indépendamment du pourcentage affiché ou des anciennes marques de complétion. Les chapitres facultatifs ne bloquent pas le final. Seule une réussite du final autorise la complétion de formation et la demande de certificat.

## Reprise des formations existantes

Les anciennes questions sans chapitre deviennent des questions du final. Aucun QCM de chapitre ni aucune réussite n’est inventé : un chapitre sans question indique à l’apprenant de contacter l’équipe pédagogique. Les auteurs doivent affecter les questions avant utilisation de ces parcours. Les diaporamas associés aux chapitres restent affichés ; les diapositives non affectées sont présentées dans le premier chapitre. Le lecteur historique sans chapitre reste pris en charge.

La publication avec contrôle exhaustif de préparation, le versionnement du cursus pour les inscrits existants et la migration éditoriale des formations restent à développer. Ajouter un chapitre obligatoire à une formation active modifie actuellement les prérequis du final. Ce mécanisme technique ne constitue pas une validation réglementaire du programme ou de l’examen.

## Vérification

Le test PostgreSQL du parcours couvre le refus du final prématuré, le refus de complétion manuelle, les banques séparées, l’immuabilité du rattachement de session, les seuils/durées, la reprise après réussite, les tentatives indépendantes, la soumission idempotente, les chapitres facultatifs et la réserve de certification au final.
