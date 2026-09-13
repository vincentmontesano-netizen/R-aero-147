# Langue du contenu indépendante de l’interface

Le studio utilisait directement la langue d’interface lors des générations de texte, narration et mini-QCM. Ouvrir une formation anglaise depuis une interface française pouvait donc produire un ajout en français par défaut.

Les dialogues de nouvelle formation manuelle et de plan IA proposent désormais un choix explicite Français/English/العربية. La langue d’interface initialise seulement ce choix à l’ouverture ; le choix est ensuite conservé dans l’état du dialogue et envoyé comme langue du nouveau cours ou du plan enregistré. Le dialogue IA fige toujours les paramètres après réception d’un plan, y compris sa langue, pour sa reprise idempotente.

L’éditeur de diapositive initialise son choix de langue depuis la formation existante si celle-ci porte FR/EN/AR ; une donnée ancienne absente ou non reconnue utilise la langue d’interface comme valeur initiale visible. Le choix est transmis aux générations de texte, audio et QCM. Il est désactivé pendant une génération et ne modifie ni la langue globale du cours, ni les contenus déjà enregistrés. Un texte explique cette distinction en FR/EN/AR. Le prompt vidéo reste une description explicite distincte.

Il ne s’agit pas d’une traduction automatique. La narration locale du lecteur est désormais reliée à la langue du curriculum versionné, comme décrit ci-dessous. La revue humaine reste nécessaire pour les résultats générés.

## Vérification

TypeScript/build réussis, contrôle des paramètres des cinq appels concernés (création manuelle, plan, texte, audio, QCM). Aucun test reproduisant ces simples affectations n’a été ajouté ; la dernière suite complète reste celle du lot 81 : 251 tests réussis (186 PostgreSQL). Recette navigateur multilingue toujours à effectuer. Aucun serveur fournisseur appelé, migration ou déploiement.


## Narration locale du lecteur (lot 83)

`SlideDeck` reçoit la langue du contenu, distincte de la langue de ses boutons et messages. Les lecteurs sans chapitres et avec chapitres utilisent la langue de `enrollment.training`, déjà issue du snapshot de la version liée à l’inscription. La prévisualisation auteur utilise celle du brouillon courant.

SpeechSynthesis sélectionne `fr-FR`, `en-US` ou `ar-SA` à partir de cette langue. Les variantes régionales FR/EN/AR sont reconnues par leur préfixe ; une langue historique absente ou non prise en charge garde le repli sur la langue UI. Changer la langue du contenu interrompt une narration en cours. Les fichiers audio déjà enregistrés ne sont pas modifiés et aucune traduction automatique n’est exécutée.

La voix effectivement utilisée dépend de l’appareil et du navigateur. Aucune voix n’est téléchargée, aucun fournisseur de génération n’est appelé et aucune qualité de prononciation n’est garantie par ce choix de locale.

251 tests réussis (186 PostgreSQL), TypeScript/build réussis. Le scénario existant de versions publiées a été renforcé : une première inscription conserve l’arabe alors qu’une nouvelle publication et une seconde inscription utilisent l’anglais, via l’API de tableau de bord réellement consommée par le lecteur. Cela prouve la source versionnée des métadonnées, pas le rendu sonore dans un navigateur ; cette recette reste à effectuer.
