# Comparaison des parcours de formation aéronautique

Consultation : 13 septembre 2026 — lot 261. Décisions produit pour R-AERO, pas classement des organismes ni audit de leur agrément.

## Méthode et limites

Lecture de pages publiques officielles de Lufthansa Technical Training (LTT), Storm Aviation et SR Technics. Les descriptions ci-dessous sont des offres annoncées par ces acteurs, pas des expériences testées dans leurs espaces apprenants. Aucun compte créé, formulaire envoyé, achat, inscription ou contact commercial effectué. Aucun contenu pédagogique, marque ou média récupéré pour intégration dans R-AERO.

La lecture textuelle d’une page ne prouve ni ergonomie, accessibilité, disponibilité réelle d’un cours, ni fonctionnement du paiement. Les numéros/portées d’agrément annoncés ne sont pas validés ici auprès des autorités. Aucune conclusion sur l’absence de fonctionnalités privées chez un concurrent.

## Observations sourcées

| Acteur / page officielle | Observation publique | Ce que cette lecture ne permet pas d’affirmer |
| --- | --- | --- |
| [Storm — Technical Training](https://www.stormaviation.com/technical-training/) | Présentation de formations au type, différences/conversions, catégories B1.1/B2 et parties théoriques/pratiques ; offre pour particuliers, compagnies et MRO ; modalités à distance ou sur site mentionnées. | Disponibilités, prix, éligibilité d’une personne ou validation de chaque modalité pour un programme donné. |
| [Storm — Learning Solutions](https://www.stormaviation.com/learning-solutions/) | Parcours annoncé : analyse des besoins, définition d’objectifs, conception de programmes/supports, réalisation et évaluation. | L’existence d’un module logiciel de TNA libre-service ou la forme exacte de ses preuves d’évaluation. |
| [SR Technics — Training Services](https://www.srtechnics.com/services/training-services/) | Offre de formation de base/au type et de programmes adaptés aux besoins des entreprises ; liens vers brochure, documents d’agrément et calendrier courant. | Le fonctionnement du calendrier externe : son ouverture a échoué dans cette consultation. Aucun parcours d’inscription ou de paiement testé. |
| [LTT — Training Finder](https://www.ltt.aero/en/training-finder) | Point d’entrée de recherche intégré et possibilité de contacter les ventes si la recherche n’aboutit pas. | Fonctionnement des filtres/résultats de l’iframe, qui n’a pas été testé. |
| [LTT — eLibrary](https://www.ltt.aero/en/elibrary) | Liens regroupés par catégories, notamment autorités, références et constructeurs ; renvoi vers le formateur pour davantage de supports. | Accès à des manuels sous licence ou disponibilité d’une bibliothèque apprenant privée. |
| [LTT — MAINTAIN360](https://www.ltt.aero/en/maintain360) | Présentation d’un environnement virtuel A320, de scénarios et d’un suivi de performance. | Efficacité mesurée, gains annoncés, certification ou équivalence avec une formation pratique. Les chiffres commerciaux ne sont pas repris. |

## Confrontation avec le code actuel

Les constats locaux portent sur les sources relues, pas sur une recette utilisateur intégrale.

| Besoin produit | État R-AERO constaté | Écart à traiter |
| --- | --- | --- |
| Comprendre précisément le programme avant achat | [Schéma training](../drizzle/schema.ts) : type, domaine, langue, prérequis, objectifs, public cible, durée et référence ; [fiche](../client/src/pages/TrainingDetail.tsx) affiche ces éléments. | Le tableau trainings ne sépare pas explicitement famille avion/motorisation, périmètre théorique/pratique et document délivré. Un texte libre ne permet pas un filtre fiable ni une validation structurée. |
| Choisir une session adaptée | [Schéma sessions](../drizzle/schema.ts) : format, lieu, dates, places, langue ; [tests de calendrier](../server/sessionSchedule.integration.test.ts). | Relier et tester le parcours programme → session → inscription selon format, rôle et langue. Ces colonnes ne prouvent pas les moyens réels d’une session. |
| Partir d’un besoin compagnie | [runTNA](../server/db.ts) rapproche des règles de fonction/licence puis crée les récurrences manquantes ; [tests](../server/tnaConcurrency.integration.test.ts). | C’est une application de règles de suivi, pas un dossier complet d’analyse des besoins avec situation initiale, objectifs, programme proposé et évaluation. Éviter de présenter ce bouton comme une analyse pédagogique exhaustive. |
| Produire un programme interne maîtrisé | [Accès compagnie](../server/companyTraining.ts), [tests d’isolation du studio](../server/makerAccess.integration.test.ts), [revue pédagogique](../server/pedagogicalReview.integration.test.ts). | Vérifier le parcours intégral responsable → auteur → relecteur → apprenant, avec version publiée et résultat rattaché. La présence des services ne suffit pas à certifier ce parcours. |
| Mettre les ressources et l’assistance près du cours | [Lecteur](../client/src/pages/LearningPlayer.tsx) et [diapositives](../client/src/components/SlideDeck.tsx) : médias, QCM, progression et gestion d’erreurs. | Vérifier les droits/durée d’accès aux ressources et le contact pédagogique au bon endroit. Ne pas agréger automatiquement des manuels constructeur protégés. |
| Apprendre par scénarios | Interactions vidéo et activités dans SlideDeck ; contrôles de QCM côté serveur. | Tester des scénarios représentatifs avec un expert métier. Le lecteur actuel n’est pas un simulateur avion ou une preuve de compétence pratique. |

## Priorités retenues et preuve attendue

Ces priorités sont une inférence de conception, non des exigences réglementaires déduites des pages commerciales. Elles s’ajoutent au périmètre initial sans remplacer paiements, KYC/KYB, agrément admin, IA ou exploitation.

1. **Clarifier le rôle de l’outil de récurrence.** Présenter son action exacte et ce qui entre dans le calcul. Critère : un responsable comprend qu’il crée du suivi à partir de règles ; aucune inscription ou validation de compétence n’est annoncée à tort. Une future vraie TNA doit conserver besoin, justification, auteur, version et approbation du programme.
2. **Structurer la portée de la formation.** Concevoir les champs métier avec le responsable pédagogique avant de les rendre obligatoires : public, famille/type/moteur si pertinent, parties couvertes, modalités et document délivré. Critère : deux programmes aux titres proches restent distinguables ; aucune valeur fictive ne remplit les données anciennes ; les informations approuvées sont liées à la version publiée.
3. **Vérifier un parcours complet par rôle.** Particulier : recherche → choix → inscription → chapitre/QCM → résultat/document. Compagnie : besoin → programme interne → revue → attribution → suivi/preuves. Admin : dossier organisme → décision autorisée → historique. Critère : preuves navigateur et fournisseurs sur un environnement de test configuré, avec états d’échec, et pas seulement des tests de fonctions.
4. **Améliorer les scénarios avant d’investir dans la VR.** Prioriser qualité du contenu, objectifs mesurables et retours du formateur avec les interactions existantes. Critère : scénario relu, question rattachée à l’objectif, version et résultat traçables, essai apprenant. Aucune promesse de supériorité pédagogique sans évaluation.

## Statut de la comparaison

Comparaison documentaire des offres publiques étendue à trois acteurs, avec écarts locaux précis et critères de validation. Restent non évalués : espaces privés concurrents, contrats/prix détaillés, déroulement réel d’une inscription, interfaces mobiles/accessibilité, efficacité pédagogique et utilisabilité comparative. Le benchmark n’est donc pas déclaré exhaustif. [L’audit opérationnel](operational-readiness.md) reste ouvert.
