# Médias privés des formations

Les nouvelles images et narrations générées depuis une diapositive exigent un identifiant de formation et une autorisation d’auteur avant tout appel au fournisseur. L’autorisation est de nouveau vérifiée lors de l’enregistrement du résultat. Les managers de compagnie peuvent utiliser cette route selon leur affiliation, sans dépendre d’un rôle global staff.

Les fichiers PNG/JPEG/MP3 sont enregistrés sous `/storage/course-media/`, avec une référence immuable à la formation, au créateur, au type, à la taille et à l’empreinte SHA-256. Taille maximale 50 Mo, en-tête de format contrôlé. Un fichier nouveau utilise une nouvelle clé ; le stockage refuse l’écrasement. La migration `20260913_course_media.sql` empêche modification et suppression du registre. Un échec de registre peut laisser un fichier orphelin, mais celui-ci reste inaccessible.

Chaque téléchargement vérifie le compte actif et les droits courants. Les auteurs autorisés accèdent aux médias de leur formation. Les apprenants doivent disposer d’une inscription autorisée dont la version figée référence précisément ce média. Un média de brouillon ou d’une publication ultérieure ne devient pas accessible du seul fait d’avoir une inscription à la formation. Expiration, suspension de paiement/abonnement et retrait d’affiliation s’appliquent par les mêmes portes que le parcours.

La réponse HTTP est privée, sans cache, intégrable dans le lecteur (`inline`) ; les octets sont comparés à l’empreinte et à la taille avant envoi. La publication et l’édition des diapositives refusent les références à des médias privés introuvables ou appartenant à une autre formation.

## Vérification

Trois tests PostgreSQL : auteurs/apprenants/versions/expiration, origine et empreinte immuables/références étrangères, révocation manager. Les routes de génération étrangères sont refusées avant appel fournisseur. Test HTTP sur confidentialité, rendu inline et refus d’un fichier altéré. Les tests de registre simulent l’écriture disque ; le test HTTP emploie de vrais fichiers temporaires et simule la validation d’empreinte, dont le calcul réel est couvert séparément par les tests PostgreSQL. Aucun appel IA réel effectué.

## Limites à traiter

Ce lot concerne les nouvelles images et narrations IA. Les anciens liens `/storage/courses/` restent publics et nécessitent une migration documentée avec preuve d’origine ; les liens externes ne deviennent pas privés. Restent import privé de supports et vidéos, pipeline de génération vidéo, formats supplémentaires, antivirus/décodage complet (l’en-tête n’est pas une analyse antivirus), lecture par plages pour les grands médias, quotas et tâches IA, nettoyage des orphelins sous politique de conservation, sauvegarde/contrôle d’intégrité supervisé, recette visuelle et droits de réutilisation des contenus. Les empreintes protègent l’intégrité observable, elles ne démontrent pas la qualité pédagogique ou une approbation réglementaire.

## Import de fichiers et lecture vidéo

L’import privé est maintenant disponible dans les diapositives (PNG/JPEG, MP3, MP4) et les chapitres (MP4, PDF). Un fichier importé porte l’origine `uploaded` ; les fichiers issus du lot précédent conservent `generated`. Migration `20260913_course_media_import.sql`.

L’API exige l’autorisation d’auteur, un encodage Base64 canonique, un type accepté et un fichier de 25 Mo maximum. Cette limite tient compte de l’enveloppe JSON du serveur. La validation MP4 contrôle une boîte `ftyp` initiale et un type de conteneur accepté ; PDF contrôle son en-tête. Ces contrôles ne garantissent pas le décodage, les codecs vidéo/audio ou l’absence de contenu malveillant. Le fichier est rattaché au contenu après enregistrement du chapitre ou de la diapositive ; l’interface le précise.

Les réponses MP3/MP4 prennent en charge une plage d’octets unique (`206`, `Content-Range`, `Accept-Ranges`) pour la navigation temporelle. Les plages impossibles reçoivent `416`, les plages multiples ou conditionnelles non prises en charge une réponse complète. Autorisation et empreinte portent toujours sur le fichier entier avant envoi de la plage. Le serveur lit encore le fichier en mémoire : ce n’est pas un stockage vidéo adapté à des volumes très importants.

Deux tests ajoutés : import/provenance/format/encodage/taille et lecture HTTP partielle authentifiée, suffixe, plage impossible et fichier altéré. Aucun média fourni par l’utilisateur ni service externe utilisé durant ces tests. Restent import multipart/résumable de gros fichiers, transcodage et validation codecs, antivirus/quarantaine, quotas, migration des anciens médias publics, génération vidéo et recette réelle du lecteur.

## Protection du répertoire historique

La migration `20260913_legacy_course_media.sql` capture une fois les références `/storage/courses/` présentes dans les formations, chapitres, diapositives, versions publiées et copies de revue. Ces rattachements historiques sont immuables. Ils constatent une référence existante à la date de migration ; ils ne prouvent pas qui a créé le fichier ni son intégrité d’origine.

Tout le répertoire `courses/` est désormais privé, sans cache partagé. L’auteur doit être autorisé sur une formation du registre historique ; l’apprenant doit avoir un accès valide à une version qui référence le média, dans ce même périmètre historique. Une URL copiée après migration dans un cours étranger n’élargit pas le registre et sa publication est refusée. Les fichiers sans référence capturée sont inaccessibles, y compris aux auteurs qui en connaissent le lien. Les anciennes inscriptions sans version figée ne reçoivent pas d’accès inventé.

La migration ne réécrit ni ne déplace les fichiers, les versions ou les copies de revue. Les anciennes empreintes ne sont pas disponibles : la vérification SHA-256 reste réservée au nouveau registre. Un éventuel visuel de catalogue employant cet ancien répertoire ne sera plus visible anonymement ; sa réutilisation publique nécessite une publication explicite dans un espace prévu à cet effet. Les anciens caches déjà constitués hors de l’application ne peuvent pas être rappelés par cette modification.

Deux tests supplémentaires : exécution du véritable SQL de capture et contrôle auteur/apprenant/copie étrangère/révocation/immutabilité ; frontière HTTP privée de l’ancien répertoire. Restent rapprochement assisté des fichiers orphelins, preuve d’intégrité des anciens octets et recette des contenus historiques. Les limites précédentes indiquant que `courses/` demeure public sont remplacées par ce contrôle d’accès.
