# Recette des services externes

État au lot 266 : **aucun scénario ci-dessous exécuté contre un fournisseur réel**. Le [relevé de configuration](provider-status-lot266.json) ne conserve que des indicateurs, pas des secrets. Une clé présente ne prouve ni son fonctionnement ni la réussite d'un parcours.

Ce protocole prépare la recette de l'application existante. Il ne vaut pas validation pédagogique, fiscale ou réglementaire. Les preuves Node de la [matrice opérationnelle](operational-readiness.md) restent distinctes des résultats attendus ici.

## Environnement et dossier de preuve

Utiliser une instance de recette et des données fictives identifiables, séparées des dossiers métier de l'aperçu. Consigner la version exacte de l'image, l'origine, la date UTC, l'opérateur, les comptes et objets de test par identifiants internes. Configurer les secrets par le mécanisme serveur prévu ; ne jamais les copier dans un rapport, une capture ou une URL.

Pour chaque scénario conserver : identifiant du scénario, préconditions, actions effectivement réalisées, état avant/après, références d'événements fournisseur, résultat observé, verdict réussi/échoué/non exécuté et lien vers la preuve expurgée. Une réponse HTTP 200 seule est insuffisante. Un échec laisse le scénario ouvert ; conserver les archives de recette selon leur politique plutôt que supprimer des écritures d'audit.

Les destinataires SMTP doivent être des boîtes de recette explicitement autorisées. Les générations IA nécessitent un fournisseur/modèle et un plafond de dépense convenus avant exécution. Aucun envoi ou achat n'est autorisé par la seule présence de ce document. L'emplacement de la configuration des comptes de test a été demandé ; réponse non disponible lors de cette rédaction.

## Paiements et abonnements

Préconditions : Stripe en mode test, clé et secret de signature correspondants, réception des événements sur `/api/stripe/webhook`, offres de recette et Price IDs des formules configurés. Le routage Tailscale privé actuel ne prouve pas la réception des webhooks externes ; établir et vérifier le chemin de livraison de recette avant le parcours.

| ID | Actions de recette | Résultat à vérifier |
| --- | --- | --- |
| PAY-01 | Acheter une formation publiée avec un compte fictif ; achever Checkout test ; suivre retour et événement signé | Montant/devise concordants entre commande et fournisseur, commande payée, inscription attendue créée une seule fois, accès limité à l'acheteur |
| PAY-02 | Abandonner puis essayer un paiement de test refusé | Aucun accès acquis sans paiement confirmé ; état et message permettent de comprendre l'échec, sans faux succès |
| PAY-03 | Livrer le même événement signé deux fois puis revisiter le retour | Aucun doublon de commande, inscription, capacité ou document ; événement et ressources corrélables |
| PAY-04 | Envoyer un événement sans signature puis avec signature invalide | Refus HTTP, aucune attribution d'accès ou modification financière |
| PAY-05 | Effectuer remboursement partiel puis total sur un achat de test | Historique et total remboursé exacts, absence de double décompte au rejeu ; vérifier séparément la politique d'accès et les documents de correction, encore à valider |
| SUB-01 | Souscrire chaque formule de test avec la quantité prévue | Organisation, formule, quantité et état concordants ; capacité et droits conformes à l'offre choisie, aucun accès à une autre compagnie |
| SUB-02 | Provoquer renouvellement réussi puis paiement de facture échoué en environnement de test | État reçu et droits résultants explicables, sans maintien ou retrait silencieux contraire à la politique commerciale validée |
| SUB-03 | Annuler via le portail puis observer les événements de mise à jour/suppression | Date d'effet et accès cohérents avec la politique choisie ; rejeu sans effets supplémentaires |

Points d'entrée relus : [webhooks](../server/webhooks.ts), [paiements](../server/stripe.ts), [abonnements](../server/subscription.ts). Les règles commerciales attendues en SUB-02/03 doivent être fixées avant de déclarer ces scénarios réussis.

## E-mails

Préconditions : transport de recette configuré, destinataires limités aux boîtes autorisées, contrôle des notifications administrateur et de l'adresse de retour. L'[envoi SMTP](../server/email.ts) ne relance pas automatiquement et distingue acceptation par le serveur et livraison en boîte.

| ID | Actions de recette | Résultat à vérifier |
| --- | --- | --- |
| MAIL-01 | Déclencher une récupération de mot de passe d'un compte fictif | Message reçu dans la boîte prévue ; lien utilisable sur la bonne origine, expiration et usage unique vérifiés sans conserver le jeton |
| MAIL-02 | Créer une demande de devis puis une réponse avec les comptes de recette | Bon destinataire et bon dossier, aucun contenu d'une autre compagnie ; référence fournisseur et réception vérifiées |
| MAIL-03 | Provoquer un refus SMTP dans l'environnement isolé | Erreur ou statut non confirmé fidèle ; aucune annonce de livraison certaine ; vérifier le fournisseur avant toute répétition |

