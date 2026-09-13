# Création atomique des brouillons du studio

`maker.createCourse` et `createCourseWithSlides` utilisent un schéma partagé et une transaction unique pour la formation et ses diapositives. L’échec d’une écriture ultérieure annule aussi les écritures déjà effectuées : il ne reste pas de cours vide ou de premier fragment après une erreur de diapositive.

Le service relit le compte actif et les droits de destination pendant la transaction. Pour une compagnie, il verrouille celle-ci et l’affiliation MANAGER, et exige leur état actif (l’administrateur est dispensé d’affiliation). Un espace personnel exige le rôle administrateur/instructeur. Cela empêche de réutiliser une résolution de propriétaire obtenue avant un retrait d’affiliation.

Le schéma borne titre/slug/description/langue/durée et limite un nouveau brouillon à 200 diapositives. Les diapositives manuelles peuvent rester vides pendant l’écriture. Si un mini-QCM est fourni à la création, sa question, ses options distinctes et ses réponses sont cohérentes : 2 à 10 options, indices entiers présents/uniques/dans la liste. Les champs supplémentaires sont refusés. Les sorties IA, plus contraintes, restent validées séparément avant cet appel.

Un nouveau cours ne possède encore aucun média privé : la présence de références course-media/courses dans les données de création est refusée. L’auteur doit utiliser la duplication autorisée du cours source ou importer les supports après création du brouillon. Les URLs externes conservent leur comportement existant ; cette validation ne les télécharge pas et n’en garantit pas le contenu.

Les cours créés restent des brouillons non publiés, sans version publiée héritée ; les diapositives sont ordonnées à partir de 1. Cette transaction ne couvre pas l’appel fournisseur précédent et ne rend pas la génération IA elle-même idempotente. La reprise des plans complets enregistrés est désormais décrite dans `docs/ai-outline-recovery.md` (lot 72).

## Vérification

223 tests réussis (170 PostgreSQL). Quatre nouveaux scénarios couvrent cours/diapositives/QCM/langue, échec SQL réel sur la seconde diapositive avec annulation complète, affiliation retirée après résolution du propriétaire, références privées étrangères et payloads invalides/surdimensionnés. Le cas SQL utilise un caractère nul que PostgreSQL refuse après l’insertion de la première diapositive ; il ne nécessite aucun déclencheur de test global.

TypeScript/build réussis. Aucun changement de schéma ni d’infrastructure ; pas de nouvelle recette Docker pour ce lot. Recette visuelle navigateur toujours à effectuer. Aucun fournisseur appelé ni déploiement.
