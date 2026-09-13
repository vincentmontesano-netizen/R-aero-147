# Affectation explicite des instructeurs aux classes

Les boutons Instructeurs de l’administration des sessions et webinaires ouvrent un dialogue FR/EN/AR. Il affiche les affectations actives et retirées, permet de rechercher un compte instructeur actif par nom/email (20 résultats, recherche de deux caractères minimum), puis d’affecter, retirer ou réaffecter avec un motif. Les comptes dont le rôle/statut a changé restent visibles afin de pouvoir retirer leur affectation.

Les administrateurs conservent la modération. Pour un instructeur, être auteur du cours ne suffit plus : une affectation active à cette session ou à ce webinaire est requise. Le rôle global du compte doit encore être instructor et le compte actif. Le retrait ne donne ni n’enlève de droit d’auteur dans le studio. Un intervenant externe peut être explicitement affecté à une classe interne par un administrateur sans devenir manager de la compagnie. Une compagnie suspendue ou une formation archivée bloque la modération de l’instructeur ; les administrateurs gardent leur accès opérationnel.

**Changement de comportement historique :** les anciennes classes n’obtiennent aucune affectation automatiquement. Les auteurs qui modéraient implicitement doivent être affectés par un administrateur. Aucun lien implicite n’est présenté comme une décision historique enregistrée. Les fixtures de test ont été adaptées avec des affectations explicites.

La route et les services exigent un administrateur actif. Ils verrouillent la salle pour sérialiser les décisions et relisent le compte cible. Activer une affectation nécessite un compte instructeur actif et une classe non terminée/non annulée. Retirer une affectation reste possible après la clôture ou la suspension du compte. Une répétition identique ne crée pas de transition. Les identités des affectations sont conservées ; les événements immuables contiennent état précédent/nouveau, auteur, motif et date. Les écritures SQL directes hors service ne bénéficient pas de ces contrôles transactionnels.

Le ticket vidéo annonce aussi le rôle signé. L’écran relit les droits toutes les 15 secondes et détruit l’iframe si l’inscription, la fenêtre ou le rôle de modérateur change. Il demande alors une nouvelle admission pour le rôle courant. Cela ne prouve pas l’expulsion chez JaaS d’une connexion ou d’un JWT déjà délivré : la révocation fournisseur reste à implémenter/tester.

## Validation et limites

Migration `20260913_live_instructors.sql`. 208 tests réussis (158 PostgreSQL), dont autorité limitée à la classe, absence d’accès studio, ancien propriétaire sans affectation, administrateur conservé, retrait, concurrence idempotente, journal/identité immuables, compte non instructeur/suspendu, classe terminale et compagnie suspendue. La signature vidéo existante est testée avec les nouvelles affectations explicites. Un appel de test à la liste a été corrigé pour respecter son schéma strict sans champs de mutation.

TypeScript/build vérifiés. La recherche et l’affectation ne constituent pas une vérification des qualifications réglementaires de l’instructeur ; cette validation, les notifications et la recette navigateur/JaaS restent à compléter. Le calendrier personnel est décrit ci-dessous. Aucun message, fournisseur ni conférence réelle déclenché ; aucun déploiement.

Construction Docker et recette complète installation/panne/reprise/redémarrage/sauvegarde/restauration réussies ; ressources jetables nettoyées.


## Liste personnelle des classes (lot 67)

Le tableau de bord des comptes instructor inclut « Mes classes à animer ». La période initiale couvre aujourd’hui et les trente jours suivants ; des dates locales permettent de consulter une autre période (92 jours calendaires au maximum dans l’interface). La borne supérieure inclut la journée choisie, avec conversion explicite en UTC ; le serveur borne toute requête à 93 jours pour tenir compte des changements d’heure.

La requête n’accepte aucun identifiant d’un autre utilisateur. Elle relit le compte actif/instructeur et sélectionne ses affectations actives, les sessions qui chevauchent la période et les webinaires dont la fin est calculée depuis leur durée. Les salles inexistantes, formations archivées et compagnies suspendues sont exclues. Une affectation retirée disparaît ; une classe annulée reste visible comme telle si l’affectation est encore active, sans bouton d’ouverture.

La projection est limitée à l’identité de l’affectation/salle, titre, statut et horaires. Aucune URL de fournisseur/replay ni donnée de participant n’est renvoyée. Le lien Ouvrir la classe passe par /live, dont les droits et fenêtres sont relus. Les classes terminées restent consultables selon les règles de replay existantes.

La pagination de 50 lignes utilise date de début puis identifiant d’affectation pour distinguer des départs simultanés. Un changement d’horaire peut déplacer une classe entre pages ; revenir à la première page ou appliquer à nouveau la période permet de relire la liste courante. Actualisation automatique à la minute, gestion chargement/erreur/réessai/vide. Il s’agit d’une liste personnelle des classes affectées, pas encore d’un calendrier graphique ni d’un export iCalendar.

211 tests réussis (161 PostgreSQL), dont droits/projection, retrait, chevauchement, durée webinar, compagnie suspendue/compte suspendu, pagination de 53 départs identiques et périodes invalides. TypeScript/build réussis ; aucune migration ni nouvelle recette Docker nécessaire pour cette lecture. Recette visuelle navigateur toujours à effectuer. Aucun fournisseur appelé ni déploiement.


## Historique des affectations (lot 68)

Le dialogue Instructeurs contient un bouton dépliant Historique des affectations, chargé à son ouverture. Les ajouts, retraits et réaffectations apparaissent avec état avant/après, instructeur concerné, administrateur ayant agi, motif et date locale. Les noms actuels sont explicitement distingués des identifiants conservés. L’historique reste disponible pour les classes terminées et les affectations retirées ; un journal vide ne fabrique pas d’historique antérieur.

La route de lecture et le service exigent un administrateur actif. La requête joint les événements à leurs affectations et filtre à la fois roomType et roomId ; elle ne renvoie ni email ni hash de mot de passe ni autre donnée du compte. La pagination par identifiant sur 50 événements conserve la position des pages anciennes sous de nouvelles insertions. Les erreurs, réessais, chargement et navigation sont gérés ; une mutation invalide le journal.

213 tests réussis (163 PostgreSQL), dont projection sans secrets, identités distinctes instructeur/acteur, administrateur suspendu/refus instructeur, classe terminée, retrait et pagination de 53 événements avec autre classe et ajout récent. TypeScript/build réussis. Aucune migration ni nouvelle recette Docker nécessaire ; recette visuelle navigateur toujours à effectuer. Aucun fournisseur appelé ni déploiement.
