# Références de preuve dans les signatures — lot 95

La route compagnie vérifiait le salarié mais acceptait auparavant un identifiant de preuve sans contrôler son propriétaire ni sa validité. Lorsqu’une preuve est explicitement fournie, le service la lit maintenant sous verrou partagé dans la transaction qui insère la décision.

La preuve doit appartenir au technicien et être soit partagée par la personne, soit attribuée à cette compagnie via une affiliation source cohérente. Une origine ORG_ASSIGNED sans lien permettant d’établir la compagnie ne suffit plus pour cette opération. Si une formation est également précisée, elle doit correspondre à celle de la preuve ; sinon la formation est reprise de la preuve.

Une décision VALIDATED exige une preuve LIVING non expirée. Si elle référence un certificat, celui-ci est lu sous verrou partagé et doit appartenir au même titulaire, concerner la même formation et être valide/non expiré. Une révocation concurrente attend ce verrou, ou est constatée avant la signature si elle a déjà été validée en base. REJECTED peut citer une preuve inactive ou un certificat révoqué, tout en respectant propriété et partage.

La route borne les identifiants positifs, les scopes COMPETENCE/RECURRENCY et la note à 2000 caractères. Les décisions humaines sans identifiant de preuve restent possibles : elles ne sont pas transformées en validation automatique sur la seule base d’un certificat.

275 tests réussis (201 PostgreSQL), TypeScript/build réussis. Nouveau scénario SQL via la route réelle : preuve étrangère, privée, expirée, certificat révoqué, origine compagnie inconnue et formation incompatible refusés sans signature ; preuve partagée valide acceptée avec formation déduite ; rejet d’un certificat révoqué conservé. Assertions renforcées sur les codes d’erreur attendus, test ciblé repassé.

Limites au lot 95 : droits contrôlés initialement dans la route et verrouillage trop large des preuves après écriture. Ces points sont corrigés pour la signature au lot 96 ci-dessous. L’instantané des preuves, l’immutabilité des décisions et l’idempotence restent à renforcer. L’interface actuelle signe principalement au niveau formation ; ce lot sécurise le paramètre de preuve exposé par l’API. Aucune migration, dépendance ou modification UI ; dernière recette Docker complète au lot 93. Aucune signature réglementaire qualifiée revendiquée.

## Droits revérifiés jusqu’à l’écriture — lot 96

La transaction relit sous verrous partagés le responsable actif, la compagnie active, le salarié actif rattaché au bon compte et à cette compagnie, le technicien actif et son affiliation active. Un responsable non administrateur doit posséder une affiliation MANAGER active dans cette compagnie. L’affiliation enregistrée sur la décision vient de cette lecture effective, pas du paramètre initial de la route.

La preuve explicite est verrouillée pour écriture. Si la décision VALIDATED utilise une preuve partagée encore retirable, son verrou de conservation est posé dans la même transaction que la signature. La route ne verrouille plus ensuite toutes les preuves partagées du technicien. REJECTED conserve sa décision sans verrouiller la preuve citée. Une décision sans preuve explicite ne prétend pas avoir utilisé toutes les preuves de la personne.

275 tests réussis (201 PostgreSQL), TypeScript/build réussis. Le scénario SQL existant est renforcé : retrait du rôle manager, salarié désactivé, compte technicien suspendu et affiliation terminée sont refusés directement par le service même avec les anciens paramètres ; aucune signature supplémentaire. Seule la preuve validée est verrouillée, les preuves non utilisées et rejetées restent inchangées.

Ce lot ne modifie pas le verrouillage historique effectué par la consultation du dossier compagnie, qui reste un autre chemin à examiner. Pas de migration, dépendance ou modification UI ; dernière recette Docker complète au lot 93. Instantanés, immutabilité et reprise idempotente des signatures restent à réaliser.

## Décisions immuables et instantané — lot 97

La migration ajoute un instantané nullable aux signatures et interdit UPDATE, DELETE et TRUNCATE sur leurs enregistrements. Une nouvelle décision conserve les noms du responsable et du technicien, le titre de formation et, si elle cite une preuve, son identifiant/libellé/état/échéance ainsi que l’identifiant, le numéro, l’état et l’échéance du certificat associé. Ces valeurs sont capturées sous les verrous de la transaction de signature.

Une preuve rejetée peut conserver le constat d’un certificat manquant ou révoqué. Un certificat retrouvé mais appartenant à une autre personne ou formation est refusé, même pour un rejet, afin de ne pas introduire de données étrangères dans l’historique. Une formation explicitement référencée doit exister.

