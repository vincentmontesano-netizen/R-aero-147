# Demandes de confidentialité dans le support privé

## Dépôt et suivi — lot 109

Le dossier personnel propose un lien vers `/support?request=privacy`. Le formulaire s’ouvre avec le type accès aux données et permet de choisir accès, rectification ou effacement, ainsi que l’assistance générale. Les libellés et l’explication du traitement sont disponibles en FR/EN/AR.

Une demande de confidentialité exige un objet et une description d’au moins dix caractères. Le titulaire précise les données concernées et ce qu’il demande. La catégorie est conservée sur le ticket et visible côté titulaire et administrateur. Le fil et le statut de support existants permettent de poursuivre l’échange privé. Une clôture de ticket est un statut de suivi, pas une preuve qu’un effacement a été exécuté.

Le dépôt ne supprime ni ne modifie les données du compte. La création vérifie le compte actif sous verrou et enregistre ticket/message initial dans une transaction. Un échec d’écriture du message annule le ticket. Les notifications configurées du support restent celles du parcours existant ; les tests les neutralisent et aucun email réel n’a été envoyé pendant ce travail.

La migration ajoute `requestKind` avec GENERAL par défaut. Les anciens tickets ne sont pas reclassés d’après une interprétation de leur texte. PostgreSQL interdit la modification de la catégorie originale ; les précisions peuvent être apportées dans la conversation. Le contenu des tickets fait déjà partie de l’export personnel.

## Limites

Le parcours est réservé aux comptes disposant encore d’une session active. Réception et vérification d’identité après fermeture restent à construire. Il ne constitue pas un dispositif complet d’instruction des demandes : décision motivée, journal immuable de traitement, échéances applicables, analyse par catégorie et livraison sécurisée éventuelle restent à compléter. Aucune suppression automatique ni conclusion de conformité n’est revendiquée.

## Validation

291 tests réussis (213 PostgreSQL), TypeScript/build réussis. Deux nouveaux scénarios SQL couvrent les trois types, absence de modification du compte au dépôt, accès titulaire/admin et refus d’un tiers, catégorie originale protégée, description insuffisante refusée, défaut GENERAL, rollback d’une erreur de message et refus d’un auteur suspendu. Pas de recette navigateur.

Construction Docker et recette complète avec sauvegarde/restauration réussies ; image `sha256:a29968d7682de28530f7263bc7960dab5e3cedfb70ad7af8452b6bcf98f9be3b`. Ressources de recette nettoyées. Aucun déploiement.

## Historique du traitement et clôture expliquée — lot 110

Les nouveaux tickets possèdent un événement initial OPEN dans la transaction de création. Chaque changement de statut via le service relit l’administrateur actif, verrouille le ticket et écrit son événement dans la même transaction. L’événement conserve acteur, nom constaté, ancien/nouveau statut, explication éventuelle et date. UPDATE/DELETE/TRUNCATE du journal sont refusés ; un ticket référencé ne peut pas être supprimé physiquement. Aucun historique passé n’est reconstitué.

Une transition vers CLOSED pour DATA_ACCESS, RECTIFICATION ou ERASURE exige une explication d’au moins dix caractères, au plus 2000. L’interface administrative la demande avant envoi. Cette explication est visible par le titulaire dans l’historique du fil. Répéter le même statut ne crée pas de nouvel événement ; cette répétition ne réécrit pas une ancienne explication.

L’historique est réservé au titulaire actif ou à un administrateur actif, avec pagination de 25 événements. Le fil propose son affichage FR/EN/AR et son rafraîchissement pendant la consultation. L’export personnel inclut désormais `support.statusHistory`, filtré par titulaire du ticket. Une modification ultérieure du nom de l’opérateur ne change pas les événements antérieurs.

La clôture expliquée trace un acte de suivi ; elle ne prouve pas à elle seule que des données ont été effacées ou qu’une demande est juridiquement satisfaite. Les messages du fil ne sont pas transformés en journal immuable par ce lot. Les décisions structurées, pièces de traitement, délais applicables et accès après fermeture du compte restent à compléter.

Validation : 293 tests réussis (215 PostgreSQL), TypeScript/build réussis. Deux nouveaux scénarios SQL : changement concurrent sans doublon, clôture sans explication refusée, explication et nom historiques, droits actuels, pagination/export, immutabilité et rollback complet d’une erreur de journal. Pas de recette navigateur.

Recette finale du lot 110 : Docker, redémarrage et sauvegarde/restauration réussis. Image `sha256:871799f9aa39522b0c7832b08e5bc6802947c3343964587107240099100f0d56` ; ressources jetables nettoyées. Aucun déploiement.

## Lecture et réponses avec droits actuels — lot 111

La lecture du fil et l’ajout d’un message vérifient désormais les droits dans le service : compte actif et titulaire du ticket ou administrateur actuel. L’acteur est verrouillé en lecture partagée ; le ticket est verrouillé pendant la lecture ou l’écriture. La fermeture du compte ou le retrait du rôle ne peuvent pas intercaler une modification des droits au milieu de cette transaction.

Une réponse et la date de mise à jour du ticket sont enregistrées ensemble. Si la mise à jour du ticket échoue, la réponse n’est pas conservée isolément. La lecture des messages utilise une jointure limitée au nom et au rôle des auteurs ; elle ne charge plus leurs emails pour construire le fil. Ces noms restent les valeurs actuelles, distinctes des noms figés dans le journal de statut.

294 tests réussis (216 PostgreSQL), TypeScript/build réussis. Nouveau scénario SQL : titulaire/admin autorisés, tiers refusé, ancien admin et compte suspendu refusés directement par les services, échec SQL de mise à jour avec rollback du message et du ticket. Pas de migration/UI/nouvelle recette Docker ; dernière recette complète au lot 110. Aucun email réel envoyé.
