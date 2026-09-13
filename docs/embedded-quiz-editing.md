# Édition cohérente des mini-QCM

Le dialogue de diapositive supprimait les options vides avec `filter(Boolean)` avant sauvegarde tout en conservant les indices des réponses. Une option retirée au milieu pouvait donc déplacer une bonne réponse ou rendre son indice invalide. Il conserve désormais les positions : toutes les options doivent être renseignées ou retirées explicitement avec le bouton existant, qui ajuste les indices.

Le schéma partagé `shared/embeddedQuiz.ts` exige question, 2 à 10 options non vides et distinctes après normalisation, et une ou plusieurs réponses entières, uniques, dans la liste. L’éditeur affiche une erreur FR/EN/AR avant envoi si le QCM est incomplet. Effacer la question dans le dialogue retire explicitement l’ensemble du groupe de champs QCM.

Les services de création et modification de diapositive vérifient le groupe QCM et les interactions vidéo. Pour une modification d’activité, `updateSlide` verrouille la ligne, fusionne le patch avec son état courant puis valide avant écriture dans la même transaction. Deux patches partiels qui seraient valides séparément ne peuvent donc pas combiner un nombre d’options raccourci avec une réponse devenue hors limite. Retirer seulement la question tout en conservant ses options/réponses est refusé ; une suppression du QCM exige leur remise à null ensemble.

Les modifications sans champ d’activité ne réécrivent pas les activités historiques. Modifier une activité implique en revanche que les activités résultantes soient cohérentes. Les versions publiées ne sont pas réécrites. Les contrôles de propriété, liens pédagogiques et médias restent ceux des routes existantes. Ces mini-QCM demeurent des exercices locaux, distincts des examens serveur.

## Vérification

237 tests réussis (176 PostgreSQL), TypeScript/build réussis après correction d’une annotation de retour TypeScript trop étroite. Trois nouveaux tests PostgreSQL couvrent la route de modification réelle, positions des réponses, patches incomplets, retrait explicite, validation vidéo à la création/modification et course concurrente de patches. La dernière course vérifie qu’un seul patch incompatible est accepté et que le résultat reste valide.

Aucune migration ni nouvelle recette Docker nécessaire. Recette navigateur toujours à effectuer ; aucun fournisseur appelé ni déploiement.
