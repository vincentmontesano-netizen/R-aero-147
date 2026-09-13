# Vérification publique des certificats — lot 88

La page publique affichait un bandeau vert pour tout certificat trouvé, même révoqué, et ignorait l’expiration. Le statut est maintenant calculé sur le serveur : une validité explicitement désactivée ou inconnue donne `revoked`, une échéance atteinte donne `expired`, sinon `valid`. La révocation prime sur l’expiration. Le bandeau, l’icône et le champ de statut utilisent ce résultat, avec libellés FR/EN/AR et dates affichées dans la langue d’interface en UTC.

La réponse publique contient uniquement numéro, dates, statut, nom du titulaire, titre et référence de formation. Le titre reste issu du curriculum versionné lorsque disponible. Le numéro interne de personne est utilisé pour le journal d’accès puis retiré par la route ; identifiants de certificat/inscription/formation, PDF privé, détails de catalogue et autres champs ne sont pas retournés. Le formulaire borne le code à 32 caractères et la route valide sa forme.

Les actions de téléchargement public sont remplacées par une indication d’accès depuis l’espace du titulaire. **Correction du constat initial : au lot 88, seul le lien avait été retiré de la réponse/page ; le serveur servait encore directement les fichiers de certificat publiquement. La protection effective est ajoutée au lot 91 ci-dessous.** La page nomme le registre de certificats et ne prétend plus établir à elle seule un agrément EASA de l’émetteur.

261 tests réussis (189 PostgreSQL), TypeScript/build réussis. Nouveau scénario SQL via la route publique : clés exactes de réponse, absence de description privée, expiration, révocation, validité et refus d’un code trop long. Test de frontière temporelle : échéance exacte expirée, échéance future valide, révocation prioritaire. Les tests existants des remboursements et accès apprenants restent réussis.

La suspension d’accès commercial n’est pas transformée en annulation de réussite. Aucun certificat existant n’est modifié par cette lecture. Ce statut exprime le registre applicatif ; il ne vérifie pas les qualifications ni le périmètre réglementaire de l’émetteur.

Suites identifiées dans le générateur existant : révocation auditée et cadre réglementaire à renforcer. Origine du QR et mentions d’agrément corrigées au lot 89, émission transactionnelle au lot 90, archivage des nouvelles émissions au lot 92 ci-dessous. Ces points empêchent de considérer la certification globale comme terminée. Recette navigateur non effectuée ; aucune migration, dépendance ou nouvelle recette Docker pour ce lot.

## Adresse officielle et mentions du modèle — lot 89

Le QR et son URL imprimée sont construits avec `canonicalAppOrigin`, règle partagée avec la récupération de mot de passe : `PUBLIC_APP_URL`, puis repli de configuration `APP_ORIGIN`. En production, origine HTTPS obligatoire, sans identifiants, chemin, query ou fragment. En développement seulement, repli localhost et HTTP local admis. La route accepte encore le champ historique `origin`, désormais facultatif et ignoré ; le service l’ignore également. Une configuration incorrecte bloque la première émission avant QR, fichier ou certificat SQL. Un document existant est rendu sans nouvelle génération.

Le modèle ne porte plus l’affirmation systématique d’agrément EASA ni une signature attribuée à un directeur non identifié. La référence de curriculum est étiquetée « Référence de formation ». Cela ne constitue pas la mise en œuvre d’un certificat réglementaire Part-147 : identité de l’émetteur, périmètre d’agrément et signataire vérifiés restent à intégrer.

263 tests réussis (191 PostgreSQL), TypeScript/build réussis. Deux nouveaux scénarios SQL vérifient la véritable valeur fournie à l’encodeur QR, l’ignorance d’une origine hostile, la récupération sans réémission et l’absence d’écriture sur plusieurs configurations invalides. Un spécimen synthétique a été généré dans le stockage temporaire, rendu et inspecté sur une page ; l’URL imprimée utilise le domaine de test configuré. Aucun appel HTTP externe ni certificat commercial émis. Aucun changement de migration/dépendance ; dernière recette Docker complète au lot 85.

## Émission transactionnelle — lot 90

Le service verrouille l’inscription pendant les contrôles et l’émission. La recherche d’un certificat existant intervient après ce verrou : les demandes concurrentes attendent puis récupèrent le même document. La lecture du curriculum, l’insertion du certificat, les associations d’objectifs et la preuve personnelle utilisent la même transaction PostgreSQL. Une erreur de preuve annule les écritures SQL précédentes.

