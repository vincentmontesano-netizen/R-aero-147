# Contrôle persistant des demandes IA

Les cinq routes de génération du studio (plan, texte de diapositive, QCM, image, audio) réservent une demande dans PostgreSQL avant d’appeler le fournisseur. Une réservation active par compte bloque une seconde génération, même d’une autre catégorie, avec une réponse TOO_MANY_REQUESTS. La décision utilise un verrou transactionnel par compte et relit son statut actif ; les droits auteur restent vérifiés par les routes existantes et par la sauvegarde des médias.

Les quotas sont calculés sur l’heure glissante à partir des enregistrements PostgreSQL, y compris les échecs et réservations dont le résultat est inconnu. Plan/texte/QCM partagent le quota text. Valeurs par défaut, modifiables dans les deux fichiers Compose et l’exemple d’environnement :

- `AI_TEXT_REQUESTS_PER_HOUR=30`
- `AI_IMAGE_REQUESTS_PER_HOUR=10`
- `AI_SPEECH_REQUESTS_PER_HOUR=20`

Une valeur entière de 0 désactive la catégorie ; 1000 est le maximum accepté. Une configuration invalide refuse la génération avec une erreur explicite. Ces quotas sont par compte, partagés entre instances utilisant la même base. Ils ne constituent pas un budget financier, un quota d’organisation ou une garantie sur la facture fournisseur ; créer plusieurs comptes peut multiplier les plafonds.

Le studio affiche en FR/EN/AR les demandes consommées/limites et la réservation en cours, actualisées toutes les 30 secondes. Les demandes textuelles sont bornées avant génération : sujet 2000 caractères, instruction/contenu 20000, objectifs 10000, plan de 2 à 14 diapositives entières et langue FR/EN/AR ; les autres champs de contexte sont aussi bornés. Les limites précédentes image/audio sont conservées.

## Réservations, échecs et reprise

La migration `20260913_ai_requests.sql` conserve identifiant, compte, opération/catégorie, début, expiration et résultat running/succeeded/failed. L’identité et le résultat final sont immuables, DELETE/TRUNCATE refusés. Aucun prompt, clé fournisseur, texte généré ou message d’erreur fournisseur n’est enregistré dans ce journal.

La réservation dure 15 minutes, selon l’horloge SQL. Chaque appel HTTP fournisseur est limité à 180 secondes, lecture du corps incluse via AbortSignal ; le parcours image Mistral peut enchaîner trois appels. Les appels terminés libèrent la réservation en enregistrant un succès ou un échec. Si le processus ou la base tombe avant l’enregistrement final, le résultat reste inconnu : après expiration, une nouvelle demande est autorisée, sans prétendre que le fournisseur n’a rien exécuté. Une demande répétée après réussite est une nouvelle génération facturable potentielle.

Cette évolution n’est pas une file de travaux ni un mécanisme d’idempotence fournisseur. Elle ne reprend pas automatiquement les sorties et ne garantit pas l’annulation chez le fournisseur après un timeout. La reprise durable, le suivi des coûts/tokens, les quotas B2B et la validation des contenus de réponse restent à compléter. Les services IA internes appelés directement hors de ces routes ne réservent pas eux-mêmes un quota.

## Vérification

216 tests réussis (166 PostgreSQL). Trois nouveaux scénarios vérifient l’exclusion concurrente avant invocation du callback, comptage des échecs et quota texte commun, séparation des comptes/catégories, résultat final immuable, récupération après réservation expirée sans faux résultat, catégorie désactivée et configuration invalide. Fournisseurs simulés par callbacks, aucun appel réel. TypeScript/build réussis après correction du type de langue du dialogue de diapositive.

Les deux configurations Compose sont validées sans lire de fichier d’environnement privé. Construction Docker et recette installation/panne/reprise/redémarrage/sauvegarde/restauration réussies, ressources jetables nettoyées. Le délai fournisseur est implémenté avec AbortSignal.timeout mais n’a pas été exercé contre un fournisseur réel. Recette navigateur et opérationnelle fournisseur toujours à effectuer. Aucun déploiement.

La validation structurelle des sorties et des QCM est décrite dans `docs/ai-output-validation.md` (lot 70) ; elle ne garantit pas leur justesse pédagogique.

La reprise manuelle des plans complets enregistrés est disponible dans `docs/ai-outline-recovery.md` (lot 72). Elle ne reprend pas une génération interrompue avant sauvegarde.
