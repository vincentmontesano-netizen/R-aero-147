# Chargement et reprise du lecteur de formation

Le lecteur attend la résolution de l’authentification avant d’afficher une demande de connexion. La liste des inscriptions est interrogée uniquement pour une session authentifiée. Une absence d’inscription n’est affichée qu’après réception de la liste ; une erreur initiale affiche une explication traduite avec une action de reprise.

Les diapositives, modules, progressions, questions et tentatives doivent avoir une réponse avant que le lecteur choisisse son mode d’affichage ou présente l’examen. Une liste vide reçue reste distincte d’une réponse absente. La reprise relance uniquement les requêtes du lecteur dont les données manquent et désactive le bouton pendant leur chargement.

Les QCM de chapitre proposent également de relancer le chargement initial des questions et tentatives. Si les données existent déjà, une erreur de rafraîchissement ne remplace pas le lecteur ou le QCM par cet écran de chargement. Les validations serveur d’accès, de tentative et de temps restent applicables ; aucune tentative n’est créée par le bouton de reprise de lecture.

Validation du lot 114 : TypeScript, build et suite complète de 297 tests réussis (216 PostgreSQL). Ces tests couvrent les règles existantes du moteur d’examen, sans simuler ces nouveaux états React. Pas de recette navigateur ou de simulation réelle de coupure réseau. Les réponses non enregistrées ne sont pas garanties après fermeture/rechargement de l’onglet ; les erreurs d’émission de certificat et les autres erreurs de mutation gardent leur traitement actuel.

## Certificat après réussite (lot 115)

La réussite du QCM final n’affiche plus une promesse de disponibilité du certificat. Le lecteur distingue une demande en cours, un certificat confirmé par son numéro, un échec (y compris une réponse vide) et une demande pas encore effectuée dans cette session. Les textes sont disponibles en français, anglais et arabe.

L’émission automatique après réussite est conservée. Si elle échoue, le bouton de reprise appelle la même mutation ; après rechargement, une réussite relue permet de demander ou retrouver le certificat. Le bouton est désactivé pendant la demande. Le parcours des modules conserve le retour détaillé du QCM et présente la reprise en dessous ; le parcours des diapositives la présente dans l’écran de réussite. Le lien vers le tableau de bord reste disponible dans tous ces états.

Un numéro enregistré ne garantit pas la validité actuelle du certificat : le texte invite à consulter son état dans l’espace personnel. L’origine du navigateur n’est plus envoyée pour cette demande ; le serveur utilise toujours son adresse officielle configurée. Aucun changement de PDF ou de droit d’émission.

TypeScript, build et 297 tests réussis, dont les scénarios PostgreSQL existants de répétition, concurrence et rollback d’émission dans `certificateOrigin.integration.test.ts`. Pas de test DOM ni de recette navigateur de la reprise. Les erreurs d’accès expiré restent soumises aux règles serveur existantes.

## Navigation sur petit écran (lot 116)

Le parcours par modules propose sous la barre de titre un sélecteur natif avec libellé, titre de chaque chapitre et indication des chapitres terminés. Le QCM final dispose d’une option et d’un bouton visibles sous le seuil `lg`, où la barre latérale est masquée. Le bouton et l’option appliquent la même condition que la barre latérale : tous les modules requis doivent être terminés. Le texte de prérequis reste visible quand l’examen est verrouillé.

Un bouton de QCM final est également présent en bas du dernier chapitre, sur toutes les tailles d’écran. Les actions précédent/suivant et la barre de titre peuvent revenir à la ligne ; le contenu central peut rétrécir dans son conteneur flex. Les libellés réutilisent les traductions FR/EN/AR existantes. Aucun changement du parcours uniquement composé de diapositives.

Validation statique TypeScript et build. Le serveur conserve ses contrôles de prérequis. Pas de recette navigateur sur appareil mobile, au clavier ou en arabe ; ces ajustements ne prouvent pas à eux seuls une conformité d’accessibilité. Le changement volontaire de chapitre continue de démonter le QCM en cours, comme la navigation latérale existante ; la protection explicite des réponses non enregistrées reste à compléter.

## Confirmation de sortie pendant un QCM (lot 117)

Un QCM monté signale son activité au lecteur pendant son démarrage et jusqu’à réception du résultat, sauf erreur de démarrage. Les actions internes de sélection de chapitre, précédent/suivant, ouverture du QCM final et retour au tableau de bord demandent confirmation lorsqu’un QCM est actif. Refuser conserve la navigation actuelle. Le texte FR/EN/AR précise que le chronomètre serveur continue et que les réponses non enregistrées peuvent être perdues. Une réponse déjà sauvegardée ne met pas le chronomètre en pause ; la confirmation reste donc pertinente dans cet état.

Un gestionnaire `beforeunload` est installé uniquement pendant cette activité, puis retiré après résultat ou démontage. Le navigateur contrôle l’affichage et le texte de son avertissement natif ; il peut ne pas l’afficher, notamment sans interaction préalable ou lors de certaines fermetures mobiles. Cette protection ne couvre pas les changements d’URL par l’historique SPA, l’arrêt du processus ou tous les liens externes à ces commandes. Aucune sauvegarde synchrone au départ ni pause de session serveur ajoutée.

TypeScript et build validés. Pas de recette navigateur des confirmations, de fermeture mobile ou de retour historique. Les règles d’enregistrement et de reprise serveur restent inchangées.

## Reprise du démarrage et numéro de tentative (lot 118)