La création d’une preuve manquante appelée séparément ouvre également une transaction et verrouille le certificat avant de chercher une preuve existante. Cela sérialise les reprises concurrentes de cette opération. Aucun doublon historique n’est supprimé ; aucune contrainte d’unicité rétrospective n’est ajoutée.

266 tests réussis (194 PostgreSQL), TypeScript/build réussis. Trois nouveaux tests : trois émissions concurrentes donnent un fichier, un certificat, une association d’objectif et une preuve ; une véritable erreur SQL déclenchée sur l’insertion de preuve annule certificat et associations puis permet une reprise ; deux créations de preuve historique retournent le même enregistrement. Le déclencheur de panne synthétique est limité à la personne de test et retiré après le scénario.

Le fichier est écrit avant le commit SQL : une panne peut donc laisser un fichier orphelin, non référencé et inaccessible par les droits normaux. La reprise utilise un autre numéro/chemin ; aucune suppression automatique de document n’est introduite. Ce lot ne transforme pas les contrôles de droits effectués par la route en verrouillage complet des paiements/affiliations, ni les anciens certificats en archives immuables. Modèle PDF inchangé, aucune migration/dépendance ; dernière recette Docker complète au lot 85.

## Protection effective des fichiers — lot 91

Le namespace `certificates/` passe maintenant par l’authentification et le contrôle de droits du serveur de fichiers. Le fichier doit correspondre au lien d’un certificat enregistré ; seuls son titulaire actif ou un administrateur actif peuvent le télécharger. Un manager de compagnie n’obtient pas un droit implicite. Un fichier orphelin est refusé même à un administrateur. Les réponses autorisées portent `Cache-Control: private, no-store`, `Vary: Cookie` et une disposition de pièce jointe ; une demande anonyme reçoit 404.

Un certificat révoqué reste consultable par son titulaire : son état se vérifie dans le registre, son document n’est pas effacé. Les anciens fichiers référencés bénéficient également de cette protection. Une copie déjà téléchargée ou un ancien cache externe ne peuvent pas être rappelés par ce changement.

268 tests réussis (195 PostgreSQL), TypeScript/build réussis. Nouveau test HTTP avec authentification/droits simulés : anonymat refusé, contenu autorisé et en-têtes privés. Nouveau test SQL du contrôle réel : titulaire, tiers, manager, administrateur, compte suspendu, certificat révoqué et chemin orphelin. Ces deux niveaux vérifient séparément le branchement HTTP et les droits issus de la base. Modèle PDF inchangé ; aucune migration/dépendance/nouvelle recette Docker. L’archive immuable reste le prochain chantier.

## Archive des nouvelles émissions — lot 92

Une archive est insérée dans la transaction d’émission avec le certificat et sa preuve. Elle conserve nom imprimé du titulaire, titre/référence/durée de formation, date de réussite, version du curriculum, identifiant de tentative finale réussie, URL de vérification et objectifs attestés (identifiant, code, titre). La clé de stockage, la taille et le SHA-256 lient cet instantané aux octets du PDF. Une date de réussite absente bloque désormais la première émission au lieu d’utiliser la date du jour.

La table d’archive refuse UPDATE, DELETE et TRUNCATE. Une identité de certificat archivée ne peut plus être modifiée (titulaire, inscription, formation, numéro, code, dates et lien PDF) ; seul `isValid` peut encore évoluer. La référence étrangère protège le certificat contre la suppression. La procédure de révocation avec acteur et motif reste à créer : cette protection n’en tient pas lieu.

La vérification publique utilise le nom et le titre archivés. La liste personnelle utilise le titre archivé. Le PDF servi dans le namespace privé est vérifié par sa taille et son empreinte avant envoi ; un fichier modifié est refusé avec 404. Les anciennes émissions gardent leur comportement de lecture et n’obtiennent pas d’empreinte ni d’identité historique artificiellement reconstituées. Pour une ancienne inscription non versionnée, l’archive conserve le catalogue disponible à l’émission, sans prétendre prouver son état antérieur.

270 tests réussis (197 PostgreSQL), TypeScript/build réussis. Nouveau scénario SQL d’archive : changements de profil/catalogue sans changement de vérification, intégrité, refus de modifications/suppressions, statut révoqué encore possible. Nouveau scénario de date manquante. Le scénario de panne de preuve vérifie aussi le rollback de l’archive ; le test HTTP vérifie le refus d’intégrité après autorisation. Migration ajoutée sans modifier les migrations déjà appliquées. Le modèle PDF reste celui inspecté au lot 89.

