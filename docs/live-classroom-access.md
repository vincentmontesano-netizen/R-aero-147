# Accès applicatif aux classes à distance

Toutes les opérations de présence, participants, chat/Q&A et votes vérifient l’inscription et le compte actif. Une inscription de session annulée et une salle annulée ne donnent aucun accès. Les sessions payantes et formations internes exigent également un accès pédagogique actif à la formation associée ; une simple inscription à la salle ne contourne plus cette condition.

ADMIN peut modérer les salles actives. Un instructeur peut modérer les salles associées à une formation dans son périmètre d’auteur ; son rôle global seul ne donne plus accès aux salles des autres instructeurs. Les salles sans formation associée restent administrées par ADMIN. Une affectation explicite d’instructeurs de séance, indépendante de l’auteur du cours, reste à développer.

Une personne non inscrite ne reçoit ni nom de salle ni URL de replay. Les listes publiques webinaires/sessions et la liste des sessions personnelles ne diffusent plus les adresses de visioconférence, noms de salle ou liens de replay ; elles indiquent seulement la disponibilité d’un replay. Les webinaires internes/non publiés sont exclus de la liste publique. Les noms des participants n’utilisent plus leur adresse email comme libellé de secours.

Les corrigés des quiz et leur répartition des votes restent masqués aux apprenants tant que le quiz est ouvert. Après clôture, le corrigé peut être affiché. Chaque personne reçoit ses propres choix, pas les votes individuels des autres. Les choix hors limites ou dupliqués sont refusés. Un verrou sur le sondage sérialise le vote et la clôture ; les votes simultanés d’une même personne ne créent pas de doublons. Les présences simultanées sont également sérialisées par salle/personne.

Validation : tests PostgreSQL d’accès étranger, non-divulgation salle/replay, droits instructeurs, corrigés masqués, votes invalides/clos, concurrence, inscription annulée et refus d’accès à une séance payante sans inscription pédagogique. TypeScript et build contrôlent les routes et écrans consommateurs.

## Limites opérationnelles

Ces contrôles protègent les API de la plateforme. Le client Jitsi existant et les noms de salles prévisibles ne constituent pas encore une barrière d’accès vidéo externe : configuration d’un service de conférence avec authentification serveur, jetons de salle et contrôle des modérateurs à réaliser avant mise en production. Les replays doivent aussi être servis par un stockage privé ou un fournisseur contrôlant l’accès.

La présence actuelle repose sur des heartbeats navigateur ; le score d’engagement existant ne prouve ni assiduité effective ni compétence. Restent journal de présence fiable, déconnexions, seuils, émargement, qualification/affectation des instructeurs, places et admissions transactionnelles, paiement dédié des séances et suppression/archivage des preuves de classe. Les QCM de classe n’attribuent pas de certificat réglementaire par ce module.

## Intervalles de présence observée

Le score ne calcule plus la durée entre première et dernière connexion. Chaque heartbeat autorisé enregistre un intervalle serveur dans `live_presence_intervals`. Seul un intervalle positif de 45 secondes maximum est crédité ; un retour après une interruption plus longue crée un intervalle à zéro, sans inventer de présence pendant l’absence. Les minutes affichées sont la somme des millisecondes créditées, arrondie vers le bas. Les intervalles historiques absents ne sont pas reconstruits.

Le journal est immuable (UPDATE/DELETE/TRUNCATE interdits), consultable uniquement par un modérateur autorisé de cette classe, avec pagination par identifiant. Le panneau d’engagement affiche les intervalles et les secondes créditées. Les heartbeats simultanés d’une personne sont sérialisés ; une horloge serveur revenue en arrière ne recule pas le dernier horodatage observé.

Côté navigateur, les heartbeats démarrent après `videoConferenceJoined` et s’arrêtent après `videoConferenceLeft`, `readyToClose` ou démontage de la page. La fermeture retire aussi l’écouteur de chargement du script, pour éviter un démarrage tardif après départ. Référence : [événements de l’API iframe Jitsi](https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe-events/).

Ces événements client peuvent être falsifiés et ne remplacent pas des événements fournisseur authentifiés, une preuve d’identité, un émargement ou la validation d’un formateur. L’interface qualifie donc cette durée d’observation de connexion. La transformation en preuve d’assiduité opposable reste un chantier distinct, de même que la conservation/pseudonymisation du journal et les métriques de déconnexion réseau fine.

Test PostgreSQL avec horloge maîtrisée : deux intervalles de 30 secondes, interruption de deux minutes non créditée, reprise de 30 secondes, aucune double comptabilisation de heartbeats concurrents au même instant, minute affichée calculée sur le cumul, pagination, droits du journal et immutabilité.

## Admissions et capacité

L’inscription verrouille la séance ou le webinaire pendant le contrôle et la réservation. Les places sont comptées à partir des personnes inscrites, en excluant les inscriptions de séance annulées ; le compteur `seatsTaken` est actualisé à partir de ce registre. Une réservation répétée est idempotente. La concurrence sur la dernière place n’attribue qu’une place.

Les nouveaux inscrits sont refusés après l’heure de début, ainsi que pour les classes annulées ou terminées. Un compte actif est requis. Une formation associée doit être publiée et non archivée. Les séances payantes et formations internes exigent un accès pédagogique actif ; une séance payante sans formation associée ne peut être réservée. Ce parcours ne prélève pas de paiement supplémentaire de séance : une tarification distincte et son checkout restent à développer.

L’absence de capacité maximale sur un webinaire signifie qu’aucune limite de places n’y est configurée ; une capacité de zéro refuse toute nouvelle inscription. Les anciens compteurs incohérents sont recalculés lors d’une nouvelle réservation acceptée. Les doublons historiques ne sont pas supprimés et sont comptés une seule fois par personne.

Tests PostgreSQL : dernière place sous concurrence pour les deux types de classe, répétition du même utilisateur, récupération d’une place annulée sans effacer l’ancienne inscription, états fermés, début dépassé, compte suspendu et séance payante non rattachée. Restent liste d’attente, annulation utilisateur et son journal, invitations, notifications durables et contraintes de capacité lors de la modification ADMIN des séances.

## Annulation des réservations de séance

« Mes réservations », sur la page des séances, affiche les inscriptions personnelles et permet de libérer une place avant le début. Le serveur utilise l’utilisateur authentifié, verrouille la séance puis ses inscriptions, conserve les lignes annulées et recalcule la capacité. Une annulation répétée ne produit pas d’événement supplémentaire. Une inscription marquée comme ayant participé ne peut être annulée par ce parcours.

Les nouvelles inscriptions et annulations produisent des événements immuables dans `session_admission_events`. L’identité des inscriptions et leurs états terminaux sont protégés en base, ainsi que leur conservation. Une réinscription éventuelle crée une nouvelle ligne, sans réécrire l’annulation passée. Les inscriptions historiques ne reçoivent pas d’événements rétroactifs inventés.

L’ancienne suppression ADMIN d’une séance devient une annulation conservant les inscriptions et leur historique. L’interface distingue une séance annulée par l’organisateur d’une réservation personnelle encore active. L’annulation de réservation ne rembourse aucune commande et ne retire aucune licence de formation.

Tests : annulation étrangère refusée, répétitions concurrentes produisant une seule trace, place libérée, reprise de réservation, refus après début, impossibilité de réactiver/supprimer une inscription annulée, journal immuable et annulation ADMIN conservant les inscriptions. Restent annulation des webinaires, notifications des participants et règles tarifaires distinctes des licences de formation.
