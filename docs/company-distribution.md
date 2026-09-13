# Distribution interne et renouvellements

Le studio d’une formation appartenant à une compagnie propose l’attribution aux comptes actifs affiliés. L’API exige une version publiée, une compagnie active et un acteur ADMIN ou manager actif de cette compagnie. Une sélection contenant un utilisateur étranger ou inactif est refusée entièrement.

L’attribution est sérialisée sur la formation, préserve les accès actifs existants et crée au plus une inscription par apprenant lors d’appels concurrents. L’inscription conserve sa version, son organisation d’origine, son auteur et, lorsqu’il existe, le lien salarié. L’organisation et l’auteur d’attribution ne peuvent pas être modifiés ensuite. Une preuve issue de cette inscription est identifiée comme attribution organisationnelle même sans ligne salarié historique.

L’apprenant doit rester affilié activement à une compagnie active pour lire les supports et emprunter les routes pédagogiques rattachées à cette attribution. La perte d’accès ne supprime pas ses résultats ou certificats. La durée de conservation du dossier et les droits sur les preuves sont distincts de l’accès aux supports.

## Gestion du personnel

Les routes liste/création/import de salariés exigent désormais un manager actif de la compagnie du compte. La modification vérifie la compagnie réelle du salarié ciblé et valide une liste stricte de champs. Changer `companyId` ou `userId` par une mise à jour arbitraire est refusé. Le parcours interface multi-organisation et le rattachement d’un compte invité à une ligne salarié restent à compléter.

## Renouvellements

Le service d’accès salarié crée une nouvelle inscription lorsque toutes les anciennes sont expirées ; il ne remet plus à zéro un résultat ancien. Une version publiée est obligatoire. Les appels automatiques d’abonnement transmettent l’organisation et le salarié, avec vérification d’affiliation avant attribution.

Créer ou renouveler un abonnement ne prouve pas une compétence. Le service de récurrence ne repousse plus une échéance à chaque activation : il conserve la date existante et crée les nouvelles lignes sans réussite ni échéance de qualification inventées. La mise à jour d’échéance sur preuve de formation et la séparation de l’échéance d’accès commercial doivent encore être intégrées au cycle complet.

## Limites

Cette attribution porte sur les formations internes de la compagnie. Les places de catalogue achetées sont maintenant enregistrées et attribuables depuis `/licences` ; les quotas d’abonnement restent à compléter. Les activations Stripe de démonstration ont été retirées. Le cycle financier complet reste à terminer ; voir `stripe-verification.md`. Notifications, demandes de recyclage explicites avant expiration, interface multi-organisation et supervision des traitements par lot restent à développer.

Migration : `20260913_training_assignments.sql`. Tests PostgreSQL : gestion de roster, affectation publiée, refus inter-compagnie, invalidité atomique d’une sélection, idempotence concurrente, origine immuable, révocation et renouvellements sans perte de preuve ni déplacement d’échéance.