La lecture d’historique utilise le nom du responsable et le titre conservés lorsque l’instantané existe. Une modification ultérieure du profil, du catalogue ou de la validité du certificat ne réécrit donc pas la décision. Les signatures anciennes n’obtiennent pas d’instantané reconstitué ; leurs anciens champs restent conservés et leurs libellés utilisent encore le repli historique.

275 tests réussis (201 PostgreSQL), TypeScript/build réussis. Scénario SQL renforcé : contenu d’instantané, changement de nom/titre/statut sans changement de décision passée, refus de modification et suppression. La décision ne devient pas une preuve actuelle indéfiniment valide : son instantané décrit l’état constaté lors de la signature. Aucune signature électronique qualifiée revendiquée ; workflow de rectification par nouvelle décision et reprise idempotente restent à compléter.

Recette finale du lot 97 : construction Docker, contrôles HTTP/droits, redémarrage avec session conservée, sauvegarde et restauration sur nouveaux volumes réussis. Image `sha256:8d2e1320a4d5740cac3db32493d99ac9acc51aca5fc56ccc1ba364edb5e96331` ; ressources de recette supprimées. Aucun déploiement.

## Consultation sans verrouillage et retrait conservatoire — lot 98

La consultation `company.technicianFile` conserve sa journalisation d’accès mais ne verrouille plus les preuves partagées. Le service de verrouillage global, devenu inutilisé, est supprimé. Une validation explicite reste le chemin qui pose le verrou sur la seule preuve utilisée. Aucun verrou historique n’est levé automatiquement : son origine ne peut pas être reconstituée avec certitude.

Le retrait d’une preuve indépendante remplace désormais la suppression physique par la remise à null de `surfacedByPersonAt`. La preuve reste dans le dossier personnel et les références historiques restent intactes ; elle disparaît de la couverture partagée et ne peut plus être citée par une nouvelle signature. Les décisions déjà prises gardent leur instantané. La vérification du propriétaire, du partage et du verrou puis cette mise à jour utilisent une transaction et un verrou de ligne compatible avec celui de la signature.

275 tests réussis (201 PostgreSQL), TypeScript/build réussis. Le scénario SQL vérifie une consultation sans verrou, le refus de retrait par un tiers ou après validation, la conservation après retrait d’une preuve rejetée, et une signature en concurrence avec un retrait : seule l’une des deux opérations peut réussir. Pas de migration ou modification UI. Dernière recette Docker complète au lot 97. La journalisation détaillée des changements de partage et la gestion explicite de plusieurs compagnies restent à améliorer.

## Reprise idempotente d’une demande — lot 99

La route exige désormais un UUID de demande. Après revérification des droits actuels, le service sérialise cet identifiant pour le responsable et compare l’empreinte des paramètres métier (salarié, personne, compagnie, preuve, formation, portée, décision et note). Une répétition identique renvoie la décision originale, même si les libellés ou la validité du certificat ont changé depuis. Réutiliser le même identifiant avec un contenu différent renvoie CONFLICT. L’index unique responsable/demande protège aussi l’écriture ; les anciennes décisions restent sans identifiant rétrospectif.

Le bouton de validation conserve son identifiant après erreur pour les nouvelles tentatives dans le même composant et le renouvelle après un succès confirmé. Ce mécanisme ne restaure pas une demande après rechargement de la page ou fermeture du navigateur. Un autre UUID représente toujours une nouvelle décision volontaire. La journalisation d’accès peut contenir plusieurs tentatives ; l’enregistrement de décision reste unique. La reprise ne contourne pas un retrait des droits du responsable ou du technicien.

Validation du lot 99 : 275 tests réussis (201 PostgreSQL), TypeScript/build réussis, construction Docker et recette complète avec sauvegarde/restauration réussies. Deux demandes simultanées rendent le même identifiant de décision ; un contenu différent est refusé et une reprise après changement de contexte rend l’instantané original. Un ancien serveur de développement connecté à la base jetable a été arrêté après identification de son interférence avec les tests de file vidéo ; la suite finale est isolée. Image `sha256:03fcaae9c1630dbc94871ebe9c168ef1e1bf8bf69aa57895b79fa708e61414cb`. Recette navigateur non effectuée.

## Destination compagnie explicite — lot 100

Le partage personnel exige maintenant `orgId` ; compte, compagnie et affiliation active sont revérifiés sous verrous dans la transaction. La preuve est rattachée à cette affiliation précise. La consultation compagnie charge uniquement les preuves de cette affiliation et de cette personne. Une signature, validation comme rejet, impose le même rattachement. Les preuves historiques sans affiliation restent conservées mais ne sont plus considérées comme partagées avec toutes les compagnies.

