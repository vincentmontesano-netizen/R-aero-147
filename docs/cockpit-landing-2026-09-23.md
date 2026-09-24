# Landing cockpit A320 — 23 septembre 2026

## Livré

- Ancienne turbine retirée. `CockpitExperience` utilise le modèle fourni dans `a320_cockpit_2` via `cockpitScene` et `cockpitCamera`.
- Modèle complet avec cockpit : GLB Draco/WebP de 4 415 940 octets, depuis 44,05 Mo de sources. Géométrie non simplifiée, textures limitées à 2048 pixels. Sources d’origine conservées ; commande et empreintes dans `cockpit-asset.json`.
- Grande scène immersive, fond nuit, accents cyan/orange, nouvelle hiérarchie typographique et traitement des sections, cartes, FAQ et formulaire.
- Défilement extérieur → approche → poste de pilotage ; bouton d’entrée ; cinq vues (extérieur, poste, instruments, console, panneau supérieur) ; glisser pour regarder, zoom +/−, retour extérieur.
- Clavier : flèches pour regarder, +/− pour zoomer, Échap pour revenir. Les touches ne sont interceptées que lorsque la scène est focalisée.
- Mobile : défilement de page conservé et choix des vues dans une barre horizontale. Mouvement réduit : pas de trajet automatique, vues explicites immédiates.
- Chargement progressif, image de repli issue du modèle, message et reprise en cas d’échec, gestion de la perte du contexte WebGL, arrêt du rendu hors champ et onglet caché, libération des ressources au démontage.
- Français/anglais/arabe. Crédit avec liens modèle, auteur et CC BY 4.0 ; licence copiée avec l’asset.
- Aucun prix ni comparatif tarifaire réintroduit. Inscription, catalogue et capture brochure conservés.

## Preuves

- TypeScript `pnpm check` : succès.
- Build projet via `sites-building` : succès ; scène chargée en module séparé.
- Rendu isolé du modèle fourni : cadrages inspectés pour les cinq positions, correction de la console après inspection.
- Harness WebGL utilisant le module réel `mountCockpit` : décodage, cinq rendus distincts, changement de zoom et de regard, trajet de défilement, redimensionnement à 390 pixels, mouvement réduit, perte de contexte et démontage sans canvas résiduel. Aucune erreur JS.
- HTML, ressources d’entrée, GLB, image de repli et décodeur servis sur l’aperçu Tailscale ; octets comparés aux fichiers locaux.
- Ces contrôles portent sur le modèle et le moteur 3D isolés ; pas de campagne de tests navigateur de l’application complète.

Aperçu : http://100.123.204.41:3175/ — conteneur local existant actualisé. Aucune publication distante ou modification des données métier.

## Ajustement demandé : navigation par défilement uniquement

- Mentions visibles de type/constructeur retirées du hero, des légendes et du libellé du crédit ; lien source et attribution du créateur conservés.
- Décalques de type/constructeur sur le fuselage et la plaque du cockpit neutralisés au rendu par des masques UV ciblés ; atlas original intact. Image de repli régénérée depuis ce rendu.
- Suppression des boutons de zoom/retour, des instructions glisser/zoomer, des handlers souris/tactiles et des raccourcis de manipulation. Canvas décoratif sans capture des pointeurs ni focus clavier.
- Les cinq vues s’enchaînent au défilement. La barre devient un indicateur d’étapes passif ; le bouton d’entrée fait défiler la page au début du cockpit.
- Mouvement réduit : vues fixes par étapes, sans animation entre elles.
- Validation WebGL ciblée : cinq rendus distincts selon la progression ; glisser et touches +/flèche sans effet ; aucune API de manipulation manuelle exposée ; pas d’erreurs JS ; démontage propre. Plaque du cockpit contrôlée visuellement sur le rendu isolé du modèle.

## Ajustement demandé : retenir la page jusqu’à la vue 05 et ajouter des images

- Scène maintenue à l’écran jusqu’à la fin du parcours, caméra stabilisée sur le panneau supérieur, puis pause de lecture de 0,8 seconde. Les grands défilements sont limités à 20 % du parcours par seconde. Le parcours occupe 540 svh sur ordinateur et 500 svh sur mobile.
- Borne de sortie calculée à partir de la hauteur réelle de la scène et de la navigation. Le surplus de défilement est écarté tant que le parcours n’est pas terminé ; le lien de continuation apparaît ensuite. La scène reste retenue pendant le chargement ; un échec libère la page. Les arrivées directes sous l’introduction restent possibles.
- Trois illustrations aéronautiques créées avec l’outil intégré image_gen, sans marque ni type d’avion affiché : moteur, équipe en hangar, détail d’aile. Intégration dans la présentation de la maintenance, les cartes de formation, le parcours et la section entreprises. Mention illustrative en pied de page, FR/EN/AR.
- WebP en 768 et 1536 pixels, chargement différé et dimensions réservées. Les fichiers et prompts exacts figurent dans `aviation-image-provenance-2026-09-23.json` ; originaux conservés dans `output/aviation-assets-20260923` à la racine SOFT.
- Vérification : trois tests de progression (défilement brutal, délai d’onglet masqué, mouvement réduit), TypeScript et build réussis. Banc isolé du moteur WebGL réel : les cinq vues parcourues en 6,65 secondes, sortie après stabilisation et pause finale, aucune erreur JS et démontage propre. Ces vérifications ne constituent pas un test navigateur de l’application complète.
