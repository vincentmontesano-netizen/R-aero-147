# Reprise des plans IA enregistrés

La génération d’un plan reçoit désormais la destination choisie dans le studio. Les droits sont vérifiés avant l’appel fournisseur puis relus pendant l’enregistrement de la réponse validée. Le plan complet, sa langue, son compte créateur, sa compagnie éventuelle et sa demande IA sont conservés dans `ai_outline_drafts`. Le journal `ai_requests` reste distinct, sans prompts ni sorties.

Le studio crée ensuite le brouillon à partir de l’identifiant du plan enregistré. Si la conversion échoue après réception de cet identifiant, le dialogue conserve celui-ci, fige les paramètres et propose de créer le cours avec le même plan enregistré. Si la réponse HTTP se perd après cet enregistrement, la section « Plans IA à enregistrer » permet de retrouver le plan sans nouvel appel fournisseur. La liste affiche uniquement titre, espace d’origine et date, avec pagination de 50 entrées. Elle est privée au créateur, même face à un autre administrateur. L’utilisateur doit rester actif et conserver les droits de l’espace : rôle administrateur/instructeur pour l’opérateur, compagnie active et affiliation MANAGER active pour une compagnie (administrateur dispensé d’affiliation).

La conversion verrouille le plan et crée le cours, ses diapositives et le lien vers le cours dans une seule transaction. Deux conversions simultanées ou une répétition après perte de réponse retournent le même identifiant de cours. La destination et le contenu proviennent de l’enregistrement serveur ; le client ne peut pas les remplacer lors de cette conversion. Le brouillon reste non publié et suit la revue pédagogique existante.

La migration `20260913_ai_outlines.sql` interdit suppression, TRUNCATE et modification du contenu ou de son identité. Le seul changement permis est le premier lien vers un cours créé. Après conversion, le plan disparaît de la liste d’attente, tandis que le cours reste accessible dans la liste du studio. Les sorties complètes sont conservées comme données privées ; aucun prompt ni secret fournisseur n’est ajouté.

## Limites

La reprise concerne uniquement une sortie complète validée et effectivement enregistrée. Une interruption avant son commit ne permet pas de récupérer ce que le fournisseur aurait produit. Il n’y a ni file de travaux, ni reprise automatique de génération, ni idempotence fournisseur. L’enregistrement final du statut de la demande peut échouer indépendamment après sauvegarde du plan ; le plan enregistré reste récupérable. Une erreur de conversion laisse le plan intact et non consommé. Un contenu refusé, notamment une référence à un média privé étranger, nécessite une correction du parcours de contenu ; aucune régénération payante automatique n’est lancée.

## Vérification

226 tests réussis, dont 173 sur PostgreSQL. Les nouveaux cas couvrent récupération sans nouvelle génération, conversions simultanées, cours unique et diapositives complètes, langue/QCM, immutabilité, confidentialité, retrait puis restauration d’affiliation, destination conservée, conversion refusée sans cours partiel et opération de demande incompatible. Les callbacks produisent des données synthétiques, sans fournisseur réel. Les tests préexistants continuent de vérifier le rollback après une erreur SQL sur une diapositive ultérieure.

TypeScript et build réussis. La recette Docker et la restauration sont consignées dans `plan.md`. Recette navigateur et fournisseur réel encore à effectuer.
