# Doré et modes clair/sombre — 24 septembre 2026

À la demande de l’utilisateur, l’accent orange de l’interface est remplacé par un doré mat. Le mode sombre bleu nuit reste proposé par défaut ; un mode clair blanc cassé, avec cartes blanches et texte bleu profond, est disponible dans le même sélecteur.

Le bouton soleil/lune figure dans la navigation publique, les espaces apprenant, entreprise, administration et auteur, ainsi que sur les écrans de connexion, inscription et récupération. Son libellé accessible est traduit en français, anglais et arabe. Le choix est conservé à la navigation et au rechargement. Il est appliqué avant le premier affichage ; un stockage navigateur indisponible ne bloque pas le changement de thème.

Les surfaces, textes, formulaires, notifications, boutons et fenêtres PDF suivent les jetons du thème. Les zones de vidéo conservent leur fond noir et leurs textes blancs. La scène 3D et les sections aéronautiques adaptent leur fond au thème sans modifier le parcours des cinq vues.

## Validation

- TypeScript et build de production : réussis.
- Tests ciblés langues et progression du cockpit : 6 réussis.
- Suite navigateur `scripts/e2e/themes.mjs` : bascule souris/clavier, persistance, stockage bloqué, RTL et 28 combinaisons écran/thème/taille réussies. Résultat local : `tmp/e2e/run-20260923222841/themes-results.json`.
- Pages publiques en mode clair : 15 routes × FR/EN/AR, soit 45 contrôles mobiles, sans débordement ni erreur JavaScript (`tmp/e2e/public-light-results.json`).
- Espaces connectés en mode clair : 26 onglets apprenant/entreprise/admin, sans débordement ni erreur JavaScript (`tmp/e2e/workspaces-light-results.json`).
- Inspection visuelle de la landing, de la scène 3D, des cartes, du formulaire brochure, du catalogue et des espaces connectés dans les deux palettes. Les captures des sections sont prises après la fin des cinq vues, afin de respecter la retenue du défilement.
- Les parcours métier et tests serveur de la recette précédente restent applicables : cette évolution ne modifie ni les API ni le schéma des données.

Cette évolution remplace la palette orange décrite dans le rapport d’harmonisation du 23 septembre.
