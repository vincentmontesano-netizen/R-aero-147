# Rôles et création d'une formation e-learning

État vérifié le 29 septembre 2026. Ce document décrit les droits applicatifs ; il ne vaut pas validation du contenu pédagogique ni agrément réglementaire.

## Choisir les droits d'un compte

| Profil | Droits | Limites |
| --- | --- | --- |
| Visiteur non connecté | Catalogue, informations publiques, vérification publique d'un certificat | Aucun accès aux brouillons, documents privés ou fonctions d'administration |
| Apprenant — `user` | Ses achats, inscriptions, formations, résultats, certificats, dossier personnel et demandes de support | Une inscription valable est nécessaire pour suivre un cours ; aucune création de formation sans affiliation MANAGER |
| Formateur — `instructor` | Crée et modifie ses formations du catalogue opérateur dans `/maker` ; publie après approbation indépendante | Aucun accès aux cours d'un autre formateur, aux utilisateurs ou à l'administration globale ; l'animation d'une classe exige une affectation explicite |
| Responsable entreprise — affiliation `MANAGER` active | Crée et modifie les formations internes de son organisation ; distribue une version publiée aux membres actifs ; participe à la revue des cours internes | Organisation active requise ; aucun accès à une autre organisation ; le tableau de bord permet de choisir l’organisation active à gérer |
| Membre d'entreprise — affiliation `MEMBER` active | Suit les formations attribuées et conserve son espace personnel | Ne gère ni les membres ni les formations de l'organisation |
| Administrateur — `admin` | Gère les utilisateurs, organisations, réglages et toutes les formations ; accède au registre administratif | Ne peut pas approuver sa propre revue ; au moins un administrateur actif doit rester |
| Compte suspendu | Aucun accès authentifié | La session existante est refusée dès la requête suivante |

Un compte possède un seul rôle global et peut avoir plusieurs affiliations. Le rôle global historique `company_manager` ne remplace pas une affiliation MANAGER active. À l'inverse, un compte `user` avec une affiliation MANAGER peut créer des formations internes. Le studio propose un sélecteur d'organisation ; la destination est vérifiée de nouveau par le serveur à chaque création.

Dans **Administration > Utilisateurs**, le formulaire explique maintenant les droits du rôle sélectionné en français, anglais et arabe. Dans **Organisations**, attribuer les responsables par leur compte existant. Le tableau entreprise présente un sélecteur d’organisation. Le rattachement principal autorisé ou l’unique affiliation MANAGER active fournit le choix initial ; avec plusieurs affiliations sans rattachement principal, un choix explicite est requis. Le choix est conservé dans l’URL (`orgId`), dans les clés de cache et dans chaque requête. Il ne modifie pas le compte : deux onglets peuvent gérer deux organisations différentes. Changer d’organisation ferme les formulaires et le dossier ouverts. Une organisation suspendue ou une affiliation révoquée interdit les lectures et les mutations. Les administrateurs peuvent sélectionner une organisation active depuis le même écran.

Les fonctions nommées du registre Part-147 et les affectations d'animateurs ne sont pas des rôles globaux supplémentaires. Le registre reste réservé aux administrateurs. Une affectation d'animateur donne des droits sur une classe précise ; elle n'ouvre pas l'administration ni les cours d'un autre auteur.

## Créer votre première formation

1. Se connecter, puis ouvrir **Studio e-learning** dans le menu du compte, ou directement `/maker`.
2. Sélectionner **Catalogue opérateur** pour une formation publique, ou l'organisation concernée pour une formation interne.
3. Cliquer sur **Nouvelle formation**, saisir le titre, puis **Créer la formation**. Cette création manuelle fonctionne sans clé IA.
4. Ajouter un **Module**. Renseigner son titre et son contenu pédagogique, ou ses supports privés. Répéter pour chaque chapitre.
5. Ajouter les diapositives souhaitées et rattacher chacune à son chapitre. Une diapositive non rattachée bloque la publication.
6. Ajouter les questions de chaque chapitre et indiquer les bonnes réponses. Ajouter aussi une banque de questions pour l'examen final, sans rattachement à un chapitre. Les exercices intégrés aux diapositives ne remplacent pas ces questions.
7. Dans **Administration > Formations**, compléter les métadonnées commerciales et pédagogiques, notamment la description, la durée, le prix et les paramètres d'examen.
8. Cliquer sur **Revérifier** dans le studio. Corriger chaque point signalé jusqu'à obtenir la préparation technique valide.
9. **Demander une revue**. Un autre administrateur examine et approuve le cours opérateur. Pour un cours interne, un autre manager actif de la même organisation peut aussi effectuer cette revue. Le propriétaire et le demandeur ne peuvent approuver leur propre demande.
10. Après approbation, cliquer sur **Publier**. Une modification du contenu après la revue impose une nouvelle approbation. Une version publiée est conservée pour les inscriptions.
11. Pour une formation interne, attribuer la formation aux membres actifs depuis le studio. Pour une formation publique, vérifier sa fiche catalogue et son acquisition avant ouverture commerciale.
12. Effectuer une recette avec un compte apprenant distinct : ouverture, chapitres, QCM, examen final, résultat, certificat et vérification publique.

Si vous êtes le seul administrateur et l'auteur du cours, créer un second compte administrateur pour la personne chargée de la revue. Ne pas contourner la séparation auteur/réviseur.

## Ce qui est disponible et ce qui reste à configurer

Le 29 septembre, une connexion avec le compte de production de Vincent a confirmé un compte administrateur actif, l'accès au studio et le bouton de création disponible. Aucun contenu de production n'a été créé ou publié pendant ce contrôle.

Le parcours manuel complet a été exécuté en local : administrateur, formateur distinct, création, supports, QCM, revue, publication, acquisition simulée, apprentissage et certificat. La création interne par un compte `user` affilié MANAGER est également testée dans le navigateur, avec refus des accès étrangers et retrait d'accès après suspension.

Décision de Vincent du 29 septembre : ne pas configurer ni activer Stripe tant que la société n’est pas créée. Le paiement en ligne reste donc indisponible ; le parcours de demande de devis est conservé.

L'inspection de production ne trouve pas de configuration SMTP, IA, JaaS ou d'identité de facturation. Il reste nécessaire de configurer et tester ces services lorsqu'ils sont utilisés. Les simulations locales de paiement et d'e-mail ne prouvent pas leur fonctionnement chez les fournisseurs.

Preuves et limites de la recette : `../../QA-2026-09-29/`. Les corrections du 29 septembre sont locales tant qu'une livraison distincte n'a pas été approuvée et exécutée.

## Compatibilité du tableau entreprise

Les nouveaux écrans utilisent l’API `companyWorkspace.*` avec un `orgId` explicite. L’API historique `company.*` conserve les appels sans sélection pour les clients précédents. Les deux routes partagent les mêmes contrôles serveur. Le champ de confirmation `selectedOrgId` doit correspondre à la sélection avant d’afficher les actions.

Cette route distincte protège un retour à une ancienne image : un client récent reçoit un refus de route inconnue au lieu d’envoyer une mutation à un serveur qui ignorerait silencieusement le choix d’organisation. L’écran demande alors de recharger la page. Aucune migration de schéma ni modification du rattachement principal n’est nécessaire.