Ces contrôles ne constituent pas une signature électronique ou un archivage légal certifié. Les fichiers orphelins après panne restent possibles ; aucune copie historique n’est effacée. L’identité juridique et les pouvoirs du signataire, le périmètre d’agrément et la révocation auditée restent à réaliser.

Construction et recette Docker complète installation, panne/reprise PostgreSQL, redémarrage, sauvegarde/restauration réussies pour l’image finale `sha256:af4269f18d95d85a23f989e0317a4107e1b1cd338004c23ff9784495f1009d3f`. Ressources jetables nettoyées ; aucun déploiement.

## Révocation administrative motivée — lot 93

L’onglet Certificats de l’administration permet une recherche exacte par numéro. Il présente le titulaire et le titre archivés lorsque disponibles, le statut et l’éventuel événement de révocation. Un administrateur actif peut révoquer un certificat valide ou expiré avec un motif de 10 à 2000 caractères et une confirmation explicite dans le formulaire FR/EN/AR. La consultation administrative est journalisée ; le motif reste réservé à l’administration et n’est pas ajouté à la réponse publique.

La transaction verrouille le compte administrateur puis le certificat. L’événement conserve acteur, motif et date ; sa clé de certificat assure un seul événement. Les requêtes répétées ou concurrentes ne remplacent pas le motif initial. L’événement et la désactivation du certificat sont validés ensemble. L’historique refuse modification, suppression et TRUNCATE ; une réactivation d’un certificat ayant cet événement est refusée par PostgreSQL.

Les certificats déjà invalides sans événement restent identifiés comme tels : le service ne leur invente pas un auteur ou un motif historique. Le parcours n’offre pas de réactivation ; une correction/remplacement nécessite un futur workflow distinct. Les fichiers, archives, réussites et inscriptions sont conservés. Le statut public devient révoqué à la prochaine consultation.

272 tests réussis (199 PostgreSQL), TypeScript/build réussis. Deux nouveaux scénarios SQL passent par les routes réelles : concurrence et événement unique, statut public, conservation du lien PDF, refus de modification/suppression/réactivation, refus des non-admins et administrateurs suspendus, motif court et données historiques sans audit. La migration est additive.

Limites : pas de double validation, de notification automatique ou de remplacement de certificat. Les modifications directes historiques de `isValid` sans événement ne sont pas rétrospectivement auditées et le rôle propriétaire de base conserve ses pouvoirs DDL. Les preuves liées ne sont pas effacées ni automatiquement gelées par ce lot ; leurs usages comme preuve doivent tenir compte du statut du certificat. Recette navigateur non effectuée. Le cadre réglementaire de l’émetteur reste à compléter.

Construction et recette Docker complète avec restauration réussies pour l’image `sha256:12fc3f2393874974f95056596b735975bb6e1019e2d88c8b612961ef0ae05bc7`. Ressources jetables nettoyées ; aucun déploiement.

## Preuves actuelles dans la vue compagnie — lot 94

La projection commune du dossier compagnie considère valide uniquement un certificat explicitement valide dont l’échéance n’est pas atteinte. Elle ne choisit plus un certificat expiré simplement parce qu’il est plus récent. Une autre émission encore valide peut continuer à satisfaire le même besoin de formation.

La couverture d’objectifs utilise uniquement les preuves LIVING non expirées, visibles selon les règles de partage et rattachées à une formation requise. Une preuve liée à un certificat doit retrouver ce certificat parmi les émissions valides du titulaire et correspondre à la même formation. Certificat manquant, révoqué, expiré ou de formation différente : couverture exclue. Les preuves sans certificat conservent leurs règles de visibilité mais doivent aussi être actives, non expirées et rattachées à une formation requise.

Le calcul ne supprime ni ne modifie les preuves FROZEN/LIVING, certificats ou dates de réussite. Le calendrier de récurrence reste distinct de la validité documentaire ; les vues peuvent donc présenter une date de formation enregistrée avec absence de certificat valide. Cette couverture pédagogique déclarée n’est pas une attribution de licence Part-66.

274 tests réussis (200 PostgreSQL), TypeScript/build réussis. Nouveau test de projection couvrant expiration, validité inconnue, certificat manquant/différent, preuve gelée/expirée/sans formation ; nouveau scénario SQL reliant la révocation administrative au dossier compagnie réel, avec disparition de la couverture et conservation des enregistrements. Aucun changement UI/migration/dépendance ; dernière recette Docker complète au lot 93. L’ensemble des autres usages de preuves, notamment signatures de compétence et exports historiques, reste à examiner séparément.
