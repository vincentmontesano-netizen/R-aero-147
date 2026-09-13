# Aperçu local Tailscale

Lancement demandé par l’utilisateur le 13 septembre 2026. Adresse : http://macstudio-de-sano.tailbdfa51.ts.net:3174 ; accès local : http://localhost:3174. Le Mac et le client distant doivent rester connectés au même réseau Tailscale.

Le conteneur `raero-local-preview` écoute sur `127.0.0.1:3174` et utilise les volumes dédiés `raero-local-preview-db` et `raero-local-preview-storage`. Il ne partage pas la base de test. Les données initiales sont celles de démonstration. Les fournisseurs de paiement, génération et messagerie réels ne sont pas configurés. Les identifiants sont dans `/Users/sano/Desktop/SOFT/147/Acces-R-AERO-local.txt`, protégé en 0600 ; la configuration privée est à côté dans `raero-local-preview.env`. Ne pas intégrer ces fichiers dans le dépôt ou dans une image.

Le compte Tailscale a refusé la délivrance de certificats TLS. Le relais retenu est TCP privé 3174 vers localhost:3174, sans Funnel. L’application tourne avec `NODE_ENV=preview` pour servir ses assets compilés et permettre les cookies HTTP dans cet aperçu. Les règles de cookies du mode production n’ont pas été modifiées. Cette configuration n’est pas destinée à une exposition Internet. Les fonctions du navigateur exigeant un contexte sécurisé, notamment certaines utilisations de caméra/microphone, ne sont pas validées ici.

Les relais existants 3092 et 3093 n’ont pas été modifiés. Pour arrêter uniquement cet aperçu : `docker stop raero-local-preview`. Pour retirer uniquement son relais : `tailscale serve --tcp=3174 off`. Le conteneur peut être relancé avec `docker start raero-local-preview` et le relais avec `tailscale serve --bg --tcp=3174 tcp://127.0.0.1:3174`. Les volumes sont conservés. Le conteneur utilise une politique de redémarrage `unless-stopped`.

## Compatibilité des identifiants de demande

Au lot 121, les validations et les demandes vidéo utilisent un UUID v4 avec génération native quand disponible, sinon 16 octets issus de `crypto.getRandomValues` avec les bits version/variant du UUID v4. Aucun repli vers Math.random. Les identifiants déjà retenus pour une reprise restent réutilisés comme auparavant. `randomUUID` requiert un contexte sécurisé alors que `getRandomValues` peut être utilisé dans un contexte non sécurisé : [randomUUID](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID), [getRandomValues](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues).

Trois tests du chemin natif, du repli et du refus sans source sûre ; 303 tests réussis au total, TypeScript/build réussis. Pas de navigateur automatisable disponible dans la session : les vérifications d’URL sont des requêtes HTTP et les comportements JavaScript sont testés séparément.

## Salle à distance dans l’aperçu (lot 128)

