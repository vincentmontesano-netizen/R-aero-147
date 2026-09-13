# Administration des webinaires

Le panneau des sessions de formation inclut désormais une section Webinaires FR/EN/AR. Il permet de créer un webinaire avec titre, date/heure locale, durée entière de 1 à 1440 minutes, capacité de 1 à 10000 personnes et rattachement facultatif à une formation. Les valeurs ISO transmises incluent le fuseau. La capacité est appliquée par le parcours d’inscription existant.

Le formulaire indique qu’un webinaire sans formation est visible dans le catalogue public ; une formation interne le masque, et une formation non publiée/archivée reste filtrée par la lecture publique existante. Une formation archivée ne peut pas être choisie à la création. Les droits de classe restent ceux du parcours existant, notamment l’accès aux formations internes ; aucun simple nom d’intervenant n’accorde le rôle de modérateur. Ces webinaires n’ajoutent pas de produit de paiement ou d’abonnement.

Les administrateurs actifs peuvent corriger début/durée avec un motif, puis marquer le webinaire en direct, terminé ou annulé. Les états terminaux ne se rouvrent pas et leurs horaires ne sont plus modifiables par ces routes. Le passage en direct ne contourne pas la fenêtre horaire d’admission vidéo. Les erreurs restent affichées par notification, les mutations en cours désactivent le formulaire et les listes/accès sont invalidés à la réussite.

Chaque écriture relit l’administrateur et verrouille le webinaire dans une transaction. L’événement immutable conserve l’action, l’auteur, les états avant/après, le motif et la date. La création conserve aussi son état initial. Deux corrections identiques concurrentes n’écrivent qu’une transition ; une répétition du même statut ne réécrit pas l’historique. Les inscriptions restent présentes après annulation, tandis que le catalogue public masque le webinaire annulé.

La migration `20260913_webinar_admin.sql` protège les événements contre modification/effacement/troncature et les webinaires contre DELETE/TRUNCATE. Elle ne fabrique pas de provenance pour les anciennes lignes. Les mises à jour SQL directes ne sont pas journalisées par ces services ; séparer les droits SQL d’exécution/migration reste nécessaire. Le journal est conservé en base et consultable depuis le bouton Historique (lot 65 ci-dessous).

## Validation et limites

201 tests réussis, dont 151 PostgreSQL. Les scénarios nouveaux couvrent création publique et journal, correction concurrente, états terminaux, conservation des inscriptions, interdiction d’effacement, validation dates/durée/capacité, administrateur suspendu, formations internes/non publiées masquées et formation archivée refusée. Une adresse email fixe du test précédent des horaires a été rendue unique pour permettre de rejouer toute la suite sur la base conservée.

TypeScript/build et construction Docker vérifiés ; recette complète installation/panne/reprise/redémarrage/sauvegarde/restauration réussie, ressources jetables nettoyées. Recette visuelle navigateur toujours à effectuer. Aucun fournisseur appelé ni déploiement. Restent notifications des inscrits, affectations d’instructeurs et intégration JaaS réelle. L’édition des métadonnées/capacités est décrite ci-dessous.


## Métadonnées et capacité (lot 64)

Le bouton Modifier ouvre un formulaire FR/EN/AR pour le titre, la description et les places, avec un motif obligatoire. La liste affiche le nombre réel de participants distincts inscrits et la capacité. Une capacité vide signifie explicitement sans limite ; cette valeur conserve les anciens webinaires non bornés sans leur imposer silencieusement une limite lors d’une simple correction de titre. Les nouvelles créations restent bornées par défaut. Une capacité numérique doit être entière, entre 1 et 10000.

Le service relit l’administrateur actif puis verrouille le webinaire avec le même verrou que le parcours d’inscription. Il compte les personnes distinctes et refuse une capacité inférieure à ce nombre, sans modifier titre/description ni journal. Une réservation concurrente et une réduction des places sont ainsi sérialisées : la seconde action relit la situation résultant de la première. Les écritures SQL directes hors de ces parcours ne bénéficient pas de cette coordination.

Le rattachement à une formation, les horaires et le statut ne sont pas modifiables par cette route stricte ; ils ne changent pas lors d’une correction de texte. Les webinaires terminés/annulés restent protégés. Une modification identique est idempotente. Les valeurs avant/après et le motif sont journalisés sous l’action metadata ; la nouvelle migration `20260913_webinar_metadata.sql` étend la contrainte du journal sans modifier les migrations appliquées.

203 tests réussis (153 PostgreSQL), incluant immutabilité de la première correction répétée, absence de modification partielle en cas de capacité insuffisante, mode sans limite, nombre affiché, droits/statuts et course réelle entre inscription et réduction de capacité. Recette visuelle navigateur toujours à effectuer.

TypeScript/build, construction Docker et recette complète installation/panne/reprise/redémarrage/sauvegarde/restauration réussis ; ressources jetables nettoyées. Aucun fournisseur appelé ni déploiement.


## Consultation du journal (lot 65)

Un bouton Historique est disponible pour chaque webinaire, y compris terminé ou annulé. Le dialogue FR/EN/AR présente chaque action et les seuls champs changés avant/après : titre, description, horaire, durée, capacité, statut et rattachement. La création présente l’état initial. Le motif des changements est affiché avec auteur et date ; les noms actuels sont explicitement distingués des identifiants conservés. Un journal vide ne prétend pas couvrir les changements antérieurs à sa mise en place.

La route et le service exigent un administrateur actif ; la transaction conserve le verrou partagé de l’acteur pendant la lecture. La requête SQL projette les champs autorisés des instantanés sans renvoyer meetingUrl, replayUrl, liveRoom ou d’éventuels champs supplémentaires. La projection utilisateur ne contient que nom et identifiant. Ce filtrage de colonnes ne réécrit pas le texte libre des titres/descriptions/motifs.

La pagination par identifiant renvoie 50 événements et un curseur integer borné. Les nouvelles insertions ne décalent pas les pages anciennes. Le dialogue gère chargement/erreur/réessai/vide et navigation ; les mutations administratives invalident le journal. Les heures s’affichent dans le fuseau du navigateur.

205 tests réussis (155 PostgreSQL), dont projection des instantanés contenant des URL privées, absence de secrets utilisateur, droits/administrateur suspendu, annulation et pagination de 53 entrées avec nouvelle insertion et autre webinaire. TypeScript/build réussis ; aucune migration ni nouvelle recette Docker nécessaire pour ce lot de lecture. Recette visuelle navigateur toujours à effectuer. Aucun fournisseur appelé ni déploiement.
