# Fermeture du profil et conservation des justificatifs

## Comportement livré — lot 103

Le parcours autrefois nommé effacement est désormais présenté comme une fermeture de compte. Il retire les champs d’identité du profil (nom/prénom, biographie, email, informations de licence et poste), désactive le compte et le partage du passeport, annule les jetons de récupération et codes de connexion et retire le mot de passe. La rotation de version de session existante invalide les sessions précédentes. Le cookie du parcours personnel est supprimé après succès.

Les preuves restent présentes et passent à FROZEN si elles ne le sont pas déjà. Leur propriétaire, contrôleur et affiliation d’origine restent inchangés : une preuve personnelle n’est pas transférée à une compagnie. Les snapshots déjà gelés sont conservés. Les examens, tentatives, certificats, factures, partages et autres historiques ne sont pas supprimés. Les affiliations encore actives deviennent inactives ; les lignes salariés restent présentes, avec le lien de connexion détaché.

L’écriture est une seule transaction. `account_closures` conserve le titulaire, l’acteur, le nombre de preuves conservées et la date ; UPDATE/DELETE/TRUNCATE sont refusés. La base interdit la réactivation d’un compte ayant cet événement. Un administrateur actif peut retrouver le résultat d’une fermeture déjà enregistrée sans la répéter.

## Droits et confirmation

Le titulaire doit fournir son mot de passe actuel ; la route limite les tentatives. Le service relit sous verrou l’acteur actif et la personne. Un tiers doit être administrateur actif. Les fermetures sont sérialisées, notamment pour éviter que deux administrateurs se ferment réciproquement à partir de droits devenus périmés. Le service refuse la fermeture du dernier administrateur actif. Aucun compte utilisateur réel n’a été fermé durant ce travail ; seuls des comptes synthétiques ont servi aux tests.

L’interface personnelle FR/EN/AR explique la conservation, demande le mot de passe et une confirmation. Les libellés administratifs ont été corrigés. Les anciens noms internes `eraseAccount`/`erasePerson` sont conservés pour limiter la rupture API, mais le résultat est maintenant `{closed:true,retainedCredentials:number}`. Le champ `deletedCredentials` et la promesse d’un effacement complet sont retirés.

## Limites et suite

Cette fermeture n’est pas un traitement complet d’une demande d’effacement de données personnelles. Les pièces, inscriptions, archives et historiques peuvent toujours contenir des informations identifiantes ; aucune durée de purge ou conclusion de conformité n’est inventée. Il reste à livrer le dépôt/suivi des demandes de confidentialité, leur instruction, les règles de conservation applicables et les actions autorisées sur chaque catégorie de données. La fermeture ne résilie pas automatiquement les abonnements des compagnies. Les comptes sans mot de passe doivent passer par un traitement administratif.

Pas de reconstitution des fermetures anciennes, ni de réparation d’un éventuel effacement partiel effectué par l’ancien code. La règle empêchant la réactivation s’applique aux nouvelles fermetures enregistrées.

## Vérification

282 tests réussis, dont 208 PostgreSQL ; TypeScript et build réussis. Trois nouveaux scénarios SQL couvrent mot de passe incorrect, fermeture personnelle via route, profil retiré, version de session avancée, preuves et examens conservés, affiliation terminée, cookie supprimé, réactivation/suppression de journal refusées, rollback complet lors d’une erreur SQL d’audit et fermeture concurrente de deux administrateurs avec une seule réussite. Le navigateur n’a pas été testé.

Construction Docker et recette complète avec redémarrage, sauvegarde/restauration réussies. Image `sha256:9fe0321417c881524951b2edadfe3cd2c4907dbc67bd0e740fe3dbd1d275a62c` ; ressources de recette supprimées. Aucun déploiement.

## Contrôles d’accès après fermeture — lot 104

Le téléchargement privé relit désormais le compte depuis PostgreSQL, exige un statut actif et la même version de session, puis utilise le rôle actuel. Fournir un ancien objet utilisateur actif ou administrateur ne suffit plus. Ce contrôle précède les branches certificats, factures, passeport, agrément, vérification et médias de cours.

`requireEnrollment` relit également le statut actuel du compte. Les réservations de sessions et webinaires ainsi que l’annulation personnelle de réservation verrouillent le compte en lecture partagée dans leur transaction, avant le verrou de séance ; une fermeture qui modifie ce compte est donc sérialisée avec ces opérations. Les contrôles de capacité et d’habilitation pédagogique restent appliqués.

282 tests réussis (208 PostgreSQL), TypeScript/build réussis. Tests existants renforcés : accès au fichier et à l’inscription avant fermeture puis refus après fermeture avec le même objet utilisateur ; nouvelles réservations refusées ; rôle admin fabriqué ou retiré refusé, administrateur réel accepté ; ancienne version de session refusée et nouvelle acceptée. La fixture unitaire d’accès pédagogique représente désormais explicitement un compte actif. Pas de migration/UI/nouvelle recette Docker ; dernière recette complète au lot 103.

Ces vérifications ne constituent pas un audit exhaustif de tous les traitements déjà en cours ou des jetons émis par des prestataires externes. Les liens de visioconférence déjà délivrés gardent notamment leur propre échéance ; aucun mécanisme de révocation prestataire n’est inventé ici.
