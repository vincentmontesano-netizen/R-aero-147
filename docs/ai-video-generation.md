# Génération vidéo IA

## Transport fournisseur (lot 79)

`server/veoProvider.ts` implémente les trois étapes REST distinctes de Google Veo : démarrage via `predictLongRunning`, consultation de l’opération puis téléchargement du résultat. Le flux asynchrone et la structure REST sont décrits dans la [documentation officielle Google Veo](https://ai.google.dev/gemini-api/docs/veo?hl=en), consultée le 13 septembre 2026. Cette documentation indique des durées de 4, 6 ou 8 secondes et les formats paysage/portrait. Le service demande une vidéo 720p avec un seul résultat.

Le modèle doit être explicitement fourni dans `GEMINI_VIDEO_MODEL` ; la clé vient de `GEMINI_API_KEY` ou du repli existant `GOOGLE_API_KEY`. Aucun modèle n’est activé par défaut. Le transport valide un prompt non vide borné à 5000 caractères, le format, la durée et l’identifiant d’opération. Consulter une opération ne soumet jamais une nouvelle génération. Les erreurs retournées ne recopient pas les messages bruts fournisseur.

Le JSON est lu avec une limite de 1 Mio. Le téléchargement a une limite effective de 50 Mio pendant la lecture et un délai de 180 secondes commun à ses redirections. Le lien initial doit provenir de `generativelanguage.googleapis.com` en HTTPS sans identifiants ni port personnalisé ; les redirections manuelles sont limitées à trois et aux hôtes Google admis (`storage.googleapis.com`, sous-domaines `googleusercontent.com` et hôte API). La clé n’est jointe qu’à l’hôte API. Le résultat doit porter une signature MP4 reconnue, sans prétendre en vérifier tous les codecs ni la lecture complète.

## Plan initial du lot 79 (réalisé au lot 80 ci-dessous)

Au lot 79, ce module n’était pas encore exposé par une route ni branché dans le studio. Le lot 80 décrit ci-dessous réalise ce raccordement. Le plan initial était :

- Une réservation persistante privée liée au compte et à la formation avant l’appel, avec quota vidéo et identité/destination immuables.
- L’enregistrement de l’opération connue, sa consultation sans régénération, une récupération du résultat en média privé et un lien de résultat idempotent.
- Le traitement honnête de l’issue inconnue après coupure entre acceptation fournisseur et sauvegarde de son identifiant : aucune resoumission payante automatique.
- Les routes auteur avec droits relus, le suivi FR/EN/AR et l’insertion volontaire dans une diapositive, sans écraser son contenu.
- Configuration Compose/exemple, tests PostgreSQL/concurrence/droits, migration et recette Docker.

La reprise durable ne doit pas stocker de clé ni exposer les adresses fournisseur au navigateur. Les paramètres réellement envoyés et la relation compte/cours doivent rester vérifiables. Aucun financement, activation de service, appel fournisseur réel ou déploiement n’a été effectué.

## Vérification du transport

243 tests réussis (178 PostgreSQL), TypeScript/build réussis. Quatre nouveaux tests HTTP simulés vérifient soumission unique, polling, nom de modèle avec point, formes invalides, résultats terminaux sans vidéo, absence de corps d’erreur brut, redirections sans transmission de clé, rejet des hôtes étrangers, annulation de flux trop volumineux et signature MP4. Ce sont des tests d’adaptateur ; ils ne prouvent pas l’activation du modèle, les coûts, la fidélité aéronautique, la qualité audiovisuelle ni le parcours complet.

## Parcours studio et suivi persistant (lot 80)

Le transport est maintenant relié aux routes auteur et au dialogue de diapositive. La section « Vidéo IA » permet de décrire une scène, choisir 4/6/8 secondes et paysage/portrait, lancer une demande, vérifier une opération existante et utiliser le MP4 obtenu dans le formulaire. L’insertion est volontaire et la diapositive doit ensuite être enregistrée. Les 50 dernières demandes de cette formation appartenant au compte sont affichées ; elles ne sont pas exposées aux autres auteurs du même cours.

La migration `20260913_ai_video_jobs.sql` conserve l’identifiant client, auteur, cours, organisation d’origine, modèle et paramètres effectivement envoyés. Cette identité est immuable. Le journal distingue submitting, running, ready, failed et unknown ; les états terminaux, suppressions et TRUNCATE sont protégés. Les paramètres contiennent le prompt privé, jamais la clé fournisseur. Le navigateur ne reçoit ni l’identifiant d’opération fournisseur ni son adresse de téléchargement.

La réservation est commise avant l’appel externe. Répéter le même identifiant retrouve la demande, sans nouvel appel ; changer ses paramètres est refusé. Si la réponse de démarrage se perd, l’issue reste unknown et aucune resoumission automatique n’a lieu. Un submitting ancien de plus de cinq minutes est présenté comme inconnu. Une opération connue reste consultable après un redémarrage. Après 24 heures, sa vérification la classe unknown sans prétendre l’annuler chez Google.

Un quota distinct de vidéo s’applique par compte : `AI_VIDEO_REQUESTS_PER_HOUR=2` par défaut, valeurs 0 à 20, zéro désactive les nouvelles demandes. Tous les enregistrements de l’heure comptent, y compris les issues inconnues. Une seule demande vidéo active récente est admise par compte. Ce quota est séparé des quotas texte/image/audio existants ; les tâches vidéo longues ne bloquent pas la rédaction. Il ne constitue pas un budget monétaire fournisseur.

La vérification verrouille la demande et les droits courants pendant la consultation/téléchargement, pour sérialiser deux demandes de récupération. Compte actif, cours non archivé, organisation active et affiliation MANAGER sont exigés selon le contexte, avec l’exception administrateur habituelle. Le compte créateur et l’organisation d’origine restent requis pour retrouver la tâche. Retirer une affiliation bloque les consultations ultérieures. Une vérification commencée conserve ces verrous jusqu’à sa fin : une révocation concurrente peut donc attendre le délai réseau borné.

L’enregistrement de la métadonnée du média privé et de son lien au job appartient à la même transaction. Répéter une récupération terminée ne crée pas un second média. Les erreurs de transport laissent l’opération running, affichent une invitation à réessayer et enregistrent un délai minimal de dix secondes avant nouvelle consultation. Le fichier est écrit avant le commit SQL : une panne à cet instant peut laisser un fichier orphelin sans droit de lecture apprenant ; aucun ramasse-miettes n’a été ajouté. Le téléchargement n’entraîne jamais une nouvelle génération.

`GEMINI_VIDEO_MODEL` et le quota sont présents dans les deux fichiers Compose et l’exemple d’environnement. Le modèle demeure à sélectionner explicitement parmi ceux activés pour le compte Google ; aucun modèle ni clé réelle n’a été configuré ici.

## Vérification de l’intégration

247 tests réussis (182 PostgreSQL), TypeScript/build et validation des deux fichiers Compose réussis. Quatre nouveaux tests PostgreSQL couvrent soumissions identiques simultanées, résultat média unique malgré deux récupérations, immutabilité, confidentialité/droits révoqués, issue inconnue sans resoumission, conflit de paramètres, quota et reprise après échec de téléchargement avec temporisation. Les écritures de fichiers sont simulées dans ces tests SQL ; le registre et les transactions sont réels. L’adaptateur HTTP possède ses tests simulés séparés. La recette de migration et restauration Docker est consignée dans `plan.md`.

Restent à effectuer : activation et recette réelle Google (modèle/région/facturation), écoute/lecture des fichiers réellement générés, précision aéronautique, recette navigateur et accessibilité. Au lot 80, la consultation se faisait à l’initiative de l’auteur ; la collecte automatique est ajoutée au lot 81 ci-dessous. La disponibilité distante peut toujours expirer pendant un arrêt prolongé de l’application. Le chantier vidéo possède maintenant son parcours applicatif, sans validation de bout en bout chez le fournisseur ni garantie de production.


## Collecte automatique des opérations connues (lot 81)

Au démarrage du serveur puis toutes les 30 secondes, un traitement borné consulte jusqu’à cinq tâches running arrivées à échéance de vérification. Il ne soumet aucune génération et ignore les tâches submitting ou unknown. Un verrou local empêche deux passes simultanées dans le même processus ; les verrous de ligne avec `SKIP LOCKED` permettent à plusieurs instances de se répartir les tâches sans attendre celle qu’un autre processus ou une vérification manuelle traite déjà.

Le choix utilise la dernière vérification (null en premier), puis la création et l’identifiant. Les tâches running disposent d’un index partiel dédié. Après une tentative échouée, la date de vérification est conservée et empêche une nouvelle tentative automatique avant 30 secondes. Cela permet aux tâches suivantes de progresser. La fonction de collecte permet aussi un périmètre de formation pour une maintenance ciblée, sans route publique supplémentaire.

Le traitement réutilise les mêmes contrôles de droits et la même récupération transactionnelle que l’auteur. Un point de sauvegarde SQL par tâche permet d’annuler une insertion de média échouée, d’enregistrer la tentative et de continuer les autres tâches. Les journaux de serveur indiquent seulement le nombre de tentatives indisponibles, sans prompt, URL ni secret. Une suspension de l’auteur empêche les appels fournisseur ; une restauration de ses droits permet la reprise ultérieure.

Aucune clé/modèle réel n’a été configuré et aucune génération réelle n’a été demandée pendant le développement. Le traitement ne rend pas la disponibilité fournisseur permanente et ne peut retrouver une opération dont l’identifiant n’a jamais été enregistré. Une coupure après écriture du fichier mais avant commit peut toujours laisser un fichier orphelin. Les limites réseau et la durée de maintien des verrous décrites au lot 80 restent applicables ; cinq tâches lentes peuvent allonger une passe, sans chevauchement dans le même processus.

251 tests réussis (186 PostgreSQL), TypeScript/build réussis. Quatre scénarios supplémentaires vérifient worker/worker/auteur simultanés avec un seul média, isolation d’une erreur et poursuite de la file sans resoumission, droits suspendus/rétablis, et véritable échec SQL de métadonnée média avec rollback puis réussite d’une autre tâche. Le démarrage Docker et la restauration avec cette migration sont consignés dans `plan.md`. Recette réelle fournisseur/navigateur toujours à effectuer.