Une erreur ou une réponse vide au démarrage du QCM affiche maintenant un bouton de reprise. Le bouton relance la demande sans incrémenter le compteur local de nouvelle tentative. Une session encore active est retrouvée par le serveur ; son échéance n’est pas renouvelée. Le texte FR/EN/AR précise qu’une session expirée reste soumise aux règles de nouvelle tentative : la reprise n’est pas une garantie de réutilisation indéfinie d’une session terminée.

Le numéro de tentative affiché, utilisé dans la présentation de la tentative suivante et envoyé à la soumission vient désormais de la réponse serveur. Le déclencheur local de nouvelle tentative reste distinct pour ne pas redémarrer l’effet lorsque le numéro serveur est reçu. Les numéros envoyés par le client ne déterminent toujours pas les limites côté serveur.

Validation : nouveau scénario PostgreSQL avec première tentative échouée, deuxième session active, sauvegarde puis nouvelle demande avec un numéro client périmé. Même deuxième session, questions, échéance et révision enregistrée ; deux sessions au total. Suite complète de 298 tests réussis (217 PostgreSQL), TypeScript et build réussis. Pas de simulation navigateur d’une réponse réseau perdue.

## Seuil de réussite propre à la session (lot 119)

La réponse de démarrage/reprise contient le seuil de réussite de l’instantané de session, et le lecteur utilise cette valeur pendant le QCM. La valeur du cours ou du chapitre actuellement affiché ne remplace plus le seuil conservé au démarrage. Les réponses de session déjà réussie retournent également ce seuil.

Les replis des anciennes sessions sans instantané suivent les comportements de correction existants : seuil actuel du cours (ou 75) pour une session active, 75 pour un résultat déjà conservé. Aucun historique manquant n’est reconstitué. Aucune modification des seuils stockés ou de la règle de notation.

Validation : 298 tests réussis, TypeScript/build réussis ; scénarios renforcés de changement du seuil du cours et du chapitre après démarrage, avec reprise avant et après réussite. Les 11 tests SQL d’examen ont été relancés après le dernier renforcement du scénario de chapitre et passent. Aucune recette navigateur de cette indication.

## Réponses figées après envoi (lot 122)

Le premier envoi conserve le jeu de réponses soumis ; les reprises manuelles utilisent ce même jeu et le même identifiant de session. Les champs texte, choix et associations restent verrouillés pendant la demande et après une réponse non confirmée. Une erreur ou une réponse vide affiche une explication FR/EN/AR et le bouton de reprise reste disponible même lorsque le délai est écoulé. Le serveur garde la décision d’expiration et peut alors corriger uniquement les réponses sauvegardées avant son échéance.

Le départ d’une soumission annule les sauvegardes différées non encore parties ; une sauvegarde déjà en vol reste soumise aux verrous et règles serveur. L’indication d’autosauvegarde n’est plus affichée après l’envoi. À expiration, l’envoi automatique ne se déclenche qu’une fois par session ; une erreur ne crée plus une boucle de soumission chaque seconde. L’utilisateur peut relancer explicitement la récupération du résultat.

Ces états sont remis à zéro au démarrage d’une nouvelle tentative. La soumission de récupération d’une session déjà réussie verrouille également les champs. Une réponse vide n’appelle plus le traitement de réussite avec null.

Validation : suite complète 303 tests réussis ; scénario SQL renforcé de répétition avec un autre jeu de réponses après résultat, résultat original et tentative unique conservés. TypeScript/build réussis. Pas de test DOM ou navigateur du gel des champs, ni de simulation réseau réelle ; la conservation des réponses figées concerne ce composant monté, pas un stockage persistant après fermeture.

## État local séparé par formation et compte (lot 123)

Le composant du lecteur est désormais identifié par le compte courant et le slug de la formation. Un changement de l’un de ces éléments recrée son état local : chapitre sélectionné, résultat, réponses et mutation de certificat ne sont pas réutilisés pour l’autre formation ou compte. Les requêtes serveur continuent d’appliquer les droits et de retrouver les données enregistrées.

Le nettoyage du démarrage d’une session invalide aussi la référence utilisée par les retours d’autosauvegarde, afin qu’une réponse tardive ne soit pas appliquée à une session quittée. Les requêtes déjà parties ne sont pas annulées côté serveur. Ce changement ne constitue pas un blocage de navigation par l’historique et ne stocke pas les réponses non enregistrées après départ.

TypeScript/build validés. Pas de test DOM ou recette navigateur du changement de route/compte. Les données enregistrées et la base ne sont pas réinitialisées par cette séparation de l’état React.

## Accusé de sauvegarde perdu (lot 124)

Si une sauvegarde a été enregistrée mais que sa réponse a été perdue, un renvoi identique avec la révision immédiatement précédente retrouve la révision et l’heure déjà enregistrées. Il ne modifie ni les réponses ni l’heure de réception. La comparaison porte sur le contenu complet des réponses ; une différence reste un conflit. Une révision plus ancienne reste refusée, même si le contenu est identique.

Les vérifications de candidat, d’état actif et d’échéance précèdent cette reconnaissance : une reprise ne permet pas de sauvegarder après expiration ou au nom d’un autre candidat. Les modifications locales effectuées entre la demande perdue et sa reprise peuvent produire un contenu différent ; ce cas reste un conflit à résoudre et n’est pas écrasé automatiquement.

Validation : scénario PostgreSQL de trois demandes identiques concurrentes, une seule incrémentation, horodatage conservé, anciennes révisions/tiers/expiration refusés. Suite complète 304 tests réussis (218 PostgreSQL), TypeScript et build réussis. Aucune migration nécessaire.
