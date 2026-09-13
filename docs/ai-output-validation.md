# Validation des contenus produits par l’IA

Les générations de plan et QCM sont validées avant d’être renvoyées au studio. Le parseur conserve la prise en charge des blocs JSON entourés de balises Markdown, mais refuse plus de 200000 caractères et remplace les erreurs de parsing par une explication sans recopier la réponse du modèle.

Le plan exige titre et description non vides, des diapositives avec titre/corps non vides et des champs de taille bornée. Il doit contenir exactement le nombre demandé (2 à 14). La couverture all exige un QCM par diapositive, none n’en autorise aucun, some exige au moins un QCM et au moins une diapositive sans QCM. Aucun élément manquant n’est fabriqué et aucun excès n’est tronqué silencieusement. Un imagePrompt omis devient une chaîne vide ; un quiz null/omis devient absent.

Chaque QCM exige quatre options non vides et distinctes après nettoyage/casse, une question et une explication, et un à quatre indices entiers distincts dans l’intervalle 0–3. Les réponses multiples restent possibles. Les champs supplémentaires et structures non conformes sont refusés. Le texte de diapositive doit être une chaîne non vide de 20000 caractères maximum ; une réponse fournisseur d’un autre type est refusée proprement.

Une réponse invalide produit une erreur AIError dans le parcours existant. Le client ne lance donc pas la création du cours à partir d’un plan invalide. La demande reste comptée dans le quota horaire et son échec est enregistré ; aucune régénération automatique payante n’est déclenchée. Un titre ou une option valide syntaxiquement peut encore être faux : ces contrôles ne valident ni la justesse technique, ni les références réglementaires, ni la qualité pédagogique. La revue humaine avant publication reste nécessaire.

La consigne de génération de texte reconnaît désormais ar et demande explicitement l’arabe, au lieu de retomber sur l’anglais. Cela ne détecte pas automatiquement la langue réelle de la sortie et ne modifie pas le choix des voix audio.

## Vérification

219 tests réussis, dont 166 PostgreSQL. Trois nouveaux tests utilisent des réponses HTTP simulées pour exercer les fonctions réelles de génération : plan arabe et balises JSON, nombre/couverture, indices invalides/dupliqués/fractionnaires, options dupliquées ou manquantes, explication vide, champs supplémentaires, structures invalides, réponse volumineuse, texte vide/non textuel et réponses multiples valides. Le signal AbortSignal est bien transmis au fetch simulé ; aucun fournisseur réel appelé.

TypeScript/build réussis. Aucune migration ni modification d’infrastructure, donc pas de nouvelle recette Docker pour ce lot. Recette navigateur et opérationnelle fournisseur toujours à effectuer ; avertissement de bundle persistant. Aucun déploiement.