Le lecteur de salle indique désormais lorsque le navigateur n’est pas dans un contexte sécurisé et désactive l’ouverture de la visioconférence intégrée dans ce cas. Cette vérification concerne la vidéo en direct ; elle ne bloque pas la lecture d’un replay. L’aperçu HTTP distant reste donc destiné aux autres parcours tant qu’un accès HTTPS et la configuration JaaS n’ont pas été mis en place. L’accès à caméra/microphone par getUserMedia nécessite un contexte sécurisé : [documentation MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#security).

Une erreur de lecture initiale de salle est distincte d’une salle inexistante et propose une reprise. Une erreur réseau de rafraîchissement conserve la salle affichée avec un message ; un refus UNAUTHORIZED/FORBIDDEN/NOT_FOUND entraîne le démontage de l’instance vidéo et l’arrêt du heartbeat client. Cela intervient à la réception du refus, avec le rafraîchissement existant de 15 secondes, pas par notification serveur immédiate. Ce mécanisme ne révoque pas à lui seul un JWT JaaS déjà délivré hors de cette page.

Les types de salle et identifiants d’URL mal formés ne déclenchent plus de requête d’accès. Les autorisations et horaires serveur restent inchangés. Ces changements de cycle de vie n’ont pas été exécutés dans un navigateur ; aucun appel de caméra, microphone ou fournisseur réel n’a été réalisé.

## Création des QCM de classe à distance (lot 129)

Les lignes d’options vides sont omises avant l’envoi, avec remappage de la bonne réponse vers sa position effective. La sélection d’une ligne vide ou inexistante est refusée, au lieu d’être déplacée vers une autre réponse. Les sondages sans correction gardent le comportement de suppression des lignes vides. Le QCM de cette interface exige une bonne réponse sélectionnée ; les règles serveur restent inchangées.

Le formulaire limite la question à 1 000 caractères, chaque option à 500 et le nombre de lignes à 10, en cohérence avec les limites API. La sélection de correction expose un libellé et l’état pressé. Deux tests vérifient les lignes vides avant/entre les options, les caractères arabes, l’absence de modification du brouillon et le refus d’une sélection invalide.

307 tests réussis (219 PostgreSQL), TypeScript/build réussis. Aucune séance, aucun sondage réel lancé ; pas de recette navigateur de ce formulaire.

## Confirmation des votes et erreurs de sondage (lot 130)

Le panneau distingue chargement, erreur et absence de sondages. Une erreur de lecture propose une reprise et désactive les votes/clôtures jusqu’à actualisation réussie. Les erreurs de mutation sont affichées sur le sondage concerné ; une lecture est demandée après succès comme après erreur pour retrouver l’état serveur, sans relancer automatiquement un vote.

Les choix enregistrés viennent de myChoices renvoyé par le serveur et sont présentés par leur lettre et l’état aria-pressed des boutons. Aucune sélection optimiste n’est affichée comme enregistrée. Les choix issus du dernier chargement restent visibles lors d’un échec de rafraîchissement avec le message d’indisponibilité.

Les pourcentages ne sont plus affichés comme des zéros lorsque le serveur masque les résultats d’un QCM encore ouvert aux participants. Après clôture, une correction retournée par le serveur est indiquée par une coche et un texte accessible, sans dépendre seulement de la couleur.

TypeScript/build validés ; changement d’affichage sans nouvelle règle serveur. Dernière suite complète au lot 129 : 307 tests (219 PostgreSQL). Aucun vote réel, aucune séance ou recette navigateur réalisés pour ce lot.

## Brouillons et erreurs du chat/questions (lot 131)

Un accusé de réception réussi n’efface le brouillon que si aucune frappe ne l’a modifié depuis cet envoi. Un compteur de modification distingue un nouveau brouillon, même lorsque son texte redevient identique au précédent. Un verrou immédiat empêche plusieurs envois simultanés par soumission du formulaire ; le bouton désactivé n’était pas suffisant pour couvrir tous les événements de soumission.

Une erreur ou une réponse vide conserve le brouillon et affiche un message FR/EN/AR, puis demande une actualisation du fil. La reprise n’est pas automatique. Au lot 131, une réponse perdue pouvait cacher un message effectivement enregistré ; le lot 132 ajoute la protection décrite ci-dessous. Le texte invite à consulter le fil avant de renvoyer. Cette conservation concerne le composant monté, pas la fermeture de l’onglet ou le changement de panneau.

Chargement/erreur/absence de messages distingués, reprise de lecture disponible, envoi et marquage désactivés lorsque le fil est en erreur. Les erreurs de marquage apparaissent sur la question concernée. Saisie limitée à 4 000 caractères comme l’API, champ et bouton d’envoi nommés pour les technologies d’assistance.

TypeScript/build validés. Pas de test DOM/navigateur de frappe concurrente ni d’envoi réel. Dernière suite métier complète au lot 129 : 307 tests.

## Reprise des envois du chat/questions (lot 132)

Les nouveaux envois portent un UUID de demande conservé dans le composant monté. Une reprise du même contenu après erreur réutilise cet identifiant. Le serveur sérialise les demandes de même auteur et identifiant, retrouve le message déjà enregistré et refuse un contenu, un type de message ou une salle différents. Il vérifie les droits courants avant chaque demande. Le même UUID d’un autre auteur désigne une demande indépendante. Les lectures du fil n’exposent pas cet identifiant.

Une migration additive ajoute la colonne nullable et son index unique par auteur. Les pages anciennes sans UUID restent compatibles, sans garantie de dédoublonnage. La fermeture/recharge ou le changement de panneau perd l’identifiant en mémoire ; cette reprise n’est pas persistante côté navigateur.

308 tests réussis, TypeScript/build réussis. Le nouveau test PostgreSQL couvre trois reprises concurrentes, la normalisation du UUID, les conflits de contenu/type, la séparation par auteur et le refus après retrait d’accès. Pas de recette navigateur ni de message réel envoyé.

Mise à jour locale appliquée après recette Docker complète, incluant sauvegarde/restauration. Index vérifié via Tailscale, session antérieure conservée et lectures du tableau de bord réussies. Volumes existants préservés.

## État courant du compte pour la lecture de salle (lot 133)

Le service getLiveAccess relit le statut, le rôle et le nom du compte à partir de son identifiant. Un compte suspendu est refusé avant la lecture de salle. Les champs rôle/nom éventuellement fournis par un appelant ne servent plus aux décisions ni au nom affiché. requireLiveRoom utilise cette même vérification sans dupliquer la lecture du compte. La route d’accès transmet uniquement l’identifiant authentifié.

Ce durcissement couvre aussi les appels internes avec un ancien objet utilisateur ; il ne suppose pas que la route authentifiée acceptait auparavant un rôle envoyé par le navigateur. Il ne sérialise pas une révocation concurrente avec toutes les écritures de salle et ne révoque pas les jetons JaaS déjà délivrés.

309 tests réussis, TypeScript/build réussis. Le test PostgreSQL couvre un rôle administrateur fourni mais absent en base, un nom modifié, le retrait du rôle d’un formateur affecté, puis le refus de lecture et d’envoi après suspension. Aucun compte réel modifié ni message réel envoyé.

Mise à jour appliquée à l’aperçu après recette Docker complète avec sauvegarde/restauration. URL Tailscale, index, session existante et lectures du tableau de bord vérifiés après redémarrage. Pas de recette navigateur.

## Première confirmation des questions conservée (lot 134)

Le marquage « traité » est réservé aux messages de type question. L’écriture conditionnelle ne remplace plus le modérateur enregistré lorsque la question est déjà traitée, y compris si deux modérateurs confirment simultanément ou reprennent une demande. Les droits courants de salle restent contrôlés avant une reprise ; un compte suspendu ou un formateur sans affectation ne bénéficie pas du résultat précédent. Les anciens états null sont traités comme non confirmés.

Il s’agit d’une garantie au niveau du service, pas d’un journal d’audit immuable de la modération. Aucun historique n’est reconstitué et les anciennes attributions ne sont pas modifiées. Le contrôle d’accès et l’écriture ne sérialisent pas toutes les révocations concurrentes.

310 tests réussis, TypeScript/build réussis. Aucun compte réel modifié, aucune question réelle marquée ; pas de recette navigateur.

Recette Docker complète réussie avec sauvegarde/restauration. Aperçu local actualisé avec volumes conservés ; index via Tailscale, session antérieure et lectures inscriptions/certificats vérifiés après redémarrage.

## Lectures groupées des votes (lot 135)

Après vérification d’accès, les sondages sont lus dans l’ordre date puis identifiant décroissants. Leurs votes sont récupérés ensemble, uniquement pour les identifiants de sondage de la salle. Une passe calcule les compteurs, le nombre de votants et les choix du demandeur. Cela remplace une requête de votes par sondage par une seule requête, sans modifier le contrat de réponse. Une salle sans sondage ne déclenche aucune lecture de votes.

Les QCM ouverts masquent toujours correction et compteurs aux participants ; les modérateurs voient les résultats, et la clôture permet leur lecture aux participants. Le nombre de votants reste visible comme auparavant. Les votes individuels des autres personnes ne figurent pas dans la réponse.

Le test PostgreSQL couvre plusieurs sondages dont un vide, choix multiples, autre salle avec votes, choix distincts du modérateur, masquage puis clôture et ordre déterministe à date égale. Le volume des votes est toujours chargé en mémoire ; ce changement réduit les allers-retours SQL, sans constituer une pagination ni une mesure de charge réelle. Les deux lectures ne sont pas un instantané transactionnel unique.

311 tests réussis, TypeScript/build réussis. Compatibilité de l’itération Set ajustée au target TypeScript existant, sans changer la configuration. Aucun vote réel effectué et pas de recette navigateur.

Recette Docker complète réussie avec sauvegarde/restauration. Aperçu local actualisé avec volumes conservés ; index via Tailscale, session antérieure et lectures inscriptions/certificats vérifiés après redémarrage.

## Chargement du suivi de présence (lot 136)

Participants, scores de participation et journal de présence distinguent chargement, erreur et liste vide. Une erreur propose une reprise de la lecture concernée et masque ses données en cache pour ne pas présenter un ancien indicateur comme actuel. Les boutons de navigation du journal sont bloqués pendant la lecture ; l’accès aux pages anciennes est masqué en cas d’erreur et le retour aux dernières entrées reste disponible.

La pastille de participant est accompagnée de « Présence récente » ou « Présence non confirmée », selon l’indicateur serveur existant ; cela ne prétend pas certifier une connexion vidéo actuelle. Les intervalles du journal affichent date et heure locales, pour distinguer plusieurs jours. Les erreurs du journal utilisent un texte FR/EN/AR et ne présentent plus directement le message technique.

TypeScript/build réussis. Changement d’affichage sans règle serveur, migration ou dépendance. Dernière suite complète au lot 135 : 311 tests. Pas de recette DOM/navigateur ni de séance réelle.

Image locale reconstruite et assets actualisés sans redémarrage ; index vérifié via Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes. Dernière recette Docker complète au lot 135 ; avertissement de taille Vite persistant.

## État local rattaché à la salle et au compte (lot 137)

La page de classe est remontée lorsque l’identifiant de compte, le type ou l’identifiant de salle change. Les tickets vidéo et erreurs, brouillons de messages/replay/sondage, demandes en mémoire et curseurs de journal appartiennent ainsi à cette instance de salle. Le démontage déclenche le nettoyage vidéo/heartbeat existant. Ce changement ne conserve pas les brouillons quittés et ne révoque pas un jeton vidéo auprès du fournisseur.

Le panneau affiché est calculé parmi ceux actuellement disponibles. Si le rôle de modérateur disparaît, le panneau de scores est démonté ; au passage en replay, un ancien panneau chat/sondages/participants est remplacé par les questions. La sélection expose aussi aria-pressed. Le contrôle serveur demeure requis pour chaque lecture et action.

TypeScript/build réussis. Changement de cycle de vie et d’affichage sans nouvelle règle serveur ni migration. Pas de recette navigateur de navigation, changement de compte, rôle ou replay ; dernière suite métier complète au lot 135 : 311 tests.

Image locale reconstruite et assets actualisés sans redémarrage ; index vérifié via Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes. Dernière recette Docker complète au lot 135 ; avertissement de taille Vite persistant.

## Certificats du parcours dans le coffre (lot 138)

L’onglet Formation ne réutilise plus un certificat d’une autre inscription au même cours. Le rattachement exige une correspondance unique inscription/formation/titulaire. Les doublons ou liens incohérents affichent « Rattachement à vérifier » sans choisir de document. Les certificats anciens sans inscription ne sont pas rattachés par supposition ; la liste personnelle du tableau de bord conserve leur accès.

L’état du certificat utilise le même calcul que le tableau de bord : valide, expiré ou révoqué. Les documents rattachés restent consultables même expirés/révoqués ; une formation terminée sans certificat reste indiquée comme terminée. Ce contrôle d’affichage ne remplace pas les règles serveur des liens privés.

Chargement et erreur des inscriptions/certificats sont distingués d’une absence ; reprise disponible et liste masquée si l’une des lectures échoue. Dates du certificat dans la langue choisie. Le calcul d’expiration utilise l’heure du navigateur au rendu, comme le tableau de bord. Les chargements de documents ajoutés et archives restent un travail distinct.

313 tests réussis avec maxWorkers=4/minWorkers=1, après un dépassement du délai de 5 s dans signoffEvidence lors du premier passage parallèle (délai inchangé). Les deux nouveaux tests sont dans server/, conformément à la découverte Vitest. TypeScript/build réussis ; pas de recette navigateur. Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Dernière recette Docker complète au lot 135.

## Lectures documentaires et archives du coffre (lot 139)

Les onglets documentaires attendent une première lecture réussie avant de montrer leurs listes et formulaires. Chargement et erreur proposent un état explicite ; archives et conformité restent des onglets indépendants. Après une lecture réussie, une erreur d’actualisation conserve les composants montés, avec un avertissement indiquant que les documents affichés proviennent de la dernière lecture réussie. Cela évite de démonter un formulaire en cours à cause d’une erreur de rafraîchissement. Ce n’est pas une conservation de brouillon après changement d’onglet ou fermeture.

Archives et historique ont chacun chargement, erreur et reprise. Leur liste en cache est masquée en cas d’erreur, leur absence n’est affichée qu’après réussite. L’historique vide est explicite. Messages FR/EN/AR, boutons désactivés pendant leur requête et aucun message technique brut. Les règles de téléchargement privé restent inchangées.

TypeScript/build réussis ; dernier ensemble métier au lot 138 : 313 tests. Aucun nouveau test DOM/navigateur, aucune mutation réelle de document. Pas de règle serveur, migration ou dépendance modifiée.

Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes. Dernière recette Docker complète au lot 135 ; avertissement de taille Vite persistant.

## Préparation des fichiers du coffre (lot 140)

Les deux formulaires d’ajout (documents et qualifications) partagent un verrou local immédiat couvrant la lecture FileReader puis la mutation. Le formulaire et la fermeture du dialogue sont bloqués pendant cette opération. Un échec ou abandon de lecture locale affiche une erreur FR/EN/AR ; aucune mutation n’est alors lancée et les valeurs restent disponibles. La fin de lecture après démontage du composant ne lance pas l’envoi. Une requête déjà envoyée n’est pas annulée par ce mécanisme.

Les erreurs serveur/réseau restent signalées par la mutation existante et le verrou est libéré à la fin, succès ou erreur. Ce verrou limite les soumissions concurrentes dans le composant monté ; il ne constitue pas une idempotence serveur après perte de réponse, nouvelle tentative ou plusieurs onglets. Les limites de formats/taille et les contrôles de contenu serveur restent inchangés.

TypeScript/build réussis. Pas de test DOM/navigateur du FileReader, fermeture ou double clic ; aucun document réel ajouté. Dernière suite métier complète lot 138 : 313 tests. Pas de changement serveur, migration ou dépendance.

Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes. Dernière recette Docker complète au lot 135 ; avertissement de taille Vite persistant.

## Échéances documentaires des qualifications (lot 141)

Le badge « Valide » de la liste des pièces de qualification est remplacé par un état limité aux documents : aucun document, au moins un document à date future, échéance inconnue, ou toutes les échéances dépassées. Une date absente/invalide ne constitue plus une validité implicite. La borne exacte de l’échéance est classée expirée ; un document futur prime sur les autres pièces, sinon une date inconnue reste visible plutôt qu’une conclusion d’expiration de tout le dossier.

Le texte FR/EN/AR précise que les dates sont celles saisies et que le dépôt ne valide pas la qualification. Le libellé d’absence de date ne suggère plus une dispense de renouvellement. Le calcul utilise l’heure du navigateur au rendu, sans audit réglementaire ou vérification d’authenticité du document. Les décisions du dossier de conformité restent distinctes.

Deux tests purs couvrent absence, date invalide/manquante, borne exacte, date future et dossiers mixtes. Aucun document ou dossier réel modifié ; pas de recette navigateur.

315 tests réussis avec quatre workers, TypeScript/build réussis. Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 135.

## Brouillons de profil et qualifications (lot 142)

Les formulaires de poste/description et licence/qualifications ne recopient plus le compte chargé lorsqu’une saisie locale a commencé. Les actualisations du compte conservent donc ce brouillon. Pendant la sauvegarde, les champs sont désactivés ; un succès autorise à nouveau la synchronisation avec le compte chargé, tandis qu’une erreur conserve la saisie.

Les onglets du coffre sont remontés lorsque l’identifiant de compte change, réinitialisant les états locaux. Ce n’est pas une garantie de persistance après fermeture/changement d’onglet, ni une gestion des conflits de modifications entre plusieurs appareils. Les règles d’autorisation et le cache de requêtes restent distincts de cette gestion du formulaire.

TypeScript/build réussis. Pas de recette DOM/navigateur de frappe, sauvegarde ou changement de compte. Dernière suite métier complète lot 141 : 315 tests. Aucun profil réel modifié ; pas de migration/dépendance/règle serveur modifiée.

Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 135.

## Cache lors des transitions de connexion (lot 143)

Une connexion réussie (mot de passe ou second facteur) et une inscription réussie annulent les lectures en cours, vident les caches de requêtes/mutations, puis installent le nouveau compte avant navigation. Les données du coffre, des tableaux de bord et les variables de mutations précédentes ne restent donc plus simplement dans le cache commun entre ces transitions explicites.

La déconnexion réussie, ou une réponse indiquant que la session est déjà absente, effectue la même purge avant d’installer auth.me=null. Une erreur réseau/serveur ne simule plus une déconnexion dans finally ; le menu affiche une erreur FR/EN/AR invitant à réessayer. Le bouton est désactivé pendant l’opération.

Le test avec QueryClient réel vérifie la suppression de données privées et de variables de mutation, ainsi qu’une ancienne lecture qui se termine après annulation sans restaurer les données supprimées. Cela ne révoque pas les requêtes de mutation déjà envoyées, les fichiers téléchargés, les états d’autres onglets/appareils ou les sessions fournisseur. La synchronisation des changements de compte entre onglets reste à traiter séparément. Pas de recette navigateur des transitions.

316 tests réussis avec quatre workers, TypeScript/build réussis. Pas de recette DOM/navigateur ni déconnexion réelle d’utilisateur. Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Dernière recette Docker complète au lot 135.

## Changement de session entre onglets (lot 144)

Après connexion/2FA/inscription ou déconnexion confirmée, l’onglet annonce un changement via BroadcastChannel et un événement de stockage en repli. Le signal contient uniquement son type et un identifiant aléatoire d’onglet, ou un nonce aléatoire dans localStorage ; aucune identité, mot de passe ou donnée de session. Un onglet ignore son propre signal de canal. Les réceptions répétées ne déclenchent qu’une transition.

L’onglet destinataire démonte l’application, annule les lectures et purge ses caches, puis recharge l’adresse courante. Le démontage retire les formulaires et lance les nettoyages existants de vidéo/examen. Les brouillons non enregistrés de cet onglet sont abandonnés : il ne doit pas continuer à travailler avec une session devenue différente. Une mutation déjà envoyée n’est pas annulée.

Cette coordination porte sur une même origine et les onglets chargés avec ce code. Des pages ouvertes avant la mise à jour doivent être rechargées pour en bénéficier. Si canaux et stockage sont tous deux bloqués, une authentification réussie n’est pas transformée en erreur, mais aucun signal ne peut être envoyé. Les autres navigateurs/appareils, une expiration serveur et les sessions fournisseur ne sont pas couverts.

Tests avec surfaces navigateur simulées : canal du même onglet ignoré, autre onglet reçu, repli stockage, événement étranger/suppression ignoré, répétitions et nettoyage, échec des deux moyens sans exception. Pas de recette multi-onglets dans un navigateur réel.

319 tests réussis avec quatre workers, TypeScript/build réussis. Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Dernière recette Docker complète au lot 135. Aucun changement de session réel déclenché par les vérifications HTTP.

## Révocation, fermeture et récupération de compte (lot 145)

La révocation de toutes les sessions et la fermeture du compte vident les mots de passe saisis, annulent les lectures, purgent les caches et installent un compte local absent avant la navigation existante. Les autres onglets de la même origine sont prévenus. La fermeture ne laisse plus son ancien dossier affiché pendant un délai de 800 ms avant navigation.

La réinitialisation de mot de passe confirmée vide les champs, purge les caches et prévient les autres onglets ; l’écran de réussite mène ensuite à une navigation complète vers la connexion. Cette opération ne prétend pas fermer une éventuelle session distincte d’un autre compte : les sessions réellement révoquées restent déterminées par le serveur. Le changement confirmé du double facteur annonce aussi la transition, puis actualise le compte courant dont le serveur vient de renouveler le cookie.

Aucun signal n’est émis sur les erreurs ou lors d’une simple demande de code/lien email. Ces changements raccordent les opérations existantes au mécanisme des lots 143–144 ; ils ne modifient pas les règles de révocation, conservation des données ou vérification du mot de passe. Les onglets destinataires abandonnent leurs brouillons non enregistrés comme décrit au lot 144.

TypeScript/build réussis. Dernière suite complète au lot 144 : 319 tests. Pas de mot de passe réel changé, de compte fermé, de session révoquée ni de code/email envoyé ; pas de recette navigateur.

Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Dernière recette Docker complète au lot 135. Aucun changement de session réel déclenché par la vérification HTTP.

## Libellés des champs du coffre (lot 146)

Les champs réutilisables du coffre, la description, la liste de qualifications, les fichiers et le type de document disposent d’identifiants React useId reliés à leurs libellés. Les textes de formats et d’aide sont référencés par aria-describedby sur chaque sélecteur de fichier. Les boutons retirant une qualification annoncent son nom et l’action en FR/EN/AR au lieu du libellé générique anglais « remove ».

Les règles de saisie, dépôt et sauvegarde sont inchangées. TypeScript/build réussis et références vérifiées dans le code ; cela ne remplace pas une recette au clavier et avec lecteur d’écran, non réalisée ici. Dernière suite complète lot 144 : 319 tests. Aucun document réel modifié.

Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 135.

## Cache HTTP de l’API (lot 147)

Les réponses /api/trpc portent Cache-Control: private, no-store. Le middleware est installé avant le parseur de corps, pour couvrir aussi ses erreurs. La politique s’applique à toute l’API, y compris les lots mêlant données publiques et compte privé, sans modifier la mise en cache des ressources statiques. Les fichiers privés avaient déjà leur propre règle private, no-store.

Deux tests HTTP avec Express et l’adaptateur tRPC réel vérifient lecture privée, lot public/privé, refus 401, JSON invalide 400 et absence de modification de la réponse statique. Les routes de ces tests utilisent uniquement des fixtures, sans compte réel. Cette règle HTTP ne purge pas les téléchargements ou copies déjà conservés ; les caches applicatifs et transitions de session restent couverts séparément par les lots précédents.

321 tests réussis avec quatre workers, TypeScript/build réussis. Recette Docker complète réussie avec sauvegarde/restauration. Aperçu local remplacé avec volumes conservés ; index via Tailscale, session antérieure et lectures inscriptions/certificats vérifiés après redémarrage. En-tête private, no-store confirmé sur les trois routes API via Tailscale. Pas de recette navigateur.

## Compte actif exigé dans le service du coffre (lot 148)

Les lectures personnelles de documents/archives/historique vérifient le statut courant du compte. Le dépôt et l’archivage verrouillent le compte en partage dans leur transaction puis refusent un propriétaire inactif. Le dépôt écrit le fichier seulement après cette vérification. Le partage vérifie aussi le statut sous son verrou utilisateur existant, y compris pour une reprise sans changement de valeur.

Les mutations se coordonnent ainsi avec une suspension qui met à jour la ligne utilisateur : soit l’opération obtient son verrou sur un compte actif et termine avant la suspension, soit elle observe le statut suspendu et refuse. Les lectures ordinaires ne forment pas un instantané transactionnel unique. Le stockage externe n’est pas transactionnel avec PostgreSQL ; une erreur SQL après écriture peut toujours laisser un fichier orphelin. L’idempotence persistante de dépôt après perte d’accusé reste à ajouter.

Le test PostgreSQL suspend une fixture et vérifie le refus des trois lectures, du dépôt, de l’archivage et des deux valeurs de partage ; aucune écriture au stockage, document/historique/consentement préservés. Aucun compte réel suspendu ni fichier réel ajouté.

322 tests réussis avec quatre workers, TypeScript/build réussis. Recette Docker complète réussie avec sauvegarde/restauration. Aperçu remplacé avec volumes conservés ; index Tailscale, session antérieure et lectures documents/archives/historique du coffre vérifiés après redémarrage, en-tête no-store confirmé. Pas de recette navigateur ni mutation réelle de document.

## Reprise des dépôts du coffre (lot 149)

Migration additive : UUID nullable et index unique propriétaire/demande, protégés par l’immutabilité existante du document. Les clients anciens sans UUID restent compatibles, sans dédoublonnage de leurs reprises. Le serveur vérifie le compte actif puis sérialise la demande avant toute écriture au stockage. Une demande déjà enregistrée retrouve le document seulement si type, titre normalisé, émetteur, référence, pays, dates, nom/type/taille du fichier et SHA-256 correspondent. Une réutilisation différente est refusée.

Les formulaires conservent l’identifiant en mémoire avec la signature exacte de leur charge utile après une erreur ; ils le réutilisent si l’envoi est inchangé. Une réussite libère la demande. Recharger la page ou démonter le formulaire perd cette information ; le fichier/signature peuvent rester en mémoire pendant une reprise, dans la limite de taille existante. Aucune persistance locale de fichier n’est ajoutée.

Une reprise après archivage retourne le document archivé sans le réactiver ni ajouter un événement de dépôt ; le formulaire signale qu’il est déjà dans les archives. Le même UUID d’un autre propriétaire est une demande distincte. Le test PostgreSQL couvre trois reprises concurrentes, UUID en majuscules, écriture fichier/événement unique, conflits de contenu/métadonnées, propriétaires distincts, archivage, immutabilité et suspension.

323 tests réussis, TypeScript/build réussis. Pas de recette navigateur ou dépôt réel. La transaction fichier/SQL n’est pas distribuée : un fichier orphelin après échec SQL reste possible. Cette protection remplace la limite d’absence d’idempotence des lots 140/148 pour les envois portant un UUID.

Recette Docker complète réussie avec sauvegarde/restauration. Migration appliquée à l’aperçu lors de son remplacement avec volumes conservés ; index Tailscale, session antérieure et lectures documents/archives/historique vérifiés après redémarrage. En-tête no-store confirmé. Aucun document réel déposé.

## Dépôt non confirmé visible dans le formulaire (lot 150)

Les deux formulaires affichent une erreur persistante lorsque la mutation échoue, en plus du détail fourni par le toast. Le texte FR/EN/AR explique qu’un fichier et des champs inchangés reprennent la même demande, et invite à consulter le coffre avant de modifier l’envoi. Documents, archives et historique sont actualisés après erreur pour retrouver un éventuel dépôt enregistré dont la réponse a été perdue. Aucune nouvelle mutation n’est lancée automatiquement.

Les messages sont réinitialisés à l’ouverture d’un nouveau formulaire et lors d’une nouvelle tentative. L’erreur de lecture précise désormais « pour cette tentative », sans prétendre qu’un dépôt précédent n’a jamais été enregistré. La clé de reprise conserve les limites du lot 149 : mémoire du composant, sans persistance après démontage/recharge.

TypeScript/build réussis ; dernière suite métier complète au lot 149 : 323 tests. Pas de recette navigateur, de panne réseau simulée dans le navigateur ni de dépôt réel. Aucun changement serveur/migration/dépendance.

Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 149.

## Navigation dans l’historique du coffre (lot 151)

Une nouvelle lecture historyPage fournit 100 événements maximum et un curseur lorsque des événements plus anciens existent. Elle filtre toujours le propriétaire actif et utilise l’identifiant décroissant, avec une borne strictement inférieure pour la page suivante. L’ancienne route history conserve sa réponse tableau des 100 dernières actions pour les pages anciennes. L’index propriétaire/identifiant existant est réutilisé.

L’interface propose « Actions plus anciennes » et un retour aux dernières actions, avec libellés FR/EN/AR. Navigation bloquée pendant la lecture ; erreur/reprise restent propres à la page. Les mutations de document actualisent les deux routes d’historique. Les pages ne sont pas un instantané transactionnel global ; une action récente nécessite un retour aux dernières actions.

Le test PostgreSQL parcourt 206 événements propres sur trois pages, ajoute un événement après la première lecture, vérifie l’ordre sans doublon, l’absence d’événement étranger, la compatibilité de l’ancienne route, le curseur invalide et le refus après suspension. Aucun événement réel créé et pas de recette navigateur.

324 tests réussis avec quatre workers, TypeScript/build réussis. Recette Docker complète réussie avec sauvegarde/restauration. Aperçu remplacé avec volumes conservés ; index Tailscale, session antérieure, ancienne route history et nouvelle route historyPage vérifiés après redémarrage. En-tête no-store confirmé ; aucune action réelle ajoutée à l’historique.

## Brouillons du centre KYC/KYB (lot 152)

Une actualisation du même dossier encore éditable ne remplace plus des champs localement modifiés. Les boutons d’envoi pour examen sont bloqués tant que ces modifications ne sont pas enregistrées, avec explication FR/EN/AR. La sauvegarde réussie remet la synchronisation en service. Un dossier dont le statut serveur est devenu verrouillé retrouve les valeurs serveur.

Le passage à un autre dossier, à un nouveau dossier ou à la file administrateur demande confirmation si le brouillon contient des modifications. Les sélections et principales actions documentaires sont bloquées pendant une mutation/lecture de fichier. Le motif de revue est vidé au changement de dossier et bloqué pendant la décision, pour éviter de transporter le motif d’un autre dossier ou de l’effacer pendant une saisie concurrente.

Le garde-fou concerne les boutons de cette page ; il ne conserve pas les brouillons après fermeture/navigation externe et ne résout pas les conflits d’édition entre appareils. Aucun changement de règle d’approbation ou de contrôle serveur. Pas de recette navigateur des transitions ni de dossier réel modifié.

TypeScript/build réussis ; dernière suite complète lot 151 : 324 tests. Pas de recette DOM/navigateur ni dossier KYC/KYB réel modifié. Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Dernière recette Docker complète au lot 151.

## Reprise de lecture du centre KYC/KYB (lot 153)

Les listes personnelle/administrateur et le détail disposent d’un message FR/EN/AR et d’une reprise de leur lecture ; leurs données en cache sont masquées en cas d’erreur. Une liste vide est indiquée uniquement après réussite. Les erreurs techniques brutes ne servent plus de message de lecture.

La création d’un KYB attend la lecture des organisations et bloque sauvegarde/sélection en cas d’indisponibilité. L’absence de rôle MANAGER actif est expliquée. Pour un dossier KYB existant, notamment en revue administrateur sans affiliation, l’organisation immuable reste identifiable par son numéro et le nom légal du dossier au lieu d’un sélecteur visuellement vide.

Une frontière React compte/rôle réinitialise l’espace et sa file sélectionnée lors de ces changements. Les contrôles serveur restent requis ; ce changement ne révoque pas à lui seul une session. TypeScript/build réussis, sans recette navigateur de changement de compte/rôle ou erreur réseau. Dernière suite complète lot 151 : 324 tests. Aucun dossier réel modifié.

Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 151.

## Lecture et envoi de justificatif KYC/KYB (lot 154)

Le dépôt distingue fichier vide/trop grand, format déclaré non accepté, échec de lecture locale et envoi non confirmé, avec texte FR/EN/AR persistant. Il valide PDF/JPEG/PNG côté interface sans cast trompeur en PDF ; les signatures de contenu restent contrôlées par le serveur. Un état de progression couvre lecture et mutation.

Un verrou immédiat empêche des préparations simultanées dans l’instance. Le FileReader actif est abandonné au démontage et sa fin ne lance pas de mutation après départ de l’espace. Une mutation déjà envoyée n’est pas annulée. En cas d’erreur de mutation, les listes/détails sont actualisés et le message invite à vérifier les pièces avant renvoi ; ce dépôt KYC/KYB n’a pas encore l’idempotence UUID du coffre.

TypeScript/build réussis. Pas de recette FileReader/navigateur, panne réseau réelle ou document réel ajouté. Dernière suite complète lot 151 : 324 tests. Aucun changement serveur/migration/dépendance.

Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 151.

## Droits KYC/KYB rechargés au service (lot 155)

Les fonctions du service et les listes rechargent le rôle/statut du compte en base. Un ancien objet acteur actif ou administrateur ne conserve donc pas ces droits après suspension ou rétrogradation. Les règles existantes d’affiliation responsable et d’indépendance de revue restent appliquées. Le contexte HTTP rechargeait déjà les utilisateurs ; ce changement renforce aussi les appels internes du service.

Un test PostgreSQL vérifie un rôle administrateur falsifié, la suspension du propriétaire sur les opérations personnelles et la rétrogradation du relecteur sur les opérations administrateur. Les pièces ne sont pas archivées et la décision reste en attente lors des refus. 325 tests réussis avec quatre workers, build réussi. Ces lectures de droits ne constituent pas un verrou transactionnel du compte : une révocation concurrente à une opération déjà autorisée n’est pas sérialisée par ce lot.

Aucun dossier réel modifié et pas de recette navigateur. Aucun changement de schéma ou de dépendance. 

TypeScript confirmé, recette Docker complète réussie avec sauvegarde/restauration. Aperçu remplacé avec volumes conservés ; index Tailscale identique au build, session antérieure conservée et lectures auth.me/verification.mine/verification.queue vérifiées avec en-tête private, no-store. Aucun dossier réel modifié.

## Reprise des justificatifs KYC/KYB (lot 156)

Chaque nouvelle interface attribue un UUID au dépôt et le réutilise après erreur pour une charge utile identique. Le serveur sérialise la demande par déposant et compare le dossier, la nature, le nom, le format et l’empreinte SHA-256 du contenu avant de retrouver une pièce existante. Un UUID réutilisé avec un autre dépôt produit un conflit. Les droits actuels sont vérifiés avant toute reprise ; un compte suspendu ou un responsable dont l’affiliation a été retirée ne retrouve pas la pièce par ce mécanisme.

Une reprise réussie n’ajoute ni fichier ni événement, y compris après soumission du dossier ou archivage de la pièce. L’archive reste fermée et l’interface le précise. Le schéma protège désormais les pièces contre modification et suppression, tout en permettant leur premier archivage. La migration conserve les pièces existantes avec UUID/empreinte nuls ; les clients anciens omettant l’UUID restent compatibles sans dédoublonnage.

La reprise du navigateur reste en mémoire dans le dossier ouvert et disparaît après changement de dossier, démontage ou recharge. Une réussite ou une charge utile différente génère ensuite un nouvel UUID. La nature de la pièce n’est plus réinitialisée lors d’une actualisation du même dossier. Aucun renvoi automatique. Le stockage fichier reste non transactionnel avec PostgreSQL : une erreur SQL après écriture peut laisser un fichier orphelin.

327 tests réussis, TypeScript/build réussis. Tests PostgreSQL de concurrence et d’isolation avec fichiers synthétiques ; pas de justificatif réel ni recette navigateur. Assertion d’immutabilité renforcée avant archivage et recette Docker réussie.

Recette ciblée renforcée réussie (11 tests KYC/KYB), recette Docker complète réussie avec sauvegarde/restauration. Aperçu remplacé avec volumes conservés et migration additive appliquée ; index Tailscale identique au build, session antérieure et lectures auth.me/verification.mine/verification.queue vérifiés avec private, no-store. Aucun justificatif réel déposé.

## File de revue administrateur complète (lot 157)

L’interface utilise une nouvelle route paginée, remplaçant sa lecture limitée à 200 dossiers. La navigation propose 50 dossiers à la fois, du plus récemment créé au plus ancien, et un filtre par statut. Les dossiers en attente de revue sont affichés par défaut ; « Tous les statuts » conserve l’accès aux brouillons et dossiers déjà traités. Un bouton revient aux derniers dossiers et permet leur actualisation.

Le curseur utilise l’identifiant immuable du dossier : une nouvelle arrivée ne décale pas les pages suivantes. La navigation n’est pas un instantané global, et les transitions de statut modifient les résultats du filtre. La liste n’expose que les quatre champs affichés ; adresse, motif et pièces restent dans le détail autorisé. Le rôle administrateur et le statut actif sont contrôlés à chaque page.

L’ancienne route queue conserve son tableau limité pour compatibilité ; les mutations actualisent aussi la nouvelle route. Une migration ajoute l’index statut/id, sans modifier les dossiers. Test PostgreSQL avec 205 dossiers synthétiques et une arrivée supplémentaire, filtres, parcours sans doublon, retour aux derniers, curseur invalide, rôle retiré et suspension. 328 tests réussis, TypeScript/build réussis. Pas de dossier réel modifié ni recette navigateur. Recette Docker réussie.

Recette Docker complète réussie avec sauvegarde/restauration. Aperçu remplacé avec volumes conservés et migration d’index appliquée ; index Tailscale identique au build, session antérieure, ancienne queue et nouvelle queuePage (tous statuts/attente) vérifiés en lecture avec private, no-store. Aucun dossier réel modifié.

## Diapositives rattachables sans objectif Part-66 (lot 158)

Dans l’éditeur de diapositive, le choix du chapitre apparaît désormais même lorsque la formation ne contient aucun objectif Part-66. Auparavant, le chapitre était inclus dans le bloc conditionnel des objectifs : l’auteur ne pouvait pas effectuer cette affectation depuis l’éditeur pour ces formations. L’objectif reste un champ séparé et facultatif.

Les deux listes indiquent leur chargement et disposent d’une reprise après erreur. Leur indisponibilité ne vide pas les identifiants déjà sélectionnés ; une option de remplacement les identifie si nécessaire. Une liste de chapitres effectivement vide explique qu’il faut créer un chapitre dans la structure, puis rouvrir la diapositive. Tous ces messages sont traduits en FR/EN/AR.

TypeScript/build réussis. Contrôle des locales et actualisation de l’interface réussis. Aucun changement serveur/migration/dépendance, dernière suite complète lot 157 : 328 tests. Pas de recette navigateur ni formation réelle modifiée.

Les trois tests de locales réussissent. Image locale reconstruite et assets actualisés sans redémarrage ; index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 157.

## Propositions IA de diapositive (lot 159)

Le texte, l’image, la voix et le QCM générés apparaissent dans une proposition distincte. L’auteur peut continuer à saisir son contenu pendant l’attente ; la réponse ne remplace plus cette saisie. Après relecture du texte, de l’image, de l’audio ou du QCM avec corrigé, il choisit d’appliquer les champs proposés au brouillon ou d’écarter la proposition. La diapositive doit ensuite être enregistrée.

La sauvegarde attend la fin de génération et la résolution de la proposition. Un verrou immédiat évite de lancer plusieurs générations ou une sauvegarde concurrente dans cette instance. Pendant la sauvegarde, les champs et la fermeture sont bloqués. Une réponse après démontage n’actualise plus l’interface ; l’éditeur est réinitialisé si son identifiant de diapositive change.

Ces propositions ne persistent pas après fermeture. Aucune annulation de demande fournisseur déjà envoyée n’est revendiquée. Les imports de fichiers privés et les jobs vidéo ont leurs flux distincts. TypeScript/build et trois tests de locales réussis ; pas d’appel IA réel ni recette navigateur. Aucun changement serveur/migration/dépendance ; dernière suite complète lot 157 : 328 tests. Actualisation locale réussie.

Image locale reconstruite et assets actualisés sans redémarrage ; index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 157.

## Imports privés après fermeture de l’éditeur (lot 160)

L’import partagé image/audio/vidéo/PDF abandonne désormais son FileReader au démontage. Une lecture terminée après départ ne déclenche pas de requête et une réponse d’import reçue après démontage ne modifie pas le brouillon. Le composant se réinitialise par formation et nature de média ; l’éditeur de chapitre se réinitialise par formation/chapitre.

Un verrou immédiat empêche deux préparations simultanées dans le même import. Les messages persistants distinguent fichier vide/trop grand/format refusé, lecture impossible et import non confirmé. Les formats acceptés sont affichés. Un import non confirmé peut déjà avoir créé un fichier côté serveur ; une nouvelle tentative peut créer une copie. Aucun renvoi automatique ni idempotence n’est ajouté dans ce lot.

Une requête déjà envoyée continue côté serveur. La coordination entre un import en cours et l’enregistrement du contenu dans son éditeur reste distincte. Aucun fichier réel importé et pas de recette navigateur. Aucun changement serveur/migration/dépendance. Revalidation finale et actualisation locale réussies ; dernière suite complète lot 157 : 328 tests.

TypeScript et build finaux réussis. Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 157.

## Lecture et préparation de publication dans le studio (lot 161)

Les espaces auteur, formations, versions, revues en attente et diapositives disposent de reprises de lecture explicites. Le chargement n’est plus présenté comme une liste de diapositives vide. Les listes en erreur sont masquées ; si le cours est déjà chargé, sa surface reste montée avec un avertissement sur la dernière lecture pour préserver les sous-éditeurs ouverts.

Le contrôle de préparation ne conserve pas un ancien résultat « prêt » après une erreur ou pendant une actualisation. La publication initiale et celle d’une nouvelle version attendent un résultat disponible et prêt ; le retrait de publication reste indépendant de ce contrôle. Cela ne remplace pas la revue pédagogique indépendante et les vérifications serveur existantes.

La prévisualisation et l’ajout de diapositives attendent une lecture disponible, le réordonnancement attend la fin de sa mutation, et les erreurs d’ajout/ordre sont signalées. Messages FR/EN/AR. TypeScript/build et trois tests de locales réussis ; dernière suite complète lot 157 : 328 tests. Aucun changement serveur/migration/dépendance, pas de publication réelle ou de recette navigateur. Actualisation locale réussie.

Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 157.

## Attendre l’import avant la sauvegarde (lot 162)

Les éditeurs de chapitre et de diapositive attendent désormais la fin d’un import avant d’autoriser la sauvegarde. Leurs champs sont bloqués pendant lecture/envoi pour que le résultat ne remplace pas une modification concurrente. Un second import dans cet éditeur attend également. Le message d’attente est disponible en FR/EN/AR.

L’éditeur de diapositive coordonne aussi les imports avec ses générations IA immédiates et la résolution de leurs propositions. L’éditeur de chapitre bloque les sauvegardes répétées, protège ses champs pendant mutation et ignore les callbacks après démontage. La fermeture reste autorisée pendant import ; la garde de résultat du lot 160 reste appliquée.

La libération de l’état d’import n’a lieu qu’une fois, y compris lors d’une fermeture suivie d’une réponse tardive. Les requêtes serveur et jobs vidéo déjà lancés ne sont pas annulés. Pas de fichier réel importé ou de recette navigateur. TypeScript/build et trois tests de locales réussis ; aucun changement serveur/migration/dépendance. Dernière suite complète lot 157 : 328 tests. Actualisation locale réussie.

Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 157.

## Parcours compagnie vers réussite des examens (lot 163)

Un scénario intégré supplémentaire couvre une formation interne sans objectifs Part-66, avec deux chapitres et leurs diapositives, QCM par chapitre et QCM final. Il effectue création de contenu, demande de revue, décision indépendante, publication et attribution via les routes métier tRPC sur PostgreSQL isolé.

Le scénario refuse publication prématurée, auto-revue et attribution comportant une personne étrangère à la compagnie, sans inscription partielle. L’attribution répétée conserve une seule inscription. L’apprenant consulte la version publiée sans corrigé de session ; le final reste inaccessible avant les deux QCM de chapitre. Une réussite finale répétée conserve un seul résultat et l’inscription terminée.

11 tests studio ciblés et TypeScript réussis, suite complète réussie : 329 tests avec quatre workers. Comptes/cours de fixture synthétiques, aucun contenu réel modifié ou fournisseur appelé. Ce contrôle n’exécute pas le navigateur, la couche HTTP ou l’émission de certificat PDF. CUA ne fournit aucune surface navigateur ; sélection de Chrome échoue cgWindowNotFound. Aucun changement applicatif à livrer : aperçu inchangé au lot 162.

Aucune reconstruction ou relance de l’aperçu nécessaire pour ce lot de tests ; code applicatif et données de prévisualisation inchangés.

## Sélection des salariés et attribution confirmée (lot 164)

Le formulaire d’attribution bloque la sélection pendant l’envoi et limite le lot à 100 personnes comme l’API. Un compteur rend cette limite visible. La lecture des candidats dispose d’une actualisation et d’un message d’erreur ; l’attribution attend sa disponibilité.

Si des personnes sélectionnées ne figurent plus dans la liste actualisée, leur nombre est signalé et une action permet de les retirer. Aucun retrait automatique de la sélection. Le formulaire rappelle la publication préalable si la formation ne possède pas de version publiée.

Le nombre d’accès créés/existants reste visible après réussite. Une erreur conserve la sélection et actualise les candidats, avec message de non-confirmation et reprise manuelle. La règle serveur existante conserve les inscriptions encore valides lors d’une nouvelle attribution. Pas de nouvelle idempotence ou annulation serveur revendiquée.

TypeScript/build initiaux et tests de locales réussis ; revalidation finale des libellés et actualisation locale réussies. Aucun changement serveur/migration/dépendance ou attribution réelle. Pas de recette navigateur, dernière suite complète lot 163 : 329 tests.

Build final et trois tests de locales réussis. Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 157.

## Quitter un éditeur pédagogique avec un brouillon (lot 165)

Les éditeurs de chapitre et de diapositive comparent le formulaire à son état d’ouverture. Une fermeture par les commandes du dialogue demande confirmation si le formulaire a changé, si une proposition IA reste à résoudre ou si une opération est en cours. Une sauvegarde en cours reste non fermable ; la fermeture après sauvegarde réussie reste normale.

Un écouteur beforeunload demande également l’avertissement natif du navigateur lors d’un rechargement ou de la fermeture de l’onglet, uniquement tant que cet état existe. Le message du dialogue distingue une opération en cours, qui peut continuer sur le serveur après départ. Les textes sont disponibles en FR/EN/AR.

Ce dispositif ne conserve pas les brouillons après départ, ne bloque pas toutes les navigations internes SPA et ne garantit pas l’avertissement en cas de fermeture forcée ou selon les restrictions du navigateur/mobile. Aucun comportement navigateur réellement recetté. TypeScript/build et trois tests de locales réussis, dernière suite complète lot 163 : 329 tests. Aucun changement serveur/migration/dépendance. Actualisation locale réussie.

Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 157.

## Commandes identifiables du studio (lot 166)

Les commandes de déplacement, modification et archivage d’une diapositive ont un nom accessible incluant son titre ou son numéro. Les commandes de retrait d’option et d’interaction vidéo sont numérotées. Les boutons de sélection des bonnes réponses, dans les mini-QCM et QCM vidéo, exposent leur état aria-pressed ; leur couleur n’est plus le seul indicateur. Libellés FR/EN/AR.

La vignette décorative de la liste possède un alt vide, son titre restant présent à côté. Aucun changement visuel majeur ou de règle QCM. TypeScript/build et trois tests de locales réussis ; pas de recette clavier/lecteur d’écran/navigateur et aucune conformité d’accessibilité globale revendiquée. Dernière suite complète lot 163 : 329 tests. Aucun changement serveur/migration/dépendance. Actualisation locale réussie.

Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 157.

## Taille limite et fichier refusé par le serveur (lot 167)

Les limites inspectées sont cohérentes : 25 MiB de fichier importé, encodé en base64 dans une requête sous la limite JSON HTTP de 50 MiB. Les erreurs connues de taille, encodage et signature de fichier importé renvoient désormais BAD_REQUEST ; une erreur de contenu généré reste une erreur serveur. L’interface distingue ce rejet d’un envoi non confirmé.

Un test PostgreSQL passant par le caller tRPC accepte une charge synthétique de exactement 25 MiB à en-tête PDF, puis refuse un octet supplémentaire. Les deux tailles produisent la même longueur base64, ce qui vérifie aussi la limite sur les octets décodés. Encodage et signatures invalides sont refusés avant écriture : une seule invocation du stockage simulé et une seule ligne média. Aucun fichier réel écrit par ce test, pas de validation complète PDF, ni de recette HTTP/navigateur à cette taille.

330 tests réussis et TypeScript/build initiaux réussis. Complément interface suivi de revalidation et recette Docker réussies. Aucune migration ou dépendance ajoutée.

TypeScript/build finaux réussis et recette Docker complète réussie avec sauvegarde/restauration. Aperçu remplacé avec volumes conservés ; index Tailscale identique au build, session antérieure et lectures auth.me/maker.courses vérifiés. Import mal encodé refusé via HTTP 400/BAD_REQUEST et no-store avant stockage ; aucun média réel déposé. Le contrôle HTTP ne couvre pas la charge maximale de 25 MiB.

## Corrigés liés aux bonnes options (lot 168)

L’éditeur de questions refusait certains corrigés invalides mais retirait silencieusement les options vides, ce qui pouvait déplacer un indice valide sur une autre réponse. Il exige désormais de compléter chaque option ou de la retirer explicitement. Les indices sont conservés ; une réponse unique est exigée pour QCU/vrai-faux et les appariements doivent couvrir chaque élément gauche une fois.

Quand l’auteur retire volontairement un élément d’appariement, les paires concernant cet élément sont retirées et les indices suivants recalculés pour garder les autres associations. Les textes vrai/faux existants ne sont plus remplacés en français à l’ouverture ; ils sont éditables, avec valeurs traduites proposées seulement lors d’un changement volontaire vers ce type.

Quatre tests vérifient notamment les associations par les textes des éléments avant/après suppression, ainsi que l’absence de mutation du brouillon par la préparation. 334 tests réussis, TypeScript/build réussis. Aucune question réelle ou version publiée modifiée, aucune migration/dépendance/règle serveur changée. Pas de recette navigateur ; actualisation locale réussie.

Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 167.

## Réponses libres publiables (lot 169)

L’éditeur n’invite plus à saisir une expression régulière pour une nouvelle question : cette option était incompatible avec le contrôle de publication existant. Il exige des mots-clés ou expressions alternatives et décrit la règle de correction déjà utilisée : au moins une alternative présente dans la réponse, sans distinction de casse ou d’accents.

Une ancienne regex reste affichée. L’auteur doit fournir des alternatives et confirmer explicitement son remplacement lors de l’enregistrement. Aucun changement automatique des questions ou versions existantes. Le formulaire se réinitialise par formation/question pour ne pas transférer cette confirmation entre deux questions.

Le test PostgreSQL vérifie qu’une règle avec regex bloque la demande de revue, que la conversion en mots-clés rend le contenu prêt et que le snapshot de revue conserve la nouvelle règle. Il vérifie aussi la correction par chacune des alternatives et le rejet d’une réponse ne les contenant pas. 335 tests réussis, TypeScript/build réussis. Pas de recette navigateur, de question réelle modifiée ou de règle serveur changée. Aucune migration/dépendance. Actualisation locale réussie.

Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 167.

## Sauvegarde et abandon d’une question (lot 170)

L’éditeur de questions bloque les champs et sa fermeture pendant la sauvegarde, avec verrou immédiat contre double envoi. Une erreur garde le brouillon ouvert, actualise la banque et affiche une non-confirmation persistante. Une réponse tardive après démontage ne ferme pas un autre éditeur.

La garde d’abandon compare tous les champs à leur état initial, y compris les paires d’appariement et la confirmation de remplacement d’une ancienne regex. Fermeture explicite et avertissement beforeunload suivent le dispositif des chapitres/diapositives ; il n’y a ni persistance du brouillon ni protection globale de navigation SPA.

Les créations ne disposent pas encore d’idempotence UUID : le message invite à vérifier la banque actualisée avant une nouvelle tentative, car la première peut déjà avoir été enregistrée. Aucun renvoi automatique. TypeScript/build initiaux et trois tests de locales réussis ; revalidation finale et actualisation locale réussies. Aucun changement serveur/migration/dépendance ou question réelle modifiée, pas de recette navigateur. Dernière suite complète lot 169 : 335 tests.

TypeScript/build finaux et trois tests de locales réussis. Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 167.

### Lot 171 — reprise de création des questions

- Tour précédent : vérification de disponibilité locale/Tailscale, sans changement applicatif. Reprise du lot en cours : six tests en échec ont révélé le branchement erroné du nouveau gestionnaire sur modules.create. Schéma et gestionnaire des chapitres restaurés, gestionnaire raccordé à maker.content.questions.create.
- UUID facultatif normalisé, empreinte du contenu, verrou transactionnel par auteur/demande et registre immutable séparé des questions. Même demande retrouvée, contenu différent refusé ; question modifiée ou archivée retrouvée sans réécriture ni réactivation. Vérification des droits et du statut actif avant reprise. Pas de verrou transactionnel sur les changements concurrents de rôle/affiliation.
- Éditeur réutilisant le même UUID pour le même contenu et conservant l’ordre initial malgré actualisation de la banque. UUID en mémoire uniquement : fermeture/rechargement ou contenu changé ne bénéficient pas de cette reprise. Messages distincts de création et modification FR/EN/AR. Routes anciennes et requêtes sans UUID compatibles, sans dédoublonnage.
- Trois tests PostgreSQL ajoutés : concurrence, conflits, isolation auteurs, reprise après modification/archive, registre immutable, révocation des droits, compatibilité sans UUID et ordre des clés JSON. Après correction : 338 tests réussis, TypeScript/build réussis. Migration additive 20260913_question_creation_requests.sql ; aucune migration existante modifiée. Pas de question réelle créée ni de recette navigateur.
- Recette Docker complète et sauvegarde/restauration réussies. Aperçu remplacé avec volumes conservés, migration additive appliquée. Index Tailscale identique au build, session administrateur antérieure et lectures des formations/questions vérifiées avec no-store. Conteneur healthy. Objectif global non achevé.

### Lot 172 — mots-clés vides après normalisation

- Tour précédent classé progression : reprise UUID des créations de question validée et intégrée. Inspection du correcteur : includes(normalize(keyword)) acceptait toute réponse non vide lorsque le mot-clé devenait vide (espaces ou diacritiques isolés). Le contrôle de publication vérifiait seulement trim.
- Normalisation existante extraite dans shared/freeTextAnswer.ts sans changer son alphabet de diacritiques. Mot-clé utilisable exigé dans l’éditeur et pour chaque alternative avant publication/revue ; correcteur ignorant les alternatives vides ou non textuelles. Alternatives valides, casse, accents et expressions arabes conservés. Regex historiques inchangées ; toujours refusées pour nouvelle publication.
- Deux tests de correction et un test PostgreSQL de blocage de revue ajoutés. 341 tests réussis, TypeScript/build réussis. Aucune migration, note stockée, tentative ou question réelle modifiée. Les feedbacks historiques étant recalculés à la lecture, une ancienne réponse admise par ce défaut peut désormais être indiquée incorrecte alors que son score archivé reste conservé ; versionnement/persistance du feedback historique restant à traiter explicitement. Aucune recette navigateur.
- Recette Docker et sauvegarde/restauration réussies. Aperçu remplacé avec volumes conservés ; index Tailscale identique au build, session antérieure et lectures formations/préparation pédagogique vérifiées avec no-store. Objectif global non achevé.

### Lot 173 — correction des tentatives conservée avec la note

- Tour précédent classé progression : mots-clés normalisés sécurisés et aperçu actualisé. Correction du défaut restant : réponse à une soumission déjà terminée recalculait chaque résultat alors que le score était conservé.
- Colonne feedback nullable ajoutée aux tentatives. Nouvelle soumission calculant une seule fois les résultats par question, les utilisant pour le score et les enregistrant dans la même transaction. Reprise lisant exclusivement le détail enregistré. Migration additive interdisant UPDATE, DELETE et TRUNCATE des tentatives, sans réécriture des anciennes lignes.
- Ancienne tentative sans feedback : score/réussite conservés, feedback vide et feedbackAvailable=false ; explication FR/EN/AR dans le lecteur. Pas de reconstitution historique prétendue. Progression des objectifs utilisant le feedback lorsqu’il existe ; son ancien calcul reste en place pour les tentatives sans feedback (limite historique encore à auditer).
- Trois tests PostgreSQL : enregistrement/reprise malgré modification de banque, immutabilité des tentatives, résultat conservé différent du correcteur actuel, absence explicite pour historique. Le premier test tentait initialement de modifier le snapshot de session déjà immutable ; corrigé pour vérifier le refus, sans modifier cette protection. Ajustement de l’itération au niveau de compilation TypeScript existant.
- 344 tests réussis, TypeScript/build et recette Docker avec sauvegarde/restauration réussis. Aperçu remplacé avec volumes conservés ; index Tailscale identique au build, session antérieure et lectures auteur vérifiées avec no-store. Aucun examen réel soumis, aucune note historique recalculée, pas de recette navigateur. Objectif global non achevé.

### Lot 174 — historique de résultats accessible au retour dans le cours

- Tour précédent classé progression : feedback immutable des examens enregistré et aperçu actualisé. Inspection du lecteur : chapitre réussi retournant seulement une mention de réussite, écran final masquant le détail après rechargement.
- Composant de consultation des tentatives enregistrées, avec lignes dépliables natives, note/réussite et détail de correction. Chapitres : accessible avant démarrage et après réussite ; limite épuisée explicitée sans proposer un démarrage voué au refus serveur. Examen final : historique identifié dans la consultation du cours et après réussite, ainsi que dans le parcours sans chapitres. Pas de démarrage/soumission déclenché par consultation.
- Nouveau feedback conservant aussi le texte de question, utilisé dans l’historique. Ancien feedback sans texte affichant un numéro, sans reconstruire le libellé depuis la banque actuelle ; anciennes tentatives sans feedback signalées comme telles. Actualisation de la liste finale après soumission confirmée. Aucun ajout de route, migration ou réécriture des résultats existants.
- Test PostgreSQL existant renforcé sur conservation du texte et reprise après modification de banque. 344 tests réussis ; TypeScript/build initiaux réussis. TypeScript/build finaux et recette Docker avec sauvegarde/restauration réussis. Aperçu remplacé avec volumes conservés ; index Tailscale identique au build, session antérieure et lecture des inscriptions vérifiées avec no-store. Pas de recette navigateur, aucun examen réel soumis. Objectif global non achevé.

### Lot 175 — préparation explicite avant démarrage d’un QCM

- Tour précédent classé progression : historique des corrections accessible et aperçu actualisé. Inspection du lecteur : sélection du final ou fin du diaporama montait QuizView et lançait immédiatement startExam.
- Écran ExamEntry commun aux chapitres et au final. Seuil de réussite, durée configurée, nombre de tentatives disponibles calculé depuis les résultats, historique et bouton explicite démarrer/reprendre. Information FR/EN/AR sur le chronomètre déjà actif qui continue pendant l’absence et ne redémarre pas à zéro.
- Consultation ne montant pas QuizView avant clic, donc sans création de session. Limite atteinte affichée avec historique sans bouton de démarrage. Échec de lecture des tentatives bloquant le démarrage avec reprise de lecture ; actualisation en cours désactivant le bouton. Serveur restant autorité sur disponibilité, session active, seuil et temps restant.
- TypeScript/build et trois tests de locales réussis. Aucun changement serveur, migration, dépendance ni examen réel lancé. Dernière suite complète et recette Docker lot 174 : 344 tests. Pas de recette navigateur. Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes. Objectif global non achevé.

### Lot 176 — progression rafraîchie et erreurs de lecture visibles

- Tour précédent classé progression : écran de préparation avant démarrage des QCM et aperçu actualisés. Inspection des callbacks : objectifs non invalidés après résultat, inscriptions non actualisées après final, erreurs de requêtes avec cache laissées sans message.
- Résultat final confirmé actualisant tentatives, objectifs et inscriptions ; résultat de chapitre actualisant objectifs même après échec, progression des modules et inscriptions après réussite. Les données restent celles du serveur ; aucun objectif marqué acquis localement.
- Message de rafraîchissement échoué FR/EN/AR partagé entre les deux présentations du lecteur. Reprise seulement des lectures en erreur, bouton désactivé pendant leur actualisation. Données déjà reçues et sous-arbre du QCM conservés ; les erreurs initiales sans données gardent le traitement bloquant existant. Cette modification ne remplace pas la gestion spécifique des erreurs de soumission/sauvegarde du QCM.
- TypeScript/build initiaux et trois tests de locales réussis ; ajustement final de l’invalidation des objectifs de chapitre suivi de revalidation/build réussis. Image locale reconstruite et assets actualisés sans redémarrage ; index Tailscale identique au build validé, anciennes ressources conservées pour les pages ouvertes. Aucun changement serveur/migration/dépendance, examen réel ou note modifiée. Dernière suite complète et recette Docker au lot 174 : 344 tests. Pas de recette navigateur. Objectif global non achevé.

### Lot 177 — diffusion admin : destinataires cohérents et résultat des canaux

- Tour précédent classé progression : progression/erreurs de rafraîchissement du lecteur et aperçu actualisés. Inspection de la messagerie : résultat SMTP ignoré, succès affiché et brouillon vidé même sans envoi, destinataire unique refusé par audience obligatoire, ciblage compagnie différent entre ancien companyId et affiliations (y compris inactives).
- Service adminBroadcast : rôle/statut admin relus, cible unique ou audience validée, comptes actifs seulement, compagnie ACTIVE avec affiliations ACTIVE dédupliquées. Une même liste alimente notifications et e-mails. Notifications insérées transactionnellement par lots avant les envois ; canal inApp honoré. Liens limités à chemins internes ou HTTPS, HTML du message échappé. Ancienne fonction broadcastNotification conservée mais route admin redirigée.
- Résultat séparant notifications, destinataires, e-mails acceptés selon sendEmail, échecs et non-envoyés (SMTP absent/adresse manquante). Exceptions par destinataire comptées sans stopper les autres. Acceptation SMTP ne prouvant pas réception en boîte. Bilan de composition persistant et toast de diffusion ; brouillon conservé sur résultat incomplet ou modifications intervenues pendant envoi. Pas de reprise automatique ou globale conseillée ; requête sans UUID, perte d’accusé pouvant encore produire des doublons.
- Trois tests PostgreSQL via API, SMTP entièrement simulé : affiliations dupliquées/révoquées, compte suspendu et ancien companyId exclus, adresse absente, échec/exceptions, SMTP non configuré, destinataire unique, canal email seul, cibles/canaux/liens invalides, compagnie suspendue et administrateur rétrogradé. 347 tests, TypeScript/build réussis.
- Aucune migration ou dépendance, aucun e-mail réel ni notification réelle créés. Pas encore de boîte d’envoi durable, de journal des erreurs consultable après rechargement ou de reprise ciblée : chantier restant. Pas de recette navigateur. Recette Docker et sauvegarde/restauration réussies. Aperçu remplacé avec volumes conservés ; index Tailscale identique au build, session antérieure vérifiée. Requête de diffusion à cible invalide refusée en HTTP 400/BAD_REQUEST avant envoi, avec no-store. Objectif global non achevé.

### Lot 178 — acceptation SMTP explicite et erreurs sans données privées

- Tour précédent classé progression : ciblage admin et bilan séparé des canaux corrigés et intégrés. Inspection de sendEmail : toute résolution de sendMail déclarée réussie, destinataire/sujet consignés et réponse brute du fournisseur retournée/loguée.
- Succès seulement si liste accepted non vide et liste rejected présente/vide. Réponse absente/incomplète ou refus partiel signalé non confirmé. Configuration avec port entier 1–65535 exigée ; transport créé dans le try. Délais de connexion et greeting 10 s, socket 20 s (délais par phase/inactivité, pas une durée totale garantie).
- Logs du service email limités à événements fixes, sans adresse/sujet/corps ou réponse brute. Erreur d’authentification distinguée, autres exceptions qualifiées de non-confirmation avec invitation à vérifier le fournisseur avant reprise. Aucun renvoi automatique. Acceptation SMTP ne prouvant toujours pas la livraison finale.
- Trois tests à transport Nodemailer simulé : configuration absente/ports invalides, acceptation vide/partielle/incomplète et acceptation valide, délais transmis, confidentialité des logs/résultats face à erreurs contenant des données privées. 350 tests, TypeScript/build réussis. Aucun e-mail réel envoyé ; pas de test de fournisseur réel, migration ou dépendance.
- Recette Docker et sauvegarde/restauration réussies. Aperçu remplacé avec volumes conservés ; index Tailscale identique au build, session administrateur antérieure et no-store vérifiés. Boîte d’envoi durable, journal administrateur après rechargement et reprises ciblées toujours à construire. Objectif global non achevé.

### Lot 179 — journal durable des diffusions administrateur

- Tour précédent classé progression : acceptation SMTP et confidentialité des erreurs corrigées, aperçu actualisé. Ajout du journal jusque-là absent après rechargement.
- Tables broadcast_runs et broadcast_outcomes : métadonnées de diffusion, auteur/cible, comptes de destinataires/notifications et bilan SMTP agrégé. Corps, adresses e-mail et réponses SMTP non copiés dans le journal. Création du journal et des notifications dans la même transaction avant SMTP ; bilan final ajouté après la boucle d’envoi. Absence de bilan signifiant en cours ou résultat incomplet, sans assimilation à un échec ni à une réussite.
- Deux tables immutables contre UPDATE/DELETE/TRUNCATE ; unicité du bilan par diffusion et validation SQL de la somme des résultats. Migration additive, aucune ancienne ligne reconstruite. Première exécution arrêtée sur syntaxe CASE ; absence d’application vérifiée dans raero_migrations avant correction des parenthèses, puis migration appliquée normalement.
- API admin avec statut/rôle relus, pagination descendante stable de 50 lignes. Composant FR/EN/AR dans la composition d’e-mails : détails, compteurs, auteur, état incomplet explicite, actualisation et pages anciennes. Lectures actualisées après réussite ou erreur d’une diffusion ; aucun bouton de renvoi.
- Deux tests PostgreSQL supplémentaires avec SMTP simulé : journal visible pendant envoi retenu par une promesse, bilan persistant et immutable, total incohérent refusé, pagination face à une nouvelle arrivée, refus aux non-admin/suspendus et curseur invalide. 352 tests réussis, TypeScript/build initiaux réussis ; TypeScript/build finaux et recette Docker avec sauvegarde/restauration réussis. Aperçu remplacé avec volumes conservés ; index Tailscale identique au build, session antérieure et lecture du journal vide vérifiées avec no-store.
- Aucune diffusion réelle envoyée ni donnée historique réécrite, pas de recette navigateur. Le journal couvre les diffusions admin nouvelles, pas les messages automatiques. Pas de file d’envoi durable/reprise ciblée, pas d’UUID empêchant un second envoi après perte d’accusé, et pas de bilan par destinataire : chantier restant. Objectif global non achevé.

### Lot 180 — reprise UUID des diffusions sans nouvel envoi

- Tour précédent classé progression : journal durable admin intégré et validé. Demande répétée après perte d’accusé pouvait encore créer un deuxième lot de notifications/e-mails.
- Migration additive requestId/fingerprint nullable dans broadcast_runs, paire cohérente et index unique auteur/UUID. Empreinte du contenu d’entrée normalisé ; verrou transactionnel par auteur/demande, recherche d’une diffusion existante avant résolution des destinataires et création atomique journal/notifications. Bilan existant retourné sans nouveau SMTP ; bilan absent refusé CONFLICT avec indication journal/en cours/incomplet. Aucun verrou SQL maintenu pendant SMTP.
- Statut/rôle admin relus avant toute reprise. Changement de contenu/canal avec le même UUID refusé. Reprise d’un bilan après suspension d’un ancien destinataire permise sans lui envoyer de nouveau message. UUID identique d’un autre administrateur indépendant. Métadonnées de reprise exclues de la projection du journal.
- Deux formulaires admin réutilisant un UUID en mémoire par demande inchangée. Changement de demande/rechargement ne conserve pas cette protection ; absence d’UUID reste compatible sans dédoublonnage. Message explicatif dans la composition, aucune relance ciblée des échecs proposée. Ce mécanisme ne garantit pas l’unicité de livraison SMTP au-delà d’une demande et ne résout pas une interruption entre envoi et bilan.
- Deux tests PostgreSQL avec SMTP simulé : demande concurrente pendant envoi retenu par promesse, casse UUID/ordre des clés, une notification/un appel SMTP, reprise de bilan, conflits, destinataire suspendu, admin rétrogradé, séparation auteurs et projection sans empreinte. 354 tests réussis. Import useRef manquant révélé par TypeScript puis corrigé ; TypeScript/build et recette Docker avec sauvegarde/restauration réussis. Aperçu remplacé avec volumes conservés ; index Tailscale identique au build, session antérieure et lecture du journal vérifiées avec no-store.
- Aucune diffusion réelle envoyée, aucune migration déjà appliquée modifiée, pas de recette navigateur. File d’envoi durable, états par destinataire et reprises ciblées restant à construire. Objectif global non achevé.

### Lot 181 — résultat conservé par destinataire de diffusion

- Tour précédent classé progression : UUID de reprise intégré et validé. Journal jusque-là limité au bilan global, sans détail exploitable si interruption avant ce bilan.
- Migration additive broadcast_recipients/broadcast_recipient_outcomes, lignes immutables contre UPDATE/DELETE/TRUNCATE. Destinataires dédupliqués enregistrés dans la transaction de création de diffusion/notifications, avant SMTP. Un résultat unique par destinataire ajouté immédiatement après son traitement : accepté, non confirmé, non envoyé pour configuration/adresse absente, e-mail non demandé.
- Absence de résultat qualifiée en attente ou résultat inconnu, sans déduire si un SMTP a été tenté. Échec d’écriture du résultat arrêtant la boucle (non absorbé comme échec SMTP), laissant le bilan global incomplet et conservant les résultats précédemment enregistrés. Aucun renvoi automatique ; reprise UUID du bilan ne crée aucun nouveau détail/envoi.
- API administrateur avec contrôle rôle/statut frais, diffusion existante exigée, pagination de 50 lignes indexée par diffusion/id. Détail chargé à la demande dans le journal, actualisation et pagination FR/EN/AR. Compte identifié par son ID, sans copie de l’adresse e-mail ou d’un corps de message ; anciennes diffusions sans détail signalées sans reconstitution.
- Deux tests PostgreSQL avec SMTP simulé : résultats non confirmé/adresse absente, conservation à la reprise UUID, immutabilité et absence d’adresse dans la projection, pagination 55 destinataires et résultats inconnus, refus d’accès non-admin/suspendu et diffusion absente. 356 tests, TypeScript/build initiaux réussis. TypeScript/build finaux et recette Docker avec sauvegarde/restauration réussis. Aperçu remplacé avec volumes conservés ; index Tailscale identique au build, session antérieure et journal vide vérifiés avec no-store, lecture des destinataires d’une diffusion inexistante refusée en HTTP 404.
- Aucune diffusion réelle envoyée, aucune migration déjà appliquée modifiée, pas de recette navigateur. Pas encore de file d’envoi exécutable ni de reprise ciblée ; une absence de résultat après SMTP reste ambiguë et ne doit pas provoquer de renvoi aveugle. Objectif global non achevé.

### Lot 182 — autorisation et adresse relues avant chaque e-mail de diffusion

- Tour précédent classé progression : résultats par destinataire intégrés et validés. Inspection de la boucle : liste initiale conservée même après modification de droits pendant une diffusion longue.
- Avant chaque appel SMTP : relecture du rôle/statut de l’administrateur, du statut et de l’adresse du compte ciblé ; diffusion compagnie exigeant encore affiliation ACTIVE et compagnie ACTIVE. Adresse différente de celle sélectionnée au départ refusée, sans redirection silencieuse. Configuration SMTP vérifiée à chaque itération également.
- Nouveau statut immutable skipped_access, libellé FR/EN/AR « droits ou adresse modifiés », comptabilisé parmi non-envoyés. Migration additive élargissant la contrainte de statuts, après vérification de son nom en base ; aucune migration appliquée réécrite.
- Test PostgreSQL/SMTP simulé couvrant six changements après le premier appel : compte suspendu, adresse changée, affiliation inactive, compagnie suspendue, administrateur rétrogradé ou suspendu. Chaque scénario : une acceptation, un destinataire ignoré et un seul appel SMTP. 357 tests, TypeScript/build réussis.
- Vérification juste avant SMTP, sans atomicité entre base et fournisseur : un envoi déjà engagé ne peut pas être rappelé et une modification après cette vérification reste possible. Les notifications internes créées dans la transaction initiale restent conservées. Aucune promesse de révocation rétroactive ou de sérialisation globale.
- Aucun e-mail réel envoyé, pas de recette navigateur. Recette Docker et sauvegarde/restauration réussies. Aperçu remplacé avec volumes conservés ; index Tailscale identique au build, session antérieure et lecture du journal vérifiées avec no-store. File d’envoi durable et reprises ciblées restant à construire ; objectif global non achevé.

### Lot 183 — reprise ciblée des e-mails explicitement non envoyés

- Tour précédent classé progression : droits/adresse relus avant SMTP, aperçu validé. Ajout d’une reprise explicite des destinataires skipped_configuration, skipped_missing_email ou skipped_access ; états accepted/unconfirmed, absence de résultat et e-mail non demandé refusés.
- Migration additive broadcast_payloads (corps/lien conservés pour nouvelles diffusions) et broadcast_retries (liaison source destinataire → diffusion enfant unique, périmètre compagnie hérité). Tables immutables ; anciennes diffusions sans contenu non reconstituées et reprise indisponible. Le corps est désormais conservé séparément du journal de métadonnées pour permettre cette fonction ; accès de prévisualisation réservé aux administrateurs actifs.
- Prévisualisation du contenu conservé et du destinataire/adresse actuels. Confirmation envoie un seul e-mail, sans notification interne supplémentaire. Adresse attendue vérifiée à la mutation et avant SMTP ; rôle/statut, affiliation/compagnie et configuration vérifiés à nouveau. Périmètre compagnie transmis à toutes les générations de reprise.
- Verrou transactionnel par destinataire source et contrainte unique empêchant deux diffusions enfants, y compris appels concurrents avec UUID différents. Reprise d’un enfant déjà créé retrouvant son bilan ; bilan encore absent refusé sans nouvel envoi. Une reprise elle-même explicitement non envoyée peut être reprise depuis son propre destinataire, avec périmètre hérité.
- Dialogue FR/EN/AR en lecture seule avant bouton de confirmation, fermeture bloquée pendant mutation, verrou d’envoi immédiat. Journal affichant l’identifiant de diffusion pour retrouver une reprise existante. Aucun bouton pour forcer le renvoi d’un résultat SMTP ambigu.
- Trois tests PostgreSQL/SMTP simulé : contenu prévisualisé/échappé, concurrence et une seule reprise SMTP sans notifications, immutabilité contenu/liaison, exclusion succès/non-confirmé/absence de résultat/historique sans corps, adresse changée, SMTP disparu après validation, affiliation révoquée sur génération suivante et admin rétrogradé. 360 tests, TypeScript/build initiaux réussis ; TypeScript/build finaux et recette Docker avec sauvegarde/restauration réussis. Aperçu remplacé avec volumes conservés ; index Tailscale identique au build, session antérieure et journal vérifiés avec no-store, prévisualisation d’une source inexistante refusée en HTTP 404.
- Aucun e-mail réel envoyé, pas de recette navigateur, aucune migration déjà appliquée réécrite. Traitement toujours synchrone par requête, sans worker de file d’envoi ; messages automatiques non couverts. Conservation du nouveau contenu à intégrer à l’audit global de confidentialité/rétention. Objectif global non achevé.

### Lot 184 — noms et titres multilingues dans les certificats PDF

- Tour précédent classé progression : reprise ciblée des e-mails intégrée et validée. Inspection du certificat : nom et titre rendus en Helvetica, sans prise en charge correcte de l’arabe ni contrôle des débordements.
- Compétence PDF appliquée ; marqueur d’opération exécuté avant création de trois spécimens de QA. Réutilisation de la police Noto Sans Arabic embarquée et du moteur de lignes bidirectionnelles déjà utilisé pour les factures. Noms, titres et référence de formation rendus sans inverser les lettres des séquences arabes ; références latines conservées dans les contenus mixtes.
- Zones de texte explicites avec réduction de taille jusqu’à un minimum et retour à la ligne. Si le contenu ne peut pas tenir, émission refusée PRECONDITION_FAILED plutôt que tronquée ou prolongée sur une seconde page. Motif de précondition affiché dans l’état de certificat du lecteur. Espacement vertical des éléments ajusté pour séparer titres, référence et détails.
- Trois PDF de test (nom français accentué, nom arabe/titre mixte, nom et titre longs mixtes) générés dans tmp/pdfs/lot184, rendus avec Poppler puis inspectés visuellement : lisibles, sans chevauchement visible, une page A4 paysage chacun. Identifiants et référence SPECIMEN, aucune émission réelle ni écriture d’archive.
- Trois tests : préservation des textes FR/AR et référence latine dans le rendu d’une page, refus d’identité dépassant la zone. 363 tests, TypeScript/build initiaux réussis ; TypeScript/build finaux et recette Docker avec sauvegarde/restauration réussis. Aperçu remplacé avec volumes conservés ; index Tailscale identique au build, session antérieure et lecture des certificats vérifiées avec no-store.
- Aucune nouvelle police/dépendance/migration ; licence de la police existante conservée. Anciens PDF archivés inchangés. Libellés fixes toujours en français, pas de traduction intégrale du certificat ni validation de tous les scripts Unicode. Pas de conformité réglementaire du document revendiquée. Objectif global non achevé.


### Lot 185 — certificats localisés et langue archivée

- Tour de statut précédent classé sans progression fonctionnelle : disponibilité Docker/Tailscale confirmée uniquement. Reprise des modifications de certificats en cours ; journaux terminaux relus avant toute nouvelle exécution.
- Libellés du certificat FR/EN/AR selon la langue de la version de formation attachée à l’inscription ; cours courant utilisé pour les inscriptions historiques sans version, français par défaut pour langue inconnue. Nom du titulaire et titre conservés dans leur langue originale.
- Langue enregistrée dans le snapshot immutable de la nouvelle archive (champ JSON facultatif, sans migration). Changement ultérieur du catalogue ne régénérant pas le certificat déjà émis. Dates affichées en calendrier grégorien UTC, mois écrit en arabe pour limiter l’ambiguïté numérique.
- Trois spécimens QA français/anglais/arabe rendus avec Poppler et inspectés : une page chacun, libellés lisibles et absence de chevauchement visible. Dernière version arabe inspectée après ajustement de date et ponctuation du numéro. Aucune émission réelle et aucun PDF historique modifié.
- 368 tests réussis, dont rendu trilingue, normalisation de langue/date UTC et intégration PostgreSQL prouvant la langue de version archivée et absence de régénération après changement du catalogue. TypeScript et build réussis. Recette Docker et sauvegarde/restauration réussies.
- Aperçu remplacé avec volumes conservés et ancien conteneur before185 arrêté pour retour arrière. Index Tailscale identique au build, session administrateur antérieure, lecture des certificats avec no-store et police embarquée lisible vérifiés.
- Pas de validation réglementaire du modèle ni de recette navigateur revendiquées. Validation globale des parcours, fournisseurs réels et exigences réglementaires restant à effectuer ; objectif global non achevé.


### Lot 186 — objectifs historiques sans recalcul de correction

- Tour précédent classé progression : certificats trilingues intégrés et vérifiés. Inspection du suivi des objectifs révélant un recalcul des anciennes réponses sans feedback avec le corrigé actuel, pouvant modifier la conclusion affichée après édition du cours.
- Suppression de ce recalcul. L’objectif utilise exclusivement le feedback enregistré de la tentative réussie retenue (ou la plus récente si aucune réussite). Une question sans détail dans une tentative existante ajoute un compteur unavailableQuestionCount et empêche de confirmer l’objectif ; absence de tentative reste simplement non complétée. Les règles de sélection de tentative sont conservées.
- Indication FR/EN/AR dans la liste des objectifs : détail historique indisponible, objectif non confirmable et résultat d’examen conservé. Aucune réécriture de score, résultat, archive ou certificat. Pas de migration ni nouvelle dépendance. La cartographie des objectifs des inscriptions historiques non versionnées dépend encore du catalogue courant ; pas de reconstitution revendiquée.
- Deux tests PostgreSQL couvrent absence de tentative, résultat historique sans feedback et résultat avec feedback, puis modification du corrigé : conclusion stable, résultat réussi conservé. 370 tests, TypeScript et build réussis. Première insertion automatisée des traductions interrompue sur clé non trouvée ; format plat des clés vérifié et correction appliquée, puis contrôles complets relancés après ajout des tests.
- Recette Docker et sauvegarde/restauration réussies. Aperçu remplacé avec volumes conservés ; ancien conteneur before186 arrêté pour retour arrière. Index Tailscale identique au build, session administrateur antérieure et lecture des inscriptions avec no-store vérifiés. Pas de recette navigateur. Objectif global non achevé.


### Lot 187 — échéances mensuelles sans débordement de fin de mois

- Tour précédent classé progression : suivi des objectifs sans recalcul historique intégré. Inspection des échéances révélant trois appels setMonth locaux pouvant reporter le 31 janvier en mars pour une période d’un mois et dépendre du fuseau du serveur.
- Fonction partagée addCalendarMonths : ajout des mois calendaires en UTC, jour limité au dernier jour du mois cible, heure/millisecondes conservées, date source non mutée, entrées non entières/dates invalides et résultats hors plage refusés. Appliquée aux nouvelles échéances d’inscription, de certificat et aux nouvelles récurrences créées par analyse des besoins (TNA).
- Aucun changement des périodes métier configurées, dates historiques, archives ou échéances Stripe fournies par le prestataire. Convention logicielle de fin de mois, sans prétendre valider les périodes réglementaires de formation. Pas de migration ou dépendance.
- Sept nouveaux tests : mois de février ordinaire/bissextile, anniversaire du 29 février, changement d’année, mois négatif, heure UTC autour d’un changement saisonnier et entrées invalides. 377 tests, TypeScript et build réussis. Test d’archive renforcé sur période de douze mois après 29 février, avec échéance attendue le 28 février ; dix tests d’intégration certificat relancés et réussis après ce renforcement. Stockage simulé, aucune émission réelle.
- Recette Docker et sauvegarde/restauration réussies. Aperçu remplacé avec volumes conservés ; ancien conteneur before187 arrêté pour retour arrière. Index Tailscale identique au build, session administrateur antérieure et lecture des certificats avec no-store vérifiés. Pas de recette navigateur. Objectif global non achevé.


### Lot 188 — historique KYC/KYB paginé et anciens motifs visibles

- Tour précédent classé progression : échéances calendaires corrigées et intégrées. Inspection KYC/KYB : détail du dossier chargeant tous les événements avec leurs snapshots complets, interface limitée à l’action/date et au seul motif courant.
- Nouvelle lecture history à contrôle d’accès frais par dossier et page : 50 événements, curseur ID descendant borné entier SQL, projection id/auteur/action/date et motif uniquement pour approved/rejected/needs_information. Snapshots previous/current conservés en base mais exclus de cette réponse. Événements retirés de la réponse detail ; tous ses consommateurs de code recherchés et adaptés.
- Composant d’historique réinitialisé au changement de dossier, pages anciennes et actualisation des derniers événements, motifs précédents affichés en texte. États chargement/erreur/nouveau chargement FR/EN/AR et invalidation après mutations. Une erreur masque les lignes en cache. Pas de mutation historique, migration ou nouvelle dépendance.
- Test PostgreSQL de 56 événements puis nouvelle arrivée entre pages : ordre stable et absence de doublons, projection minimale, motif seulement sur décision, detail sans snapshots d’événements, curseurs invalides et interdiction aux tiers/comptes suspendus. Test KYB complété pour refuser aussi l’historique après révocation d’affiliation. 378 tests, TypeScript et build réussis ; tests KYC ciblés relancés après renforcement KYB.
- Recette Docker et sauvegarde/restauration réussies ; 13 tests KYC ciblés réussis. Aperçu remplacé avec volumes conservés, ancien conteneur before188 arrêté. Index Tailscale identique au build, session antérieure et lecture KYC avec no-store vérifiés ; historique inexistant refusé HTTP 403. Pas de recette navigateur. Volume des justificatifs et liste personnelle encore non paginés. Pas de validation juridique du processus KYC/KYB revendiquée. Objectif global non achevé.


### Lot 189 — pièces KYC/KYB paginées et métadonnées d’archive consultables

- Tour précédent classé progression : historique KYC/KYB paginé intégré. Inspection des justificatifs : chargement de toutes les pièces actives dans detail et absence de consultation des métadonnées des pièces archivées.
- Nouvelle lecture documentsPage par dossier, filtre actuel/archivé et curseur ID descendant de 50 lignes. Rôle/statut et accès personne/compagnie relus à chaque page. Projection limitée aux informations utiles à l’affichage ; URL rendue nulle pour pièce archivée, sans empreinte ni UUID de dépôt. Les téléchargements archivés restent refusés par la barrière de stockage existante.
- Réponse detail limitée aux informations du dossier ; consommateurs recherchés et adaptés. Interface FR/EN/AR avec listes actuelles/archivées, dates de dépôt/archivage, actualisation et pages anciennes, états vide/chargement/erreur. Changement de dossier réinitialisant le composant ; mutations invalidant la liste. Archivage proposé seulement sur pièces actuelles d’un dossier modifiable.
- Test PostgreSQL de 55 pièces : pagination sans doublon, déplacement d’une pièce vers les archives, projection et URL nulle, refus de téléchargement, accès tiers/suspendu et curseurs invalides. Contrôle KYB après affiliation révoquée renforcé ; contrôle de soumission avec seule pièce archivée renforcé. 379 tests, TypeScript et build réussis ; tests KYC ciblés relancés après dernier renforcement.
- Pas de suppression de fichier ni restauration automatique, migration ou nouvelle dépendance. Liste personnelle des dossiers encore non paginée. Recette Docker et sauvegarde/restauration réussies, 14 tests KYC ciblés réussis. Aperçu remplacé avec volumes conservés, ancien conteneur before189 arrêté. Index Tailscale identique au build, session antérieure et lecture KYC avec no-store vérifiés ; pièces archivées d’un dossier inexistant refusées HTTP 403. Pas de recette navigateur. Objectif global non achevé.


### Lot 190 — encodage strict des justificatifs KYC/KYB

- Tour précédent classé progression : pièces actives/archivées paginées intégrées. Inspection du validateur : expression de caractères Base64 mais pas de longueur multiple de quatre ni de contrôle des bits de bourrage ; Buffer.from acceptait silencieusement des variantes mal formées.
- Limite de longueur encodée avant décodage selon 8 Mio, longueur multiple de quatre et comparaison du réencodage canonique exigées. Taille décodée non vide et au maximum 8 Mio conservée, message de borne corrigé. Aucun changement de format produit par FileReader ni des documents déjà stockés.
- Deux tests ajoutés : variantes de bourrage, bits non canoniques, caractères supplémentaires/retours à la ligne/préfixe data URL, signatures PDF/PNG/JPEG, limite exacte et dépassement décodé/encodé. Test de dépôt UUID renforcé : entrée mal formée refusée BAD_REQUEST sans appel au stockage, document ou événement ajouté, puis dépôt canonique réussi avec le même UUID.
- 381 tests, TypeScript et build réussis. Validation toujours limitée à l’encodage/taille/signature initiale : ne prouve pas l’intégrité structurelle complète d’un PDF/image ni l’absence de contenu malveillant. Pas de nouvelle dépendance ou migration, aucun justificatif réel envoyé.
- Recette Docker et sauvegarde/restauration réussies. Aperçu remplacé avec volumes conservés, ancien conteneur before190 arrêté. Index Tailscale identique au build, session antérieure et lecture KYC avec no-store vérifiés. Pas de recette navigateur. Objectif global non achevé.


### Lot 191 — reprise de création de chapitre sans doublon

- Tour précédent classé progression : encodage des justificatifs renforcé et intégré. Inspection du studio : création de question protégée par UUID, création de chapitre encore sans reprise après accusé perdu.
- Nouveau service createAuthorModule avec schéma d’entrée du studio, UUID facultatif normalisé et empreinte canonique de la demande. Acteur actif relu et droits d’auteur vérifiés avant recherche de reprise. Verrou transactionnel auteur/UUID, création du chapitre et liaison de reprise atomiques.
- Migration additive module_creation_requests : unicités auteur/UUID et chapitre, registre immutable contre UPDATE/DELETE/TRUNCATE. Reprise retournant le chapitre sans réécrire ses modifications ultérieures ni réactiver son archive ; UUID utilisé avec autre contenu/formation refusé CONFLICT. Liens de contenu contrôlés avant création nouvelle. Route admin historique conservée.
- Formulaire de chapitre gardant un UUID en mémoire pour chaque demande inchangée ; ordre stocké dans l’état initial du formulaire. Message FR/EN/AR de reprise après erreur, confirmation distinguant création, chapitre retrouvé et chapitre retrouvé archivé. Changement de contenu génère un autre UUID ; fermeture/rechargement ne conserve pas cette identité. Aucune promesse de dédoublonnage entre demandes distinctes ou appels historiques sans UUID.
- Trois tests PostgreSQL : concurrence avec casse UUID, un chapitre/un registre, conflits, permissions et auteurs indépendants, modification/archivage conservés à la reprise, registre immutable, révocation d’affiliation, ordre des clés et compatibilité sans UUID. 384 tests réussis ; TypeScript/build initiaux réussis, contrôles finaux relancés après amélioration des messages.
- Pas de migration appliquée réécrite, pas de nouveau fournisseur ou dépendance. Création de diapositives encore sans UUID et contrôle des éditions concurrentes restant à traiter. TypeScript/build finaux et recette Docker avec sauvegarde/restauration réussis. Aperçu remplacé avec volumes conservés et ancien conteneur before191 arrêté ; index Tailscale identique au build, session antérieure et lecture des inscriptions avec no-store vérifiés. Pas de recette navigateur. Objectif global non achevé.


### Lot 192 — reprise de création manuelle de diapositive

- Tour précédent classé progression : chapitres protégés contre les doublons de reprise, aperçu intégré. Inspection de l’ajout manuel de diapositive révélant une nouvelle création à chaque essai et ordre recalculé sur la liste actualisée.
- Nouveau service createAuthorSlide : acteur actif et droits d’auteur relus, UUID/empreinte et verrou transactionnel par auteur/demande, création et registre atomiques. Migration additive slide_creation_requests immutable avec unicités auteur/UUID et diapositive. Reprise retournant l’ID existant sans écraser édition/archivage. Demande différente sous même UUID refusée.
- Validation existante des activités réutilisée avant insertion : QCM et interactions vidéo toujours contrôlés, liens chapitre/objectif validés. ID de réponse conservé pour les consommateurs existants. Imports devenus inutilisés retirés du routeur.
- Bouton d’ajout conservant la demande complète, dont ordre, dans une carte en mémoire par utilisateur/formation jusqu’à confirmation ; verrou immédiat de clic. Reprise conservée pendant navigation interne entre formations, sans persistance après rechargement. Succès invalidant la formation de la demande même si l’utilisateur a changé de vue. Messages FR/EN/AR pour erreur/reprise/archive retrouvée.
- Trois tests PostgreSQL : concurrence, identité unique, conflits/permissions, modification/archivage conservés, immutabilité, affiliation révoquée, compatibilité sans UUID, ordre des clés. Test renforcé pour QCM invalide sans diapositive ni registre ajouté. 387 tests réussis ; six tests ciblés création/locales réussis après derniers ajouts.
- Pas de création réelle dans l’aperçu ni migration appliquée modifiée. Pas de dédoublonnage automatique des générations IA ou demandes distinctes. Première vérification TypeScript arrêtée sur itération Map incompatible avec la cible du projet ; remplacée par forEach. TypeScript/build finaux et recette Docker avec sauvegarde/restauration réussis. Aperçu remplacé avec volumes conservés et ancien conteneur before192 arrêté ; index Tailscale identique au build, session antérieure et lecture des inscriptions avec no-store vérifiés. Pas de recette navigateur. Objectif global non achevé.


### Lot 193 — détection des éditions concurrentes de diapositives

- Tour précédent classé progression : ajout de diapositives avec reprise UUID intégré. Inspection de l’édition : verrou SQL sérialisant les patchs mais aucun contrôle de la version chargée par l’auteur, permettant l’écrasement silencieux d’un formulaire ancien.
- Migration additive slides.revision (entier initial zéro) et trigger SQL incrémentant à chaque UPDATE, y compris réordonnancement ou écriture directe. Nouvelle révision technique de brouillon, distincte des versions publiées immutables de formation ; snapshots déjà publiés inchangés.
- Mutation updateSlide acceptant expectedRevision facultatif validé entier SQL. Comparaison sous verrou de ligne avant validation/écriture, refus CONFLICT en cas de décalage ou archive. Éditeur envoyant la révision de son ouverture ; brouillon conservé après refus, message FR/EN/AR et invalidation de la liste pour relecture. Aucun rechargement automatique du formulaire ni écrasement forcé.
- Test PostgreSQL : deux patchs avec même révision, une seule réussite ; brouillon ancien refusé sans modification du contenu ; changement direct d’ordre détecté ; nouvelle révision acceptée après rapprochement ; compatibilité de patch historique sans expectedRevision, bornes d’entrée et refus bas niveau d’édition archivée. 388 tests, TypeScript et build réussis ; test diapositive ciblé relancé après renforcement archive.
- Contrôle optionnel pour compatibilité des anciens appels : pas de protection globale revendiquée pour clients n’envoyant pas expectedRevision, chapitres/questions ou toutes les générations IA. Rapprochement manuel des brouillons, pas de fusion automatique ni reprise d’accusé d’édition perdu. Réordonnancement entraînant aussi un conflit conservateur.
- Aucune migration appliquée modifiée. Quatre tests de diapositives ciblés réussis, recette Docker et sauvegarde/restauration réussies. Aperçu remplacé avec volumes conservés et ancien conteneur before193 arrêté ; index Tailscale identique au build, session antérieure et lecture des cours auteur avec no-store vérifiés. Révisions présentes dans la lecture des diapositives du premier cours accessible. Pas de recette navigateur. Objectif global non achevé.


### Lot 194 — rapprochement des conflits dans l’éditeur de diapositive

- Tour précédent classé progression : révision de diapositive et refus des écrasements concurrents intégrés. Suite du parcours, jusque-là limité à une consigne de copie manuelle avant fermeture.
- Bouton de comparaison après CONFLICT, lecture fraîche des diapositives autorisées et maintien du brouillon en cas d’échec ou diapositive disparue/archivée. Formulaire verrouillé pendant lecture/comparaison ; annulation revenant au brouillon inchangé.
- Rapprochement à trois versions (base d’ouverture, brouillon, dernière version) : changements indépendants réunis, changements identiques sans conflit et choix explicite requis pour chaque groupe contradictoire. Groupes titre, texte, image+description, audio, vidéo+interactions, chapitre+objectif et QCM complet. Aucun assemblage automatique d’options de QCM provenant d’une version et de bonnes réponses provenant de l’autre.
- Interface FR/EN/AR à comparaison côte à côte ; détails complexes d’interactions consultables dans le texte de comparaison. Application prépare uniquement le brouillon et adopte la révision comparée ; bouton Enregistrer toujours nécessaire, validation QCM/vidéo/liens conservée et nouveau conflit possible si autre modification entre comparaison et enregistrement. Pas de fusion textuelle ligne par ligne ni d’écriture forcée.
- Trois tests purs : changements indépendants sans mutation des entrées, conflits nécessitant choix et cohérence du groupe QCM, changements identiques/locaux conservés. 391 tests, TypeScript/build réussis. Empreinte SHA256 du bundle serveur identique au serveur d’aperçu ; modification d’interface seulement, sans migration.
- Image construite et ressources d’interface copiées dans le conteneur sans arrêt du service, anciens fichiers hachés conservés. Index Tailscale identique au nouveau build vérifié. Pas de nouvelle recette Docker complète : code serveur inchangé vérifié par empreinte. Pas de recette navigateur. Objectif global non achevé.


### Lot 195 — refus d’écrasement concurrent des chapitres et questions

- Tour précédent classé progression : comparaison des conflits de diapositives intégrée. Inspection des autres éditeurs : chapitres et questions sans contrôle de la version de brouillon chargée.
- Migration additive revision sur training_modules et quiz_questions, triggers SQL incrémentant chaque UPDATE, y compris modifications directes, réordonnancement et archivage. Versions publiées et tentatives/corrigés enregistrés non réécrits.
- Helpers d’édition sous verrou de ligne : absence NOT_FOUND, archive ou révision dépassée CONFLICT avant écriture. Routes du studio acceptant expectedRevision entier SQL facultatif et l’excluant des champs de contenu. Éditeurs envoyant la révision chargée et conservant leur brouillon à l’erreur, message FR/EN/AR et invalidation des listes pour relecture.
- Deux tests PostgreSQL (chapitre/question) : une seule réussite de deux éditions concurrentes avec même révision, ancien patch refusé sans changement, écriture directe détectée, révision actualisée acceptée, appel historique sans révision compatible, bornes invalides et refus bas niveau de modification archivée.
- 393 tests, TypeScript et build réussis. Pas de migration appliquée modifiée. Contrôle facultatif pour compatibilité des anciens clients ; pas de fusion assistée des chapitres/questions à ce stade, ni contrôle des éditions concurrentes d’objectifs/catalogue. Rapprochement manuel des brouillons encore nécessaire pour ces deux éditeurs.
- Recette Docker et sauvegarde/restauration réussies. Aperçu remplacé avec volumes conservés et ancien conteneur before195 arrêté ; index Tailscale identique au build, session antérieure et lectures auteur avec no-store vérifiés. Lectures des chapitres/questions du premier cours accessible réussies mais listes vides : pas de preuve de projection des révisions sur données locales non vides. Migration confirmée appliquée dans les logs du conteneur ; comportement des révisions couvert sur fixtures PostgreSQL. Pas de recette navigateur. Objectif global non achevé.


### Lot 196 — rapprochement des versions de chapitre dans le studio

- Tour précédent classé progression : chapitres/questions avec détection des écrasements concurrents intégrés. Suite du parcours pour chapitres, jusque-là limité à conservation du brouillon et consigne de rapprochement manuel hors éditeur.
- Bouton de comparaison après CONFLICT : lecture fraîche des chapitres autorisés, refus si chapitre disparu/archivé en conservant le brouillon. Formulaire/imports/enregistrement verrouillés pendant lecture ou comparaison, annulation retournant au brouillon inchangé.
- Moteur existant de rapprochement extrait en fonction à groupes et composant renommé DraftConflictResolution pour les deux éditeurs réellement utilisateurs (diapositive/chapitre). Groupes de chapitre : titre, description, contenu, vidéo, PDF, durée, ordre, caractère obligatoire, politique QCM complète. Changements indépendants réunis, conflits avec choix obligatoire ; seuil/tentatives/temps QCM choisis ensemble pour éviter un assemblage involontaire de règles.
- Application préparant le brouillon et adoptant la révision comparée sans écriture serveur ; enregistrement explicite ensuite, nouvelle modification concurrente toujours refusée. Messages et comparaison FR/EN/AR, booléens affichés Oui/Non, données absentes distinguées par tiret. Pas de fusion ligne par ligne et pas encore de rapprochement assisté des questions d’examen.
- Deux tests supplémentaires : changements de chapitre indépendants sans mutation de la base/brouillon, conflit de politique QCM et conservation cohérente du groupe choisi. 395 tests, TypeScript/build initiaux réussis ; contrôles finaux relancés après ajustement du libellé vidéo pour chapitre.
- TypeScript/build finaux et construction de l’image réussis. Interface copiée dans le conteneur sans arrêt, anciens fichiers hachés conservés. Index Tailscale identique au build et bundle serveur identique par SHA256 vérifiés ; pas de nouvelle recette Docker complète pour cette modification d’interface seule. Pas de migration, nouvelle dépendance ou recette navigateur. Objectif global non achevé.


### Lot 197 — rapprochement des questions d’examen dans le studio

- Tour précédent classé progression : comparaison de chapitres intégrée. Extension au troisième éditeur déjà protégé par révision, celui des questions d’examen.
- Lecture fraîche de la banque autorisée après conflit, maintien du brouillon si lecture échoue ou question devient inaccessible. Éditeur verrouillé pendant lecture/comparaison ; annulation revenant aux saisies intactes. Version attendue et ordre de la question désormais conservés dans l’état de rapprochement.
- Groupe de correction indivisible : type, énoncé, options gauche/droite, bonnes réponses, associations, mots-clés/ancienne règle, confirmation de remplacement, points et explication. Placement chapitre/objectif et ordre séparés pour réunir leurs changements indépendants. Aucun mélange automatique d’un nouvel énoncé avec un corrigé concurrent.
- Préparation du brouillon rapproché sans enregistrement, état de règle historique et confirmation restitués selon la version choisie. Nouvelle règle historique adoptée imposant sa propre confirmation de remplacement ; contrôles QCM/QCU, associations et mots-clés conservés au bouton Enregistrer. Révision comparée envoyée au serveur, nouveau changement concurrent toujours refusé.
- Composant partagé FR/EN/AR adapté aux questions ; bonnes réponses et associations affichées avec numéros commençant à 1, type de question traduit. Ancien message générique de conflit devenu inutilisé retiré des trois dictionnaires.
- Trois nouveaux tests : correction locale + placement/ordre distants indépendants, conflit de changement de type conservant toute l’évaluation choisie, confirmation d’ancienne règle non transférée à une règle modifiée. 398 tests, TypeScript/build initiaux réussis ; contrôles finaux relancés après libellés et nettoyage.
- TypeScript/build finaux et image Docker réussis. Interface copiée sans arrêt du service, anciens fichiers hachés conservés. Index Tailscale identique au build et bundle serveur identique par SHA256 vérifiés. Pas de nouvelle recette Docker complète pour cette modification d’interface seule. Pas de migration, nouvelle dépendance ou recette navigateur. Fusion de texte ligne par ligne non proposée. Objectif global non achevé.


### Lot 198 — réordonnancement atomique des diapositives

- Tour précédent classé progression : comparaison de questions intégrée. Inspection du déplacement de diapositives : une écriture hors transaction par ligne et aucune révision attendue, permettant un ordre partiel après erreur et l’écrasement d’un réordonnancement concurrent.
- Réordonnancement sous transaction, verrouillage des lignes dans l’ordre stable de leurs IDs, vérification des lignes existantes/non archivées et d’une seule formation. Révisions attendues facultatives comparées avant écriture. Liste non vide sans doublons et révisions alignées exigées. Seules les positions modifiées sont écrites, préservant les révisions pour un ordre déjà identique.
- Studio envoyant les révisions associées aux IDs dans l’ordre demandé ; verrou de clic immédiat, flèches désactivées pendant l’actualisation. Listes et disponibilité de publication invalidées après réussite ou échec pour permettre de repartir de l’état actuel. Aucun changement d’ordre local optimiste à annuler.
- Deux tests PostgreSQL : concurrence avec même base, un seul ordre accepté et positions cohérentes, ordre identique sans écriture, entrées invalides ; erreur SQL synthétique sur dernière position annulant tout changement d’ordre/révision, reprise sans révisions compatible et archive refusée. Premier test d’erreur cherchait le message au niveau Drizzle au lieu de sa cause ; assertion corrigée pour vérifier précisément la cause SQL, puis suite complète relancée.
- 400 tests, TypeScript et build réussis. Pas de migration ni nouvelle dépendance. Listes partielles historiques encore acceptées, créations simultanées non sérialisées par verrou de formation et réordonnancement des objectifs non traité par ce lot. Pas de protection revendiquée pour anciens clients omettant les révisions.
- Recette Docker et sauvegarde/restauration réussies. Aperçu remplacé avec volumes conservés et ancien conteneur before198 arrêté ; index Tailscale identique au build, session antérieure et lectures auteur des cours/diapositives avec no-store vérifiés. Aucun déplacement réel demandé dans l’aperçu. Pas de recette navigateur. Objectif global non achevé.


### Lot 199 — déplacement fonctionnel des chapitres

- Tour précédent classé progression : réordonnancement atomique de diapositives intégré. Inspection du studio : poignée graphique de chapitre sans action de déplacement, pas de mutation dédiée de réordonnancement.
- Nouvelle mutation d’auteur modules.reorder avec liste unique complète et révisions obligatoires. Droits vérifiés pour chaque chapitre ; transaction verrouillant les chapitres actifs de la formation dans l’ordre stable de leurs IDs. Liste partielle, révision dépassée, archive ou liste d’une autre formation refusées avant écriture. Mise à jour des seules positions modifiées, toute erreur annulant le déplacement complet.
- Boutons Monter/Descendre avec libellés accessibles FR/EN/AR remplaçant la poignée inactive des chapitres. Verrou de clic immédiat, blocage aux extrémités et pendant chargement/mutation ; invalidation des listes et de la disponibilité de publication après succès/erreur. Aucun ordre optimiste affiché avant confirmation.
- Trois tests PostgreSQL : concurrence et aucune écriture pour ordre identique, rollback de toutes positions/révisions après panne SQL synthétique et refus archive, liste complète exigée après nouveau chapitre et auteur étranger refusé. 403 tests, TypeScript et build réussis ; tests de réordonnancement chapitre relancés après préfixe de fonction SQL de test rendu distinct de celui des diapositives.
- Aucun changement des versions publiées. Création d’un chapitre après lecture des lignes non sérialisée par verrou de formation ; ne revendique pas de verrouillage des insertions concurrentes. Pas de migration ou nouvelle dépendance ; réordonnancement d’objectifs restant à traiter.
- Trois tests ciblés de réordonnancement chapitre réussis ; recette Docker et sauvegarde/restauration réussies. Aperçu remplacé avec volumes conservés et ancien conteneur before199 arrêté ; index Tailscale identique au build, session antérieure et lectures auteur cours/chapitres avec no-store vérifiés. Liste locale testée vide, tests de déplacement effectués uniquement sur fixtures PostgreSQL. Aucun déplacement réel dans l’aperçu, pas de recette navigateur. Objectif global non achevé.


### Lot 200 — audit transversal de préparation opérationnelle

- Tour précédent classé progression : déplacement de chapitres intégré et vérifié. Audit relisant routes/pages, sélection de tests métier, configuration Vitest, documentation des fournisseurs et de CI, plus état runtime authentifié.
- Nouvelle matrice docs/operational-readiness.md couvrant landing, utilisateurs, apprentissage/examens, studio, B2B, IA multimédia, distanciel, vault, Stripe, abonnements, factures, KYC/KYB, agrément admin, références produit, exploitation et confidentialité. Chaque exigence distingue éléments présents/preuves ciblées et validations manquantes ; aucun statut global d’achèvement.
- Lecture actuelle admin.settings.get : Stripe non configuré, webhook absent, SMTP non configuré, texte/image/voix de tous les fournisseurs IA indisponibles. Variables initiales du conteneur JaaS et identité de facturation absentes. Relevé limité à indicateurs, aucune valeur de clé/adresse ou secret masqué consignée. Pas d’appel fournisseur ni d’action de paiement, émission ou diffusion.
- Vérification effective que le répertoire n’est pas un dépôt Git. La présence des fichiers de workflow ne prouve donc pas leur exécution distante. Vitest en environnement Node confirmé ; contrôles HTTP et 403 tests du lot 199 ne valent pas recette navigateur.
- todo.md corrigé : ancienne affirmation de validation globale et mots de passe de démonstration retirés, renvoi vers audit actuel et fichier d’accès privé. Liste V1 conservée comme historique. Liens locaux de la matrice vérifiés existants.
- Pas de changement applicatif, test répété ou remplacement de conteneur nécessaire pour ces documents. Aperçu toujours lot 199. Progrès de ce tour : preuves runtime nouvelles et audit de périmètre, pas uniquement répétition de statut. Objectif global non achevé ; travaux locaux encore possibles, pas d’impasse globale malgré fournisseurs absents.


### Lot 201 — réordonnancement atomique des objectifs pédagogiques

- Dernier tour de développement (lot 200) classé progression par audit et preuves runtime ; tour d’accès Tailscale suivant limité à une vérification HTTP et du conteneur. Reprise du travail applicatif après inspection actuelle de CLAUDE, plan et implémentation.
- Ancienne boucle d’écritures indépendantes remplacée par transaction avec verrouillage stable des objectifs par ID. Liste non vide, IDs entiers positifs uniques, lignes existantes/non archivées et même formation exigés avant écriture. Positions historiques commençant à zéro préservées ; seules les positions modifiées sont écrites.
- Deux tests PostgreSQL : erreur SQL synthétique sur une écriture tardive annulant toutes les positions, puis reprise réussie ; doublons/IDs invalides, objectif manquant, formations mélangées, auteur étranger et archive refusés sans modification résiduelle.
- 405 tests (93 fichiers), TypeScript, build et recette Docker sauvegarde/restauration réussis. Journaux /tmp/raero-lot201-{focused,tests,check,build,docker,smoke}.log. Aperçu remplacé avec volumes conservés, ancien conteneur before201 arrêté ; index Tailscale identique au build, session antérieure admin et no-store vérifiés. Aucun déplacement réel dans l’aperçu.
- Pas de migration, dépendance ou recette navigateur. Ce lot corrige atomicité et cohérence de formation ; il ne fournit pas encore de révision attendue, de protection contre un ordre périmé ni de boutons de déplacement des objectifs. Listes partielles historiques encore acceptées. Objectif global non achevé.


### Lot 202 — déplacement des objectifs dans le studio avec contrôle d’ordre

- Tour précédent classé progression : atomicité du réordonnancement intégrée. Inspection actuelle du studio confirmant absence de boutons de déplacement et absence de contrôle d’ordre chargé.
- Boutons Monter/Descendre FR/EN/AR, libellés accessibles incluant le titre, limites de liste et chargement/mutation désactivés. Verrou immédiat contre double clic, invalidation de toutes les listes d’objectifs et disponibilité de publication après réponse ; aucun ordre local optimiste.
- Paramètre expectedSortOrders facultatif pour compatibilité des anciens appels, toujours transmis par le studio. Comparaison sous verrou avec positions exactes chargées, y compris null historique. Quand fourni, toute la liste active de la formation est verrouillée et exigée ; ordre périmé, nouvel objectif déjà présent ou liste incomplète refusés. Positions normalisées à zéro après succès.
- Deux tests SQL supplémentaires : deux déplacements concurrents depuis même ordre, un seul accepté, liste partielle et longueur incohérente refusées, reprise sur ordre frais, nouveau membre invalidant l’ancienne liste ; normalisation des positions null. TypeScript a détecté le champ nullable historique ; contrat et test adaptés puis contrôles relancés.
- 407 tests (93 fichiers), TypeScript/build et recette Docker sauvegarde/restauration réussis ; journaux /tmp/raero-lot202-{tests,check,build,docker,smoke}.log. Aperçu remplacé, volumes conservés, ancien before202 arrêté ; index Tailscale conforme, session antérieure admin et no-store vérifiés. Aucun déplacement réel ni recette navigateur.
- Pas de migration ni nouvelle dépendance. Contrôle limité à l’ordre et à la composition de liste : aucune révision de texte d’objectif, aucune sérialisation des insertions après lecture, appels historiques sans positions toujours sans contrôle d’ordre périmé. Objectif global non achevé.


### Lot 203 — protection des brouillons d’objectifs contre les écritures concurrentes

- Tour précédent classé progression : déplacement d’objectifs intégré et vérifié. Inspection actuelle du formulaire et de sa mutation montrant une sauvegarde sans contrôle de version.
- Migration additive objective_revision : compteur non nul et déclencheur utilisant la fonction de révision existante, incrémenté à toute mise à jour, déplacement compris. Schéma et liste de migrations enregistrés ; aucune migration antérieure modifiée.
- Mise à jour sous transaction et verrou de ligne, refus si absent/archivé ou révision attendue dépassée. API auteur acceptant la révision bornée séparément des données éditables ; paramètre facultatif pour anciens clients. Formulaire transmettant sa révision initiale, conservant les champs en cas de conflit et actualisant la liste en arrière-plan. Message persistant FR/EN/AR invitant à copier le brouillon avant fermeture et réouverture ; pas de fusion automatique dans ce lot.
- Test PostgreSQL supplémentaire : deux sauvegardes de même révision, une seule acceptée ; absence d’écriture après conflit, reprise sur version fraîche, changement d’ordre détecté, révision négative refusée, ancien appel compatible, archive protégée même via helper direct.
- 408 tests (93 fichiers), TypeScript/build et recette Docker sauvegarde/restauration réussis. Journaux /tmp/raero-lot203-{tests,check,build,docker,smoke}.log. Aperçu remplacé avec volumes conservés, ancien before203 arrêté ; index Tailscale conforme, session antérieure admin et no-store vérifiés. Aucune édition réelle dans l’aperçu ni recette navigateur.
- Les clients historiques omettant la révision ne bénéficient pas du contrôle de brouillon périmé ; création d’objectif sans UUID de reprise et rapprochement visuel des brouillons restent à traiter. Aucune modification des versions de formation déjà publiées. Objectif global non achevé.


### Lot 204 — comparaison des brouillons d’objectifs pédagogiques

- Tour précédent classé progression : révision d’objectifs intégrée et vérifiée. Inspection actuelle du formulaire et composant partagé de comparaison avant extension.
- Après conflit, lecture fraîche de la liste autorisée et comparaison avec le brouillon initial ; échec de lecture ou objectif inaccessible laissant les saisies en place. Champs et sauvegarde bloqués pendant lecture/comparaison. Annulation revenant au brouillon intact ; application préparant le formulaire et adoptant la révision comparée, sans écriture serveur. Enregistrement explicite restant requis et contrôlé par révision.
- Définition indivisible code/titre/description/niveau de connaissances ; chapitre, caractère obligatoire et ordre séparés. Composant partagé étendu avec libellés FR/EN/AR. Message de conflit adapté pour proposer la comparaison plutôt que copier puis fermer. Fermeture du dialogue conserve son comportement existant ; pas de sauvegarde durable du brouillon.
- Deux tests de rapprochement : définition locale avec placement/ordre distants compatibles, conflit de définition imposant choix complet sans mélange automatique des niveaux et descriptions. 410 tests (94 fichiers), TypeScript/build réussis ; journaux /tmp/raero-lot204-{tests,check,build,docker}.log.
- SHA256 du bundle serveur identique à celui en exécution vérifié. Image Docker reconstruite et fichiers publics copiés sans arrêt, anciens fichiers hachés conservés ; index Tailscale conforme au build. Pas de migration, dépendance ou nouvelle recette Docker complète requise pour interface seule ; aucune recette navigateur. Objectif global non achevé.


### Lot 205 — protection de sortie du brouillon d’objectif

- Tour précédent classé progression : comparaison d’objectifs intégrée. Inspection du formulaire montrant une fermeture directe sans avertissement, contrairement aux éditeurs de chapitres/questions ; lecture du hook useDraftExitGuard avant réutilisation.
- Avertissement avant fermeture explicite d’un brouillon modifié ou d’une comparaison et protection native beforeunload. Fermeture du dialogue bloquée pendant sauvegarde/lecture ; bouton Annuler désactivé durant ces opérations. Référence initiale réajustée après rapprochement à la version serveur comparée, pour détecter correctement les changements restant à enregistrer.
- Verrou immédiat commun sauvegarde/comparaison contre doubles appels avant rendu React ; callbacks de résultat vérifiant le montage avant modification de l’interface et notification. Pas de stockage durable ni de protection générale des navigations internes SPA revendiquée. Reprise d’une création après réponse réseau perdue toujours sans UUID serveur.
- TypeScript et build réussis, relecture du code modifié ; aucune nouvelle suite de tests répétant ce câblage de hook existant. Dernière suite complète : 410 tests au lot 204, pas de recette navigateur. Journaux /tmp/raero-lot205-{check,build,docker}.log.
- Bundle serveur SHA256 identique à celui en exécution. Image reconstruite, interface copiée sans interruption, anciens fichiers hachés conservés et index Tailscale conforme vérifié. Pas de migration ou nouvelle dépendance. Objectif global non achevé.


### Lot 206 — reprise des créations d’objectifs sans doublon

- Tour précédent classé progression : protection du brouillon d’objectif. Inspection actuelle du service de création de chapitres et de la mutation d’objectifs avant adaptation du mécanisme de reprise existant.
- Nouveau service objectiveCreation : entrée canonique, UUID facultatif normalisé, empreinte SHA256, acteur actif et droits de formation relus, transaction avec verrou par acteur/demande. Objectif et registre créés ensemble. Reprise identique retournant le même ID sans réécrire ni restaurer une archive ; charge différente avec même UUID refusée.
- Migration additive objective_creation_requests, index unique acteur/UUID, lien unique objectif et déclencheur immutable ; schéma et migration enregistrés. Ancienne création sans UUID compatible. Studio conservant UUID et signature de formulaire tant que le dialogue reste ouvert, nouveau UUID si contenu change ; messages FR/EN/AR de récupération ou archive.
- Trois tests PostgreSQL adaptés au contrat objectif : concurrence, UUID en majuscules, refus charge différente, auteur étranger/suspendu, édition et archive préservées, registre immutable ; révocation d’affiliation entreprise ; anciennes requêtes et ordre canonique des clés. 413 tests (95 fichiers), TypeScript/build réussis. Libellés français et noms locaux corrigés après première suite, TypeScript/build finaux réussis.
- Recette Docker sauvegarde/restauration réussie ; journaux /tmp/raero-lot206-{tests,check,build,docker,smoke}.log. Aperçu remplacé, volumes conservés, ancien before206 arrêté ; index Tailscale conforme, session antérieure admin et no-store vérifiés. Aucune création réelle dans l’aperçu ni recette navigateur.
- UUID du formulaire non conservé après fermeture/rechargement ; aucune sérialisation des changements de droits avec toute la transaction. Pas de nouvelle dépendance. Objectif global non achevé.


### Lot 207 — pagination des dossiers personnels KYC/KYB

- Tour précédent classé progression : reprise de création d’objectifs. Inspection actuelle de VerificationCenter et de ses routes révélant une liste personnelle complète non bornée.
- Nouvelle minePage : 50 dossiers par page, curseur ID décroissant stable, projection id/kind/legalName/status seulement ; utilisateur actif et affiliations MANAGER actives de sociétés actives relus. KYC personnel et KYB autorisés explicitement distingués. Ancienne mine conservée pour compatibilité.
- Interface utilisant minePage uniquement en vue personnelle ; commandes derniers/plus anciens FR/EN/AR, chargement bloquant les déplacements et confirmation des brouillons avant changement de page. Sélection, note et formulaire réinitialisés ; erreurs conservant l’affichage d’erreur existant plutôt que des données périmées. Mutations invalidant aussi les pages personnelles.
- Test SQL supplémentaire : 55 sociétés gérées, projection minimale, arrivée d’un KYC sans perturber la seconde page, société supplémentaire, révocation d’affiliation et utilisateur suspendu. Fixture initiale omettant subjectKey rejetée ; corrigée vers des sociétés distinctes et clés canoniques avant relance. 414 tests (95 fichiers), TypeScript/build réussis.
- Recette Docker et sauvegarde/restauration réussies ; journaux /tmp/raero-lot207-{tests,check,build,docker,smoke}.log. Aperçu remplacé avec volumes conservés et before207 arrêté ; index Tailscale, session antérieure admin, minePage et no-store vérifiés. La lecture locale valide le contrat HTTP, les pages non vides sont couvertes par fixtures SQL. Aucun dossier réel créé, aucune recette navigateur.
- Pas de migration/dépendance. Pas de filtre de statut personnel ou recherche ajoutés ; ancien endpoint mine non borné reste disponible. Objectif global non achevé.


### Lot 208 — résumés privés et bornés sur les anciennes listes KYC/KYB

- Tour précédent classé progression : pagination personnelle. Recherche actuelle de tous les consommateurs hors tests : interface utilisant exclusivement minePage/queuePage ; anciennes routes encore exposées avec dossiers complets et mine non bornée.
- mine et queue conservées sous forme de tableaux, mais projection limitée à id/kind/legalName/status, tri ID décroissant et limite 200. Branche entreprise de mine explicitement KYB ; aucun justificatif/adresse/note renvoyé par une liste. Détail autorisé restant disponible via detail, consultation exhaustive via endpoints paginés.
- Modification du contrat des routes historiques : consommateurs extérieurs éventuels utilisant leurs anciens champs détaillés doivent appeler detail ; aucune utilisation locale de ces champs trouvée. Aucun dossier supprimé.
- Test PostgreSQL avec 205 sociétés : plafond et ordre, projection exacte des deux routes, accès détail préservé, liste étrangère vide et revue admin interdite à un utilisateur. 415 tests (95 fichiers), TypeScript/build et recette Docker sauvegarde/restauration réussis ; journaux /tmp/raero-lot208-{tests,check,build,docker,smoke}.log.
- Aperçu remplacé avec volumes conservés et before208 arrêté ; index Tailscale conforme, session antérieure admin, mine/queue et no-store vérifiés. Contrôles de listes non vides en fixtures SQL ; pas de dossier réel créé ni recette navigateur. Pas de migration/dépendance. Objectif global non achevé.


### Lot 209 — contrôle des modifications simultanées KYC/KYB

- Tour précédent classé progression : listes historiques bornées et minimisées. Inspection actuelle de saveVerification montrant une sérialisation des écritures mais aucun contrôle du brouillon chargé.
- Migration additive verification_revision : compteur et déclencheur à toute mise à jour du dossier ; schéma et liste de migrations mis à jour. expectedRevision facultatif et borné, null pour une création attendue. Sous verrou existant, une révision dépassée ou un dossier déjà présent pour une création attendue sont refusés avant écriture et événement.
- Interface conservant la révision lors du chargement effectif du formulaire ; brouillon modifié ne prenant pas silencieusement la révision d’un rafraîchissement. Création envoyant null. Conflit déclenchant actualisation et message FR/EN/AR ; ancien comportement de réhydratation lorsque le statut verrouille le dossier conservé. Pas de fusion de brouillons ; anciens appels sans révision compatibles mais non protégés contre brouillon périmé.
- Test PostgreSQL : deux sauvegardes concurrentes depuis même révision, une acceptée ; historique limité à création et modification acceptée, création attendue refusée sans changement, reprise avec révision fraîche et entrée négative refusée. 416 tests (95 fichiers), TypeScript/build réussis ; build final après ajustement du message.
- Recette Docker sauvegarde/restauration réussie ; journaux /tmp/raero-lot209-{tests,check,build,docker,smoke}.log. Aperçu remplacé avec volumes conservés et before209 arrêté ; index Tailscale conforme, session antérieure admin et no-store vérifiés. Aucun dossier réel modifié ni recette navigateur. Objectif global non achevé.


### Lot 210 — soumission et décision KYC/KYB liées à la version consultée

- Tour précédent classé progression : révision des sauvegardes de dossiers. Inspection actuelle des transitions et de la saisie de décision montrant qu’un dossier corrigé puis resoumis pouvait recevoir une décision préparée lors du cycle précédent.
- expectedRevision facultatif borné ajouté aux mutations submit/review et au helper de transition. Contrôle sous verrou après droits et état admissible, avant mise à jour et événement. Interface envoyant la version courante lors de soumission ; version de revue fixée au début de rédaction de la note, non remplacée par un rafraîchissement.
- Erreurs de transition actualisant le dossier. Message FR/EN/AR après conflit de revue demandant de consulter les informations actuelles et de réécrire le motif ; nouvelle saisie depuis note vide fixant la nouvelle révision. Note remise à zéro après succès. Anciennes requêtes sans révision restent compatibles et ne bénéficient pas de cette protection.
- Test PostgreSQL supplémentaire : soumission après modification refusée avec révision périmée ; demande de complément, correction et resoumission ; décision de l’ancien cycle refusée sans modification ni événement, décision sur version actuelle acceptée. 417 tests (95 fichiers), TypeScript/build finaux et recette Docker sauvegarde/restauration réussis ; journaux /tmp/raero-lot210-{tests,check,build,docker,smoke}.log.
- Aperçu remplacé avec volumes conservés et before210 arrêté ; index Tailscale conforme, session antérieure admin et no-store vérifiés. Aucune soumission/décision réelle, aucune recette navigateur. Pas de migration/dépendance. Objectif global non achevé.


### Lot 211 — révision des dossiers lors des changements de justificatifs

- Tour précédent classé progression : transitions KYC/KYB contrôlées par révision. Inspection actuelle des dépôts/archives montrant que les modifications de pièces ne faisaient pas avancer la révision du dossier.
- Ajout effectif et archivage effectif mettant à jour updatedAt dans la même transaction, déclencheur existant incrémentant la révision. Reprise d’un dépôt existant, même archivé, retournant sans nouvelle révision ni événement. Aucun changement rétroactif des historiques.
- Archivage relisant la pièce après acquisition du verrou de dossier : une seconde demande simultanée observe désormais l’archive déjà effectuée et n’insère pas un événement supplémentaire.
- Test PostgreSQL supplémentaire : ajout puis reprise, soumission depuis ancienne révision refusée, deux archives simultanées avec une seule révision et un seul événement, reprise du dépôt archivé sans réactivation. 418 tests (95 fichiers), TypeScript/build et recette Docker sauvegarde/restauration réussis ; journaux /tmp/raero-lot211-{tests,check,build,docker,smoke}.log.
- Aperçu remplacé avec volumes conservés et before211 arrêté ; index Tailscale conforme, session antérieure admin et no-store vérifiés. Aucune pièce réelle ajoutée/archivée ni recette navigateur. Pas de migration/dépendance. Objectif global non achevé.


### Lot 212 — protection de sortie des saisies et motifs KYC/KYB

- Tour précédent classé progression : révision de justificatifs et archivage concurrent corrigés. Inspection actuelle de canLeave montrant qu’il ignorait les motifs de revue ; lien Mon espace sans garde et aucune protection native beforeunload.
- Réutilisation du hook useDraftExitGuard existant, actif pour formulaire modifié, motif même partiellement saisi ou opération en cours. Commandes existantes de sélection, pagination, changement de mode, filtre et nouveau dossier bénéficiant désormais du contrôle des notes de revue aussi. Lien Mon espace confirmant les abandons et bloqué pendant busy ; protection native rechargement/fermeture ajoutée.
- Message FR/EN/AR mentionnant formulaire et motif. Aucune persistence de données privées dans le navigateur. Garde limitée aux commandes raccordées et au beforeunload ; ne prétend pas intercepter toute navigation SPA ou les liens de PublicNav.
- TypeScript/build et relecture du câblage réussis ; dernière suite complète 418 tests au lot 211, pas de test miroir de hook ni recette navigateur. Journaux /tmp/raero-lot212-{check,build,docker}.log.
- Bundle serveur SHA256 identique à celui en exécution. Image reconstruite et interface copiée sans arrêt, anciens fichiers hachés conservés ; index Tailscale conforme vérifié. Pas de migration/dépendance ni nouvelle recette Docker complète pour interface seule. Objectif global non achevé.


### Lot 213 — traduction arabe du parcours coffre documentaire

- Tour précédent classé progression : protection de sortie KYC/KYB. Recherche et inspection actuelle du dépôt Passport : reprise existante, mais 83 libellés passport encore anglais dans le dictionnaire arabe.
- Traduction des 83 libellés : identité, types de pièces, formulaire de dépôt, états de transfert, validité, formations et certificats, profil, qualifications Part-66 et suivi des certificats de type. Paramètres {percent}/{count}/{rating} conservés par vérification automatique ; noms R-AERO/EASA/Part-66 conservés.
- Aucun libellé de la famille passport sans caractère arabe après modification. Cela vérifie le périmètre de traduction, pas la qualité visuelle RTL ni la traduction de toute l’application. Pas de recette navigateur ni de relecture linguistique externe.
- Trois tests de dictionnaires/interpolation réussis, TypeScript/build réussis ; dernière suite métier complète 418 tests au lot 211. Journaux /tmp/raero-lot213-{locales,check,build,docker}.log.
- Bundle serveur SHA256 identique à celui en exécution. Image reconstruite et interface copiée sans interruption, anciens fichiers hachés conservés ; index Tailscale conforme vérifié. Pas de migration/dépendance ni nouvelle recette Docker complète pour traductions seules. Objectif global non achevé.


### Lot 214 — erreurs de dépôt documentaire dans le registre administrateur

- Tour précédent classé progression : traduction arabe du coffre. Inspection actuelle d’ApprovalCenter montrant un catch silencieux sur lecture FileReader, pas de contrôle MIME/non-vide local, champs modifiables pendant lecture et absence de verrou immédiat.
- Gestion explicite FR/EN/AR des erreurs fichier/lecture/envoi non confirmé. Vérification taille non nulle jusqu’à 8 Mo et MIME PDF/JPEG/PNG avant lecture ; contrôles serveur inchangés. FileReader annulé au démontage, callbacks d’interface conditionnés au montage.
- Verrou immédiat, métadonnées et fichier capturés pour une tentative, fieldset bloquant les modifications pendant lecture/envoi. Fichier et champ natif vidés après succès, confirmation affichée. Échec réseau actualisant la liste et invitant à vérifier les versions avant nouvelle tentative ; aucun mécanisme serveur de reprise UUID ajouté.
- TypeScript/build et relecture de l’implémentation réussis. Dernière suite métier complète 418 tests au lot 211 ; pas de test miroir de callbacks ni recette navigateur. Journaux /tmp/raero-lot214-{check,build,docker}.log.
- Bundle serveur SHA256 identique à celui en exécution. Image reconstruite et interface copiée sans interruption, anciens fichiers hachés conservés ; index Tailscale conforme vérifié. Pas de migration/dépendance ni nouvelle recette Docker complète pour interface seule. Objectif global non achevé.


### Lot 215 — reprise des dépôts documentaires d’agrément

- Tour précédent classé progression : traitement des erreurs de dépôt administrateur. Inspection actuelle du serveur confirmant validation stricte partagée déjà présente, mais stockage indépendant de toute reprise après réponse perdue.
- Migration additive approval_upload_requests : requestId et empreinte nullable, index unique déposant/demande. Dépôt avec UUID normalisé, empreinte canonique des métadonnées et hash fichier, droits admin/actif relus. Transaction verrouillée par acteur/demande, document existant identique retourné sans stockage ni nouvel événement ; changement de contenu refusé. Anciennes requêtes sans UUID compatibles ; documents historiques intacts.
- Interface conservant signature et UUID de la tentative en mémoire, réutilisés à contenu identique après erreur et remis à zéro après succès. Fermeture/rechargement non couverts par cette reprise ; stockage orphelin après échec SQL non réconcilié dans ce lot.
- Test SQL supplémentaire : trois dépôts simultanés avec UUID normalisé, un document/un événement ; empreinte différente et base64 invalide refusés, ordre de clés sans impact, administrateur suspendu refusé à la reprise. 419 tests (95 fichiers), TypeScript/build et recette Docker sauvegarde/restauration réussis ; journaux /tmp/raero-lot215-{tests,check,build,docker,smoke}.log.
- Aperçu remplacé avec volumes conservés et before215 arrêté ; index Tailscale conforme, session antérieure admin et no-store vérifiés. Aucun dépôt administratif réel ni recette navigateur. Pas de nouvelle dépendance. Objectif global non achevé.


### Lot 216 — autorisation fraîche de toutes les opérations du registre d’agrément

- Tour précédent classé progression : reprise des dépôts documentaires. Inspection de createContext et adminProcedure : contexte HTTP relisant déjà utilisateur/session, middleware admin vérifiant seulement ce contexte. Registre hors upload sans seconde lecture fraîche.
- Procédure locale commune aux sept opérations approval : utilisateur relu avant gestion métier, administrateur actif requis, contexte remplacé par cette identité fraîche. Vérification spécifique upload devenue redondante remplacée par utilisation du contexte contrôlé.
- Test SQL supplémentaire avec contexte initial conservé : overview/saveProfile/setStatus/upload/createFinding/updateFinding/closeFinding tous refusés après suspension puis retrait du rôle admin ; aucun document/événement créé. Défense des contextes périmés, pas de preuve d’une ancienne faille HTTP systématique. Aucune sérialisation du changement de rôle pendant toute la transaction métier revendiquée.
- 420 tests (95 fichiers), TypeScript/build et recette Docker sauvegarde/restauration réussis ; journaux /tmp/raero-lot216-{tests,check,build,docker,smoke}.log. Aperçu remplacé, volumes conservés et before216 arrêté ; index Tailscale conforme, session antérieure admin, overview et no-store vérifiés.
- Aucune modification réelle du registre ni recette navigateur. Pas de migration/dépendance, pas de changement du middleware global. Objectif global non achevé.


### Lot 217 — affichage du registre après erreur ou changement d’identité

- Tour précédent classé progression : autorisation fraîche des sept procédures. Inspection actuelle d’ApprovalCenter montrant un simple message d’erreur au-dessus des données mises en cache et des formulaires, avec états locaux conservés sur changement d’identité.
- Contenu administratif (résumés/formulaires/documents/écarts/historique) masqué lorsque overview est en erreur. Section de reprise FR/EN/AR et bouton Réessayer désactivé pendant la lecture. En-tête générique restant visible, aucun résultat vide présenté comme une lecture réussie.
- Workspace monté avec clé utilisateur/rôle, suivant le mécanisme déjà présent dans le centre de vérification. Changement d’identité réinitialisant tous les états locaux et exécutant le nettoyage FileReader existant. Pas de détection instantanée d’une révocation distante revendiquée avant retour serveur/auth.
- TypeScript/build et relecture réussis ; dernière suite complète 420 tests au lot 216, pas de test miroir de conditions JSX ni recette navigateur. Journaux /tmp/raero-lot217-{check,build,docker}.log.
- Bundle serveur SHA256 identique à celui en exécution. Image reconstruite et interface copiée sans interruption, anciens fichiers hachés conservés ; index Tailscale conforme vérifié. Pas de migration/dépendance ni nouvelle recette Docker complète pour interface seule. Objectif global non achevé.


### Lot 218 — brouillon et révision du dossier organisme

- Tour précédent classé progression : affichage du registre après erreur/changement d’identité. Inspection actuelle du formulaire montrant réhydratation automatique à chaque refresh et sauvegarde sans contrôle de version.
- Migration additive operator_approval_revision : compteur incrémenté à toute mise à jour (statut compris). saveProfile acceptant expectedRevision facultatif/null et comparant sous verrou existant avant toute écriture ; contrôle séparé des valeurs persistées. Ancienne requête sans révision compatible.
- Formulaire marquant les saisies modifiées, conservant leur version de départ pendant rafraîchissements ; champs désactivés et verrou immédiat pendant sauvegarde. Réhydratation après succès ou abandon explicite, bouton de rechargement après conflit. Avertissement beforeunload et retour Administration pour ce brouillon ; autres formulaires non couverts par cette garde.
- Test SQL supplémentaire : statut enregistré après chargement, ancienne sauvegarde refusée sans remise en préparation ni événement ; version fraîche acceptée et révision incrémentée, création attendue null refusée si organisme existe. 421 tests (95 fichiers), TypeScript/build finaux et recette Docker sauvegarde/restauration réussis ; journaux /tmp/raero-lot218-{tests,check,build,docker,smoke}.log.
- Aperçu remplacé avec volumes conservés et before218 arrêté ; index Tailscale conforme, session antérieure admin, overview et no-store vérifiés. Aucun profil/statut réel modifié ni recette navigateur. Contrôle de révision des décisions setStatus encore à traiter ; pas de nouvelle dépendance. Objectif global non achevé.


### Lot 219 — décisions d’agrément contrôlées par révision

- Tour précédent classé progression : brouillon/révision du dossier organisme. Inspection actuelle de setStatus et du formulaire montrant l’absence de contrôle de version pour les décisions.
- expectedRevision facultatif borné comparé sous verrou avant validations documentaires et écriture. Décision périmée refusée sans événement. Interface fixant la version au premier changement du formulaire, conservée pendant rafraîchissements ; verrou immédiat contre double envoi, champs désactivés pendant mutation ou modifications non enregistrées du dossier organisme.
- Succès vidant motif et références documentaires. Échec actualisant le registre et conservant la décision préparée ; action explicite pour effacer la décision et actualiser. Ancien appel sans version compatible et non protégé contre décision périmée. Pas de validation réglementaire nouvelle revendiquée.
- Test SQL supplémentaire : ancienne décision après changement de périmètre refusée sans modification/événement ; deux décisions concurrentes avec même révision, une acceptée. 422 tests (95 fichiers) réussis. Erreur TypeScript initiale useRef sans argument corrigée, TypeScript/build finaux réussis.
- Recette Docker sauvegarde/restauration réussie ; journaux /tmp/raero-lot219-{tests,check,build,docker,smoke}.log. Aperçu remplacé avec volumes conservés et before219 arrêté ; index Tailscale conforme, session antérieure admin et no-store vérifiés. Aucune décision réelle ni recette navigateur. Pas de migration/dépendance. Objectif global non achevé.


### Lot 220 — révision des plans d’action et de leur clôture

- Tour précédent classé progression : décisions d’agrément contrôlées par révision. Inspection actuelle des écarts montrant des écritures verrouillées sans version de brouillon attendue.
- Migration additive approval_finding_revision : compteur et déclencheur à toute mise à jour. updateFinding/closeFinding acceptant révision facultative bornée, comparée sous verrou avant écriture et événement. Indépendance de clôture existante conservée.
- Interface fixant révision à la sélection de l’écart, actualisée après sauvegarde propre ; champs et sélection désactivés pendant mutation. Erreur persistante et rafraîchissement après conflit, nouvelle sélection rechargeant le plan. Clôture bloquée si champs du plan diffèrent de la version courante, avec message FR/EN/AR.
- Test SQL supplémentaire : deux modifications de même révision, une acceptée ; plan prêt modifié après consultation, ancienne clôture refusée sans événement et clôture sur version actuelle acceptée. 423 tests (95 fichiers), TypeScript/build finaux et recette Docker sauvegarde/restauration réussis ; journaux /tmp/raero-lot220-{tests,check,build,docker,smoke}.log.
- Aperçu remplacé avec volumes conservés et before220 arrêté ; index Tailscale conforme, session antérieure admin et no-store vérifiés. Aucun écart réel modifié/clôturé ni recette navigateur. Anciennes requêtes sans révision toujours compatibles et non protégées contre brouillon périmé. Pas de nouvelle dépendance. Objectif global non achevé.


### Lot 221 — historique du registre d’agrément consultable par pages

- Tour précédent classé progression : révision des plans d’action. Inspection actuelle montrant l’historique affiché depuis overview limité aux 200 derniers événements.
- Nouvelle historyPage protégée par procédure admin fraîche, curseur ID positif borné et 50 lignes avec nextCursor. Historique immutable inchangé ; tri ID stable plutôt que timestamp pouvant être partagé. Vue historique utilisant cette route, commandes derniers/plus anciens FR/EN/AR, états chargement/vide/erreur avec reprise et données périmées masquées après erreur. Toutes mutations invalidant aussi cet historique.
- Test SQL supplémentaire : 55 événements à même date, première page exacte, nouvelle arrivée non insérée dans la seconde, aucun chevauchement, utilisateur suspendu refusé. 424 tests (95 fichiers), TypeScript/build et recette Docker sauvegarde/restauration réussis ; journaux /tmp/raero-lot221-{tests,check,build,docker,smoke}.log.
- Aperçu remplacé avec volumes conservés et before221 arrêté ; index Tailscale conforme, session antérieure admin, nouvelle route et no-store vérifiés. Listes non vides validées sur fixtures SQL, aucune écriture réelle ni recette navigateur. overview conserve son ancien tableau events borné pour compatibilité ; pas de filtre/recherche historique ajouté.
- Pas de migration/dépendance. Objectif global non achevé.


### Lot 222 — reconstruction du bilan de diffusion après interruption finale

- Tour précédent classé progression : pagination de l’historique d’agrément. Inspection actuelle des diffusions : résultats par destinataire persistés, mais panne avant bilan global laissant une reprise signalée incomplète même si tous les résultats existent.
- Finalisation commune sous verrou transactionnel par diffusion, bilan existant retourné ou agrégation des résultats individuels. Écriture seulement si leur nombre correspond exactement aux destinataires attendus ; accepted/unconfirmed/skipped conservant leur sens. Reprise d’une demande existante pouvant ainsi réparer le seul bilan sans nouvel envoi ni notification. Journal incomplet toujours refusé ; aucun envoi automatique des statuts absents ou incertains.
- Test SQL/SMTP simulé supplémentaire : panne synthétique d’insertion du bilan après résultats individuels, puis deux reprises concurrentes ; une ligne de bilan, un seul appel SMTP simulé, deux notifications initiales inchangées et compteurs exacts. 425 tests (95 fichiers), TypeScript/build et recette Docker sauvegarde/restauration réussis ; journaux /tmp/raero-lot222-{tests,check,build,docker,smoke}.log.
- Aperçu remplacé avec volumes conservés et before222 arrêté ; index Tailscale conforme, session antérieure admin et no-store vérifiés. Aucun message réel envoyé, aucune réparation réelle déclenchée et pas de recette navigateur. Pas de migration/dépendance. Travailleur SMTP durable général non implémenté par ce lot. Objectif global non achevé.


### Lot 223 — récupération explicite du bilan depuis le journal des diffusions

- Tour précédent classé progression : reconstruction interne de bilan complet. Inspection actuelle du journal et des routes révélant que cette réparation exigeait encore de répéter la demande originale.
- Nouvelle mutation recoverBroadcastOutcome, droits admin actifs relus, appel du finaliseur du lot 222. Journal incomplet refusé avec PRECONDITION_FAILED ; bilan existant retourné, sans aucun appel d’envoi. Bouton Reconstituer le bilan dans les entrées sans bilan, explication FR/EN/AR précisant aucun message envoyé ; indisponible pendant requête/mutation et actualisation après résultat.
- Test SQL/SMTP simulé : journal incomplet refusé sans bilan, résultat explicite non envoyé ajouté en fixture puis réparation réussie, sendEmail jamais appelé et administrateur suspendu refusé. Première fixture omettait l’audience/destinataire obligatoire ; corrigée, suite complète relancée.
- 426 tests (95 fichiers), TypeScript/build et recette Docker sauvegarde/restauration réussis ; journaux /tmp/raero-lot223-{tests,check,build,docker,smoke}.log. Aperçu remplacé avec volumes conservés et before223 arrêté ; index Tailscale conforme, session antérieure admin et no-store vérifiés.
- Aucun message réel ni réparation de diffusion réelle exécutés, pas de recette navigateur. Pas de migration/dépendance. Reprise des envois interrompus avec résultats absents et travailleur SMTP durable toujours hors de ce lot. Objectif global non achevé.


### Lot 224 — traduction arabe du parcours compagnie et dossier technicien

- Tour précédent classé progression : récupération explicite des bilans de diffusion. Inspection actuelle du dictionnaire arabe montrant 176 valeurs anglaises dans companyDashboard et technicianFileDialog.
- Traduction des libellés de salariés/import-export, échéances et entraînement périodique, informations société, abonnements, analyse des besoins, dossier technicien, attestations et décisions du responsable. Références techniques Part-66/R-AERO/TNA/CSV conservées. Distinction entre données de suivi fournies et détermination humaine de conformité conservée.
- Vérification des paramètres d’interpolation pour chaque remplacement, aucun libellé de ces deux familles sans caractère arabe après modification. Ce contrôle ne constitue pas une validation linguistique externe ni une recette RTL ; textes contractuels et comportements métier existants non modifiés.
- Trois tests de dictionnaires/interpolation, TypeScript/build réussis ; dernière suite métier complète 426 tests au lot 223. Journaux /tmp/raero-lot224-{locales,check,build,docker}.log.
- Bundle serveur SHA256 identique à celui en exécution. Image reconstruite et interface copiée sans interruption, anciens fichiers hachés conservés ; index Tailscale conforme vérifié. Pas de migration/dépendance ni nouvelle recette Docker complète pour traductions seules. Objectif global non achevé.


### Lot 225 — lecture et erreurs de l’import CSV compagnie

- Tour précédent de simple vérification d’accès classé sans progression applicative ; disponibilité Docker/Tailscale revalidée avant reprise. Inspection du code actuel : lecture FileReader non protégée, aucune gestion des erreurs/annulations, contrôle désactivé seulement après le début de la mutation.
- Verrou immédiat couvrant lecture et envoi, état occupé dès la sélection, fermeture du dialogue bloquée pendant le traitement, rejet explicite des fichiers vides/illisibles, erreur persistante FR/EN/AR distinguant lecture et résultat d’envoi incertain. Réinitialisation du champ fichier après traitement permettant de resélectionner le même fichier. Lecture annulée au démontage et callbacks d’interface ignorés après démontage.
- Aucun nouvel envoi automatique en cas d’erreur : le message demande de vérifier la liste avant de réessayer car le serveur importe ligne par ligne. Ce verrou ne garantit pas l’idempotence entre onglets ou après rechargement. Parseur CSV serveur, validation métier et caractère partiel des insertions inchangés ; ils restent à approfondir. Pas de protection de toutes les navigations SPA ni de recette navigateur.
- TypeScript, trois tests de dictionnaires et build réussis ; journaux /tmp/raero-lot225-{check,locales,build,docker}.log. Dernière suite métier complète : 426 tests au lot 223. Aucun import réel exécuté et aucun test UI ne prouve encore les interactions FileReader.
- SHA256 serveur identique à l’instance en exécution ; image reconstruite et frontend copié sans interruption. Index Tailscale comparé au build, HTTP 200. Aucune migration/dépendance. Objectif global toujours en cours.


### Lot 226 — parseur CSV et validation des salariés

- Tour précédent classé progression : gestion de lecture/envoi dans le dialogue d’import. Inspection serveur confirmant une découpe naïve sur chaque retour ligne et point-virgule, sans traitement des guillemets, ni validation des e-mails ou des longueurs avant insertion.
- Nouveau parseur employeeCsv : séparateur point-virgule, BOM UTF-8, guillemets doublés, champs multilignes, CR/LF/CRLF et numéros de lignes physiques. Lecture complète avant insertions ; guillemets cassés, en-têtes inconnus/manquants ou alias en double refusés globalement. Limites 1 Mio UTF-8 et 1 000 salariés non vides. Alias français/anglais historiques conservés ; colonnes inconnues désormais explicitement refusées au lieu d’être ignorées.
- Validation Zod des champs requis, adresse e-mail et longueurs alignées sur employees. Nombre de colonnes incorrect ou champs invalides signalés par ligne ; lignes valides importées comme auparavant, sans modifier les salariés existants. Échec SQL signalé sans recopier l’adresse personnelle. Le format reste celui indiqué dans le dialogue, sans détection automatique des CSV à virgules ; espaces après fermeture de guillemets refusés. L’export de tableau localisé ne constitue pas un modèle de réimport garanti.
- Quatre tests de parseur (export cité/échappé, accents/arabe/multiligne, lignes invalides, ambiguïtés/en-têtes, limites) et un test PostgreSQL prouvant les champs enregistrés et zéro nouvelle insertion après un document syntaxiquement cassé malgré une première ligne valide. Correction d’un usage de spread Set incompatible avec la cible TypeScript, puis suite complète validée : 431 tests, 97 fichiers. TypeScript/build et recette Docker sauvegarde/restauration réussis, journaux /tmp/raero-lot226-{focused,tests,check,build,docker,smoke}.log.
- Instance locale remplacée, volumes conservés et ancien conteneur before226 arrêté. Index Tailscale comparé au build ; session admin antérieure encore valide et no-store vérifiés. Aucun import réel dans l’aperçu, aucune recette navigateur, aucune migration/dépendance.
- Limites restantes : import partiel en cas d’erreur de ligne/SQL, absence d’idempotence durable entre requêtes/onglets, droits non verrouillés pendant tout le traitement, limites serveur non encore affichées en amont dans le dialogue. Ni dédoublonnage d’effectif ni invitations automatiques ajoutés. Objectif global toujours non achevé.


### Lot 227 — modèle et consignes d’import CSV

- Tour précédent classé progression : parseur et validation serveur déployés. Relecture du dialogue et du parseur confirmant l’absence de modèle téléchargeable et de limites affichées avant la sélection.
- Modèle UTF-8 BOM téléchargeable avec les neuf en-têtes stables du format d’import, sans salarié exemple. Affichage des mêmes en-têtes depuis une constante partagée avec le modèle ; bloc LTR défilable pour le contenu technique en interface arabe. Label du fichier relié à son contrôle et aux consignes.
- Consignes FR/EN/AR : colonnes requises, séparateur, UTF-8, 1 Mio/1 000 salariés, import déclenché dès la sélection et caractère partiel des insertions. Refus des fichiers de plus de 1 Mio avant FileReader avec message explicite et champ réinitialisé. Le serveur reste responsable du comptage des salariés et de la validation des contenus ; aucune invitation ni import automatique ajouté.
- Test du modèle réellement consommé par le dialogue : aucune ligne exemple, en-têtes acceptés par le parseur après remplissage avec point-virgule cité. Huit tests ciblés (cinq CSV, trois dictionnaires), TypeScript et build réussis. Journaux /tmp/raero-lot227-{tests,check,build,docker}.log ; dernière suite complète 431 tests au lot 226, pas de nouvelle recette serveur pour ce frontend.
- SHA256 serveur identique à l’instance en cours. Image reconstruite et interface copiée sans redémarrage ; index Tailscale comparé au build, HTTP 200. Aucun import réel, pas de recette navigateur du téléchargement ou du contrôle de taille. Limites métier du lot 226 toujours présentes, sauf limites désormais annoncées avant sélection. Objectif global non achevé.


### Lot 228 — destination et droits d’import conservés dans la transaction

- Tour précédent classé progression : modèle CSV et consignes déployés. Inspection de la mutation révélant que requireManagedCompany vérifiait la compagnie du contexte puis importEmployeesCSV relisait users.companyId sans conserver cette destination ni revérifier les droits. Un changement entre ces lectures pouvait modifier la destination effective.
- La mutation passe désormais l’identifiant autorisé au service. Transaction avec verrous partagés sur compagnie, compte et affiliation manager active : compagnie active, compte actif et compagnie sélectionnée inchangée requis ; rôle administrateur relu ou affiliation manager exigée. Ces verrous sont conservés jusqu’au commit. Un changement de destination déjà effectué produit CONFLICT ; droits révoqués/suspensions produisent FORBIDDEN. Base indisponible : erreur au lieu d’un faux bilan vide réussi.
- Lignes validées insérées via savepoints pour préserver le fonctionnement partiel si une ligne échoue en SQL. Parsing syntaxique toujours complet avant toute écriture. Les insertions du fichier deviennent visibles au commit de la transaction ; aucune idempotence durable ajoutée. Les modifications d’accès concurrentes attendent la fin de l’import si les verrous sont déjà acquis ; il ne s’agit pas d’une annulation rétroactive.
- Fixture CSV existante adaptée à une véritable affiliation manager. Nouveaux tests PostgreSQL : destination changée, compte suspendu, affiliation révoquée, société suspendue même pour admin, absence d’écritures dans les deux sociétés, admin actif autorisé ; trigger synthétique échouant sur la ligne médiane et vérification des lignes avant/après conservées via savepoint. Pas de test d’ordonnancement concurrent des verrous dans ce lot.
- 434 tests, 97 fichiers, TypeScript/build et recette Docker sauvegarde/restauration réussis. Journaux /tmp/raero-lot228-{tests,check,build,docker,smoke}.log. Instance remplacée, volumes conservés, before228 arrêté ; index Tailscale conforme et session admin antérieure/no-store vérifiés. Aucun import métier réel, aucune migration/dépendance et aucune recette navigateur.
- Les autres mutations compagnie ne bénéficient pas automatiquement de ces contrôles transactionnels ; revue transversale encore nécessaire. Doublons/rejeu de CSV, audit métier d’import et parcours fournisseurs restent à compléter. Objectif global non achevé.


### Lot 229 — preuve concurrente des verrous d’import

- Tour précédent classé progression : destination et droits protégés dans la transaction. Relecture du service et de ses tests confirmant que les refus avant import et savepoints étaient testés, mais pas le blocage effectif des changements concurrents.
- Nouveau test PostgreSQL sur base isolée : trigger de fixture maintient l’import à son insertion via verrou consultatif détenu sur connexion indépendante. L’attente réelle est observée dans pg_locks, avec sondage borné ; aucun simple délai supposant l’import arrivé au bon endroit.
- Pendant cette attente, suspension du compte, suspension de la compagnie et révocation de l’affiliation sont chacune refusées par lock_timeout (SQLSTATE 55P03). Après libération, import validé avec un salarié ; révocation réussie puis second import refusé FORBIDDEN, effectif toujours d’un salarié. Trigger/fonction temporaires et connexion retirés en finally.
- Quatre tests PostgreSQL ciblés passent, dont ce scénario concurrent (374 ms dans le journal), et TypeScript passe. Journaux /tmp/raero-lot229-{tests,check}.log. Dernière suite complète : 434 tests au lot 228 ; le nouveau test n’est pas présenté comme une nouvelle exécution complète.
- Aucun changement de code de production, d’image ou de données d’aperçu ; pas de redéploiement nécessaire. La preuve concerne cet ordonnancement précis, pas tous les scénarios de blocage/interblocage ou toutes les mutations B2B. Objectif global toujours non achevé.


### Lot 230 — préparation du CSV avant import explicite

- Tour précédent classé progression : preuve concurrente des verrous. Relecture du dialogue confirmant qu’une sélection déclenchait encore immédiatement la mutation ; la consigne le signalait mais aucune étape n’autorisait d’abandonner une sélection avant envoi.
- Lecture locale séparée de startImport. Après lecture, nom du fichier affiché et bouton Importer les salariés activé ; aucune mutation à la sélection. Consignes FR/EN/AR mises à jour et états lecture/envoi distincts. Le fichier préparé demeure uniquement en mémoire du composant, sans persistance navigateur.
- Fermeture avant envoi efface sélection, résultat et erreur via un gestionnaire commun (bouton, croix/échappement). Verrou immédiat maintenu pour lecture et mutation. Sélection effacée après toute tentative d’envoi, y compris réponse incertaine, pour éviter une seconde action directe ; la liste est actualisée aussi après une erreur d’envoi afin de vérifier un éventuel résultat déjà enregistré. Une resélection explicite reste possible et n’est pas dédoublonnée côté serveur.
- TypeScript, huit tests ciblés (dictionnaires/CSV) et build réussis. Journaux /tmp/raero-lot230-{check,tests,build,docker}.log. Ces tests ne vérifient pas les clics ni FileReader : recette navigateur encore absente. Pas de validation des lignes en amont affichée ; le message précise que validation/import commencent avec le bouton.
- SHA256 serveur identique au conteneur. Image reconstruite et interface copiée sans interruption ; index Tailscale comparé au build, HTTP 200. Aucun import réel ni migration/dépendance. Dernière suite complète 434 tests au lot 228, puis test concurrent ajouté et vérifié au lot 229. Objectif global non achevé.


### Lot 231 — états indisponibles du tableau de bord compagnie

- Tour précédent classé progression : sélection de CSV séparée de l’envoi. Relecture de CompanyDashboard montrant que les données employees/recurrencies étaient ramenées à des tableaux vides sans utiliser les états de requête, produisant des compteurs zéro et listes vides pendant chargement ou erreur.
- Conservation des objets de requête compagnie/effectif/échéances, activés seulement une fois authentifié. Avant affichage du tableau de bord : chargement explicite tant qu’une requête initiale attend, panneau générique FR/EN/AR en cas d’erreur et panneau de rattachement si la compagnie est absente. Bouton relançant les trois lectures, désactivé durant une lecture active ; retour de navigation disponible.
- Une erreur de ces lectures masque aussi leurs données précédemment mises en cache et les actions de tableau, pour ne pas présenter un état ancien comme disponible. Cela ne garantit pas une révocation instantanée avant une nouvelle réponse et ne remplace pas les contrôles serveur. Un échec d’échéances masque temporairement l’ensemble de ce tableau de bord ; granularité par onglet encore améliorable.
- Trois tests de dictionnaires, TypeScript et build passent ; journaux /tmp/raero-lot231-{check,tests,build,docker}.log. Pas de nouveau test miroir des conditions JSX ni de recette navigateur. Les erreurs propres aux requêtes abonnement, consolidation et règles ne sont pas couvertes par ce panneau et restent à traiter.
- Bundle serveur identique au conteneur en cours, image reconstruite et frontend copié sans interruption. Index Tailscale conforme au build, HTTP 200 ; aucune migration/dépendance ni modification métier réelle. Objectif global toujours non achevé.


### Lot 232 — état réel de l’abonnement dans l’interface compagnie

- Tour précédent classé progression : états de lecture principaux. Inspection de l’onglet abonnement et de getSubscriptionViewForCompany/hasSubscriptionCapacity/learningAccess : une réponse absente tombait sur les offres, toute formule non none était titrée active, capacityAvailable ne contrôlait ni statut ni expiration alors que les compteurs annonçaient salariés couverts et modules débloqués.
- Requête abonnement activée après authentification ; état de chargement propre à l’onglet, panneau de réessai en erreur ou réponse null, masquant offres/actions et anciennes données de cet onglet. Une absence de réponse ne devient plus une absence d’abonnement.
- Titre neutre Formule, retrait de la pastille verte inconditionnelle et statut absent affiché Non renseigné. Compteurs désormais effectif actif et formations réglementaires au catalogue, avec leurs valeurs descriptives réelles ; aucune déduction d’accès à partir de la capacité seule. Message FR/EN/AR sur les conditions d’accès à rapprocher des contrôles serveur existants. Compte Stripe absent décrit comme tel, sans inventer un mode démo ; promesse de renouvellement automatique de recyclage retirée de cette vue.
- TypeScript, trois tests de dictionnaires et build réussis ; journaux /tmp/raero-lot232-{check,tests,build,docker}.log. Pas de recette navigateur, de transaction Stripe ou de modification des règles de facturation/accès serveur. Statuts fournisseur encore affichés bruts ; aucune validation d’exploitation Stripe déduite de ces changements.
- SHA256 serveur identique au conteneur ; image reconstruite et frontend copié sans redémarrage. Index Tailscale conforme, HTTP 200. Aucune migration/dépendance. Objectif global toujours non achevé.


### Lot 233 — états et actions de l’analyse des besoins

- Tour précédent classé progression : abonnement factuel et erreurs de lecture. Inspection de la consolidation/TNA confirmant que les erreurs de règles/catalogue/consolidation étaient assimilées à des valeurs absentes ou zéro et que les actions restaient disponibles pendant des opérations voisines.
- États des trois requêtes conservés et activation après authentification. Onglet analyse : chargement avant premières réponses, panneau d’erreur avec relecture en cas d’échec ou consolidation null, contenu ancien masqué. Aucune règle et aucun regroupement affichés seulement à partir de réponses disponibles.
- Fieldset désactivé pendant lectures/ajout/retrait/analyse ; invalidations attendues dans les callbacks de succès afin de conserver cet état pendant l’actualisation. Message persistant pour mutation en erreur, y compris retrait auparavant silencieux, et bouton relisant consolidation/règles/catalogue/échéances ; erreurs de mutations réinitialisées seulement après quatre réponses réussies. Aucun nouvel envoi automatique à la relecture.
- Formulaire conservé en mémoire lors d’une erreur de lecture ; pas de persistance ou protection globale de navigation ajoutée. Désactivation React ne constitue pas un verrou immédiat entre événements ni une idempotence serveur. Une analyse légitime côté serveur ne dépend pas de ce seul contrôle d’interface ; aucune règle métier serveur modifiée.
- Trois tests de dictionnaires, TypeScript/build réussis ; TypeScript/build relancés après ajout du bouton de relecture. Journaux /tmp/raero-lot233-{tests,check,build,docker}.log. Pas de recette navigateur ou d’exécution d’analyse réelle.
- Serveur SHA256 identique au conteneur ; image reconstruite et frontend copié sans interruption, index Tailscale conforme HTTP 200. Aucune migration/dépendance. Objectif global toujours non achevé.


### Lot 234 — archivage conservatoire des règles de besoins

- Tour précédent classé progression : états et actions TNA. Inspection serveur confirmant un DELETE physique dans deleteRoleRequirement. Aucun archivage des règles n’était présent ; les analyses sélectionnaient toutes les règles de leur périmètre.
- Migration additive role_requirement_archive : archivedAt/archivedBy (FK utilisateur et paire obligatoire), interdiction SQL des suppressions/troncatures, modifications autorisées seulement pour archiver une règle active sans changer sa définition. Une règle archivée est verrouillée. Les données existantes restent actives, sans reconstitution fictive d’auteur historique.
- Route historique deleteRoleRequirement conservée, effet remplacé par archivage transactionnel et bouton Archiver FR/EN/AR. Auteur actif relu ; manager rattaché à la société de la règle avec affiliation active/société active, ou admin actif. Ligne verrouillée : archivages concurrents conservent les premières date/auteur. Refus d’accès explicite plutôt qu’un succès false ignoré par l’interface. Règles archivées exclues des listes actives et des lectures initiales de runTNA ; échéances existantes conservées.
- Test PostgreSQL : règle appliquée à un premier salarié, tiers refusé, double archivage concurrent, métadonnées/definition conservées, second salarié sans échéance pour la règle archivée, échéances antérieures identiques, DELETE/modification/désarchivage SQL refusés et acteur suspendu refusé même pour répétition. 436 tests, 98 fichiers, TypeScript/build et Docker sauvegarde/restauration passent. Journaux /tmp/raero-lot234-{tests,check,build,docker,smoke}.log.
- Aperçu remplacé avec volumes conservés et before234 arrêté. Index Tailscale conforme, session antérieure et lecture authentifiée des règles/no-store vérifiés. Aucun archivage métier réel ; contrôle HTTP d’une liste ne prouve pas les chemins non vides, couverts par fixture. Pas de recette navigateur.
- Limites : pas encore de vue utilisateur des règles archivées ni d’auteur de création historique ; l’archivage ne révoque pas les échéances passées. Une analyse ayant déjà lu la règle peut encore terminer ; coordination transactionnelle de runTNA et de l’archivage non couverte. Politique de conservation légale à valider ; objectif global non achevé.


### Lot 235 — validation des nouvelles règles et formation ciblée

- Tour précédent classé progression : archivage des règles. Relecture de createRoleRequirement confirmant des nombres non bornés/non entiers, chaînes non bornées, insert any sans validation de la formation ciblée.
- Schéma partagé roleRequirementInput strict : identifiant SQL positif, période entière de 1 à 120 mois (limite produit, non prescription réglementaire), limites de longueurs alignées sur la table, trim des textes. API et formulaire l’utilisent ; bouton d’ajout désactivé si invalide et champ période min/max/step, consigne FR/EN/AR. Le service valide également ses appels directs avec companyId explicite.
- Transaction de création relisant/verrouillant la formation : existence, publication et absence d’archivage requises ; formation détenue par une organisation seulement pour les règles de cette organisation, jamais règle globale ou d’une autre organisation. Pas de faux succès en absence de base. Les droits auteur restent ceux vérifiés par la route ; pas de nouveau verrou transactionnel sur l’acteur dans ce lot.
- Test de schéma : périodes zéro/négatives/fractionnaires/hors limite, identifiants incorrects, longueurs et injection de destination refusés, trim et bornes acceptés. Test SQL : formation absente/brouillon/archivée, cible d’une autre organisation ou globale sur cours interne refusées sans insertion ; cible interne publiée de sa compagnie acceptée. 438 tests, 99 fichiers, TypeScript/build et Docker sauvegarde/restauration passent ; journaux /tmp/raero-lot235-{tests,check,build,docker,smoke}.log.
- Aperçu remplacé, volumes conservés et before235 arrêté, index Tailscale conforme et session antérieure/no-store vérifiés. Aucune création réelle de règle ni recette navigateur. Pas de migration/dépendance.
- Limites : anciennes règles non réécrites/non auditées par cette validation ; publication actuelle d’une cible peut évoluer ensuite, runTNA reste à renforcer. Catalogue de sélection UI reste celui existant (parcours de sélection des formations internes à compléter). Aucun avis réglementaire ni conformité globale établi ; objectif non achevé.


### Lot 236 — analyse des besoins atomique et lancements simultanés

- Tour précédent classé progression : validation des nouvelles règles. Relecture de runTNA révélant une succession check/insert hors transaction : deux analyses pouvaient constater simultanément une échéance absente, et une erreur laissait un résultat partiel déjà visible.
- Transaction et verrou consultatif par compagnie sérialisant les appels runTNA. Règles actives du périmètre sélectionnées en SQL, verrouillées en lecture dans l’ordre des identifiants ; compagnie active requise et verrouillée, effectif existant verrouillé dans l’ordre des identifiants. Un même instant de départ sert aux nouvelles échéances. Erreur d’insertion : rollback de toutes les créations de cet appel, échéances antérieures non modifiées.
- Les règles lues restent stables jusqu’au commit ; un archivage concurrent attend si l’analyse détient déjà leur verrou. Les nouvelles règles ou nouveaux salariés arrivés après la lecture sont traités lors d’une analyse suivante. Aucun verrou de prédicat global ni remise en cause des résultats historiques.
- Deux tests PostgreSQL : trois analyses concurrentes, un seul résultat créateur et aucune duplication salarié/formation pour la cible, rejeu identique ; trigger échouant au second salarié, aucun nouvel enregistrement après échec, reprise réussie et compagnie suspendue refusée. 440 tests, 100 fichiers, TypeScript/build et Docker sauvegarde/restauration passent. Journaux /tmp/raero-lot236-{tests,check,build,docker,smoke}.log.
- Instance remplacée, volumes conservés et before236 arrêté ; index Tailscale conforme et session antérieure/no-store vérifiés. Aucune analyse métier réelle, aucune migration/dépendance et aucune recette navigateur.
- Limites : sérialisation propre aux appels runTNA, pas une contrainte d’unicité couvrant tous les autres producteurs d’échéances ; droits de l’acteur contrôlés par la route mais non verrouillés pendant toute l’analyse. Règles historiques, cibles devenues indisponibles et priorité entre règles concurrentes à auditer. Objectif global toujours non achevé.


### Lot 237 — périmètre compagnie des règles et vue des compétences

- Tour précédent classé progression : analyse transactionnelle. Inspection de createRoleRequirement révélant que tout administrateur créait companyId=null, même depuis une compagnie sélectionnée. La mutation utilise maintenant la compagnie du contexte pour tous les rôles, avec contrôle de société active. Compatibilité maintenue pour l’API admin sans compagnie : création globale, qui n’est pas proposée depuis ce tableau exigeant une compagnie.
- Interface : périmètre global/compagnie visible sur les règles, explication de destination pour la nouvelle règle, archivage des règles globales masqué aux non-admins. Aucun sélecteur permettant au client d’injecter un autre companyId.
- Première suite : deux tests de compétences perturbés par une nouvelle fixture globale sans filtre, conduisant à remonter la lecture de règles dans server/access.ts. Celle-ci ne filtrait pas les règles archivées depuis le lot 234 ; correction ajoutée. Fixture globale dotée d’un filtre unique puis archivée après vérification ; première fixture globale persistée archivée seulement dans la base de tests isolée avec un auteur synthétique, sans suppression.
- Test API : admin avec compagnie produit une règle visible seulement dans celle-ci, compagnie suspendue refusée, admin sans compagnie garde la création globale historique. Test d’archivage étendu à un salarié affilié sans échéance pour vérifier que la règle archivée ne crée plus d’exigence dans la vue des compétences. Une première version de ce test omettait l’affiliation nécessaire et était refusée à juste titre ; fixture complétée avant relance.
- Suite finale : 441 tests, 100 fichiers ; TypeScript/build et Docker sauvegarde/restauration passent. Journaux /tmp/raero-lot237-{tests,check,build,docker,smoke}.log. Les échéances existantes restent des exigences de suivi, même après archivage d’une règle ; elles ne sont pas effacées de la vue.
- Aperçu remplacé, volumes conservés et before237 arrêté ; index Tailscale conforme, session antérieure/no-store vérifiés. Aucune création/archivage métier réel, pas de migration/dépendance ou de recette navigateur. Audit des autres lectures et historique des règles encore à poursuivre ; objectif global non achevé.


### Lot 238 — consultation des règles archivées

- Tour précédent classé progression : périmètre des règles et exclusion des archives dans la vue des compétences. Relecture des routes/composants confirmant l’absence de vue des règles conservées après archivage.
- Nouvelle lecture company.roleRequirementHistory : compte actif relu, compagnie/affiliation manager active vérifiées (admin sans compagnie limité aux archives globales), filtrage SQL compagnie courante ou global. Projection explicite de définition et métadonnées d’archivage, 50 lignes plus curseur avant identifiant. Aucun nom/e-mail d’auteur exposé ; attribution par identifiant de compte.
- Composant repliable dans l’onglet analyse, lecture à l’ouverture, première page/actualisation et page suivante, chargement/erreur/absence distincts. Définition complète (formation identifiée, période et deux critères), périmètre et date/auteur affichés en FR/EN/AR. Classement annoncé par numéro de règle décroissant, pas par date d’archivage. Invalidation de l’historique après modification de règles/analyse via le rafraîchissement existant.
- Test SQL avec 55 archives : première page attendue, règle active et autre compagnie exclues, nouvelle archive entre pages sans chevauchement, révocation manager et compte admin suspendu refusés. 442 tests, 101 fichiers, TypeScript/build et Docker sauvegarde/restauration réussis ; journaux /tmp/raero-lot238-{tests,check,build,docker,smoke}.log.
- Aperçu remplacé, volumes conservés et before238 arrêté. Index Tailscale conforme, session antérieure et contrat HTTP de l’historique/no-store vérifiés. Ce contrôle HTTP peut porter sur une liste vide ; les cas non vides sont vérifiés en fixture. Aucun archivage réel ni recette navigateur.
- Pas de migration/dépendance. Les archives restent consultables, sans désarchivage, édition ni effacement ; aucun journal complet de création historique reconstitué. Les archives ajoutées avec un identifiant supérieur nécessitent un retour première page. Le cache peut conserver une réponse jusqu’à relecture, sans révocation instantanée garantie. Objectif global non achevé.


### Lot 239 — droits courants dans la transaction d’analyse

- Tour précédent classé progression : historique des règles. Relecture de runTNA et de la route : contrôle de compagnie initial, mais pas de relecture/verrou de l’acteur dans la transaction d’analyse.
- Identifiant d’acteur désormais obligatoire dans le service ; la route le fournit depuis le contexte authentifié, jamais depuis une saisie client. Après verrou de la compagnie, compte relu et verrouillé en lecture : actif, même compagnie sélectionnée, administrateur actuel ou affiliation manager active verrouillée. Droits conservés jusqu’au commit. Compagnie changée : CONFLICT ; compte ou affiliation invalide : FORBIDDEN, avant toute insertion.
- Fixtures des appels internes adaptées à un acteur autorisé, sans chemin de service permettant d’omettre l’acteur. Nouveau test PostgreSQL : destination changée, compte suspendu, rôle admin retiré sans affiliation, affiliation inactive refusés avec zéro échéance ; affiliation activée puis analyse réussie. Pas de test d’ordonnancement concurrent de ces nouveaux verrous dans ce lot.
- 443 tests, 101 fichiers, TypeScript/build et Docker sauvegarde/restauration réussis ; journaux /tmp/raero-lot239-{tests,check,build,docker,smoke}.log. Aperçu remplacé, volumes conservés et before239 arrêté ; index Tailscale conforme et session antérieure/no-store vérifiés.
- Aucun lancement d’analyse réel ni recette navigateur, pas de migration/dépendance. Les changements d’accès attendent la fin d’une analyse qui détient déjà les verrous ; aucune annulation rétroactive promise. Les autres producteurs d’échéances et la validation des règles historiques restent à auditer. Objectif global non achevé.


### Lot 240 — critères de règle explicites et champs étiquetés

- Tour précédent classé progression : droits transactionnels TNA. Relecture du plan actuel et de ruleMatchesEmployee : combinaison OR des recherches poste/licence, tandis que la liste active masquait le second critère quand le premier existait. L’historique les affichait séparément sans exprimer la combinaison.
- Liste et historique affichent les deux critères reliés explicitement par OU lorsqu’ils sont tous deux présents. Consigne FR/EN/AR : correspondance textuelle sans casse, un seul des deux critères suffit, absence des deux critères concerne l’effectif actif. Aucun changement de logique serveur ou de critères existants.
- Formulaire : libellés visibles associés aux identifiants des quatre champs texte/sélection et à la période ; aide commune liée par aria-describedby. Longueurs de texte limitées à 255/128/64 comme le schéma serveur, période déjà bornée conservée. Cela ne constitue pas une recette clavier/lecteur d’écran ou RTL.
- Quatre tests ciblés (dictionnaires et schéma de règle), TypeScript/build passent. Journaux /tmp/raero-lot240-{tests,check,build,docker}.log ; dernière suite complète 443 tests au lot 239. Pas de test miroir des conditions JSX ni de recette navigateur.
- Bundle serveur identique au conteneur ; image reconstruite et frontend copié sans redémarrage. Index Tailscale conforme HTTP 200, aucune règle réelle modifiée, pas de migration/dépendance. Objectif global non achevé.


### Lot 241 — formations internes dans le choix des règles

- Tour précédent classé progression : critères OR explicites. Relecture du formulaire et de getPublicTrainings : seules les formations ownerOrgId=null alimentaient le sélecteur, malgré la possibilité serveur de créer une règle pour une formation interne de sa compagnie.
- Nouvelle lecture company.roleRequirementCourses : compte actif relu, compagnie active et affiliation manager requises sauf admin ; sélection SQL des cours publiés non archivés appartenant à la compagnie ou au catalogue public. Projection limitée à id/title/ownerOrgId, tri titre puis id. Un administrateur dans ce parcours reste limité à sa compagnie sélectionnée et au public.
- Le formulaire utilise cette lecture et deux groupes visibles FR/EN/AR : formations internes et catalogue public. Aide précisant la sélection des cours publiés/non archivés. Les états d’erreur/chargement et le blocage des actions de l’onglet continuent d’utiliser l’objet de requête ; aucune nouvelle attribution de formation automatique.
- Test PostgreSQL : cours interne propre et public présents avec projection exacte ; autre compagnie, brouillon et archive exclus ; manager révoqué et admin suspendu refusés ; admin actif ne reçoit pas les cours étrangers. 444 tests, 102 fichiers, TypeScript/build et Docker sauvegarde/restauration passent. Journaux /tmp/raero-lot241-{tests,check,build,docker,smoke}.log.
- Aperçu remplacé, volumes conservés et before241 arrêté ; index Tailscale conforme et session antérieure/no-store vérifiés. Aucun cours/règle métier créé ni recette navigateur du sélecteur. Pas de migration/dépendance.
- Limites : liste de titres complète non paginée, recherche et grands catalogues à améliorer ; création de règle revalide toujours la cible car la liste ne garantit pas son état au moment de l’envoi. Aucun paiement, accès apprenant ou validation pédagogique déduit de la présence dans ce sélecteur. Objectif global non achevé.


### Lot 242 — périodicités contradictoires avant nouvelles échéances

- Tour précédent classé progression : formations internes sélectionnables. Relecture du traitement : plusieurs règles applicables à une même formation utilisaient implicitement la période de la première règle lue, les suivantes constatant ensuite l’échéance nouvellement insérée.
- Regroupement des règles correspondantes par salarié/formation. Si aucune échéance n’existe et que les périodes diffèrent, PRECONDITION_FAILED avec identifiants du salarié, de la formation et jusqu’à dix règles impliquées. La transaction annule tous ses nouveaux ajouts. Même période : une seule échéance. Aucun choix automatique de période minimale, maximale ou de priorité globale/compagnie inventé.
- Message persistant FR/EN/AR expliquant le conflit et la nécessité de revoir les règles ; détail serveur français conservé avec identifiants. Le traitement spécifique dans l’interface exige le code PRECONDITION_FAILED et le préfixe actuel du message pour ne pas confondre une compagnie absente avec ce conflit ; contrat d’erreur structuré multilingue encore améliorable.
- Test PostgreSQL : premier salarié sans conflit, second avec périodes 24/12, aucune échéance conservée après refus ; archivage de la règle contradictoire, ajout d’une règle concordante et reprise donnant une seule échéance par salarié. Ajout ultérieur d’une période différente ne réécrit pas les échéances déjà suivies. 445 tests, 102 fichiers, TypeScript/build et Docker sauvegarde/restauration passent ; journaux /tmp/raero-lot242-{tests,check,build,docker,smoke}.log. TypeScript/build relancés après précision de la détection d’erreur UI.
- Aperçu remplacé, volumes conservés et before242 arrêté ; index Tailscale conforme, session antérieure/no-store vérifiés. Aucun lancement d’analyse ou archivage réel, pas de migration/dépendance ni recette navigateur.
- Limites : contrôle des nouvelles échéances uniquement, pas audit/réconciliation de la périodicité de tout suivi existant ; anciennes règles à période invalide ou cible devenue indisponible toujours à traiter. Arbitrage des règles applicables laissé au responsable habilité ; aucune interprétation réglementaire. Objectif global non achevé.


### Lot 243 — recherche dans l’effectif compagnie

- Tour précédent classé progression : conflits de périodicité. Inspection de la liste compagnie montrant l’affichage intégral de l’effectif sans filtre, peu pratique pour retrouver un salarié dans une liste importante.
- Filtre local sur les données déjà autorisées/chargées : prénom, nom, e-mail, poste, licence/catégories, qualifications de type, département et base. Recherche sans casse, mots séparés par espaces devant tous être présents dans l’ensemble des champs ; aucun nouvel appel serveur ni stockage du texte de recherche.
- Label associé, aide FR/EN/AR, bouton d’effacement, compteur de résultats avec role=status et message distinct en absence de correspondance. Les compteurs globaux restent ceux de l’effectif chargé. Export inchangé et explicitement nommé effectif complet ; aide précisant qu’il ne se limite pas au filtre. Barre d’actions accepte les retours à la ligne.
- Trois tests de dictionnaires, TypeScript/build réussis ; journaux /tmp/raero-lot243-{tests,check,build,docker}.log. Pas de nouveau test miroir de cette transformation de liste ni recette navigateur. Recherche exacte de sous-chaînes après passage en minuscules : pas de suppression des accents/diacritiques, de recherche phonétique ou de pagination serveur ajoutée.
- Serveur SHA256 identique au conteneur ; image reconstruite et frontend copié sans interruption, index Tailscale conforme HTTP 200. Aucun salarié réel modifié ou export réel exécuté, pas de migration/dépendance. Dernière suite métier complète 445 tests au lot 242. Objectif global non achevé.


### Lot 244 — indicateurs ouvrant les échéances filtrées

- Tour précédent classé progression : recherche dans l’effectif. Relecture des cartes et du tableau d’échéances : compteurs purement descriptifs et absence de filtre de statut.
- Cartes transformées en boutons : salariés ouvre l’effectif complet et efface sa recherche ; à jour/à renouveler/en retard ouvre l’onglet échéances avec le statut correspondant. Boutons clavier avec contour de focus déclaré, sans modification des données métier.
- Filtre de statut étiqueté (tous, à jour, bientôt, en retard, non commencé), compteur des lignes affichées et message de résultat vide distinct. Export toujours complet et explicitement nommé ainsi. Statuts calculés côté serveur conservés ; l’interface ne recalcule ni dates ni conformité.
- Trois tests de dictionnaires, TypeScript/build passent ; journaux /tmp/raero-lot244-{tests,check,build,docker}.log. Pas de tests miroir de filtre JSX ni de recette navigateur/clavier ; présence des attributs/styles ne prouve pas une validation d’accessibilité.
- Bundle serveur identique au conteneur. Image reconstruite et frontend copié sans interruption, index Tailscale conforme HTTP 200. Aucun export ou changement d’échéance réel, pas de migration/dépendance. Dernière suite complète 445 tests au lot 242. Objectif global non achevé.


### Lot 245 — indisponibilité explicite des offres et de la FAQ

- Tour précédent classé progression : accès aux échéances filtrées. Retour à Home.tsx et au contenu statique : pas de compteur de réussite dans ce composant, mais offres/FAQ utilisaient un rendu de remplacement sans distinguer chargement et échec de leur lecture. Cette inspection ne constitue pas un audit de toutes les promesses administrables de la plateforme.
- Offres : chargement explicite, erreur FR/EN/AR avec bouton de relecture désactivé pendant la requête, affichage des offres seulement après réponse disponible. Réponse vide conserve le parcours devis existant. FAQ : même séparation des états ; réponses statiques conservées seulement quand la réponse réussie ne contient pas d’entrées, plus comme remplacement silencieux après erreur.
- Une erreur de relecture masque les anciennes données de la section concernée ; les autres sections restent accessibles. Aucun prix, contenu administrable, fournisseur ou condition commerciale modifié. Le lien/devis reste accessible ailleurs sur la page.
- TypeScript/build et trois tests de dictionnaires réussis ; ces tests de dictionnaires ne couvrent pas directement homeCopy, dont l’usage des trois langues est vérifié par TypeScript. Journaux /tmp/raero-lot245-{tests,check,build,docker}.log. Pas de nouveau test miroir de conditions JSX ni recette navigateur.
- Bundle serveur identique au conteneur ; image reconstruite et frontend copié sans interruption. Index Tailscale conforme HTTP 200. Aucun téléchargement PDF réel ou changement métier, pas de migration/dépendance. Dernière suite métier complète 445 tests au lot 242. Objectif global non achevé.


### Lot 246 — contrôle vidéo et préférence de mouvement

- Tour précédent classé progression : offres/FAQ avec états explicites. Inspection de Home : playing était modifié par les promesses play et les clics, pas par les événements du lecteur ; préférence de réduction des animations contrôlée seulement au montage.
- État du bouton piloté par onPlay/onPause/onEnded/onEmptied, clic lisant la propriété paused du lecteur. Suppression du setPlaying après résolution de play, qui pouvait devenir obsolète après une pause. Écoute des changements prefers-reduced-motion : activation met en pause, désactivation ne relance pas automatiquement une vidéo. Autoplay initial conserve le respect de la préférence et une commande manuelle reste disponible.
- Nettoyage de l’écouteur et pause au démontage. Vidéo décorative, poster, URL et texte du bouton inchangés ; aucune nouvelle collecte ou ressource externe.
- TypeScript/build passent, journaux /tmp/raero-lot246-{check,build,docker}.log. Pas de nouveau test miroir d’événements DOM, de recette navigateur, de contrôle effectif d’autoplay ou de bascule système exécuté ; cette limite interdit une déclaration de validation complète d’accessibilité. Pas de relance des tests métier/traductions sans changement correspondant.
- Bundle serveur identique au conteneur ; image reconstruite et frontend copié sans interruption, index Tailscale conforme HTTP 200. Pas de migration/dépendance. Objectif global non achevé.


### Lot 247 — demande de devis et présentation factuelle

- Tour précédent classé progression : contrôle vidéo d’accueil. Relecture de QuoteRequest et de sa route : soumission non verrouillée immédiatement, champs encore éditables pendant l’envoi, nouvelle demande réutilisant le formulaire précédent, erreur seulement en toast. Les textes annonçaient agrément EASA, conformité Part-145/66, support dédié et délai 24–48 h non étayés par les preuves d’exploitation du projet.
- Verrou immédiat de soumission jusqu’à résolution/rejet de la mutation ; fieldset désactivé pendant l’envoi ; erreur persistante indiquant résultat incertain et risque d’enregistrement déjà effectué. Saisie conservée en mémoire après erreur. Nouvelle demande après succès efface les valeurs et l’état de mutation. Conversion du nombre par Number au lieu de parseInt, sans troncature silencieuse.
- Textes FR/EN/AR remplacés par descriptions factuelles de plateforme et d’étude de demande, sans affirmer agrément/conformité juridique ni délai garanti. Ce retrait ne constitue pas une détermination du statut réglementaire réel de l’organisme ; celui-ci reste à établir avec ses documents d’autorité.
- TypeScript, trois tests de dictionnaires et build passent ; journaux /tmp/raero-lot247-{tests,check,build,docker}.log. Aucun devis ni e-mail réel envoyé, pas de recette navigateur ni de nouveau test miroir des callbacks UI.
- Bundle serveur identique au conteneur ; image reconstruite et frontend copié sans interruption, index Tailscale conforme HTTP 200. Pas de migration/dépendance. Validation métier serveur, persistance/idempotence de demande et notification à approfondir ; ce verrou ne couvre pas les onglets/rechargements et ne garantit pas la livraison SMTP. Objectif global non achevé.


### Lot 248 — validation des devis et référence persistée

- Tour précédent classé progression : interface de devis et présentation factuelle. Relecture de quotes.create/createQuoteRequest confirmant chaînes non bornées, noms vides acceptés côté serveur, nombre non entier possible, service retournant null si base absente et succès sans référence d’insertion.
- Schéma partagé quoteRequestInput strict : noms requis après trim, e-mail valide, longueurs alignées sur quote_requests, effectif entier positif borné au type SQL, message limité à 10 000 caractères. API et formulaire l’utilisent. Service valide également ses appels directs avec userId interne explicite ou null, refus des champs métier injectés ; indisponibilité de base produit une erreur.
- Insertion returning id : succès et quoteId renvoyés après écriture effective. Référence affichée dans l’écran de confirmation ; labels reliés aux champs, maxLength et contraintes d’effectif côté interface, message de validation visible, aucune troncature automatique des textes serveur.
- Test de schéma : blancs, e-mail, bornes, effectifs, statuts/userId injectés refusés, trim/bornes acceptés. Test PostgreSQL : appels invalides sans enregistrement, référence correspondant à la ligne enregistrée, statut received, auteur authentifié conservé et auteur null pour anonyme. 447 tests, 104 fichiers, TypeScript/build et Docker sauvegarde/restauration passent ; journaux /tmp/raero-lot248-{tests,check,build,docker,smoke}.log.
- Aperçu remplacé, volumes conservés et before248 arrêté ; index Tailscale conforme et session antérieure/no-store vérifiés. Aucun devis/e-mail réel envoyé, pas de migration/dépendance ni recette navigateur.
- Limites : notification SMTP toujours après insertion et avant réponse, donc panne après écriture pouvant laisser un résultat incertain ; idempotence durable et reprise notification non ajoutées. Référence publique n’est pas une autorisation d’accès à un devis. Validation des longueurs ne valide pas juridiquement un SIRET ou un numéro de téléphone. Objectif global non achevé.


### Lot 249 — reprise des demandes de devis sans double création

- Tour précédent classé progression : vérification effective du conteneur actif, routage Tailscale et HTTP 200 pour livrer l’URL demandée. Relecture du code et de ../CLAUDE/CLAUDE.md avant reprise : création de devis sans idempotence durable, notification exécutée après insertion.
- UUID optionnel validé et normalisé en minuscules dans le schéma partagé. Journal quote_creation_requests immuable (mise à jour, suppression et truncate interdits), référence unique vers le devis et empreinte SHA-256 des champs normalisés et de userId. Transaction avec verrou consultatif par UUID : une seule insertion en concurrence ; même contenu/auteur retrouve quoteId, contenu ou auteur différent refuse avec CONFLICT. Reprise sans réécriture du devis ou de son statut. Appels anciens sans UUID compatibles, sans déduplication.
- Formulaire : UUID conservé en mémoire pour une nouvelle tentative du même contenu normalisé, régénéré si contenu changé ou nouvelle demande. Utilise le générateur existant compatible aperçu HTTP privé. Aucun stockage local des coordonnées. Route : une reprise confirmée ne renvoie pas la notification administrateur.
- Tests PostgreSQL : cinq appels simultanés, un seul dossier et un seul résultat initial ; reprise après changement de statut, ordre de champs différent, espaces normalisés et UUID majuscule ; contenu/auteur modifiés refusés et journal protégé. Test route avec e-mail simulé : un envoi initial, aucun nouvel envoi sur reprise. UUID invalide refusé. 449 tests / 104 fichiers, TypeScript, build et smoke Docker avec sauvegarde/restauration passent ; journaux /tmp/raero-lot249-{focused,tests,check,build,docker,smoke}.log.
- Aperçu remplacé, volumes conservés, ancien conteneur before249 arrêté. Index Tailscale HTTP 200 identique au build, session administrateur antérieure conservée et no-store vérifié. Aucun devis ni e-mail métier réel créé/envoyé et aucune recette navigateur ; fixtures seulement en base isolée.
- Limites : rechargement, fermeture du formulaire ou autre onglet ne conservent pas l’UUID ; une modification de contenu crée une nouvelle intention. Le journal protège les requêtes portant le même UUID, pas toutes les demandes similaires. Notification encore sans file durable : panne avant envoi ou échec SMTP ne déclenche pas de récupération via cette reprise. UUID/référence ne confèrent aucun accès au contenu du devis. Validations fournisseurs, parcours navigateur, conformité et autres écarts de docs/operational-readiness.md restent ouverts ; objectif global non achevé.


### Lot 250 — statuts des devis : concurrence et historique

- Tour précédent classé progression : déduplication durable des créations de devis, vérifiée et déployée. Inspection actuelle : updateQuoteRequestStatus écrivait sans auteur ni contrôle de version ; préparation Stripe modifiait également le statut sans historique. Gouvernance ../CLAUDE/CLAUDE.md appliquée.
- Révision de statut dans quote_requests, incrémentée par trigger uniquement si le statut change. Schéma strict d’update exige id entier positif, statut autorisé et expectedRevision. Service verrouille le devis, relit/verrouille l’administrateur actif, refuse version périmée/compte révoqué/devis absent et n’annonce plus de succès si base absente. Retour à un ancien statut ne rend pas une ancienne révision valide.
- Journal quote_status_events append-only, déclenché par la base pour les changements de statut, avec ancien/nouveau statut, révision, date et auteur lorsqu’il est renseigné par la transaction. Préparation de commande transmet l’auteur et revérifie son rôle/statut sous verrou. Écritures SQL sans contexte gardent un auteur null, sans identité inventée. Pas de reconstitution historique et aucun nouvel enregistrement pour un statut inchangé.
- Route d’historique admin uniquement, pagination 50 par id décroissant limitée au devis. Composant repliable dans la fiche, attribution par numéro de compte, états chargement/erreur/vide, rafraîchissement et suite, FR/EN/AR. Tableau transmet la révision, désactive les changements pendant mutation/relecture, conserve une erreur visible et permet de relire explicitement ; liste masquée si sa requête échoue.
- Tests PostgreSQL : deux décisions simultanées, un succès/un conflit, attribution, no-op, aller-retour du statut, révision obligatoire, compte suspendu, immutabilité, écriture sans auteur et pagination de 55 événements sans mélange de devis. Tests checkout existants enrichis : un événement pour une conversion concurrente, aucun lors d’un échec, admin suspendu refusé. Test route : historique interdit aux visiteurs/utilisateurs et révision transmise pour l’admin. 452 tests / 105 fichiers, TypeScript et build passent ; journaux /tmp/raero-lot250-{focused,tests,check,build}.log.
- Limites : ce suivi trace les statuts, pas toutes les coordonnées du devis ; aucune preuve juridique d’acceptation client ni transition métier supplémentaire imposée. Les anciens clients doivent désormais envoyer expectedRevision pour cette mutation. Les écritures directes restent traçables avec auteur inconnu, et le contexte SQL n’est pas une authentification indépendante de l’application. Aucun devis métier réel modifié, aucun appel Stripe réel/e-mail, aucune recette navigateur. Objectif global non achevé.

- Déploiement lot250 : image et smoke Docker/restauration validés (/tmp/raero-lot250-{docker,smoke}.log). Aperçu remplacé, volumes conservés, before250 arrêté. Index Tailscale HTTP 200 conforme au build, session précédente/no-store conservés ; endpoint historique lu avec un id inexistant (contrat vide seulement, contenu/pagination prouvés par fixtures isolées).


### Lot 251 — préparation d’une commande attachée à son devis

- Tour précédent classé progression : historique immuable des statuts, concurrence et déploiement validés. Inspection QuoteManageDialog/AdminDashboard : composant toujours monté conservant lignes, compagnie et lien entre deux devis ; catalogue sans état d’erreur et proposant des formations internes/brouillons ; édition et fermeture possibles pendant envoi ; textes affirmant une notification client non effectuée par cette route.
- Instance du dialogue indexée sur le devis (ou état fermé), donc brouillon et résultat distincts à chaque ouverture/dossier. Verrou immédiat contre doubles clics, fermeture ignorée pendant mutation, avertissement de perte du brouillon à la fermeture et beforeunload. Après tentative, lignes et acheteur figés ; reprise utilise les mêmes conditions et le mécanisme serveur existant, sans nouvelle politique Stripe. Succès avec URL affiche le lien et bloque une nouvelle création ; résultat absent n’annonce pas un succès.
- Données catalogue/compagnies avec chargement/erreur/rafraîchissement ; catalogue UI limité aux formations publiques publiées avec version et non archivées. Ajout choisit une formation absente, listes évitent doublons, suppression nommée pour accessibilité. Contraintes et validation locale quantités entières 1..100 (1 en personnel), prix TTC positifs à deux décimales et bornés, compagnie active et formations encore disponibles. Contrôles serveur restent autoritaires, dont accès de l’acheteur à la compagnie.
- Succès invalide listes devis/commandes et historique. Erreur persistante explique l’incertitude et la reprise sans changement des conditions. Textes FR/EN/AR retirent les affirmations de lien envoyé/posté au client et distinguent lien disponible du paiement. TypeScript initial a révélé retour API nullable et mauvais chemin d’invalidation commandes : corrigés avant validation finale.
- TypeScript, trois tests de dictionnaires et build passent ; /tmp/raero-lot251-{check,tests,build}.log. Pas de test miroir des callbacks UI, pas de recette navigateur ni paiement/e-mail réel. Bundle serveur SHA-256 identique au conteneur : c0557c5d7a2c1b1b4a197f87854773821ec87d6dfc6c130202e3d863d801b815. Dernière suite backend complète : 452 tests au lot250, non relancée pour ces seuls changements d’interface.
- Limites : avertissement beforeunload dépend du navigateur ; pas de garde de toutes les navigations SPA et brouillon non durable. Fermer après une tentative n’annule pas la commande. Les erreurs métier avant création demandent de fermer/rouvrir pour modifier ; vérification des commandes nécessaire si résultat incertain. Calcul HT à partir du TTC selon le taux existant inchangé, aucune validation fiscale ni transaction Stripe réelle. La liste des compagnies reste celle des admins ; autorisation acheteur contrôlée par le serveur. Objectif global non achevé.

- Déploiement lot251 : image reconstruite (/tmp/raero-lot251-docker.log), frontend copié dans le conteneur actif sans redémarrage ; index Tailscale HTTP 200 identique au build. Pas de migration ni nouvelle sauvegarde/restauration pour ce lot frontend.


### Lot 252 — états client et messagerie des devis

- Tour précédent classé progression : préparation des commandes isolée par dossier et interface déployée. Relecture MyQuotes/QuoteThread : erreurs assimilées à des listes vides, absence de verrou immédiat sur Entrée, saisie modifiable pendant envoi puis effacée au succès, erreurs d’envoi invisibles et dates toujours françaises.
- MyQuotes distingue chargement auth, erreur auth avec relecture, visiteur, chargement données, erreur avec rafraîchissement et vide réel. Données mises en cache masquées sur erreur. Dates selon langue, texte aligné au sens de lecture et aria-expanded sur la conversation.
- QuoteThread distingue chargement/erreur/vide ; rafraîchissement explicite et composition bloquée si lecture indisponible. Verrou immédiat de soumission, champ désactivé pendant envoi, invalidation attendue, erreur persistante conservant le texte et signalant le risque d’enregistrement déjà effectué. Entrée ignorée pendant composition IME ; bouton d’envoi et champ nommés pour accessibilité. Dates FR/EN/AR. Aucun message/e-mail réel envoyé.
- TypeScript, trois tests de dictionnaires et build passent ; journaux /tmp/raero-lot252-{check,tests,build}.log. Pas de nouveau test miroir du câblage React ni de recette navigateur. Serveur SHA-256 inchangé c0557c5d7a2c1b1b4a197f87854773821ec87d6dfc6c130202e3d863d801b815 ; dernière suite serveur complète 452 tests lot250, non relancée.
- Limites : conservation du brouillon uniquement tant que la conversation reste montée ; fermeture/navigation ou erreur de la liste parente peut démonter la conversation. Verrou local sans idempotence durable : vérifier les messages avant une nouvelle tentative, pas de garantie contre doublons après résultat incertain. Routes de messages et notifications inchangées ; leur validation bornée et reprise durable restent à approfondir. Objectif global non achevé.

- Déploiement lot252 : image reconstruite (/tmp/raero-lot252-docker.log), frontend copié sans redémarrage ; index Tailscale HTTP 200 conforme au build. Pas de migration ni nouvelle restauration pour ce lot frontend.


### Lot 253 — accès transactionnel aux conversations de devis

- Tour précédent classé progression : états client/messagerie et déploiement frontend. Inspection serveur : autorisation seulement dans route avant écriture, service direct sans validation/autorisation, texte non borné, lecture marquant toute la conversation avant de la charger et recherches auteurs N+1.
- Schémas partagés stricts quoteThreadInput/quoteMessageInput : id positif borné SQL, texte trim requis et maximum 10 000 caractères, champs auteur/destinataire injectés refusés. Formulaire utilise le schéma et maxLength. Service d’écriture valide ses appels directs et ne retourne plus null en l’absence de base.
- Helper transactionnel relit/verrouille en partage devis et compte actif, autorise rôle admin actuel, userId du devis ou correspondance d’e-mail actuelle (règle existante conservée). Lecture et insertion exécutées sous ces verrous. La route reçoit en interne auteur/rôle/devis vérifiés pour la notification et retourne uniquement le message au client. Ancien marquage autonome supprimé car il n’avait plus d’appelant.
- Lecture : jointure projetant nom/rôle au lieu de relire chaque compte entier, ordre date/id stable ; seuls les ids effectivement lus et provenant d’un autre auteur sont marqués lus. Une lecture interdite n’effectue aucune modification. Les champs de compte sensibles ne sont pas sélectionnés pour l’attribution.
- Deux tests PostgreSQL : blancs/longueur/injection refusés, extérieur interdit, propriétaire/admin autorisés, trim/auteur enregistrés, lecture marquant seulement la réponse entrante, admin suspendu interdit, correspondance e-mail insensible à la casse pour devis anonyme puis e-mail changé refusé, rattachement explicite accepté, erreur n’altérant pas le lu. 454 tests / 106 fichiers, TypeScript/build passent ; journaux /tmp/raero-lot253-{focused,tests,check,build}.log.
- Limites : lecture encore non paginée, isRead partagé (pas un accusé individuel par admin), noms/rôles affichés actuels et non instantané historique. Test de concurrence avec insertion précisément entre sélection et marquage non ajouté ; portée du marquage vérifiée dans le code et comportement entrant/sortant en base. Correspondance e-mail conservée sans nouvelle règle de vérification d’identité. Pas d’UUID de message/outbox durable ; une erreur SMTP après insertion peut encore laisser un résultat incertain. Aucun message/e-mail réel, aucune recette navigateur. Objectif global non achevé.

- Déploiement lot253 : image, smoke Docker et restauration validés (/tmp/raero-lot253-{docker,smoke}.log), aperçu remplacé avec volumes conservés, before253 arrêté. Index Tailscale HTTP 200 conforme au build et session antérieure/no-store vérifiés. Aucune lecture de conversation métier sur l’aperçu pour éviter de modifier ses accusés de lecture. Pas de migration.


### Lot 254 — reprise durable des messages de devis

- Tour précédent classé progression : accès transactionnel et validation des conversations déployés. Relecture des sources confirmant insertion simple et notifications après persistance, sans identifiant de reprise.
- UUID optionnel strict, normalisé en minuscules dans quoteMessageInput ; journal quote_message_requests immuable avec référence unique au message et empreinte SHA-256 du devis, auteur et contenu normalisé. Verrou consultatif UUID et insertion message/journal atomiques. Reprise retrouve le message existant après nouvelle vérification des droits actifs, refuse contenu/devis/auteur différents, ne modifie pas son état lu.
- Route retourne le message retrouvé sans nouvelle notification. Formulaire conserve en mémoire l’UUID du même contenu/devis entre tentatives, le renouvelle si contenu changé et l’efface après succès. Utilise le générateur existant compatible HTTP privé. Aucun texte de conversation stocké dans le navigateur de façon durable. Appels sans UUID conservés, sans déduplication.
- Tests SQL : cinq envois concurrents, un seul message et résultat initial ; reprise après lecture, espaces normalisés et UUID majuscule ; collisions de contenu/devis/auteur refusées, UUID invalide refusé, suspension refusant même une reprise, journal protégé contre modification/suppression. Test route avec transport simulé : une notification initiale et aucune notification de reprise. 456 tests / 106 fichiers, TypeScript/build passent ; /tmp/raero-lot254-{focused,tests,check,build}.log.
- Limites : UUID perdu au démontage/rechargement, pas de déduplication entre intentions différentes ou anciens clients. La protection évite une notification répétée sur reprise, mais ne garantit pas sa livraison : panne avant envoi ou échec SMTP non repris automatiquement, outbox durable encore absente. Aucun message/e-mail réel et aucune recette navigateur. Objectif global non achevé.

- Déploiement lot254 : image/smoke Docker/sauvegarde-restauration validés (/tmp/raero-lot254-{docker,smoke}.log), migration appliquée au remplacement de l’aperçu, volumes conservés, before254 arrêté. Index Tailscale HTTP 200 conforme au build, session antérieure et no-store vérifiés ; aucune conversation métier lue ou modifiée sur l’aperçu.


### Lot 255 — liste personnelle des devis paginée en base

- Tour précédent classé progression : reprise durable des messages, testée et déployée. Relecture getMyQuotes confirmant SELECT de tous les devis puis filtre JavaScript utilisant l’e-mail du contexte ; toutes les colonnes renvoyées et aucune limite de liste.
- Schéma strict de curseur beforeId positif entier borné SQL. Service relit/verrouille le compte actif et applique userId OU e-mail actuel insensible à la casse directement dans la requête. Ne reçoit plus d’e-mail fourni par l’appelant. Erreur réelle si base absente ou compte inactif. Admin conserve une liste personnelle, distincte de sa liste d’administration.
- Projection limitée id, companyName, status, createdAt, trainingTypes ; coordonnées, message initial et autres colonnes ne transitent plus pour cet écran. Pagination par id décroissant, 51 lignes pour détecter la suite, 50 renvoyées. Contrat myList désormais {entries,nextBeforeId}, client adapté. Ordre par référence explicite, rafraîchir depuis le début et pages précédentes, vide de page distinct du vide initial ; changement de page ferme la conversation ouverte.
- Test PostgreSQL : 55 demandes propres (userId/e-mail), demande étrangère exclue, projection minimale exacte, arrivée entre deux lectures sans doublon/décalage, première page actualisée, liste personnelle admin, changement d’e-mail, curseurs/champs injectés invalides et compte suspendu. 457 tests / 107 fichiers, TypeScript/build passent ; /tmp/raero-lot255-{focused,tests,check,build}.log.
- Limites : pas de recherche, filtre de statut ou nombre total ; ordre par id plutôt que chronologie strictement fondée sur createdAt. Aucune mesure de charge/plan SQL à grande échelle ni nouvel index dans ce lot. Correspondance e-mail historique conservée ; pas de nouvelle politique KYC. Navigation entre pages démonte le fil et son brouillon non durable (limite déjà présente à la fermeture du fil). Clients de l’ancien contrat tableau doivent être mis à jour. Aucun devis/message/e-mail métier créé ni recette navigateur. Objectif global non achevé.

- Déploiement lot255 : image/smoke Docker/restauration validés (/tmp/raero-lot255-{docker,smoke}.log), aperçu remplacé avec volumes conservés, before255 arrêté. Index Tailscale HTTP 200 conforme, session antérieure/no-store et contrat myList {entries,nextBeforeId} vérifiés en lecture seule ; pagination non vide prouvée par fixtures isolées. Pas de migration.


### Lot 256 — catalogue et fiche de formation : états et présentation

- Tour précédent classé progression : liste personnelle des devis filtrée/paginée et déployée. Retour au parcours public de formation. Inspection Catalogue/TrainingDetail : erreur assimilée à zéro résultat ou fiche introuvable, toute erreur panier présentée comme besoin de connexion, prix TTC arrondis à l’euro, langue autre que français affichée anglais et filtre arabe absent.
- Erreurs catalogue/fiche explicites avec rafraîchissement, données en cache masquées sur erreur et filtres conservés. Fiche absente uniquement après succès sans formation ; retour catalogue disponible sur erreur. Erreur panier distingue UNAUTHORIZED des autres échecs, reste visible et invite à vérifier le panier avant renvoi ; succès invalide les requêtes panier.
- Prix TTC affichés via Intl/toLocaleString en EUR dans la langue courante, avec les centimes du montant reçu. Aucun montant stocké ni calcul de paiement modifié. Ajout filtre arabe (API acceptant déjà cette langue), fiche distinguant FR/EN/AR et affichant la valeur brute pour langue inconnue. Labels de filtres associés à leurs champs, placement recherche au début selon sens de lecture et bouton panier nommé.
- TypeScript, trois tests dictionnaires et build passent ; /tmp/raero-lot256-{check,tests,build}.log. Pas de nouveau test miroir du câblage UI ni de recette navigateur. Serveur identique au conteneur SHA-256 740a2373140c830b89baef46bdee926c45de19a4dd2979f27eab9ad74a406102 ; dernière suite backend complète 457 tests lot255, non relancée pour ce lot frontend.
- Limites : pas de preuve de disponibilité d’un cours réellement en arabe, traduction interface distincte de traduction du contenu. Requête catalogue encore filtrée en mémoire côté serveur et retour vide si getDb absent, à approfondir ; aucun contrôle de charge/filtrage paginé ajouté. Prix manquant/zéro et commercialisation liés au comportement existant, pas de validation fiscale. Ajout panier toujours sans nouvelle idempotence durable ; aucun panier/paiement métier modifié pendant vérification. Objectif global non achevé.

- Déploiement lot256 : image reconstruite (/tmp/raero-lot256-docker.log), frontend copié sans redémarrage ; index Tailscale HTTP 200 identique au build. Aucune migration ni nouvelle restauration pour ce lot frontend.


### Lot 257 — filtres SQL et projection publique du catalogue

- Tour précédent classé progression : états du catalogue/fiche, prix avec centimes et filtre arabe déployés. Inspection getPublicTrainings/getFeaturedTrainings/getTrainingBySlug : SELECT de toutes les colonnes, filtres applicatifs après lecture globale et succès vide/null si base absente.
- Schéma partagé strict catalogueInput pour API et appels directs : chaînes trim bornées (type/domaine 32, langue 8, recherche 255), catégorie entière positive bornée SQL. Champs non reconnus refusés ; slug requis borné 255 pour fiche, validation directe aussi. Champ de recherche UI maxLength 255.
- Filtres type/domaine/langue/catégorie appliqués SQL avec visibilité publié/public/non archivé. Recherche insensible à la casse sur titre/description via strpos, caractères %/_ traités littéralement, description null gérée ; valeurs inconnues de type/domaine renvoient vide sans erreur d’enum SQL. Ordre conserve featured/titre puis ajoute id pour départager.
- Projection publique explicite commune catalogue, sélection accueil et fiche : description/objectifs/prérequis/public/tarifs/politiques affichées et informations catalogue conservés ; propriétaires, reviewStatus, versions de travail, archive et configuration non affichée de l’examen exclus. Base absente produit une erreur au lieu d’une fausse liste vide/fiche absente. Pas de changement de droits d’achat ou d’accès pédagogique.
- Test PostgreSQL : filtres combinés/langue arabe/catégorie, trim/casse, recherche description, caractères %/_ littéraux, filtre inconnu vide, données internes/brouillons/archives exclues, projection ne contenant pas métadonnées ciblées, entrées invalides et slug vide refusés. 458 tests / 108 fichiers, TypeScript/build passent ; /tmp/raero-lot257-{focused,tests,check,build}.log.
- Limites : catalogue non paginé et aucune mesure de charge/plan SQL ; liste publique commune contient aussi les champs utiles à la fiche, donc pas une projection minimale de carte. Recherche non accent-insensible et sans classement de pertinence ; casse selon PostgreSQL. Prix publics existants conservés, sans validation fiscale ; référence Part-147 affichée ne vaut pas validation d’agrément. Aucun contenu métier réel modifié, pas de requête fournisseur payante ni recette navigateur. Objectif global non achevé.

- Déploiement lot257 : image/smoke Docker/restauration validés (/tmp/raero-lot257-{docker,smoke}.log), aperçu remplacé, volumes conservés, before257 arrêté. Index Tailscale HTTP 200 conforme, session antérieure/no-store et réponse catalogue publique lus ; visibilité/filtres/projection sur données contrôlées prouvés par fixtures isolées. Pas de migration.


### Lot 258 — fiche de formation : document délivré et données manquantes

- Tour précédent classé progression : catalogue SQL/projection publique, contrôles et déploiement. Relecture TrainingDetail et locales : garantie générique « Certificat inclus » et conformité de traçabilité Part-147 non rattachée à une preuve de formation, taux TVA 20 % affiché en dur, tarif entreprise arrondi à l’euro et valeurs par défaut inventées pour niveau/domaine absents.
- Relecture issueCertificate : génération conditionnée au parcours completed et à une tentative finale réussie persistée, avec contrôles d’intégrité supplémentaires. Texte FR/EN/AR décrit la capacité de génération PDF numéroté/vérifiable et invite à confirmer nature/portée du document avant inscription ; aucune affirmation de conformité globale. Aucun mécanisme d’émission ni décision réglementaire modifié.
- Prix HT affiché comme HT sans taux fiscal affirmé dans cette fiche ; tarifs HT/entreprise localisés à deux décimales. Aucun montant ni calcul serveur modifié. Niveau/domaine/langue manquants affichés non renseignés ; valeurs inconnues conservées au lieu de présenter une valeur arbitraire. Description/objectifs/prérequis/public cible conservent leurs sauts de ligne pour la lecture.
- TypeScript, trois tests de dictionnaires et build passent ; /tmp/raero-lot258-{check,tests,build}.log. Pas de nouveau test miroir d’édition de texte ni recette navigateur. Serveur identique SHA-256 919c911e05d2b5d94754c4a2279d0d734ab5725020c0cb12b8dcee07d310bfc8 ; dernière suite complète 458 tests lot257, non relancée pour ce lot frontend.
- Limites : nature réglementaire du document par formation et validation de contenu/agrément restent à établir ; édition de présentation ne résout pas cette validation métier. Paramètres d’examen affichés gardent les valeurs/fallbacks existants. Le taux employé par les calculs commerciaux backend n’est pas modifié ni validé fiscalement ici. Aucun certificat/paiement/message métier émis. Objectif global non achevé.

- Déploiement lot258 : image reconstruite (/tmp/raero-lot258-docker.log), frontend copié sans redémarrage ; index Tailscale HTTP 200 conforme au build. Pas de migration ni nouvelle restauration pour ce lot frontend.


### Lot 259 — progression de lecture monotone et reprise visible

- Tour précédent classé progression : fiche factuelle et déploiement frontend. Inspection du lecteur montrant des états initiaux/rafraîchissements déjà traités et une sauvegarde de progression des diapositives sans erreur visible. Inspection updateEnrollmentProgress : écrasement direct du pourcentage, possibilité de recul avec requête tardive, statut not_started pouvant remplacer in_progress et statuts non completed pouvant être réactivés.
- Schéma partagé learningProgressInput : id SQL positif, pourcentage entier 0..100 (colonne integer), statuts de lecture not_started/in_progress uniquement. Route et service direct le valident ; erreur réelle si getDb absent. Mise à jour SQL atomique greatest(valeur courante, valeur reçue), ne faisant pas reculer in_progress ; limitée aux inscriptions not_started/in_progress. Completed/expired/failed inchangés. Lecture à 100 % n’accorde pas completed ni completedAt.
- Lecteur conserve le maximum demandé dans l’instance du parcours et affiche une erreur de sauvegarde avec reprise de cette valeur. Pas de redémarrage du diaporama ni de l’examen lors d’une reprise de progression. Aucun changement aux réponses, chronomètre ou soumission du QCM ; contrôles d’accès de route existants conservés.
- Tests PostgreSQL ciblés : sauvegarde 80 puis 20/not_started, valeurs concurrentes, lecture100 sans completion, pourcentages invalides/fractions/statut completed refusés, lignes completed/expired/failed strictement inchangées. 18 tests ciblés (dont 17 examens) passent, TypeScript et build également ; journaux /tmp/raero-lot259-{focused,check,build}.log.
- Limites : reprise locale tant que l’instance du cours reste montée, pas de file hors ligne ; les changements de modules/autres producteurs de progression ne sont pas tous refondus. Service conserve son absence de retour pour une ligne exclue ou inexistante, route requireEnrollment contrôlant l’accès avant appel ; pas de nouvelle protection transactionnelle des affiliations dans ce lot. Aucun parcours/quiz/certificat réel modifié ni recette navigateur. Objectif global non achevé.

- Validation/déploiement lot259 : 459 tests / 109 fichiers, image/smoke Docker/restauration validés (/tmp/raero-lot259-{tests,docker,smoke}.log), aperçu remplacé avec volumes conservés, before259 arrêté. Index Tailscale HTTP 200 conforme au build, session antérieure/no-store vérifiés. Pas de migration ni progression métier réelle modifiée.


### Lot 260 — erreurs de chargement des médias pédagogiques

- Tour précédent classé progression : progression monotone/reprise et déploiement validés. Inspection SlideDeck/LearningPlayer : vidéo/audio natifs sans retour applicatif de chargement en erreur ; PDF déjà proposé en lien séparé. Aucun faux état terminé induit par ce changement.
- LearningVideo conserve les props natives (contrôles, style, timeupdate) et la ref utilisée par les interactions vidéo, ajoute une erreur lisible et recharge explicite depuis le début via load(). Utilisé pour vidéos de diapositives et de modules. Erreur liée à la source et effacée au chargement réussi/reprise ; instance réinitialisée au changement de diapositive/source.
- Audio de narration : erreur native rendue avec même action de rechargement, contrôles natifs conservés. Textes FR/EN/AR, rôle alert. Cadre vidéo de module adapté pour que l’erreur soit hors du ratio vidéo. Aucun autoplay forcé ni validation de chapitre déclenchée par chargement/reprise ; les réponses locales aux interactions vidéo ne sont pas réinitialisées par ce rechargement.
- TypeScript, trois tests de dictionnaires et build passent ; /tmp/raero-lot260-{check,tests,build}.log. Aucun test miroir de callbacks DOM ni recette navigateur : erreur média réelle, reprise, codecs, focus/RTL et interactions cue après reprise non vérifiés visuellement. Serveur identique SHA-256 a589aefccfa316f57d94014a4523475119c9d2749d6bfccb875c88c1a480cca2 ; dernière suite complète 459 tests lot259, non relancée.
- Limites : pas de traitement des images/PDF ni de délais pour source bloquée sans événement error ; refus d’autoplay n’est pas assimilé à une erreur de fichier. La reprise redémarre le média et exige l’action native de lecture. Aucun média fournisseur généré ni contenu pédagogique réel modifié. Objectif global non achevé.

- Déploiement lot260 : image reconstruite (/tmp/raero-lot260-docker.log), frontend copié sans redémarrage ; index Tailscale HTTP 200 conforme au build. Pas de migration ni nouvelle restauration pour ce lot frontend.


### Lot 261 — benchmark des parcours publics et priorités métier

- Tour précédent classé progression : états média et déploiement frontend. Relecture docs/product-references.md et audit opérationnel confirmant comparaison initiale limitée à quelques repères et benchmark détaillé ouvert.
- Recherche web et lecture de six pages officielles de trois acteurs : LTT (Training Finder, eLibrary, MAINTAIN360), Storm Aviation (Technical Training, Learning Solutions), SR Technics (Training Services). Sources exactes liées dans docs/benchmark-training-journeys.md. Les annonces commerciales sont distinguées des fonctionnalités réellement testées ; ni agréments, gains commerciaux, efficacité pédagogique ni fonctionnalités des espaces privés validés.
- Confrontation au code actuel : schémas trainings/sessions, runTNA, accès compagnie, lecteur et références des tests pertinents. Écarts retenus : portée de programme encore largement en texte libre ; runTNA applique des règles de récurrence et ne constitue pas une analyse pédagogique complète ; parcours par rôle et scénarios à vérifier de bout en bout. Priorités assorties de critères de preuve, pas de fonctionnalités présentées comme déjà livrées.
- Nouveau document benchmark-training-journeys.md, renvoi depuis product-references.md et complément ciblé dans operational-readiness.md. Vérification des liens locaux et du nombre de sources externes ; aucune suite logicielle relancée pour ces seuls documents. L’audit historique n’est pas transformé en nouvelle validation complète.
- Limites de collecte : iframe de recherche LTT non testée, ouverture du calendrier externe SR Technics en erreur, aucune inscription/connexion concurrente, aucun contact/message/achat, aucune copie de média ou manuel. Pas de recette navigateur comparative ni conclusion de supériorité. Aucun changement applicatif/déploiement pour ce lot ; aperçu du lot260 conservé. Objectif global non achevé.


### Lot 262 — présentation exacte du suivi des récurrences

- Tour précédent classé progression : comparaison publique sourcée et critères métier documentés. Application du premier écart : relecture CompanyDashboard/locales/runTNA confirme bouton « Lancer la TNA » et description de formation obligatoire, alors que le service crée des récurrences manquantes selon règles.
- Libellés FR/EN/AR remplacés par suivi des récurrences par règles et création des suivis manquants. Explication des règles actives, salariés actifs, conservation des suivis existants et date initiale calculée depuis l’exécution + période. Précise absence d’inscription au cours/validation de compétence et nécessité de définir/revoir les règles côté responsable formation.
- Résultat de mutation conservé visiblement tant que le composant garde son état ; zéro ajout distingué d’une couverture de tous les besoins. Callback typé, count provenant directement de r.created, plus de fallback fictif à zéro. Aucune logique métier/API ni règle modifiée et aucune action runTNA exécutée sur les données d’aperçu.
- TypeScript, trois tests dictionnaires et build passent ; /tmp/raero-lot262-{check,tests,build}.log. Pas de test miroir de texte/callback ni recette navigateur. Serveur identique SHA-256 a589aefccfa316f57d94014a4523475119c9d2749d6bfccb875c88c1a480cca2 ; dernière suite complète 459 tests lot259, non relancée pour ce lot frontend.
- Limites : le renommage n’est pas une analyse pédagogique complète ; futurs besoins/objectifs/programmes/évaluations restent dans le benchmark. Date de création du suivi ne prouve pas une formation antérieure ni une échéance réglementaire validée. Le résultat affiché n’est pas un historique durable des exécutions. Objectif global non achevé.

- Déploiement lot262 : image reconstruite (/tmp/raero-lot262-docker.log), frontend copié sans redémarrage ; index Tailscale HTTP 200 conforme au build. Pas de migration ni nouvelle restauration pour ce lot frontend.


### Lot 263 — récurrences vers formations encore disponibles

- Tour précédent classé progression : présentation exacte du suivi par règles et déploiement. Inspection runTNA/createRoleRequirement : contrôle du cours lors de création de règle, mais aucune revalidation lors de création ultérieure de récurrences. Deux anciennes fixtures utilisaient un cours non publié pour un scénario positif.
- Pour chaque suivi absent, après contrôle des périodes, lecture/verrouillage en partage du cours ; refuse cible absente, non publiée, archivée ou détenue par une autre compagnie. Même critère de disponibilité que la création de règle (pas de nouvelle exigence de version publiée dans ce lot). Erreur PRECONDITION_FAILED avec références de formation/règle uniquement. L’ensemble de la transaction est annulé si une cible indisponible empêche un nouvel ajout.
- Suivis existants laissés intacts, y compris si le programme est ensuite retiré ; un nouveau salarié concerné déclenche en revanche le contrôle avant création. UI FR/EN/AR explique le problème et la conservation de zéro nouvel ajout dans l’exécution échouée ; détail des références affiché pour corriger/archiver la règle.
- Fixtures positives actualisées avec cours publié. Nouveau test PostgreSQL couvre draft/archived/foreign/missing, absence d’ajout partiel, reprise après archivage de règle, conservation des suivis existants après retrait du cours et refus d’un nouvel ajout. Huit tests ciblés, TypeScript/build passent ; /tmp/raero-lot263-{focused,check,build}.log.
- Limites : pas d’archivage automatique des règles ou suivis, pas de migration/réparation des données historiques ni nouvelle décision métier. Le contrôle n’est effectué que lorsqu’un suivi manque ; les anciens suivis ne sont pas recertifiés. Pas de test orchestrant précisément un archivage concurrent pendant le verrou du cours dans ce lot. Validation des anciennes périodes hors bornes et revue complète des règles restent à approfondir. Aucun suivi/cours métier réel modifié, aucun e-mail ni recette navigateur. Objectif global non achevé.

- Validation/déploiement lot263 : 460 tests / 109 fichiers, image/smoke Docker/restauration validés (/tmp/raero-lot263-{tests,docker,smoke}.log), aperçu remplacé avec volumes conservés, before263 arrêté. Index Tailscale HTTP 200 conforme, session antérieure/no-store vérifiés. Pas de migration ni exécution de règles sur les données métier.


### Lot 264 — visibilité des cours associés aux règles

- Tour précédent classé progression : contrôle des cibles avant nouveaux suivis, testé et déployé. Inspection getRoleRequirements : chargement de toutes les règles actives avant filtre JS puis lecture de toutes les colonnes du cours sans condition de propriétaire. Une règle ancienne mal rattachée pouvait renvoyer un cours d’une autre compagnie.
- Filtre SQL règles globales/de la compagnie et actives, tri stable par id. Jointure cours autorisée pour cours public publié/non archivé ou cours appartenant à la compagnie consultée ; titre d’un cours étranger/retiré du public non renvoyé. Règle conservée avec training:null pour permettre son examen/archivage. Projection cours limitée id/title/isPublished/archivedAt, sans corps pédagogique/propriétaire/tarifs/métadonnées internes. Plus de N+1 ni faux vide si getDb absent.
- Route : contrôle requireManagedCompany aussi pour admin ayant une compagnie sélectionnée ; admin sans compagnie conserve la lecture globale. UI affiche une indication de formation indisponible si jointure absente ou cours propre non publié/archivé, avec invitation à revoir le programme/la règle. Pas d’archivage automatique.
- Nouveau test PostgreSQL : périmètre compagnie/global, règle étrangère exclue, règle globale vers cours étranger masquée, cours public/propre/archivé propre avec projection exacte, cours public retiré masqué, aucune chaîne de contenu étranger dans la réponse, règle archivée exclue. Quatre tests ciblés, TypeScript/build passent ; /tmp/raero-lot264-{focused,check,build}.log.
- Limites : liste des règles non paginée, libellés historiques de règles déjà autorisées restent visibles ; pas d’audit des données libres qu’ils contiennent. Pas de remise en état des anciennes associations, pas de nouvelle autorisation par rôle d’auteur à l’intérieur d’une compagnie. Aucun accès métier réel modifié et aucune recette navigateur. Objectif global non achevé.

- Validation/déploiement lot264 : 461 tests / 110 fichiers, image/smoke Docker/restauration validés (/tmp/raero-lot264-{tests,docker,smoke}.log), aperçu remplacé avec volumes conservés, before264 arrêté. Index Tailscale HTTP 200 conforme, session antérieure/no-store vérifiés. Pas de migration ni mutation des règles métier.


### Lot 265 — périodes anciennes invalides dans les règles

- Tour précédent classé progression : visibilité cloisonnée des cours associés, testée et déployée. Relecture de roleRequirementInput, addCalendarMonths et runTNA : création de règle limitée à 1..120 mois, mais ancien enregistrement pouvant encore atteindre le calcul sans revalidation. addCalendarMonths accepte volontairement les mois négatifs pour ses autres usages.
- Lorsqu’un suivi manque, validation de toutes les périodes du groupe via le même schéma que la saisie avant contrôle des conflits/calcul des dates. Erreur PRECONDITION_FAILED avec références de règle/formation pour valeur invalide ; transaction entière annulée. Pas de changement au helper calendrier générique.
- UI : indique les règles hors plage lors de la lecture et rend l’erreur explicite à l’exécution, FR/EN/AR. Limite 1..120 décrite comme technique, pas réglementaire. Suivis existants conservés ; correction proposée par revue/archivage/remplacement de règle, sans écrasement automatique.
- Nouveau cas PostgreSQL : périodes 0, -1, 121 et maximum SQL, erreur ciblée et absence d’ajout partiel, conservation des suivis historiques, reprise sans nouvel ajout après archivage. Six tests ciblés, TypeScript/build passent ; /tmp/raero-lot265-{focused,check,build}.log.
- Limites : revalidation seulement avant création d’un suivi manquant, pas d’audit/réécriture de toutes les anciennes échéances ; aucune détermination de période métier appropriée. Références dans les erreurs serveur restent françaises avec explication UI trilingue, comme les erreurs précédentes. Aucun suivi/règle métier réel modifié, aucune recette navigateur. Objectif global non achevé.

- Validation/déploiement lot265 : 462 tests / 110 fichiers, image/smoke Docker/restauration validés (/tmp/raero-lot265-{tests,docker,smoke}.log), aperçu remplacé avec volumes conservés, before265 arrêté. Index Tailscale HTTP 200 conforme, session antérieure/no-store vérifiés. Pas de migration ni exécution de règles sur les données métier.


### Lot 266 — préparation de la recette fournisseur et accès local

- Tour précédent : progression, disponibilité concrète de l’aperçu confirmée pour la demande utilisateur (conteneur healthy, transfert Tailscale actif, HTTP 200). L’application est déjà lancée ; aucun redémarrage nécessaire.
- Relecture de la gouvernance, de la matrice opérationnelle, du relevé fournisseur horodaté et des services Stripe/webhooks, abonnements, SMTP, vidéo privée, vidéo IA et identité de facture. Le relevé docs/provider-status-lot266.json indique Stripe/webhook, SMTP, texte/image/voix IA et variables initiales JaaS/émetteur absents au moment indiqué ; pas de nouvelle lecture des secrets ni de nouvelle mesure fournisseur dans cette reprise.
- Nouveau docs/provider-acceptance.md : préconditions et résultats attendus pour paiement, rejeu, refus, remboursement, abonnements, e-mails, création IA interne/B2B, classe à deux participants et factures. Dossier de preuve lié à une version ; tous les scénarios réels restent non exécutés. La configuration vidéo IA nécessite une vérification distincte des indicateurs texte/image/voix.
- Écarts conservés explicitement : outbox générale, révocation fournisseur effective, politiques commerciales et corrections de facturation. Configuration de recette demandée précédemment, réponse non disponible à la rédaction ; aucun nouvel envoi de question.
- Vérification documentaire : JSON lisible, liens relatifs du protocole présents. Aucun code applicatif changé, aucun test logiciel relancé, aucun déploiement, message externe, paiement, génération ou appel vidéo réalisé. Objectif global toujours non achevé.


### Lot 267 — récupération de mot de passe sans faux succès

- Tour précédent classé progression documentaire : protocole fournisseur concret créé, scénarios encore non exécutés. Relecture Login et routes de récupération : le client annonçait le même succès sur erreur réseau et succès API ; le serveur répond volontairement de façon neutre, notamment sans SMTP.
- Login distingue désormais demande reçue et réponse non confirmée. Message persistant, FR/EN/AR, sans révéler l’existence du compte ni affirmer la réception du mail. Le formulaire reste accessible pour réessayer, avec invitation à consulter la boîte avant nouvelle demande. Introduction corrigée et traduite en arabe.
- Verrou immédiat contre double soumission ; champ et retour désactivés pendant la requête ; adresse normalisée par trim ; suppression de l’origine cliente inutile, l’origine serveur reste inchangée. Étiquette liée au champ et état aria-busy, résultat status/alert. Pas de changement aux jetons, au serveur, au SMTP ou à la connexion/2FA.
- TypeScript, trois tests de langues et build passent. Dernière retouche des textes suivie d’une nouvelle vérification langues/build. Journaux /tmp/raero-lot267-{check,locales,build,docker}.log. Bundle serveur identique au conteneur avant copie (3ecce2d0275a3eb87a18943064671b58f3516250cff11cf3aca3b76cc8ae12e9). Image reconstruite, fichiers publics actualisés sans redémarrage ; HTTP 200 et index Tailscale identique au build.
- Limites : aucune recette navigateur, récupération réelle ou réception SMTP testée ; suite serveur complète non relancée pour ce changement client seul. La neutralité API ne prouve toujours pas l’envoi, et la relance volontaire reste soumise au throttling serveur existant. Aucun e-mail envoyé ni compte métier modifié. Objectif global non achevé.


### Lot 268 — confirmation durable du changement de mot de passe

- Tour précédent classé progression : demande de récupération corrigée et déployée. Relecture ResetPassword, contrat de route, consommation atomique du jeton et nettoyage du cache de session. L’interface précédente ne gardait pas les erreurs et redirigeait automatiquement après 1,5 seconde.
- Confirmation de succès conservée avec retour connexion déjà présent ; suppression du temporisateur. Champs effacés au succès, cache/session toujours nettoyés. Erreur persistante trilingue expliquant l’incertitude et la vérification par connexion/nouveau lien, sans exposer un message serveur brut.
- Verrou immédiat contre double soumission, champs désactivés pendant la requête, bornes de longueur alignées avec la route, étiquettes associées aux champs, aria-busy et annonces status/alert. Contrôle de longueur du jeton avant affichage du formulaire ; aucune prétention de valider son expiration côté client. Messages de cette page traduits en arabe.
- TypeScript, trois tests de langues et build réussis ; journaux /tmp/raero-lot268-{check,locales,build,docker}.log. Bundle serveur inchangé (3ecce2d0275a3eb87a18943064671b58f3516250cff11cf3aca3b76cc8ae12e9), image reconstruite et fichiers publics copiés sans redémarrage. HTTP Tailscale 200 et index identique au build.
- Limites : aucune recette navigateur ni consommation réelle de jeton sur l’aperçu ; suite serveur non relancée pour ce changement client seul. Traitement serveur des erreurs et mécanisme de récupération inchangés. Aucun e-mail envoyé ni mot de passe métier modifié. Objectif global non achevé.


### Lot 269 - Erreurs publiques de reinitialisation

- Tour precedent : progression, confirmation durable du changement de mot de passe livree. Inspection auth.resetPassword : err.message exposait toutes les exceptions comme BAD_REQUEST, y compris des details techniques potentiels.
- InvalidPasswordResetTokenError identifie les deux refus de jeton existants. La route retourne un BAD_REQUEST fixe pour cette classe seule ; les autres exceptions deviennent INTERNAL_SERVER_ERROR avec texte fixe et sans cause jointe. Hash, consommation atomique et revocation de session inchanges.
- Deux nouveaux tests de frontiere : exception typee, panne avec marqueurs sensibles, erreur ordinaire imitant le texte metier et rejet null. Test PostgreSQL renforce sur le type et le refus API du rejeu. 18 tests cibles, TypeScript et build passent.
- Premiere suite a quatre workers : 463 succes et un timeout de 5 s dans privacySupport.integration.test.ts. Reprise ciblee : deux succes en 3,08 s. getAdminTickets effectue une lecture globale puis une requete utilisateur par ticket ; causalite exacte du timeout non mesuree. Aucun timeout modifie ou test retire. Suite complete a un worker : 464 tests / 111 fichiers passent en 65,10 s. Performance de la liste support a corriger separement.
- Journaux /tmp/raero-lot269-{focused,check,build,tests,privacy-recheck,tests-recheck,docker,smoke}.log. Image et smoke Docker avec sauvegarde/restauration passent. Conteneur remplace avec volumes conserves, before269 arrete. Index Tailscale HTTP 200 conforme au build, ancienne session admin/no-store verifies, cookie temporaire supprime. Pas de migration.
- Le premier script de verification post-deploiement a echoue sur un encodage Python avant execution ; script ASCII corrige execute avec succes. Aucun test navigateur, aucune panne technique reelle provoquee sur l'apercu, aucun mot de passe metier modifie, aucun e-mail envoye. Audit des autres routes non couvert. Objectif global non acheve.


### Lot 270 - Lecture groupee des tickets administrateur

- Tour precedent : progression, erreurs publiques de reset assainies et deployees ; timeout de privacySupport observe, puis suite verte en execution sequentielle. Relecture getAdminTickets : une lecture globale et une lecture utilisateur par ticket.
- Remplacement par une jointure gauche en une seule requete SQL, projection auteur limitee a name/email, forme de reponse conservee. Ordre updatedAt descendant puis id descendant pour les dates identiques. Base absente : erreur explicite au lieu de faux tableau vide. Aucun changement aux droits admin ni aux conversations.
- Nouveau test PostgreSQL : plusieurs auteurs, identite nulle, ordre stable, projection exacte sans hash/openId/role ; compteur select verifie une seule requete pour la liste. Quatre tests cibles passent, dont privacySupport et supportAccess. TypeScript/build passent.
- Suite a quatre workers : 465 tests / 112 fichiers passent en 21,48 s, sans timeout sur cette execution. Ce resultat ne constitue pas un benchmark de charge. Journaux /tmp/raero-lot270-{focused,check,build,tests,docker,smoke}.log. Image et smoke Docker avec sauvegarde/restauration valides.
- Apercu remplace avec volumes conserves ; before270 arrete. HTTP Tailscale 200, index conforme, ancienne session admin/no-store et forme de support.adminList verifies sans afficher de contenu. Cookie temporaire supprime. Aucun ticket metier modifie, aucun envoi externe.
- Limites : liste toujours non paginee, volume de reponse non borne ; erreurs de liste dans le client a revoir. Jointure gauche conserve les tickets sans auteur, mais aucun cas d'auteur orphelin injecte dans ce test. Pas de recette navigateur ou charge concurrente mesuree. Objectif global non acheve.


### Lot 271 - Pagination et recherche des demandes support

- Tour precedent : progression, suppression du N+1 et deploiement verifies. Relecture liste support : reponse encore non bornee, absence de filtres serveur et confusion client entre echec et vide.
- Nouveau schema strict supportListInput : beforeId entier SQL positif, statut OPEN/PENDING/CLOSED optionnel, recherche trim bornee a 255 caracteres. Une requete jointe, recherche litterale insensible a la casse dans sujet/nom/email, filtre statut et id, limite 51 pour retourner 50 entries et nextBeforeId. Aucun contenu de conversation recherche ou ajoute.
- Tri par id descendant (creation), abandon du tri par activite pour eviter les deplacements dus aux reponses pendant la pagination ; explication visible FR/EN/AR. API adminList passe du tableau a {entries,nextBeforeId}, consommateurs connus et tests adaptes. Pas de mode tableau non borne conserve.
- Client : recherche et statut remettent le curseur au debut ; page suivante et actualisation depuis le debut, fermeture du fil lors du changement de vue. Chargement/erreur/vide distingues ; donnees cachees masquees sur erreur, bouton reessayer. Dates localisees, statut etiquete et desactive pendant refetch.
- Tests SQL : une requete/projection conservees, 55 tickets sur deux pages, nouvelle arrivee exclue des pages suivantes, absence de doublons, filtre statut, recherche sujet/nom/email, casse/trim/symboles %_ litteraux, vide et saisies invalides. Fixture privacySupport isolee par recherche auteur unique pour ne pas dependre de l'activite d'autres workers. Huit tests cibles puis 466 tests / 112 fichiers a quatre workers passent. TypeScript/build valides.
- Journaux /tmp/raero-lot271-{focused,check,build,tests,docker,smoke}.log. Image et smoke Docker avec sauvegarde/restauration passent. Apercu remplace, volumes conserves, before271 arrete. HTTP Tailscale 200, index conforme, ancienne session admin/no-store et contrat pagine verifies sans afficher de contenu. Cookie temporaire supprime.
- Limites : pagination sur donnees vivantes, pas de snapshot historique ; changement de statut ou d'identite peut modifier l'appartenance aux filtres. Recherche sans index specialise, pas de benchmark de charge ni recette navigateur/RTL. Liste personnelle et historique de conversation hors ce lot. Aucun ticket metier modifie, aucun message envoye. Objectif global non acheve.


### Lot 272 - Demandes support cote utilisateur

- Tour precedent : progression, pagination/recherche administrateur testees et deployees. Relecture Support : formulaire modifiable pendant envoi, notification seulement temporaire, erreurs de liste confondues avec liste vide, chargement auth affiche comme visiteur.
- Etats auth/loading/error/visiteur distingues. Liste avec erreur persistante, cache masque sur erreur et actualisation explicite. Dates localisees et bouton de fil aria-expanded/text-start. Liste personnelle toujours non paginee.
- Formulaire natif et validation via supportRequestInput existant ; champs etiquetes, bornes et desactivation pendant requete, verrou immediat contre double soumission. Message de creation non confirmee conserve le brouillon et invite a verifier la liste avant renvoi. Succes avec reference persistante et ouverture du fil apres invalidation. Messages FR/EN/AR.
- Pas de nouvel identifiant de deduplication serveur : un renvoi volontaire peut encore creer une autre demande ; aucune relance automatique ajoutee. Brouillon uniquement en memoire de la page, pas de persistance apres rechargement/navigation. Aucun comportement d'effacement automatique pour les demandes de confidentialite.
- TypeScript, trois tests de langues et build passent ; /tmp/raero-lot272-{check,locales,build,docker}.log. Bundle serveur identique au conteneur (067e006a0961a4a33f74db0ef70f3a86625acb4984c64ed94cc43f7c4e37a518). Image reconstruite, fichiers publics copies sans redemarrage ; HTTP Tailscale 200 et index identique au build.
- Suite serveur complete et smoke non repetes pour changement client seul. Aucune recette navigateur, aucun ticket metier cree/modifie, aucun message externe envoye. Fil de conversation et pagination personnelle a traiter separement. Objectif global non acheve.


### Lot 273 - Conversation support et envoi incertain

- Tour precedent : progression, formulaire support utilisateur et erreurs de lecture corriges/deployes. Relecture TicketThread et route reply : champ modifiable pendant mutation, Enter pouvait soumettre a nouveau, erreur de lecture affichee comme conversation vide. Notification serveur apres insertion peut laisser une reponse incertaine.
- Fil avec etats chargement/erreur/vide distincts, cache masque en erreur et bouton de reprise. Saisie et envoi desactives pendant mutation et sans lecture valide. Verrou immediat, Enter preventDefault avec respect de composition IME, limite 10000 alignee avec la route. Champ et bouton iconique etiquetes.
- Texte efface seulement apres succes, erreur persistante FR/EN/AR avec actualisation pour verifier avant renvoi. Invalidation attendue avant fin de mutation. Historique de statut dispose aussi d'une reprise en erreur. Dates localisees, marge logique RTL, fond du message propre corrige en oklch avec alpha valide (ancienne concatenation 22 invalide).
- TypeScript, trois tests de langues et build passent ; journaux /tmp/raero-lot273-{check,locales,build,docker}.log. Bundle serveur inchange (067e006a0961a4a33f74db0ef70f3a86625acb4984c64ed94cc43f7c4e37a518). Image reconstruite et fichiers publics actualises sans redemarrage. HTTP Tailscale 200, index conforme au build.
- Limites : pas de deduplication serveur ni garantie de livraison SMTP ajoutee, renvoi volontaire peut dupliquer ; brouillon perdu si fermeture du fil/navigation. Historique de messages non pagine, polling existant conserve. Pas de recette navigateur, aucun message reel envoye, suite serveur/smoke non repetes pour changement client seul. Objectif global non acheve.


### Lot 274 - Reprise des reponses support sans doublon

- Tour precedent : progression, fil support avec erreurs/reprise et protection locale livre. Relecture postTicketMessage : insertion atomique mais aucun identifiant de reprise. Les helpers SMTP avalent deja leurs erreurs ; une reponse HTTP perdue reste un cas d'incertitude.
- Nouveau supportMessageInput strict (ids SQL, contenu trim 1..10000, UUID optionnel normalise). Migration 20260913_support_message_requests.sql : ledger UUID primaire, message unique lie par FK, empreinte auteur/ticket/texte et date ; trigger interdit UPDATE/DELETE/TRUNCATE. Aucun texte ou secret duplique dans le ledger.
- Transaction : verrou UUID avant controles participant actuels, empreinte canonique, rejeu identique retourne le message sans modifier updatedAt ; reuse changee refusee CONFLICT. Message, date du ticket et ledger atomiques. Droits revalides sur rejeu. Anciens appels sans UUID conservent leur insertion sans deduplication.
- Route reply preserve la forme publique du message et saute les notifications sur rejeu. Interface conserve le meme UUID pour la reprise du texte inchange dans le meme fil ; changement de texte/ticket cree une autre reference et succes efface la reference. Pas de persistance apres fermeture/rechargement.
- Tests PostgreSQL : concurrence (une insertion), normalisation UUID/trim, rejets texte/ticket/auteur differents, compte suspendu, date conservee au rejeu, ledger immuable, bornes invalides. Test rollback existant renforce avec absence de ledger. Test route : meme message au rejeu et un seul appel SMTP simule ; aucun envoi reel. Quatre tests cibles, TypeScript/build puis 468 tests / 112 fichiers passent.
- Journaux /tmp/raero-lot274-{focused,check,build,tests,docker,smoke}.log. Image/migration/smoke/restauration valides. Apercu remplace avec volumes conserves, before274 arrete. HTTP Tailscale 200 et index conforme, ancienne session admin/no-store verifies, cookie temporaire retire.
- Limites : pas d'outbox generale, notification perdue non reprise automatiquement ; ledger garantit le message et non la livraison SMTP. Creation de ticket non dedupliquee, ancien client sans UUID non protege. Aucun test navigateur, aucun message metier envoye. Objectif global non acheve.


### Lot 275 - Creation de demandes support sans doublon

- Tour precedent : progression, deduplication des reponses support testee/deployee. Relecture createSupportTicket : ticket/message initial/historique deja atomiques, creation encore repetee sur renvoi apres perte de reponse.
- supportRequestInput accepte UUID optionnel normalise. Migration support_creation_requests : reference primaire, ticket unique FK, empreinte auteur/sujet/message/type/priorite et date ; trigger interdit modification/suppression/truncate. Verrou UUID avant verification actuelle du compte actif.
- Rejeu identique retourne le ticket actuel sans reinitialiser son traitement, creer message/evenement ou modifier sa date. Empreinte normalise trim, priorite normale par defaut et message vide/absent. Reutilisation pour un autre auteur ou contenu refusee ; compte suspendu refuse meme au rejeu. Ledger atomique avec creation.
- Route retire le drapeau interne replayed et saute la notification sur reprise ; reponse publique conservee. Formulaire garde la reference pour le contenu inchange tant que la page reste ouverte, la renouvelle pour un contenu different et l'efface apres succes. Anciens appels sans UUID restent sans deduplication.
- Tests SQL : creations simultanees avec UUID casse differente, une demande/un message/un evenement, traitement PENDING conserve, changements de champs/auteur refuses, suspension, immutabilite. Route : une notification simulee, reponse identique sans drapeau et UUID invalide refuse. Rollback de message initial verifie aussi absence de ledger.
- Premier ciblage : 8 passes/1 echec car supportHistory comparait le resultat interne enrichi a la ligne SQL ; test adapte pour exclure replayed, comparaison exacte des champs du ticket conservee. Reprise : 9 tests ciblages passes. TypeScript/build puis 470 tests / 113 fichiers passent. Journaux /tmp/raero-lot275-{focused,focused-recheck,check,build,tests,docker,smoke}.log.
- Image/migration/smoke Docker avec sauvegarde/restauration valides. Apercu remplace avec volumes conserves, before275 arrete. HTTP Tailscale 200/index conforme, ancienne session admin/no-store verifies ; cookie temporaire supprime. Aucun ticket metier cree, aucun e-mail reel envoye.
- Limites : reference client non persistante apres rechargement/navigation ; notifications sans outbox, livraison non garantie. Aucun rapprochement retroactif des doublons historiques ni suppression. Pas de recette navigateur. Objectif global non acheve.


### Lot 276 - Selection explicite de l'inscription dans le lecteur

- Tour precedent : progression, deduplication creation support livree. Retour au parcours apprenant : Dashboard liait chaque inscription au seul slug, LearningPlayer prenait la premiere inscription de ce slug. Deux inscriptions au meme cours pouvaient donc ouvrir le meme parcours malgre une selection differente.
- Liens Dashboard avec parametre enrollment=id. Selecteur client valide entier SQL positif, refuse parametre duplique/malforme, id absent ou slug different sans repli vers une autre inscription. Ancien lien sans id accepte seulement si une seule inscription correspond ; sinon retour explicite vers Mes inscriptions, FR/EN/AR.
- Cle du composant lecteur inclut la recherche URL reactive (useSearch) en plus du compte/slug, pour ne pas reutiliser resultats et reponses locaux entre inscriptions. Les appels existants continuent de transmettre enrollment.id et la version epinglee fournie dans cette inscription. Controle serveur des droits inchange.
- Deux tests de selection : inscriptions meme slug avec versions distinctes, ordre de liste indifferent, ancien lien unique/ambigu, id et slug incoherents, id absent, bornes, fraction/exposant/zero prefixe et parametres doubles. Cinq tests cibles avec langues passent, TypeScript/build valides ; /tmp/raero-lot276-{focused,check,build,docker}.log.
- Bundle serveur identique au conteneur (3aeb8828f857aa86d3eafd52af63f3ebcc9051bb7fa90e3b281e624274d1bc8e). Image reconstruite, fichiers publics copies sans redemarrage. HTTP Tailscale 200/index conforme. Pas de migration ni mutation d'inscription/examen.
- Limites : tests purs de selection, pas de parcours navigateur avec deux inscriptions ni de nouveau test d'examen serveur ; suite serveur/smoke non repetes pour code client seul. La cle change sur toute modification de recherche URL, pas uniquement du parametre enrollment. Aucun examen ou certificat metier cree. Objectif global non acheve.


### Lot 277 - Deux inscriptions du meme apprenant, deux versions

- Tour precedent : progression, selection explicite enrollment dans le lecteur et liens Dashboard deployes. Inspection des appels learning : enrollmentId transmis pour chapitres/slides/questions/progression/tentatives. Le test de versions existant utilisait deux utilisateurs differents.
- Test PostgreSQL makerAccess enrichi : nouvelle inscription du meme utilisateur sur version suivante, lecture dashboard puis selecteur client reel avec les deux ids, langues/version/contenu des chapitres et slides distincts, questions sans correction exposee et ancien lien ambigu refuse.
- Apres reussite de l'ancienne inscription : nouvelle inscription sans tentative ni objectif valide, examen final refuse avant prerequis ; tentative de chapitre commence a 1, session soumise sous l'ancienne inscription refusee, soumission sous la bonne inscription reussit. Le chapitre ajoute dans la nouvelle version reste requis pour acceder au final.
- 13 tests cibles passes (11 makerAccess et 2 learningEnrollment), TypeScript passe ; /tmp/raero-lot277-{focused,check}.log. Aucun code applicatif ou migration modifie, aucun deploiement ou build necessaire. La suite complete historique du lot275 ne devient pas une preuve fraiche globale.
- Limites : scenario API/services PostgreSQL avec selecteur pur, pas de navigation navigateur ou controle du remontage React. Utilisation de fixtures isolees, aucune inscription/examen/certificat metier modifie. Objectif global non acheve.


### Lot 278 - Reprise des lectures avant examen

- Tour precedent : progression, verification PostgreSQL de deux inscriptions/versions pour le meme apprenant. Inspection du lecteur : actualisation de progression couverte par le bandeau global ; ChapterAssessment ne signalait pas toutes les erreurs de relecture si une ancienne copie existait, et ExamEntry ne bloquait le demarrage que pour les erreurs d'historique.
- Chapitre : bandeau de relecture en erreur meme avec donnees precedentes (y compris chapitre deja reussi ou sans questions), reprise questions et tentatives. Entree chapitre et final (deux modes lecteur) prend en compte erreur/chargement des deux requetes avant nouveau demarrage. Libelle FR/EN/AR mentionne questions ou tentatives.
- Le composant ExamEntry conserve son etat started et QuizView durant une erreur de rafraichissement avec cache present ; aucune nouvelle logique de minuterie, soumission ou correction. Le bandeau signale la lecture incertaine sans remplacer un examen actif par un ecran de chargement.
- TypeScript, trois tests de langues et build passent ; /tmp/raero-lot278-{check,locales,build,docker}.log. Bundle serveur identique (3aeb8828f857aa86d3eafd52af63f3ebcc9051bb7fa90e3b281e624274d1bc8e). Image reconstruite et fichiers publics copies sans redemarrage ; HTTP Tailscale 200, index conforme.
- Limites : preservation du composant deduite de sa structure React, pas de simulation navigateur de coupure reseau ni test visuel. Pas de changement serveur, suite complete et smoke non repetes. Aucun examen ou suivi metier modifie. Objectif global non acheve.


### Lot 279 - Pagination du support personnel

- Tour precedent : progression, reprise des lectures de QCM livree. Consultation support personnelle encore non bornee ; reprise du chantier de consultation apres pagination admin.
- getMyTickets valide supportListInput, relit/verrouille en partage le compte actif, filtre obligatoirement userId puis statut/recherche litterale sur sujet/curseur id, limite 51 pour 50 entries et nextBeforeId. Erreur explicite si base indisponible. API myList change du tableau vers la page, tous consommateurs connus adaptes.
- UI : recherche objet et statut, pages anciennes, actualisation depuis debut, ordre de creation indique FR/EN/AR. Changement de filtres/page ferme le fil ; succes creation remet filtres/page au debut pour retrouver la nouvelle demande. Verification apres creation incertaine remet aussi toute la liste a zero. Etat sans correspondance distingue du vide sans filtre.
- Nouveau test SQL via API : 55 tickets, autre utilisateur exclu, nouvelle arrivee non dupliquee sur page suivante, statut/casse/trim/symboles litteraux, absence de resultat, curseur invalide et tentative d'injection userId refuses, compte suspendu refuse malgre contexte ancien. Six tests cibles, TypeScript/build puis 473 tests / 115 fichiers passent.
- Journaux /tmp/raero-lot279-{focused,check,build,tests,docker,smoke}.log. Image/smoke/restauration valides. Apercu remplace, volumes conserves, before279 arrete. HTTP Tailscale 200/index conforme, ancienne session admin/no-store et contrat personnel pagine verifies sans afficher de demandes. Cookie temporaire retire.
- Limites : pagination vivante, changements de statut/sujet peuvent modifier les resultats filtres ; pas de recherche dans conversations ni de snapshot/export global. Pas de recette navigateur ni benchmark volumetrique. Aucun ticket metier modifie, aucun message envoye. Objectif global non acheve.


### Lot 280 - Droits transactionnels de creation des regles

- Tour precedent : progression, pagination support personnel testee et deployee. Relecture createRoleRequirement : cours verrouille et verifie, mais controle du responsable/compagnie uniquement en amont de la transaction.
- Identifiant acteur obligatoire au service. Relecture en partage du compte actif et correspondance exacte de la compagnie selectionnee ; compagnie active verrouillee, affiliation MANAGER ACTIVE verrouillee pour non-admin. Global seulement admin sans compagnie. Ces verrous et le controle cours couvrent la transaction d'insertion.
- Route transmet ctx.user.id ; controle amont conserve. Fixtures directes fournissent un acteur reel. Nouveau test : creation autorisee puis retrait affiliation, changement compagnie, suspension compte, compagnie suspendue meme pour admin, global non-admin refuses ; une seule regle persiste. Aucun changement aux periodes ou au calcul des suivis.
- Dix tests cibles passes, TypeScript/build puis 474 tests / 115 fichiers passent. Journaux /tmp/raero-lot280-{focused,check,build,tests,docker,smoke}.log. Image et smoke avec sauvegarde/restauration valides.
- Apercu remplace avec volumes conserves, before280 arrete. HTTP Tailscale 200/index conforme, session admin anterieure/no-store verifies, cookie temporaire supprime. Pas de migration, aucune regle ou echeance metier modifiee.
- Limites : test de changements de droits avant appel service, pas d'orchestration d'une revocation concurrente en attente du verrou ni benchmark de contention. Creation toujours sans auteur historise/identifiant de deduplication propre. Autres mutations non auditees globalement. Aucune recette navigateur. Objectif global non acheve.


### Lot 281 - Auteur des nouvelles regles de recurrence

- Tour precedent : progression, droits de creation transactionnels testes/deployes. Inspection role_requirements : createdAt present, auteur uniquement pour archivage.
- Migration 20260913_role_requirement_creator.sql ajoute createdBy nullable avec FK users, sans attribution retroactive. Creation applicative fixe createdBy a l'acteur revalide dans la transaction ; aucun auteur fourni par le client utilise. Trigger protect_role_requirement existant couvre ce champ dans la comparaison globale immuable.
- Liste active expose le champ via sa projection existante ; historique ajoute createdBy/createdAt. UI FR/EN/AR affiche compte et date de creation si connus, sinon auteur non enregistre. Archivage conserve son attribution distincte. Pas de nom historique invente.
- Nouveau test SQL : auteur createur distinct de l'archiveur, lecture active/historique, tentative de changement d'auteur en meme temps que l'archivage refusee, effacement apres archivage refuse, auteur null conserve pour une ligne sans attribution. Neuf tests cibles, TypeScript/build puis 475 tests / 115 fichiers passent.
- Journaux /tmp/raero-lot281-{focused,check,build,tests,docker,smoke}.log. Migration/image/smoke/restauration valides. Apercu remplace avec volumes conserves, before281 arrete. HTTP Tailscale 200/index conforme, session admin anterieure/no-store verifies, cookie temporaire supprime.
- Limites : attribution a un identifiant de compte, pas de signature ni de validation pedagogique ; insertion SQL directe peut encore omettre l'auteur pour compatibilite des archives. Pas de reconstitution historique, pas de deduplication creation de regle, aucune recette navigateur. Aucun changement de definition ou echeance metier, aucun message externe. Objectif global non acheve.


### Lot 282 - Confirmation d'archivage des regles

- Tour precedent : progression, auteur de creation trace/teste/deploye. Relecture UI compagnie : erreurs persistantes et refetch deja presents, mais archivage declenche directement au clic malgre absence de reactivation.
- Confirmation native precise reference/libelle/portee, arret des nouveaux suivis, conservation des echeances et remplacement par nouvelle regle si besoin. Verrou immediat contre clics multiples ; bouton desactive pendant mutation. Succes conserve la reference archivee dans un message status, refetch existant toujours attendu. Textes FR/EN/AR.
- Premier script d'edition refuse par Python pour encodage avant toute modification ; edition appliquee par patch puis JSON verifie. TypeScript, trois tests de langues et build passent ; /tmp/raero-lot282-{check,locales,build,docker}.log.
- Bundle serveur identique au conteneur (c9a5765ba534428e2cd5b8b48883fbf278e1d1d74679468562ee634a962d7987). Image reconstruite, fichiers publics copies sans redemarrage ; HTTP Tailscale 200/index conforme. Pas de migration ni modification de regle metier.
- Limites : confirmation native navigateur, aucune recette visuelle/interaction effectuee, aucun archivage reel declenche. Suite serveur et restauration non repetees pour modification client seule. Confirmation ne remplace pas les droits serveur. Objectif global non acheve.


### Lot 283 - Images pedagogiques completes et erreurs de chargement

- Tour precedent : progression, confirmation d'archivage des regles livree. Inspection SlideDeck : image avec object-cover et hauteur plafonnee pouvant recadrer les annotations d'un schema, aucun retour explicite en cas d'echec de chargement.
- Nouveau LearningImage utilise object-contain, conserve alt/titre et plafond de hauteur. Erreur native masque l'image cassee et affiche une explication FR/EN/AR avec reprise explicite ; reprise remonte l'element image a la meme URL, sans modifier le media ni ajouter un parametre URL. Etat isole par cle diapositive/source.
- SlideDeck utilise le composant dans les parcours qui rendent une image. Priorite video/image existante conservee. Aucun changement aux QCM, progression, fichiers ou droits serveur.
- TypeScript, trois tests de langues et build passent ; /tmp/raero-lot283-{check,locales,build,docker}.log. Bundle serveur identique (c9a5765ba534428e2cd5b8b48883fbf278e1d1d74679468562ee634a962d7987). Image reconstruite et fichiers publics copies sans redemarrage. HTTP Tailscale 200/index conforme.
- Limites : pas de recette visuelle sur schemas reels ni erreur reseau simulee dans navigateur ; tailles, lisibilite et textes alternatifs des contenus administrables non audites. Pas de zoom ou reparation du media distant ; autres images hors SlideDeck non modifiees. Suite serveur/smoke non repetes pour changement client seul. Objectif global non acheve.


### Lot 284 - Verification concurrente des droits de creation

- Tour precedent : progression, images pedagogiques non recadrees et reprise de chargement livrees. Retour sur limite explicite du lot280 : verrous de droits presents mais aucune revocation orchestree pendant insertion.
- Nouveau test PostgreSQL suspend la creation juste avant insertion par un verrou consultatif de fixture, puis observe effectivement son attente dans pg_locks. Quatre modifications concurrentes (compte, compagnie, affiliation et publication du cours) echouent avec lock_timeout 55P03 pendant cette attente.
- Apres liberation, creation reussie avec auteur attendu ; revocation de l'affiliation reussie, puis nouvelle creation refusee, une seule regle conservee. Trigger/fonction de fixture et connexion de controle nettoyes en finally. Aucune modification du code applicatif.
- Douze tests cibles (six archivage/creation, six TNA) et TypeScript passent ; /tmp/raero-lot284-{focused,check}.log. Pas de build/deploiement necessaire pour ce test seul ; apercu conserve au code du lot283.
- Limites : exercice determine d'une transaction sur base isolee, pas de preuve exhaustive de toutes interleavings ni benchmark de contention. Les operations sont ordonnees : une creation deja engagee termine avant la revocation, qui bloque les suivantes. Aucune affiliation/formation/regle metier modifiee. Objectif global non acheve.


### Lot 285 - Apercu des salaries correspondant a une regle

- Tour precedent : progression, verification concurrente des droits de creation. Inspection formulaire : criteres saisis sans visualisation des salaries correspondants, alors que les employes autorises sont deja charges.
- Predicate ruleMatchesEmployee extrait dans shared/roleMatching et reexporte depuis db pour ses consommateurs ; logique conservee (sous-chaine insensible a la casse, poste OU licence, aucun critere signifie tous). Meme fonction pour runTNA et apercu. Types de champs explicites remplaçant any.
- Formulaire valide normalise par le schema existant avant comptage, employes actifs uniquement comme runTNA. Nombre et liste repliable des 20 premiers noms/ids/postes, nombre restant. Pendant relecture employes, apercu remplace par chargement ; erreur principale existante masque la vue. Textes FR/EN/AR precisent donnees chargees, absence de validation de competence/inscription et distinction avec nouveaux suivis.
- Test partage : OR, casse, trim via schema, absence de criteres, champs absents, symboles litteraux. Dix tests cibles, TypeScript/build puis 477 tests / 116 fichiers passent. Journaux /tmp/raero-lot285-{focused,check,build,tests,docker,smoke}.log. Image/smoke/restauration valides.
- Apercu remplace avec volumes conserves, before285 arrete. HTTP Tailscale 200/index conforme, session admin anterieure/no-store verifies, cookie temporaire retire. Aucune regle ou echeance metier creee.
- Limites : apercu local des salaries charges, pas de simulation de tous conflits de regles ni calcul des suivis manquants ; modifications concurrentes peuvent changer le resultat d'execution serveur. La liste des employes reste non paginee. Aucun test navigateur. Objectif global non acheve.


### Lot 286 - Chevauchements de periodes dans l'apercu de regle

- Tour precedent : progression, apercu des salaries correspondants livre. Ajout d'une comparaison du brouillon avec les regles actives deja chargees et autorisees pour la compagnie.
- Helper rolePeriodOverlaps reprend le predicate partage, ne considere que salaries actifs, meme formation, periode differente et intersection non vide des criteres. Regles archivees, cours differents, periodes egales et groupes disjoints exclus. Retour limite aux ids/periodes/nombres, sans enrichissement de donnees privees.
- UI affiche jusqu'a 20 regles concernees et le nombre restant ; nombre de salaries en commun par regle. FR/EN/AR distingue chevauchement et echec d'execution : les suivis existants ne sont pas simules et aucun blocage automatique de creation n'est ajoute. Pendant actualisation employes ou regles, l'apercu affiche chargement.
- Test de comparaisons avec criteres distincts, intersection partielle, statut inactif/null, cours/periodes/archives et absence de salaries. Cinq tests cibles avec predicate/langues et TypeScript/build passent ; /tmp/raero-lot286-{focused,check,build,docker}.log.
- Bundle serveur identique au conteneur (2638fc1c35834571031158c8aa393fd3211712ff2cd303530b142729d2285b7b). Image reconstruite, fichiers publics copies sans redemarrage. HTTP Tailscale 200/index conforme. Pas de migration, aucune regle ou echeance metier modifiee.
- Limites : comparaison sur donnees chargees, pas de simulation exhaustive de runTNA, des suivis existants ou des changements concurrents ; cout proportionnel aux regles du cours et salaries correspondants, pas de benchmark volumetrique. Pas de recette navigateur. Suite serveur/smoke non repetes pour code client seul. Objectif global non acheve.


### Lot 287 - Verification du prerequis HTTPS Tailscale

- Tour precedent : controle HTTP 200 local et Tailscale, sans changement applicatif ; pas de nouvelle fonctionnalite livree. Revalidation puis tentative concrete de Serve HTTPS prive sur 443 vers 127.0.0.1:3174.
- CLI Tailscale : Serve non active sur le tailnet, page d'activation requise. Commande en attente interrompue proprement (session 80848 terminee, code 1). Aucun certificat HTTPS ni acces HTTPS confirme.
- Configuration Serve relue apres interruption : seuls les TCP 3092, 3093 et 3174 existants ; HTTP Tailscale toujours 200. Aucun Funnel, aucun changement d'origine applicative, d'environnement prive, de conteneur ou de donnees.
- Suite : activation Serve via administration Tailscale, puis verification certificat, origine/CSRF, cookies Secure et connexion avant de promouvoir une URL HTTPS. Reference officielle : https://tailscale.com/docs/features/tailscale-serve . JaaS reste a configurer et conference multi-participants non verifiee.
- Pas de tests applicatifs repetes : aucune modification de code. Objectif global non acheve ; ce prerequis externe ne bloque pas les autres travaux.


### Lot 288 - Indisponibilite des dossiers apprenants

- Tour precedent : progression par verification concrete du prerequis HTTPS ; Serve exige une activation administrative, commande terminee sans changement de routage. Poursuite independante sur le parcours apprenant.
- getUserEnrollments/getUserCertificates renvoyaient [] et getEnrollmentById null sans base disponible. Desormais INTERNAL_SERVER_ERROR : une indisponibilite ne constitue plus une absence de dossier. Erreurs SQL deja propagees ; cas reel sans inscription inchange. Dashboard et LearningPlayer possedent deja leurs etats erreur/reprise, verifies par lecture du code.
- Nouveau test sans DATABASE_URL verifie les trois lectures. Aucun compte ou dossier reel cree. Test cible, TypeScript, build et suite PostgreSQL isolee : 479 tests / 118 fichiers passent. Journaux /tmp/raero-lot288-{focused,check,build,tests,docker,smoke}.log.
- Image reconstruite ; smoke conteneur, panne/reprise DB, session persistante, sauvegarde/restauration sur volumes jetables passes. Apercu remplace avec volumes conserves ; rollback before288 arrete. HTTP Tailscale 200, index conforme, session admin anterieure et no-store verifies ; cookie temporaire supprime. Bundle serveur local/conteneur identique 93a18496989e63d6ef36c9c003752637f7288a9c2d59c06e37d3edb101ee54db.
- Limites : test de configuration DB absente, pas de panne visuelle injectee dans un navigateur. Aucun changement de schema, de progression, de certificat ou de droits. HTTPS/JaaS et autres integrations externes restent non valides. Objectif global non acheve.


### Lot 289 - Detail d'inscription et progression entre versions

- Tour precedent : progression, erreurs explicites de lecture apprenant deployees. Inspection des lectures de curriculum et du detail dashboard : couverture precedente sur listes et API learning, sans preuve directe equivalente pour dashboard.enrollment.
- Test PostgreSQL existant enrichi : meme compte avec inscription ancienne/ar et renouvellement/en, detail restitue le contenu de chaque publication ; deux lectures croisees avec un autre titulaire renvoient null. Apres reussite du chapitre ancien, progression du detail rattachee uniquement a l'ancienne inscription et detail du renouvellement encore vide.
- Apres retrait de publication et archivage d'une question, detail ancien conserve sa langue et son contenu. Les mutations ne touchent que les fixtures de base isolee. Aucun changement applicatif necessaire : comportement existant confirme.
- Quatorze tests cibles (studio, selection inscription, indisponibilite) et TypeScript passent ; /tmp/raero-lot289-{focused,check}.log. Pas de build ni de deploiement pour changement de test seul ; apercu conserve au lot288.
- Limites : appels tRPC et PostgreSQL, pas de navigation navigateur ; archives completes de formation, medias distants et tous scenarios de retention non couverts par ces assertions. Objectif global non acheve.


### Lot 290 - Erreurs de replay et de presence en classe virtuelle

- Tour precedent : progression, preuve PostgreSQL du detail d'inscription par version. Inspection LiveRoom : avertissement HTTPS deja present, mais erreur de heartbeat de presence non affichee et replay video natif sans reprise explicite.
- Replay utilise le composant LearningVideo existant : erreur de chargement visible et bouton rechargeant la source, controles natifs conserves, etat isole par URL. Aucune modification de media distant.
- Echec de join/heartbeat affiche une alerte FR/EN/AR : periode de presence non confirmee, nouvelle tentative automatique tant que la conference reste connectee, contact organisateur si persistance. Aucun credit de presence ajoute par le client, cadence et controle connected/disposed existants conserves. Une reussite ulterieure remplace l'etat erreur de mutation.
- Premier patch refuse pour contexte de langue incomplet, aucun changement partiel ; patch corrige applique. TypeScript, trois tests de langues et build passent ; /tmp/raero-lot290-{check,locales,build,docker}.log. Bundle serveur inchange 93a18496989e63d6ef36c9c003752637f7288a9c2d59c06e37d3edb101ee54db.
- Image reconstruite puis fichiers publics copies sans redemarrage. HTTP Tailscale 200 et index conforme. Aucune conference, presence ou notification reelle declenchee.
- Limites : pas de test navigateur avec panne media/heartbeat, pas de session JaaS multi-participants ; couverture linguistique et compilation uniquement pour ce changement client. HTTPS et configuration fournisseur restent requis. Suite serveur/restauration non repetees pour code client seul. Objectif global non acheve.


### Lot 291 - Confirmation de cloture et publication du replay

- Tour precedent : progression, erreurs de replay/presence affichees. Inspection ReplaySetter : mutation de cloture directement au clic, URL non etiquetee, saisie modifiable pendant envoi et erreur uniquement en toast.
- Formulaire natif URL HTTPS obligatoire/max1024, label accessible, confirmation avec URL et consequence exacte sur les nouveaux acces video (liveAdmission ferme les statuts completed). Aucun engagement de deconnexion immediate du fournisseur.
- Verrou ref immediat et champs/bouton desactives pendant mutation ; invalidate cible attendue apres succes. Erreur persistante conserve la saisie et demande de verifier l'etat avant reprise. Textes FR/EN/AR. Entete a hauteur minimale et retours de ligne pour accueillir le formulaire et son erreur.
- TypeScript, trois tests de langues et compilation passes ; /tmp/raero-lot291-{check,locales,build,docker}.log. Bundle serveur identique au conteneur 93a18496989e63d6ef36c9c003752637f7288a9c2d59c06e37d3edb101ee54db. Image reconstruite, assets copies sans redemarrage ; HTTP Tailscale 200/index conforme.
- Limites : confirmation native et mise en page non testes en navigateur. Aucun replay reel publie ni classe cloturee. Aucun changement du serveur ; la mutation setReplayUrl reste sans journal dedie/CAS et verifie ses droits avant ecriture hors transaction commune, limites relevees a traiter. Protection client contre double clic ne constitue pas une deduplication serveur. Objectif global non acheve.


### Lot 292 - Droits transactionnels de cloture/replay

- Tour precedent : progression, confirmation et erreur persistante de cloture livrees. setReplayUrl verifiait ses droits avant UPDATE hors transaction commune.
- Service valide type/id/acteur/URL HTTPS et refuse DB indisponible. Transaction : compte actif admin/instructor FOR SHARE, classe FOR UPDATE, classe annulee refusee ; instructeur affectation active FOR SHARE, cours non archive et compagnie ACTIVE FOR SHARE. UPDATE replay/statut completed dans la meme transaction. Politique admin preexistante conservee ; correction de replay termine encore autorisee.
- Deux tests PostgreSQL nouveaux session/webinar : acteur sans droit, absence/retrait d'affectation, compte suspendu, compagnie suspendue, URL invalide, absence de mutation apres refus, cloture autorisee, correction admin et refus classe annulee. Aucun appel fournisseur.
- Dix tests cibles, TypeScript/build passent. Premiere suite complete : 480/481, fixture du test de versions utilisait deux chapitres sortOrder=0 mais exigeait ordre precis. Nouveau chapitre de fixture fixe a sortOrder=1. Deuxieme suite parallele : versions passent, timeout5s rapport certificats. Suite complete un worker : 481/481,119 fichiers,78.24s ; aucun timeout augmente. Journaux /tmp/raero-lot292-{focused,check,build,tests,tests-recheck,tests-serial,docker,smoke}.log. Charge/volume de ce rapport a examiner separement.
- Image/smoke/restauration valides. Conteneur remplace, volumes conserves, before292 arrete. HTTP Tailscale 200/index conforme, session admin anterieure/no-store verifies, cookie temporaire supprime. Bundle local/conteneur c24a180d6110e315fbe186bb4673c8342f5e9d86dae7ddf2fd4d4de5efb8d643.
- Limites : pas encore de revocation orchestree pendant UPDATE en test, ni journal dedie/CAS de replay ; verrou de ligne serialise les ecritures sans proteger contre intention ancienne d'un autre moderateur. Aucune classe/replay metier modifie. Pas de recette navigateur/JaaS. Objectif global non acheve.


### Lot 293 - Index des certificats par inscription

- Tour precedent : progression, cloture replay transactionnelle deployee ; timeout du rapport observe sous charge parallele puis suite481 validee en serie. Investigation PostgreSQL isole :3870 certificats, plus de16000 inscriptions, aucun index enrollmentId des certificats.
- EXPLAIN ANALYZE du coeur de jointure page50 : avant index Seq Scan3870 certificats, execution0.532ms ; apres migration Index Scan certificates_enrollment_idx, execution0.154ms. Observations ponctuelles sur cache chaud et requete simplifiee, pas benchmark global ni attribution exclusive du timeout. Export complet continue a parcourir toutes les pages et journaliser chaque lecture.
- Migration additive20260913_certificate_enrollment_index.sql enregistree dans migrate.ts et index declare dans schema. Index NON UNIQUE : certificats multiples historiques conserves et toujours signales review. Aucune reecriture des preuves ni changement du rapport.
- 17 tests cibles (rapport, origine/revocation/statut/rattachement certificats), TypeScript et build passes ; /tmp/raero-lot293-{focused,check,build,docker,smoke}.log. Tests rapport1.909s et2.575s isoles. Suite complete non repetee pour index seul.
- Image, smoke/panne DB/reprise et restauration passes. Conteneur remplace, volumes conserves, before293 arrete. HTTP Tailscale200/index conforme, session admin anterieure/no-store verifies, cookie temporaire supprime. Index present dans PostgreSQL de l'apercu confirme par pg_indexes.
- Limites : pas de preuve de performance en production ou sur export volumineux simultane ; creation d'index non concurrente dans la transaction de migration, adaptee a cet apercu local, fenetre de maintenance a prevoir avant reprise sur grosse base. Aucun certificat metier cree. Objectif global non acheve.


### Lot 294 - Mesure et annulation des exports complets

- Tour precedent : progression, index certificat/inscription deploye. Mesure via scripts/report-performance.ts avec garde cible stricte127.0.0.1:55477/raero_test_isolated. Compte admin de fixture cree puis suspendu ; lectures tRPC et audits reels sur base isolee uniquement. Resultats sans donnees personnelles dans docs/report-performance-lot294.json.
-16319 inscriptions/3889 certificats :3 exports sequentiels1621/1824/1987ms ;4 concurrents1750-1771ms,327 pages/export, tous16319 IDs uniques, aucune omission. Mesure en processus sans HTTP, navigateur ni serialisation CSV : ne prouve pas performance de bout en bout ni cause exclusive du timeout precedent.
- collectComplianceReport accepte signal et progression optionnels, controle annulation avant/apres chaque page et avant retour ; aucune liste partielle retournee. Test annulation durant page en attente : resultat rejete, page ignoree, aucune nouvelle lecture, compteur conserve seulement pages terminees ; signal deja annule refuse avant premiere lecture.
- Admin : compteur de dossiers lus, bouton annuler, notices durables FR/EN/AR d'echec/annulation sans fichier partiel ; verrou ref immediat, annulation au demontage/changement de compte. Le CSV n'est construit qu'apres collecte complete. La requete deja en vol termine mais son resultat est ignore ; pas d'interruption de la transaction SQL.
- Six tests cibles et TypeScript/build passes ; /tmp/raero-lot294-{performance,focused,check,build,docker}.log. Bundle serveur inchange f6604b29d7bdb87b26055e8b5ad9de2a677a2acf9d081e52e674d72278c322c6. Image reconstruite/assets copies sans redemarrage, HTTP Tailscale200/index conforme.
- Limites : pas de recette navigateur, compteur sans total instantane, assemblage CSV synchrone apres collecte non interruptible ; pas de snapshot transactionnel global entre pages. Aucun export metier telecharge. Suite serveur/restauration non repetees pour code client/helper seul. Objectif global non acheve.


### Lot 295 - Journal immuable de cloture/replay

- Tour precedent : progression, mesure et annulation export livrees. Retour sur limite de setReplayUrl : aucun historique d'auteur/avant-apres malgre transaction de droits.
- Nouvelle table live_replay_events : classe/type, acteur FK, date, ancien/nouveau statut et URL, index classe/id. Trigger statement refuse UPDATE/DELETE/TRUNCATE. Migration enregistree/schema declare, aucun backfill invente.
- setReplayUrl insere l'evenement dans la transaction de cloture. Si statut completed et URL deja identique, droits toujours verifies mais aucun UPDATE/evenement supplementaire. Deux requetes simultanees identiques conservent un evenement ; une correction autorisee ajoute un nouvel avant/apres.
- Tests session/webinar renforces : historique exact, acteur conserve, absence de doublon ; panne injectee par trigger de fixture dans INSERT journal annule UPDATE classe et laisse historique vide ; triggers/fonctions temporaires retires en finally. UPDATE/DELETE/TRUNCATE historique refuses. Dix tests cibles, TypeScript/build puis482 tests/119 fichiers passent a quatre workers. /tmp/raero-lot295-{focused,check,build,tests,docker,smoke}.log.
- Image/smoke/sauvegarde/restauration passes. Apercu remplace avec volumes conserves, before295 arrete. HTTP Tailscale200/index conforme, session anterieure/no-store verifies, cookie temporaire supprime. Table/trigger presents et0 evenement reel confirmes. Bundle local/conteneur18e1f832fb0ba83afdd8c3e275f84670740d5b5291ae9a39171f22799610c19a.
- Limites : historique pour les modifications passant par setReplayUrl a compter de cette migration ; pas encore de consultation API/UI, de motif obligatoire ou de CAS entre intentions divergentes. Les ecritures SQL directes des classes ne creent pas automatiquement cet evenement. Aucune conference/replay metier modifie. Objectif global non acheve.


### Lot 296 - Consultation du journal des replays

- Tour precedent : progression, journal transactionnel immuable deploye. Lecture getReplayHistory et route moderatorProcedure live.replayHistory ajoutees : schema strict type/id/cursor,50 entrees par page+sentinelle, ordre id decroissant, filtre classe/type.
- Controle de moderateur extrait du service de cloture sans changement de politique : compte/affectation/cours/compagnie verrouilles FOR SHARE, classe verrouillee SHARE pour lecture/UPDATE pour cloture. Meme transaction entre droits et lecture ; classe completed autorisee, cancelled refusee comme acces existant.
- LiveReplayHistory disponible dans classe pour moderateur meme en replay : details a ouverture explicite, date locale/id auteur, statut avant/apres traduit, liens affiches en texte avec bdi, notice sur debut du journal et liens anciens potentiellement expires. Chargement/erreur/reprise, cache masque sur erreur, page plus ancienne et retour/actualisation recentes. Enregistrement de replay invalide aussi ce journal.
- Tests session/webinar renforces via API :55 evenements, page50+5, nouvel evenement entre pages exclu, autre classe/type exclu, retrait affectation/compte/compagnie refuse meme avec contexte API conserve, curseur invalide refuse. Fixture etrangere finale utilise une vraie autre classe.13 tests cibles puis482 tests/119 fichiers, TypeScript/build passes ; /tmp/raero-lot296-{focused,check,build,tests,docker,smoke}.log.
- Smoke/restauration passes ; dernier ajustement client d'invalidation suivi de TypeScript/build/image finale (docker-final.log), sans changement serveur. Apercu remplace, volumes conserves, before296 arrete. HTTP Tailscale200/index conforme, session anterieure/no-store verifies et cookie temporaire retire. Bundle local/conteneur9cc819bce9f6b2ca3b80e927f1dd3f458c97f3c116cb92b0b3c3eb8fef436757.
- Limites : aucun test navigateur ni consultation d'historique metier reel. Acces aux classes annulees toujours refuse ; pas de journal automatique pour SQL direct ni de CAS sur remplacement divergent. Les liens historiques peuvent contenir des adresses privees, exposes uniquement aux moderateurs actuellement autorises. Objectif global non acheve.


### Lot 297 - Revocation concurrente pendant cloture de replay

- Tour precedent : progression, consultation du journal livree. Verification manquante du lot292 : revocation effectivement orchestree pendant une cloture, au-dela de refus apres changement deja valide.
- Test PostgreSQL suspend la cloture de session juste avant INSERT journal via trigger de fixture/verrou consultatif ; attente observee dans pg_locks. Lecture concurrente voit encore l'ancien statut/lien (pas de cloture partiellement visible).
- Pendant attente, cinq UPDATE concurrents compte/compagnie/affectation/cours/classe sont refuses par lock_timeout55P03. Apres liberation, cloture et evenement uniques valides ; retrait d'affectation reussit, puis remplacement et consultation du journal sont refuses. Etat final et auteur/url du seul evenement verifies.
- Trigger/fonction de fixture et connexion de controle nettoyes en finally. Onze tests cibles et TypeScript passes ; /tmp/raero-lot297-{focused,check}.log. Aucun changement applicatif, build/deploiement inutiles ; apercu conserve au lot296.
- Limites : scenario determine sur session/base isolee, pas preuve exhaustive de tous ordres de concurrence ou de performance ; lecture d'historique apres revocation testee, pas suspension de cette lecture elle-meme. Aucun compte/classe/replay metier modifie. Objectif global non acheve.


### Lot 298 - Conflits de remplacement des replays

- Tour precedent : progression, revocation concurrente testee. Ajout replayRevision sur sessions/webinars, initial0 ; trigger DB incremente sur changement statut ou replayUrl, refuse modification directe du compteur. Les changements de statut hors service invalident donc aussi une intention anterieure.
- getLiveAccess restitue revision aux inscrits autorises. Service/route setReplay exigent expectedRevision : sous verrou classe, meme URL deja completed reste sans nouvelle ecriture apres verification des droits ; autre modification avec revision ancienne refuse CONFLICT. URL maximale alignee512 sur colonne DB (ancienne validation1024 pouvant echouer en SQL).
- Formulaire garde revision initiale en ref, ne la remplace pas silencieusement au polling. Envoi inclut cette revision ; message conflit FR/EN/AR invite a copier le lien et recharger/verifier l'etat avant nouvel envoi. Validation HTML max512. Pas de remplacement automatique ni de nouveau bouton de correction apres cloture.
- Tests session/webinar : deux URLs concurrentes sur meme revision donnent un seul succes/un conflit ; compteur+1, reprise identique sans evenement, alteration directe du compteur refusee, annulation statut incremente encore. URL trop longue BAD_REQUEST. Tests precedents de droits/journal/rollback et revocation conserves/adaptes.
- Quatorze tests cibles, TypeScript/build et483 tests/119 fichiers passes ; /tmp/raero-lot298-{focused,check,build,tests,docker,smoke}.log. Image/smoke/panne-reprise DB/sauvegarde-restauration valides.
- Apercu remplace, volumes conserves, before298 arrete. HTTP Tailscale200/index conforme, session anterieure/no-store verifies, cookie temporaire retire. Deux triggers presents. Bundle local/conteneur7343af9b9c629e3cd9828dcf61fa43557787eb63e0bc1282893e2e68b40ce11d.
- Limites : ancien client sans expectedRevision refuse avant mutation ; aucune recette navigateur, fusion de brouillon ou formulaire de correction apres replay encore absent. Trigger compteur ne remplace pas journal d'auteur pour SQL direct. Initial0 est une base de concurrence au deploiement, pas un historique reconstitue. Aucun replay/classe metier modifie. Objectif global non acheve.


### Lot 299 - Correction de replay apres cloture

- Tour precedent : progression, revision/CAS des replays deployes. UI ne proposait encore aucun remplacement lorsque le replay etait deja affiche.
- Nouveau ReplayCorrection pour moderateur en mode replay : ouverture explicite, copie de revision et lien actuellement observes ; ReplaySetter commun affiche lien precedent et demande confirmation avant/apres avec maintien de classe terminee. Aucun rebasage automatique de cette copie au polling ; le serveur peut refuser CONFLICT si obsolete.
- Bouton remplacer desactive pour lien vide/identique et pendant mutation. Annulation explicite de la saisie hors envoi ; succes ferme le formulaire et affiche confirmation persistante apres invalidation acces/journal. FR/EN/AR. Droits serveur/historique/revision reutilises sans modification.
- TypeScript, trois tests de langues et build passes ; /tmp/raero-lot299-{check,locales,build,docker}.log. Bundle serveur identique7343af9b9c629e3cd9828dcf61fa43557787eb63e0bc1282893e2e68b40ce11d. Image reconstruite puis assets copies sans redemarrage. HTTP Tailscale200/index conforme.
- Limites : pas de recette navigateur ni remplacement de replay metier. Annulation volontaire ou rechargement perdent la saisie locale ; aucun brouillon durable. Formulaire absent pour non-moderateur et classes auxquelles acces refuse. Suite serveur/restauration non repetees pour code client seul. Objectif global non acheve.


### Lot 300 - File persistante des notifications support

- Tour precedent : progression, correction de replay depuis interface livree. Inspection support : ticket/message valide puis email direct, configuration absente/erreur silencieuses et demande non conservee pour reprise.
- Nouvelle support_notification_outbox creee atomiquement avec ticket/message : cle stable ticket:id/message:id, references FK, audience admin/owner, etat pending/sending/accepted/unconfirmed, destinataire de tentative, dates. Identite immuable, suppression/truncate interdits et transitions DB limitees pending->sending->accepted/unconfirmed. Pas de copie du contenu du support dans la file.
- Routes support utilisent notifySupport apres enregistrement, y compris relecture UUID identique : aucun doublon de ticket/message/file. Dispatcher : configuration SMTP absente laisse pending ; verrou de ligne claim unique, adresse valide/backoffice ou titulaire actif actuel, claim commit avant transport. Acceptation SMTP enregistree, erreur/exception unconfirmed. Arret apres claim ou echec de persistance laisse sending a examiner, jamais de renvoi automatique d'un resultat ambigu.
- Email minimal avec reference ticket/invitation a se connecter, sans recopier contenu ni nom du titulaire. Notification interne de reponse admin existante conservee hors transaction ; erreurs de celle-ci peuvent laisser email pending. Les autres emails (devis, inscription, etc.) ne passent pas encore par cette file.
- Tests : absence config, concurrence un seul transport simule, relecture sans renvoi, etats/identite immuables, SMTP non confirme jamais renvoye automatiquement, titulaire suspendu/nonenvoye puis adresse actualisee, panne de queue annule creation ticket/message. Sept tests cibles/typecheck/build passes ; premiere suite484/485 avec adresse de fixture reutilisee, fixture corrigee UUID sans purge ; seconde485/485,120 fichiers. /tmp/raero-lot300-{focused,check,build,tests,tests-recheck,docker,smoke}.log.
- Image/smoke/restauration passes. Apercu remplace, volumes conserves, before300 arrete. HTTP Tailscale200/index conforme, session anterieure/no-store verifies, cookie temporaire retire. Table presente/0 notification reelle. Bundle local/conteneur2ff969d162a08000691497747dc2559033be93c3b61b283cb077e98472503e7b.
- Limites : consultation/reprise administrateur de file encore a ajouter ; pending est actuellement repris lors d'une nouvelle invocation de notification liee au meme ticket/message, pas de worker periodique. Aucun backfill des anciens emails, aucun SMTP reel valide ; accepted signifie acceptation du serveur, pas remise en boite. Destinataire controle au claim, pas verrouille pendant appel reseau. Objectif global non acheve.


### Lot 301 - Consultation et reprise administrative des emails support

- Tour precedent : progression, file support persistante deployee. Ajout listSupportNotifications/notificationQueue : admin actif relu sous verrou, filtres stricts etat/ticket/cursor,50 lignes+sentinelle, dates/destination et disponibilite de reprise sans contenu du ticket. Destinataire propose actuel distinct de celui effectivement utilise.
- sendNotification/sendPendingSupportNotification : admin actif verifie dans transaction de claim, adresse attendue obligatoire comparee a adresse actuelle, configuration et titulaire actif revalides. Pending seul peut etre revendique ; sending/unconfirmed refuses, accepted retourne son etat sans nouvel envoi. Nouveau claimedBy FK conserve l'administrateur au claim ; transitions finales ne peuvent reecrire cet auteur. Migration additive sans attribution inventee aux anciennes lignes.
- SupportNotificationQueue dans onglet support admin, ouverture explicite, filtre d'etat, pagination/actualisation, absence SMTP/erreur/liste vide distinctes. Confirmation avec adresse et ticket, verrou immediat, retour durable puis refetch ; seul pending valide propose Envoyer. Textes FR/EN/AR distinguent SMTP et remise en boite, sending en cours OU interrompu et besoin de verifier le fournisseur pour incertitude.
- Tests :55 notifications filtrees page50+5, nouvel arrivant exclu de suite, changement adresseCONFLICT, absence config/nonadmin/suspension admin refuses, claim attribue et immuable. Premiere assertion concurrente attendait deux acceptations alors que sending doit etre refusee ; test corrige pour suspendre effectivement le transport simule, verifier refus du concurrent puis acceptation unique et reprise sans nouvel envoi. Aucune modification du comportement pour contourner le test.
- Onze tests cibles, TypeScript/build puis486 tests/120 fichiers passes ; /tmp/raero-lot301-{focused,focused-recheck,check,build,tests,docker,smoke}.log. Image/smoke/sauvegarde-restauration valides.
- Apercu remplace, volumes conserves, before301 arrete. HTTP Tailscale200/index conforme, session anterieure/no-store verifies, cookie temporaire retire. Lecture HTTP authentifiee notificationQueue valide :0 pending, SMTP configured=false. Aucun envoi/ticket reel. Bundle local/conteneurd443f4af7d8216a4c10148d67f921d12746319be7d754317f96c9285bfe5195d.
- Limites : pas de recette navigateur, worker periodique ou reprise d'envoi ambigu ; consultation fournisseur/reconciliation reste externe. Adresses/noms de configuration ne sont pas copies dans les journaux de verification. Notifications internes et autres categories email restent hors file. Objectif global non acheve.


### Lot 302 - Notification interne atomique avec la reponse support

- Tour precedent : progression, reprise administrative des emails support livree. Reste identifie : notification interne encore creee dans route apres commit du message, une panne pouvait laisser reponse sans alerte ou retarder email en attente.
- Insertion notifications deplacee dans postTicketMessage, dans transaction message/ticket/ledger/email intent. Role actuel deja verrouille relu ; reponse admin a un autre titulaire seule cree cette alerte, comme politique anterieure. Corps issu du contenu normalise sauvegarde, cle support-message:id pour rattachement. Route ne recree plus l'alerte.
- Test de panne sur INSERT notifications : aucun message/ledger/alerte/file email de reponse persiste, updatedAt ticket conserve, seule intention email initiale du ticket reste. Apres retrait du trigger de fixture, deux reprises UUID identiques creent un message et une alerte, puis reponse du titulaire ne le notifie pas lui-meme. Nettoyage trigger/fonction en finally.
- Neuf tests cibles, TypeScript/build et487 tests/120 fichiers passent ; /tmp/raero-lot302-{focused,check,build,tests,docker,smoke}.log. Image/smoke/panne-reprise DB/sauvegarde-restauration valides.
- Apercu remplace, volumes conserves, before302 arrete. HTTP Tailscale200/index conforme, session anterieure/no-store verifies, cookie temporaire retire. Bundle local/conteneur1a129fc3f29f5078fa625a6aa62084198c5a7641a2e2ba9880bfc638f0c1515a. Aucune reponse/notification metier ni email reel produit.
- Limites : pas de backfill des anciennes alertes manquantes ni de preuve navigateur ; notification interne conserve son comportement existant de titre FR/extrait120 caracteres/lien support. Les autres categories de notifications ne sont pas modifiees. Objectif global non acheve.


### Lot 303 - Acceptation SMTP suivie d'une panne de persistance

- Tour precedent : progression, notification interne atomique deployee. Test du point de rupture entre transport SMTP et persistance de son resultat, essentiel pour eviter renvoi ambigu.
- Trigger de fixture refuse UPDATE accepted apres transport simule ayant retourne sent=true. Le service echoue, mais le claim deja commis conserve sending, destinataire, auteur administrateur et date ; finishedAt reste null.
- Apres retrait du trigger, nouvelle invocation automatique n'appelle pas le transport, reprise administrateur refuse PRECONDITION_FAILED. Lecture de file retrouve la ligne sending avec canSend=false ; exactement un appel SMTP simule au total. Trigger/fonction nettoyes en finally.
- Huit tests cibles et TypeScript passent ; /tmp/raero-lot303-{focused,check}.log. Aucun changement applicatif ni migration ; apercu conserve au lot302, pas de build/deploiement requis.
- Limites : panne de persistance injectee sur PostgreSQL isole, pas arret brutal de processus ni SMTP reel. sending ne prouve ni processus encore actif ni remise/absence de remise ; consultation fournisseur reste necessaire. Aucune notification metier ni email reel produit. Objectif global non acheve.


### Lot 304 - Chargement et comptage des notifications personnelles

- Tour precedent : progression, panne de persistance apres SMTP testee. Inspection NotificationBell : defauts[]/0 masquaient chargement/erreurs, marquage comme lu sans retour d'echec ; compteur SQL chargeait toutes les lignes non lues.
- Services liste/compteur/marquages refusent DB absente avec INTERNAL_SERVER_ERROR. Compteur par count(*) SQL au lieu de rapatrier toutes les lignes ; liste des50 dernieres a ordre stable createdAt DESC/id DESC.
- Cloche : chargement et erreur explicites, badge avertissement/label accessible sur panne, badge numerique non affiche comme certain si erreur, reprise des deux lectures, cache de liste masque si lecture en erreur. Echec de marquage affiche avec actualisation ; actions groupees desactivees pendant mutations/lecture, invalidations attendues. Alignement text-start pour RTL.
- Tests DB absente sur4 services et PostgreSQL61 alertes propres+etrangere : compteur60 au-dela page50, ordre deterministe, marquage idempotent et isolation du titulaire, tout-lu sans affecter autre compte. Cinq tests cibles/typecheck/build puis490 tests/122 fichiers passent. /tmp/raero-lot304-{focused,check,build,tests,docker,smoke}.log.
- Image/smoke/panne-reprise DB/sauvegarde-restauration valides. Apercu remplace avec volumes conserves, before304 arrete. HTTP Tailscale200/index conforme, session anterieure/no-store verifies, cookie temporaire retire. Bundle local/conteneur86fea1636b7001136d73dc6608ac675789cab9731b58cbd87219be14e2202407.
- Limites : pas de recette navigateur ni benchmark du compteur ;50 dernieres seulement, anciennes alertes non paginees dans cette cloche. Liens actuels conserves (support ouvre la liste, pas encore le ticket exact). Aucun dossier/notification metier modifie. Objectif global non acheve.


### Lot 305 - Ouvrir le ticket depuis une notification de support

- Tour precedent : verification de disponibilite HTTP et conteneur pour la demande explicite de lancement local ; la refonte globale reste active. Relecture gouvernance et code courant avant modification.
- Les nouvelles alertes de reponse administrative pointent vers /support/ticket/<id>, dans la meme transaction que message/notification/intention email. Anciennes alertes conservees sans reecriture.
- Nouvelle page dediee independante de la pagination personnelle : identifiant canonique entier positif borne SQL, chargement/erreur auth/connexion explicites, retour a la liste, TicketThread reutilise avec cle utilisateur/ticket pour reinitialiser le brouillon. Libelles FR/EN/AR ; les messages et l'historique restent proteges par les services serveur existants.
- Test transactionnel de notification adapte au lien exact ; test API de confidentialite etendu avec50 tickets plus recents : ticket absent de la premiere page, conversation accessible au titulaire/admin et interdite aux autres roles. Suite490 tests/122 fichiers reussie, puis5 tests cibles apres extension de fixture. TypeScript et build passent. Logs /tmp/raero-lot305-{check,build,tests,focused,docker,smoke}.log.
- Image reconstruite ; smoke avec panne/reprise DB, session/restart et sauvegarde-restauration valide. Conteneur remplace, volumes conserves et before305 arrete. HTTP Tailscale200, index local identique, route profonde servie, session admin anterieure et no-store verifies ; cookie temporaire supprime. Bundle serveur local/conteneur09df687079d00165c16363f1af197d2a8cecd7ec7fac41d102b5f4944df33b06.
- Limites : pas de recette navigateur/clic reel ; HTTP de route profonde prouve la livraison SPA seulement. La page affiche le numero du ticket, pas son sujet/statut ; les erreurs de lecture restent generiques. Connexion via parcours existant (pas de retour automatique au lien apres login). Aucun ticket/notification metier ni email reel cree sur l'apercu. HTTPS, fournisseurs externes et recette globale restent non valides ; objectif global non acheve.


### Lot 306 - Retour a la destination apres connexion

- Tour precedent : progression, liens directs support deployes. Inspection Login/SupportTicket/main : la connexion envoyait toujours vers dashboard/admin et perdait le ticket demande ; le gestionnaire401 perdait aussi la page courante.
- getLoginUrl accepte une destination facultative ; le ticket transmet son chemin. Le gestionnaire401 transmet chemin/recherche/ancre. Login utilise une destination valide apres le nettoyage du cache de session et la connexion, via finishLogin commun au mot de passe et a la verification2FA. Sans destination valide, destinations de role existantes conservees.
- shared/loginReturn valide un chemin relatif local borne2048, refuse destinations externes/protocole relatif, controles/antislash, encodages de chemin invalides ou ambigus, et routes API/connexion/inscription/reset. Une seule valeur returnTo autorisee. Aucun droit metier accorde par le lien ; controle serveur existant.
- Deux tests couvrent aller-retour ticket/selection enrollment/privacy, roles admin/user, liens hostiles, doublons, routes exclues et repli. Avec trois tests de langues :5 tests passes ; TypeScript/build passent. Logs /tmp/raero-lot306-{focused,check,build,docker}.log.
- Image reconstruite puis assets copies dans le conteneur actif sans redemarrage. Bundle serveur inchange09df687079d00165c16363f1af197d2a8cecd7ec7fac41d102b5f4944df33b06, donc pas de nouvelle suite SQL/smoke serveur. HTTP200/index identique pour accueil, login avec retour et lien ticket ; bundle frontal servi identique au build local.
- Limites : pas de connexion/2FA reelle en navigateur ni validation visuelle ; les tests de fonction ne prouvent pas le parcours interactif complet. Les autres liens explicites de connexion sans parametre gardent leur destination par defaut ; pas de persistance inter-appareil ni reprise du retour apres creation de compte/reset-password. Objectif global non acheve, fournisseurs externes/HTTPS/recette globale restent a valider.


### Lot 307 - Contexte du ticket sur la page directe

- Tour precedent : progression, destination de connexion preservee. Inspection page directe : seul numero affiche, sujet/etat/type manquants pour comprendre la conversation.
- support.detail protege et strict, identifiants entiers positifs bornes SQL. Service getSupportTicketDetail revalide acteur actif et titulaire/admin sous verrous partages acteur/ticket ; projection explicite id/sujet/statut/type/dates, aucun objet utilisateur ou champ interne supplementaire.
- Page directe : sujet, etat traduit FR/EN/AR et type de demande. Lecture toutes8s, chargement/erreur/reprise explicites, donnees detail cachees masquees sur erreur. Fil existant conserve monte pendant erreur de detail pour ne pas perdre le brouillon ; il applique ses propres controles et masquage d'erreurs.
- Test API etendu : projection exacte, acces hors premiere page pour titulaire/admin, autres roles refuses, etat apres traitement, ancienne session admin apres retrait du role et titulaire suspendu refuses, identifiants invalides refuses.
- TypeScript initial a signale le statut SQL string indexant une table de libelles : dictionnaire type Record avec repli au statut brut corrige. TypeScript/build finaux passent. Premiere suite491/492, un timeout5000ms du rapport de conformite pendant compilation concurrente. Rapport seul2/2 (1475/1919ms), puis suite complete sans build concurrent492/492 dans123 fichiers en22.83s. Aucun timeout augmente ni assertion retiree ; cause de charge plausible, non prouvee. Logs /tmp/raero-lot307-{check,build,tests,report,retest,docker,smoke}.log.
- Image/smoke/panne-reprise DB/sauvegarde-restauration valides. Conteneur remplace avec volumes conserves, before307 arrete. HTTP Tailscale200/index conforme, session admin anterieure/no-store verifies, nouvelle API anonyme401 ; cookie temporaire retire. Bundle serveur local/conteneur e6fa35758f34e97d159e29976b65cd6c9727f389d3ccdb034f4694acf9222f82.
- Limites : aucune recette navigateur ni dossier support metier cree/modifie sur apercu ; metadata et messages lus dans transactions distinctes, pas de snapshot commun. Fragilite temporelle du test de rapport sous charge reste a suivre. Fournisseurs externes/HTTPS/recette globale encore non valides ; objectif global non acheve.


### Lot 308 - Reduire les allers-retours de l'export de conformite

- Tour precedent : progression, detail support deploye ; timeout ponctuel du rapport constate et relance complete verte. Inspection rapport/tests/performance : export impose50 lignes et parcourt toutes les inscriptions, donc nombre croissant d'appels tRPC et d'audits avec les fixtures accumulees.
- Mesure initiale docs/report-performance-lot308.json :17712 inscriptions/4203 certificats,355 pages,1769-2072ms sequentiel,2196ms pour4 exports concurrents. Appels tRPC en processus incluant journal d'acces, pas HTTP ni navigateur.
- API/service acceptent pageSize entier1..250, defaut50 conserve ; curseur borne SQL, entree route stricte. Export admin demande250. Requete id/pageSize+1 puis jointures et regroupement existants : toutes les lignes, certificats ambigus, ordre/cursor conserves. Annulation et assemblage complet avant fichier conserves.
- Test PostgreSQL pagination etendu a255 fixtures : defaut50, taille250/cursor, limites invalides, nouvelle inscription exclue de la traversal commencee, aucune perte ni doublon jusqu'au bout. Tests etats certificat inchanges. Cinq tests cibles, TypeScript/build et492 tests/123 fichiers passent ; suite complete executee sans build concurrent. Logs /tmp/raero-lot308-{check,build,focused,tests,docker,smoke}.log.
- Script de mesure accepte chemin de sortie et taille, sans ecraser le lot294. Comparaison sur memes17974 inscriptions/4209 certificats : docs/report-performance-lot308-page50.json donne360 pages,2099/2996/3400ms,4 exports concurrents2553ms ; page250.json donne72 pages,1002/1088/1100ms,4 exports1151ms. Chaque export verifie17974 identifiants uniques et nombre total exact. Reduction80% des appels ; temps locaux variables, pas garantie de production.
- Image/smoke/panne-reprise DB/sauvegarde-restauration valides. Apercu remplace avec volumes conserves, before308 arrete. HTTP Tailscale200/index conforme/session anterieure/no-store ; appel HTTP admin rapport pageSize250 accepte (3 lignes reelles seulement, aucune donnee personnelle imprimee). Cookie temporaire retire. Bundle local/conteneur6f63088a8e079f9029151f563862db484e2d77f491aef4a60f919502eb54f610.
- Limites : tests et mesures sur PostgreSQL isole, sans latence reseau/HTTP/CSV/navigateur dans benchmark ; memoire maximale et charge production non mesurees, pas snapshot transactionnel entre pages. La cause du timeout307 n'est pas prouvee ; taille par defaut50 peut encore rencontrer des limites sur bases croissantes. Aucun dossier metier modifie ; lecture preview journalisee. Objectif global non acheve.