L'absence d'outbox générale reste un écart d'exploitation. La réussite de MAIL-01/02 ne démontre pas la récupération après panne entre écriture métier et notification.

## Génération IA et parcours auteur

Préconditions : capacités réellement disponibles pour chaque fournisseur choisi, comptes fictifs auteur interne et responsable de compagnie, cours de brouillon, stockage privé, budget limité. Utiliser un sujet de démonstration sans données personnelles ni documents confidentiels. Répéter les contrôles linguistiques pour FR/EN/AR avant de revendiquer ces trois langues.

| ID | Actions de recette | Résultat à vérifier |
| --- | --- | --- |
| AI-01 | Générer un plan de deux diapositives avec QCM, puis ouvrir le résultat dans le studio | Nombre et structure conformes, réponses/explications éditables, langue correcte ; revue humaine du contenu avant publication |
| AI-02 | Générer une image et une voix sur ce brouillon | Médias lisibles dans le lecteur, format/durée cohérents, accès privé et rattachement au bon cours ; coût observé consigné |
| AI-03 | Soumettre une vidéo puis reprendre son suivi après rechargement | Même tâche suivie, média final jouable si réussite, état d'échec/incertitude explicite sinon ; aucune nouvelle soumission implicite |
| AI-04 | Réessayer la même demande avec son identifiant, puis provoquer une indisponibilité contrôlée | Quota et tâche cohérents, pas de duplication payante lors du rejeu ; erreur compréhensible et contenu non publié automatiquement |
| AI-05 | Tenter lecture/réutilisation du résultat depuis une autre compagnie | Accès refusé, aucun texte, média privé ou identifiant fournisseur sensible divulgué |

Références : [validation des sorties](ai-output-validation.md), [tâches vidéo](../server/aiVideoJobs.ts). Le relevé texte/image/voix ne couvre pas à lui seul la configuration vidéo : celle-ci doit être contrôlée séparément avant AI-03. Un média généré ne prouve ni la justesse aéronautique ni les droits de diffusion.

## Classe distante

Préconditions : configuration JaaS, origine HTTPS adaptée au navigateur, deux appareils et comptes de recette distincts, instructeur affecté et apprenant inscrit, horaires renseignés. Voir [admission privée et limites connues](private-live-video.md).

| ID | Actions de recette | Résultat à vérifier |
| --- | --- | --- |
| LIVE-01 | Rejoindre à deux pendant la fenêtre autorisée | Audio et vidéo bidirectionnels, rôle modérateur réservé à l'instructeur/admin, présence démarrée après connexion vidéo |
| LIVE-02 | Refuser micro/caméra, interrompre le réseau puis reconnecter | Message et reprise utilisables ; absence de crédit de présence supposé pendant la déconnexion à contrôler |
| LIVE-03 | Essayer compte tiers, compte suspendu et admission hors horaires | Aucun nouveau ticket ni accès vidéo autorisé ; refus compréhensible |
| LIVE-04 | Retirer les droits pendant une connexion, puis essayer de réutiliser un ticket | Mesurer séparément fermeture du lecteur, refus de nouvelle admission et comportement réel du fournisseur ; l'expiration du ticket ne prouve pas l'expulsion |

LIVE-04 reste un point de sécurité ouvert tant que la révocation effective côté fournisseur n'est pas prouvée. Aucun replay privé ni preuve d'assiduité réglementaire n'est validé par une simple connexion à deux.

## Facturation après paiement

Préconditions : identité fictive d'émetteur clairement réservée à la recette via `INVOICE_ISSUER_JSON`, conforme au [schéma applicatif](../shared/invoiceIdentity.ts), et identité acheteur de recette. Faire valider séparément les données réelles et mentions avant exploitation.

| ID | Actions de recette | Résultat à vérifier |
| --- | --- | --- |
| INV-01 | À partir de PAY-01, consulter/télécharger le document depuis le compte autorisé | Lien exact avec la commande, montants et identités corrects, PDF lisible, accès refusé au compte tiers |
| INV-02 | Consulter à nouveau et comparer l'archive après modification des coordonnées du compte de recette | Même document conservé et mêmes données historiques ; aucun écrasement silencieux |
| INV-03 | Rejouer le parcours sans identité d'émetteur dans l'instance isolée | Émission refusée explicitement, aucune identité inventée ; paiement et document distingués dans l'interface |

Après exécution, reporter chaque verdict dans la matrice opérationnelle avec sa preuve et sa version. Les scénarios non exécutés, écarts de révocation, corrections de factures et règles commerciales indéterminées restent ouverts.