Les numéros/statuts de certificats du dossier compagnie sont également limités aux certificats associés à une preuve visible, active et non expirée de cette affiliation, pour la même formation. Les critères existants de formation requise et de validité du certificat s’appliquent ensuite. Le dossier personnel garde ses certificats ; aucune archive n’est modifiée. Un simple rattachement à deux compagnies ne transfère pas les preuves entre elles.

Le modèle actuel permet une destination par enregistrement de preuve. Un partage distinct vers une autre compagnie crée un autre enregistrement ; la gestion d’une preuve source unique avec plusieurs autorisations de partage et l’interface de sélection restent à compléter. Aucun ancien rattachement n’est deviné ou migré automatiquement.

Validation finale du lot 100 : 276 tests réussis (202 PostgreSQL), TypeScript/build réussis. Pas de nouvelle recette Docker ; dernière recette complète au lot 99.

## Partage personnel d’un certificat existant — lot 101

Le dossier personnel propose en FR/EN/AR le choix d’un certificat valide et d’une compagnie active, affiche les preuves et leurs destinataires et permet le retrait des partages indépendants non verrouillés après confirmation. Le document original reste personnel. Les preuves attribuées par une compagnie et les preuves verrouillées n’affichent pas de retrait disponible. Les anciennes preuves sans destination sont indiquées comme telles.

`me.shareCertificate` vérifie compte, compagnie, affiliation et titulaire sous verrous, puis la validité du certificat. Le partage reprend formation, échéance et objectifs du certificat, avec priorité à l’instantané d’archive lorsqu’il existe. L’utilisateur ne fournit pas ces données. Un verrou transactionnel par titulaire/affiliation/certificat rend les demandes simultanées identiques sans dupliquer un partage déjà actif. Un partage retiré reste conservé ; un partage ultérieur crée une nouvelle preuve. Le journal d’accès enregistre la compagnie, le certificat et la preuve. Le partage seul ne constitue pas une validation humaine et la visibilité demeure limitée aux formations requises.

Le scénario SQL à deux compagnies couvre cette route, son affichage dans la vue personnelle, les demandes concurrentes, la reprise, le retrait sans effet sur la compagnie d’origine, la conservation et le refus d’un tiers ou d’un certificat expiré/révoqué. Le formulaire externe déclaratif n’est pas ajouté dans ce lot. Pas de recette navigateur.

Validation finale du lot 101 : 278 tests réussis (204 PostgreSQL), TypeScript/build, construction Docker et sauvegarde/restauration réussis. Image `sha256:7613f3c3331e8372ab200658f67b7b024c3282543b9f5c159ebc5ca83b436616`. Les tests utilisent désormais la base jetable `raero_test_isolated` sur le port 55477 ; l’ancienne base reste intacte pour diagnostic des anciennes fixtures incohérentes.

## Historique personnel du partage — lot 102

La migration `credential_sharing_events` conserve les événements SHARED et WITHDRAWN avec la personne, la preuve, la destination, les libellés constatés et la date. PostgreSQL refuse UPDATE, DELETE et TRUNCATE ; la référence de preuve empêche sa suppression physique. Les créations de partages déclaratifs et de certificats ainsi que les retraits écrivent leur événement dans la transaction métier. Une reprise qui retrouve un partage actif ne crée pas d’événement supplémentaire. Aucun événement antérieur à cette migration n’est reconstitué.

La consultation `me.credentialSharingHistory` utilise uniquement le titulaire authentifié, avec 25 résultats par page et curseur strict sur l’identifiant décroissant. Le dossier personnel propose un historique dépliable FR/EN/AR avec dates, destinations et libellés, pagination, état vide et reprise sur erreur. Un changement ultérieur du nom de compagnie ne change pas le libellé d’un événement ancien. Un retrait ultérieur décrit le nom constaté lors de ce retrait.

Les verrous issus d’une signature restent décrits par la décision conservée ; cet historique porte sur les actes personnels de partage et retrait. L’ancien parcours d’effacement de compte reste à revoir face aux obligations de conservation : ce lot ne revendique pas sa conformité et ne supprime pas les événements pour le rendre possible.

Validation finale du lot 102 : 279 tests réussis (205 PostgreSQL), TypeScript/build, construction Docker et recette avec sauvegarde/restauration réussis. Image `sha256:a15240db53361ad0a3b3f6cd8c99029a359bf76416918f53b2f938daa91b9507`. Pas de recette navigateur.
