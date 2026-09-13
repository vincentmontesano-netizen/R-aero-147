# Refonte R-AERO 147 — plan de réalisation

Objectif conservé : plateforme web opérationnelle pour organisme Part-147, apprenants et compagnies clientes. Référence de gouvernance : `../CLAUDE/CLAUDE.md` et `../CLAUDE/ARCHITECTURE.md`. Le `todo.md` historique décrit la V1 ; ses cases ne constituent pas une validation de la refonte.

## Périmètre et preuves attendues

| Domaine | Résultat à livrer | Vérification nécessaire |
| --- | --- | --- |
| Landing et expérience | Nouvelle identité aéronautique cohérente, navigation simple, mobile, FR/EN/AR, catalogue et offres | Build, contrôle des routes, parcours utilisables |
| Utilisateurs et organisations | Authentification robuste, invitations, rôles, isolation des compagnies, administration | Tests positifs et accès croisés sur base réelle |
| Formation | Chapitres complexes, médias, QCM de chapitre, examen final, progression, reprises, versioning | Parcours inscription → chapitres → examens → certificat |
| Studio IA interne et B2B | Texte, images, son, vidéo, QCM, relecture humaine et publication contrôlée | Appels de services configurés, isolation des contenus et suivi des erreurs |
| Conférence et distanciel | Planning, salles privées, animateurs, présence, interaction, replay | Accès et parcours réels avec service de visioconférence |
| Vault personnel | Documents privés, partage explicite, expiration et traçabilité | Tests téléchargement/partage/révocation, stockage privé |
| Paiements | Stripe, formules, abonnements, factures, portail client | Webhooks signés, idempotence, échecs, renouvellements et annulations |
| KYC / KYB | Dossiers particuliers et compagnies, pièces, revue, statuts, demandes de complément | Cycle complet et restrictions de visibilité |
| Agrément Part-147 | Espace réservé ADMIN, périmètres, responsables indépendants, MTOE, audits, actions, preuves | RBAC, historique non destructif, rapprochement avec sources EASA actuelles |
| Exploitation | Configuration documentée, migrations, sauvegarde/restauration, supervision, déploiement | Build et tests ; services externes réels configurés ; restauration vérifiée |
| Recherche concurrentielle | Comparaison des offres Part-147 et décisions produit motivées | Sources publiques actuelles citées, aucune revendication d’agrément inventée |

## Ordre de réalisation

1. Vérifier et sécuriser les fondations existantes : inscriptions, examens, certificats, paiements, stockage, autorisations du studio.
2. Refaire les surfaces publiques et les espaces apprenant / compagnie / administration autour de parcours complets.
3. Compléter les modèles et workflows absents : QCM par chapitre, KYC/KYB, agrément, IA vidéo et gouvernance éditoriale.
4. Exécuter les parcours intégrés, corriger les défauts et préparer l’exploitation.
5. Configurer les services externes disponibles, vérifier le déploiement adapté à Express/PostgreSQL. Ne pas déclarer la plateforme opérationnelle sur la seule base d’une maquette ou de tests simulés.

## Journal — 13 septembre 2026

- Reprise : dossier source sans `.git`, sans `node_modules`, sans manifeste Sites. Pas de preuve d’un précédent tour de réalisation dans ce dossier ; audit initial réalisé sur les fichiers.
- Dépendances installées depuis le lockfile. Baseline : typecheck réussi, 25 tests réussis (mocks, pas une preuve de fonctionnement en base).
- Défauts constatés : accès de formation non liés au propriétaire, corrigés de QCM exposés, certification à la fin des slides, timer et nombre de tentatives non imposés à la soumission.
- Correctifs réalisés : contrôle des inscriptions et dates d’accès, projection sans corrigé, certificat conditionné à une tentative réussie, session d’examen liée au candidat et consommée en transaction, verrouillage des démarrages concurrents.
- Validation de ce lot : `pnpm check` et `pnpm build` réussis ; 35 tests réussis dont 5 contre PostgreSQL 16 isolé. Tests : démarrages concurrents réutilisent la session, soumissions concurrentes ne créent qu’un résultat, refus des sessions étrangères, expiration, limite de tentatives, refus du certificat sans réussite.
- Environnement de test : conteneur `raero-refonte-test-db`, PostgreSQL sur `127.0.0.1:55477`, base `raero_test`. Base jetable sans données personnelles ; aucun autre conteneur modifié.
- Commande de vérification intégrée : `RAERO_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55477/raero_test pnpm test`. Sans cette variable les 5 tests PostgreSQL sont explicitement ignorés.
- Limites à traiter dans le prochain lot examens : sauvegarde serveur des réponses pour soumission automatique à échéance (actuellement une réponse reçue hors délai échoue), snapshot immuable des questions/seuils par session, QCM de chapitre distincts du final, prérequis serveur avant final, chronométrage pédagogique fiable.
- Autres priorités de sécurité repérées à auditer : facture par identifiant sans contrôle propriétaire, autorisations du studio B2B, fichiers du vault, sessions JWT et comptes suspendus durant 2FA.
- Le build signale un bundle client de 1,4 Mo : prévoir découpage des routes pendant la refonte UX.
- Aucun déploiement : application Express/PostgreSQL existante, pas de manifeste Sites ; hébergement à adapter après validation globale. La compétence Sites hosting a été consultée, aucun projet externe créé.
- La refonte globale reste en cours. Aucun agrément, paiement réel ou fonctionnement des fournisseurs externes n’est déclaré vérifié.

### Lot 2 — confidentialité du vault et des factures

- Le tour précédent est classé **progression** : code modifié et vérifié. Reprise de ce lot depuis les fichiers réels.
- `/storage/passport/*` et `/storage/invoices/*` exigent désormais une session authentifiée et un droit en base à chaque téléchargement. Factures : propriétaire ou ADMIN. Vault : propriétaire, ADMIN, ou manager avec affiliation active commune et consentement actif du propriétaire. Les anciens liens ne contournent plus une révocation.
- Téléchargements privés sans cache partagé, pièces jointes, `nosniff`, CSP sandbox ; chemins traversants et liens symboliques refusés, y compris un alias public vers une pièce privée.
- Génération de facture liée au propriétaire de la commande ; historique des commandes filtré en SQL sans charger les profils utilisateurs des autres acheteurs.
- La vérification publique d’un certificat renvoyait auparavant l’enregistrement utilisateur complet. Elle ne sélectionne désormais que le nom, et les tests excluent les secrets de connexion.
- Validation : 44 tests, dont 9 tests PostgreSQL (examens + confidentialité), 4 tests de la route HTTP de stockage et 1 test des chemins. TypeScript et build vérifiés après modifications.
- Portée : les certificats publiquement vérifiables et les médias pédagogiques conservent leur comportement public actuel. L’isolation des médias du studio B2B reste à traiter dans son modèle de droits. L’archivage non destructif des documents du vault reste à implémenter ; le lot ne modifie pas encore cette suppression historique.
- Facturation non déclarée prête en production : identité légale/numérotation, PDF multi-page, mode démo implicite, autorisation des abonnements et cycle des webhooks restent à reprendre.
- Prochaines étapes produit : refonte des surfaces publiques et navigation des espaces, puis parcours de vérification KYC/KYB avec stockage privé ; conserver en parallèle les tâches examens ouvertes ci-dessus.

### Lot 3 — nouvel accueil et navigation publique

- Tour précédent classé **progression** : confidentialité du stockage vérifiée. Nouvelle inspection des fichiers avant cette refonte.
- Accueil reconstruit : direction bleu nuit / blanc / ambre, typographie sans empattement, trois entrées (technicien, responsable formation, créateur), formations publiées, parcours d’apprentissage, espace compagnie, offres, FAQ, ressources et contact.
- Contenus complets FR/EN/AR dans `client/src/content/home.ts`, règles RTL, navigation mobile, sélecteur de langue accessible, lien d’évitement, focus, FAQ native au clavier, vidéo avec pause et respect initial de la préférence de mouvement réduit.
- Offres et FAQ conservent leur source administrable ; formations vedettes branchées sur tRPC ; états de chargement, erreur/reprise et catalogue vide. Catalogue PDF conservé avec affichage d’erreur.
- Retrait de l’accueil des chiffres non justifiés et des déclarations de certification/agrément non prouvées. Cela ne corrige pas encore les revendications historiques d’autres pages ou PDF.
- Vidéo existante réutilisée ; couverture JPEG extraite localement dans `client/public/brand/training-hero.jpg`. Image inspectée : avion en vol sur ciel bleu.
- Routes secondaires chargées à la demande. Build : fichier JS principal passé de 1 406,53 Ko à 695,90 Ko (207,07 Ko gzip) ; les pages administration et studio sont séparées. Un avertissement de taille subsiste.
- Vérifications : `pnpm check`, `pnpm build` réussis ; HTTP 200 pour `/`, le module Home et la couverture. Pas de contrôle visuel navigateur effectué à ce stade ; la compétence Sites réserve le test navigateur à une demande explicite. L’outil `open_in_codex` n’est pas disponible dans cette session.
- Aperçu lancé sur `http://localhost:3174/`, session exec `78370`, base PostgreSQL de test sans données client. Revalider le processus avant toute réutilisation ; ne pas supposer qu’il est encore actif.
- Sources et décisions produit : `docs/product-references.md` (Lufthansa Technical Training et Airbus, pages officielles). Benchmark initial, encore à approfondir.
- Pas de déploiement de cette tranche : la plateforme complète demandée reste inachevée. Prochain lot : KYC/KYB et parcours administratifs avec preuves privées, puis reprise des examens et des droits du studio.

### Lot 4 — parcours documentaire KYC / KYB

- Tour précédent classé **progression** : accueil et navigation construits, build vérifié. Reprise sur les modèles réels avant ce lot.
- Ajout des dossiers KYC/KYB, pièces et événements. Un dossier par sujet, brouillon modifiable, soumission verrouillée, demande de complément, refus et validation motivée. Le KYB exige une affiliation active MANAGER et une organisation active.
- Validation réservée à un ADMIN indépendant : refus de l’auto-revue, des contributeurs et des administrateurs affiliés à la compagnie. Décisions et créations concurrentes sérialisées par verrous de transaction.
- Pièces PDF/PNG/JPEG jusqu’à 8 Mo, signature vérifiée ; stockage privé dans `verification/`, accès réévalué à chaque téléchargement. Archivage non destructif avec révocation du lien ; historique des anciennes valeurs conservé.
- Migration additive `20260913_verification.sql` : index et trigger interdisant les modifications/suppressions/truncate de l’historique. Commande `pnpm db:migrate`, journal de checksums et transaction ; intégration dans l’entrée Docker après `db:push`. Migration appliquée puis rejouée sans réapplication.
- Interface `/verifications` accessible au menu utilisateur : formulaire KYC/KYB, pièces, envoi, motifs et historique ; bouton ADMIN pour la file de revue. Libellés FR/EN/AR. Documentation : `docs/verification-workflow.md`.
- Correction complémentaire critique : route de stockage limitée aux namespaces applicatifs ; fichiers cachés et opérationnels refusés, dont `.jwt_secret`. Test HTTP sur un secret factice, sans consultation de secret réel.
- Validation : 53 tests réussis dont 16 PostgreSQL réels, TypeScript et build réussis. HTTP 200 pour la nouvelle page. Pas de validation visuelle navigateur effectuée.
- Limites documentées : revue interne, pas de fournisseur KYC externe ni de contrôles registre/présence/screening ; renouvellement/expiration, politique de conservation, notifications, pagination et antivirus à compléter. Aucun paiement bloqué automatiquement par ce statut à ce stade.
- Reste global : agrément Part-147 ADMIN, parcours complets examens/chapitres, droits et production du studio IA, paiements/abonnements/factures, distanciel, exploitation et validation intégrée. Les lots achevés ne prouvent pas la plateforme complète opérationnelle.

### Lot 5 — registre d’agrément Part-147 réservé ADMIN

- Tour précédent classé **progression** : KYC/KYB développé et testé. Réinspection du code et des consignes CLAUDE avant ce lot ; sources EASA officielles consultées, consignées dans `docs/approval-register.md`.
- Nouveau registre opérateur `/admin/approval`, séparé des clients KYB et inaccessible aux rôles utilisateur, instructeur et manager d’entreprise (API et fichiers inclus).
- Dossier organisme : autorité, référence, périmètre/limitations, sites, dirigeant responsable, responsable formation, responsable qualité. Personnel actif ; séparation formation/qualité en validation et contrainte PostgreSQL. Les modifications remettent le dossier en préparation.
- Statuts factuels et motivés. L’enregistrement d’un agrément exige une référence et des versions explicitement choisies de la décision d’autorité et du MTOE. La plateforme ne délivre pas d’agrément et n’en déduit pas une conformité globale.
- Versions documentaires privées pour agrément, MTOE, périmètre, personnel, audits et preuves. Append-only côté application et triggers DB contre modification/suppression des enregistrements documentaires et événements.
- Écarts : classification, constat, référence, responsable, échéance, cause racine, action corrective, preuve, vérification d’efficacité et clôture indépendante. Verrou de transaction contre doubles clôtures ; dossier clos non modifiable via les API.
- Interface FR/EN/AR, indicateurs écarts ouverts/retards, quatre rubriques, historique affichant les différences avant/après.
- Migrations additives `20260913_approval.sql` et `20260913_approval_evidence.sql` appliquées au PostgreSQL local de test, incluses dans `db:migrate`.
- Validation : 62 tests réussis dont 21 PostgreSQL réels ; TypeScript et build réussis. API anonyme refusée. Contrôle visuel navigateur et exploitation réelle toujours non vérifiés.
- Limites et suite du module : périmètres structurés par catégorie/type/site, habilitations instructeurs/examinateurs et nominations, cycle de revue documentaire, programme d’audit périodique, notifications et exports. Les seules pièces jointes ne prouvent pas la validité matérielle d’une décision d’autorité.
- Priorité suivante : remettre le parcours e-learning en conformité avec l’objectif produit (QCM de chapitre distincts, examen final, sauvegarde serveur des réponses, snapshots) puis compléter le studio B2B et les paiements. Objectif global conservé et non achevé.

### Lot 6 — sauvegarde et stabilité des sessions d’examen

- Tour précédent classé **progression** : registre ADMIN livré et testé. Relecture des services et du lecteur avant ce lot.
- Les nouvelles sessions figent la banque servie et le seuil de réussite. Un trigger interdit de modifier ce snapshot ou son rattachement candidat/inscription/formation. Les changements éditoriaux ultérieurs ne modifient plus la notation de ces sessions.
- Sauvegarde serveur des réponses avec numéro de révision (compare-and-set), contrôle du candidat, des identifiants de question et de l’échéance. Une sauvegarde retardée ou provenant d’une autre fenêtre ne peut pas écraser silencieusement les réponses plus récentes.
- Lecteur : autosauvegarde sérialisée, reprise des réponses, indicateur enregistré/en cours/erreur FR/EN/AR et reprise manuelle après échec. À l’échéance, seules les réponses déjà enregistrées sont utilisées.
- Finalisation des sessions expirées au démarrage du serveur, toutes les 30 secondes et avant une reprise. Résultat conservé même si le navigateur a été fermé. Soumission devenue idempotente : plusieurs requêtes renvoient le même résultat sans créer plusieurs tentatives.
- Une réussite finalisée côté serveur est restituée à la reprise sans ouvrir une nouvelle tentative. Les limites de tentatives restent imposées côté serveur.
- Migration `20260913_exam_answers.sql` appliquée. Validation : 65 tests réussis dont 24 PostgreSQL réels, TypeScript et build réussis. Tests supplémentaires : édition de banque/seuil pendant une session, refus de modification du snapshot, reprise, conflits de révision, sauvegarde hors délai et correction après fermeture.
- Limites : anciennes sessions sans snapshot gardent le mécanisme historique de lecture de banque ; aucune reconstitution historique n’est présentée comme exacte. Le traitement périodique tourne dans le processus applicatif et doit être supervisé. Les erreurs sur une session héritée dont la banque manque restent à isoler dans une file de revue pour éviter qu’elles retardent le lot suivant. Les réponses non transmises avant l’échéance ne peuvent pas être récupérées.
- Prochaine tranche : QCM de chapitre séparés du final, seuils/tentatives par chapitre, progression validée côté serveur et prérequis du final. Ces exigences explicites ne sont pas encore considérées achevées.

### Lot 7 — QCM de chapitre distincts et prérequis du final

- Session et résultat rattachés à un chapitre ou au final. Banques, historique, reprises et limites de tentatives isolés par périmètre. Rattachement de session immuable en base.
- Seuil, tentatives et durée configurables par chapitre dans l’éditeur. Lecteur avec démarrage explicite, sauvegarde/reprise et message de réussite de chapitre. Supports diapositives préservés dans les chapitres.
- Réussite du QCM requise pour compléter un chapitre. Le final contrôle les réussites réelles de tous les chapitres obligatoires ; un pourcentage ou une ancienne marque de complétion ne suffit pas. La réussite d’un chapitre ne certifie pas la formation.
- Migrations additives `20260913_chapter_quizzes.sql` et `20260913_chapter_policy.sql` appliquées. Documentation et limites : `docs/chapter-assessments.md`.
- Tests : 66 réussis, dont 31 PostgreSQL réels. Nouveau parcours intégral couvrant séparation des banques/tentatives, prérequis, reprise, idempotence et certification réservée au final.
- Suite : publication/versionnement du cursus, préparation des anciens contenus sans QCM de chapitre, studio B2B et droits. L’objectif global reste actif ; cette tranche ne rend pas toute la plateforme opérationnelle.
- Validation complémentaire : `pnpm check` et `pnpm build` réussis. Avertissement existant de bundle principal >500 Ko (699,89 Ko) ; pas de contrôle visuel navigateur dans ce lot.

### Lot 8 — cloisonnement du studio par auteur et compagnie

- Tour précédent classé **progression** : parcours de chapitre testé et compilé. Réinspection du studio : les managers pouvaient accéder à toutes les formations, sans propriétaire enregistré.
- Propriétaires utilisateur/organisation ajoutés aux formations créées par le studio ou les modèles. Migration `20260913_course_ownership.sql` appliquée ; anciens contenus réservés aux ADMIN dans le studio, sans attribution arbitraire.
- Contrôles des listes, lectures, créations/modifications/suppressions/réordonnancements de diapositives et publication. Affiliation MANAGER active et compagnie active exigées ; le créateur perd également l’accès si révoqué. Interdiction de déplacer une diapositive entre formations ou de rattacher un objectif/chapitre étranger.
- Contenus d’organisation exclus des lectures catalogue, slug, panier et sessions publiques liées. Brouillons retirés de la consultation publique par slug.
- 69 tests réussis, dont 34 PostgreSQL réels. Nouveau test de cloisonnement via services et routeur réel, révocation/suspension, transferts et exclusion catalogue/panier.
- Documentation : `docs/studio-ownership.md`. Restent notamment le parcours interface multi-organisation, l’édition B2B complète, la publication revue/versionnée, les médias privés et l’archivage/audit des modifications. Ne pas présenter le studio complet comme achevé.
- TypeScript et build de production réussis ; avertissement de taille du bundle principal toujours présent. Aucun déploiement ni contrôle visuel navigateur dans ce lot.

### Lot 9 — éditeur B2B de chapitres/QCM et préparation à la publication

- Tour précédent classé **progression** : isolation du studio testée. Inspection du lecteur, de l’éditeur ADMIN et des chemins de publication avant ce lot.
- Nouveaux endpoints `maker.content` cloisonnés pour chapitres, objectifs et questions ; mises à jour strictes dérivées des schémas de création. Éditeur partagé intégré au studio et utilisant ces endpoints. Rattachement des diapositives aux chapitres dans leur formulaire.
- Rapport de préparation FR/EN/AR : supports, QCM de chaque chapitre, final, paramètres d’examen, validité des corrigés, rattachements. Actualisation après édition et bouton de revérification.
- Contrôle commun avant publication dans `updateTraining`, y compris route ADMIN ; création directement publiée refusée. Rapport visible ne remplace pas la validation serveur.
- Suppressions du nouveau routeur de contenu refusées et boutons retirés de l’éditeur, en attendant l’archivage. Les anciennes routes ADMIN et diapositives doivent encore être migrées ; ne pas prétendre le système entier non destructif.
- 71 tests réussis, dont 36 PostgreSQL réels. Parcours compagnie créé → chapitre → questions → affectation slide → publication, refus inter-compagnie, banque invalide et publication prématurée.
- Documentation `docs/course-publication.md`. Priorité suivante : archivage/historique du contenu, revue et versionnement par inscription ; les modifications directes post-publication et leur concurrence restent une limite explicite. L’objectif global est conservé, non achevé.
- TypeScript et build réussis ; avertissement existant de bundle >500 Ko. Pas de validation visuelle navigateur ni de déploiement dans ce lot.

### Lot 10 — archivage pédagogique verrouillé

- Tour précédent classé **progression** : édition B2B et préparation à la publication testées. Réinspection des suppressions historiques : cascades supprimant notamment progressions et objectifs de certificat identifiées puis retirées du chemin d’archivage.
- Formations, chapitres, objectifs, questions et diapositives archivés avec `archivedAt` ; lectures actives filtrées. Les anciennes routes ADMIN et diapositives utilisent également l’archivage. Actions interface renommées et réactivées comme archivage dans l’éditeur.
- Formation archivée dépubliée, nouvelles inscriptions refusées, accès des inscrits et correction de leur examen préservés. L’archivage d’un élément isolé reste interdit pour une formation publiée ou déjà suivie, dans l’attente des versions de cursus.
- Liens actifs à réaffecter avant archivage des chapitres/objectifs ; anciens liens archivés conservés. Validation PostgreSQL des rattachements et verrou formation partagé avec les nouvelles inscriptions.
- Événements d’archivage transactionnels avec auteur et états avant/après. Historique immuable ; route de lecture cloisonnée. DELETE/TRUNCATE interdits en base sur les cinq tables pédagogiques et l’historique ; lignes archivées verrouillées. Mises à jour ordinaires ne peuvent pas définir `archivedAt`.
- Migrations `20260913_content_archive.sql` et `20260913_archive_links.sql` appliquées. 74 tests réussis, dont 39 PostgreSQL réels ; tests de conservation, examen après archivage, absence de nouvelles inscriptions/rattachements, droits, immutabilité et idempotence.
- Documentation : `docs/content-archive.md`. L’historique concerne l’archivage et ne prouve pas encore l’audit de toute édition. Interface d’archives, versionnement/revue, conservation opérationnelle et audit des suppressions hors contenu pédagogique restent à poursuivre. Objectif global non achevé.
- Validation finale : TypeScript et build réussis ; 8 tests ciblés du studio/archivage repassés après ajout de la protection contre l’écriture directe d’`archivedAt`. Avertissement de taille du bundle principal persistant. Aucun déploiement ni contrôle visuel navigateur dans ce lot.

### Lot 11 — versions publiées et cursus par inscription

- Tour précédent classé **progression** : archivage pédagogique conservant les preuves. Lecture des résolutions de formation, lecteur et examens avant ce lot.
- Publication applicative créant une version immuable complète (fiche, chapitres, supports, objectifs, banques), auteur/date/numéro. Verrou formation pour lecture cohérente avec les mutations pédagogiques.
- Trigger fixant la version courante à chaque nouvelle inscription ; rattachement formation/version immuable. Les inscriptions sans version restent explicitement historiques, sans reconstruction rétroactive.
- Lecteur, supports, prérequis, paramètres d’examen et retries utilisent la version inscrite. Lecture privée par inscription, corrigeant la dépendance au catalogue qui bloquait les formations internes/archivées. Questions projetées sans corrigés ; objectifs agrégeant les résultats de leur périmètre chapitre/final.
- Métadonnées et objectifs de certificat repris de la version. L’archivage isolé de contenu est permis après dépublication si toutes les inscriptions sont versionnées ; elles conservent leur élément dans le snapshot.
- Studio : versions publiées listées et bouton de nouvelle publication. Lecteur : numéro ou mention historique FR/EN/AR.
- Migration `20260913_course_versions.sql` appliquée. 75 tests réussis, dont 40 PostgreSQL réels ; test intégral de deux publications avec édition, chapitre supplémentaire, inscriptions distinctes, support figé, tentatives, refus inter-candidat, archivage et immutabilité.
- Documentation : `docs/curriculum-versions.md`. Restent revue indépendante, catalogue aligné sur publication, distribution interdisant les brouillons, traitement des dossiers historiques, octets médias immuables/privés et audit de toute édition. Objectif global conservé, non achevé.
- Validation finale : 14 tests ciblés studio/stockage repassés après intégration de la version aux certificats et objectifs, TypeScript corrigé puis réussi, build réussi. Avertissement de taille du bundle principal persistant. Aucun déploiement ni contrôle visuel navigateur dans ce lot.

### Lot 12 — distribution interne et préservation des renouvellements

- Tour précédent classé **progression** : versions inscrites testées. Inspection des attributions : modification de salarié sans contrôle d’organisation et remise à zéro des anciennes inscriptions expirées identifiées.
- Gestion du roster : affiliation manager active et compagnie active pour liste/création/import ; modification vérifiant l’organisation réelle du salarié et des champs stricts, sans transfert de compte/compagnie arbitraire.
- Attribution depuis le studio compagnie aux comptes affiliés actifs : version publiée obligatoire, validation atomique de toute la sélection, concurrence sérialisée, accès existants conservés. Origine organisation/auteur immuable, lien salarié conservé si disponible.
- Accès pédagogique d’une attribution compagnie soumis à l’affiliation et au statut compagnie actuels, sans effacement des preuves lors d’une révocation. Origine des credentials utilisant aussi l’organisation explicite de l’inscription.
- Renouvellement d’accès créant une nouvelle inscription au lieu de réinitialiser les résultats antérieurs. Le chemin abonnement transmet l’organisation et vérifie l’affiliation. Les activations ne repoussent plus les échéances de qualification ; nouvelles récurrences sans réussite inventée.
- Migration `20260913_training_assignments.sql` appliquée. 78 tests réussis, dont 43 PostgreSQL réels ; tests d’accès inter-compagnie, attribution atomique/concurrente, version, révocation, origine immuable et conservation des inscriptions/dates.
- Documentation : `docs/company-distribution.md`. Suite : facturation réelle et licences, revue pédagogique, interface multi-organisation, comptes invités, notifications et supervision. Chemins Stripe de démonstration explicitement identifiés comme non opérationnels pour la production ; objectif global non achevé.
- Validation finale : TypeScript et build réussis ; 3 tests ciblés de distribution repassés après ajout de l’origine compagnie au renouvellement automatique. Avertissement de taille du bundle principal persistant. Aucun déploiement ni contrôle visuel navigateur dans ce lot.

### Lot 13 — suppression des paiements simulés et confirmation vérifiée

- Tour précédent classé **progression** : distribution/renouvellements testés. Inspection Stripe et documentation officielle sur fulfillment/webhooks avant ce lot.
- Suppression des activations automatiques sans clé Stripe pour panier, devis et abonnement. Pas de commande créée ou abonnement activé en cas de configuration absente.
- Fonction de règlement commune au retour navigateur et aux événements signés immédiats/différés. Exige paiement reçu, commande/session/propriétaire/référence client cohérents, montant et devise exacts. Une session terminée non payée ne donne plus accès.
- Transaction verrouillant la commande, attribution et `fulfilledAt` ensemble : idempotence sous concurrence, pas de résurrection d’une commande annulée/remboursée. Version de ligne de commande figée, reprise de cette version par l’inscription même après republication/archivage.
- Webhook non configuré/signature invalide refusés. Retours contraints par `PUBLIC_APP_URL` HTTPS en production (loopback permis localement). Gestion abonnement/portail réservée au manager actif ; suppression du toast d’activation fondé sur l’URL seule.
- Migration `20260913_payment_fulfillment.sql` appliquée. 83 tests réussis, dont 48 PostgreSQL réels ; tests SDK de signature sans réseau/débit, paiement différé, montant/devise/utilisateur/session falsifiés, idempotence et version achetée.
- Documentation `docs/stripe-verification.md`. Priorité suivante : registre et attribution de licences multiples, création/reprise de checkout, cycle abonnement/refund, factures et notifications durables. Limite provisoire explicitée d’une place par ligne et absence de promotion panier rapprochée. Aucun test de paiement réel, objectif global non achevé.
- Validation finale : TypeScript et build réussis ; avertissement de taille du bundle principal persistant. Aucun paiement réel, déploiement ou contrôle visuel navigateur dans ce lot.

### Lot 14 — registre et attribution des places payées

- Tour précédent classé **progression** : règlement ponctuel vérifié, avec limitation temporaire de quantité explicitée. Inspection checkout et attribution avant ce lot.
- Paiement compagnie créant une licence par place, avec version achetée, acheteur/compagnie, ligne et rang uniques. Paiement individuel attribuant sa place automatiquement. Origine/attribution immuables et suppression physique interdite.
- Panier et conversion ADMIN de devis : organisation d’achat explicite et autorisée ; quantités entreprise 1 à 100 par ligne. L’acheteur compagnie n’est plus automatiquement inscrit à toutes les places.
- Page `/licences` accessible au menu, disponibilité, bénéficiaire et version ; attribution à un membre actif par manager autorisé. Transactions/concurrence, refus des utilisateurs extérieurs, pas de seconde place consommée si l’apprenant a déjà un accès actif.
- Inscription liée à une licence payée recevant sa version d’achat, même si le contenu courant est archivé. Accès pédagogique bloqué pour commande non payée/remboursée ou licence révoquée, en conservant les preuves.
- Migration `20260913_training_licenses.sql` appliquée. 84 tests réussis, dont 49 PostgreSQL réels ; parcours trois places, concurrence, stocks complets, bénéficiaires, immutabilité et révocation.
- Documentation `docs/training-licenses.md`. Restent notamment pagination (>1 000 places), attribution groupée, création/reprise checkout, remboursement partiel/contestation, factures, cycle abonnement et notifications. Pas de débit ni de compte Stripe réel utilisé. Objectif global conservé, non achevé.
- TypeScript et build réussis ; avertissement de taille du bundle principal persistant. Aucun déploiement ni contrôle visuel navigateur dans ce lot.

### Lot 15 — rapprochement des remboursements partiels/intégraux

- Tour précédent classé **progression** : licences payées testées. Documentation officielle Stripe consultée ; l’ancien `charge.refunded` traitait les remboursements partiels comme intégraux.
- Journal immuable d’observations signées avec montants, devise, charge/PaymentIntent et date d’événement. Répétitions idempotentes, sélection de l’observation récente et contrôles de cohérence avec la commande.
- Partiel conservant les accès et affichant le cumul ; intégral marquant la commande remboursée et révoquant les licences sans effacer résultats/preuves. Révocation non effaçable.
- Remboursement reçu avant la confirmation Checkout conservé puis rapproché sous verrou PaymentIntent ; aucune place délivrée si intégral. Ancien événement ne rétablit pas l’accès.
- Historique et montant remboursé dans les tableaux de bord utilisateur/ADMIN, lecture réservée aux acteurs autorisés.
- Migration `20260913_refund_observations.sql` appliquée. Échec intermédiaire des tests par attentes de verrous DDL : migrations retirées des suites concurrentes, exécutées une fois dans `testGlobalSetup.ts` avant les workers. Nouvelle exécution complète : 86 tests réussis, dont 51 PostgreSQL réels.
- Documentation `docs/refund-reconciliation.md`. Restent remboursements individuels/échoués, avoirs, contestations, décisions explicites sur places partiellement remboursées, abonnements et facturation. Aucun mouvement bancaire réel exécuté ; objectif global non achevé.
- Validation complémentaire du lot 15 : 8 tests ciblés, TypeScript et build réussis après l'ajout de l'historique privé. Avertissement de taille du bundle principal persistant.

### Lot 16 — création atomique et reprise du paiement panier

- Tour précédent classé **progression**. L'utilisateur absent dix heures ; poursuite autonome de l'objectif actif.
- Commande, lignes et requête Stripe figée créées dans une transaction ; prix/version relus avec verrou, montants en centimes, panier invalide entièrement rejeté.
- Verrou acheteur + empreinte commerciale réutilisant la commande identique en attente. Journal `checkout_attempts` immuable, clé Stripe et corps exact conservés après coupure réseau.
- Reprise de session enregistrée et bouton trilingue du tableau de bord, réservé à l'acheteur avec autorisation compagnie réévaluée. Expiration vérifiée annulant la commande pour permettre un nouvel achat ; session terminée rapprochée par le vérificateur existant.
- Fenêtre prudente de trois heures pour les requêtes sans identifiant local, session de quatre heures ; au-delà, rapprochement requis plutôt que création aveugle. Console de rapprochement à développer.
- Migration `20260913_checkout_attempts.sql` appliquée via le global setup. 90 tests réussis, dont 55 PostgreSQL réels ; TypeScript et build réussis. Avertissement de bundle principal toujours présent. Aucun paiement réel ni déploiement.
- Documentation `docs/checkout-recovery.md`. Restent notamment conversion de devis atomique/idempotente, changements de panier laissant une ancienne session, annulation explicite, rapprochement opérateur, abonnements, factures/avoirs et notifications durables. Les nouvelles commandes panier utilisent une référence commande, sans numéro aléatoire de facture avant paiement. Objectif global non achevé.

### Lot 17 — devis négociés atomiques et reprise partagée

- Tour précédent classé **progression** : panier/reprise validés. Inspection du chemin devis montrant des commandes et messages dupliqués possibles, création partielle et arrondi silencieux des tarifs.
- Conversion passant par la même préparation transactionnelle et requête Stripe figée que le panier ; contrôle ADMIN, acheteur actif lié au devis, compagnie et montants exacts en centimes.
- Verrou devis, réutilisation à conditions identiques, refus de modification pendant une commande en attente et de nouvelle conversion après règlement/remboursement. Version déjà achetée conservée lors des reprises.
- Commande/lignes/requête, liaison au compte, statut du devis et message de préparation créés ensemble. Un seul message sans URL périssable ; accès à la reprise depuis Mes devis et le tableau de bord.
- Deux échecs ciblés intermédiaires : sélection de la mauvaise collection pour une entrée cumulant panier/devis et assertion Promise sur garde synchrone. Corrigés avant validation finale.
- 93 tests réussis, dont 58 PostgreSQL réels ; TypeScript et build réussis. Tests couvrant concurrence, montants négociés, abandon atomique, acteur/acheteur interdits, décimales invalides, version et devis déjà payé. Avertissement de bundle principal persistant. Aucun appel Stripe réseau ou débit réel.
- Documentation `docs/checkout-recovery.md` mise à jour. Restent rapprochement opérateur des réponses perdues, expiration explicite, commandes historiques, abonnements, fiscalité/avoirs, notifications et les autres chantiers pédagogiques/Part-147 du plan. Objectif global non achevé.

### Lot 18 — rapprochement ADMIN des paiements perdus

- Tour précédent classé **progression** : conversion devis transactionnelle validée. Inspection montrant l’absence d’action opérateur pour les sessions non liées après expiration de la fenêtre de reprise.
- Commandes ADMIN : lecture de la session existante ou saisie de l’identifiant retrouvé dans Stripe ; contrôles serveur mode, session, commande, acheteur, montant et devise, refus de réaffectation/conflit.
- Charge associée relue avant activation : remboursements manquants rapprochés, accès non délivré si intégral et licences existantes révoquées ; partiel conservant l’accès. Contestation signalée empêchant l’activation par ce parcours.
- Expiration vérifiée annulant seulement la commande en attente ; paiement confirmé passant par l’attribution idempotente existante. Aucun nouvel appel de création de paiement.
- Migration `20260913_payment_reconciliation.sql` appliquée ; journal immuable des observations et interface trilingue avec les 50 dernières entrées ADMIN.
- 98 tests réussis, dont 63 PostgreSQL réels ; TypeScript et build réussis. Tests : concurrence, autorisation, données falsifiées, immutabilité, expiration, session déjà liée, refund absent/partiel/intégral et contestation. Avertissement de bundle principal persistant. Aucun appel Stripe réel, débit, remboursement ou déploiement.
- Documentation `docs/payment-reconciliation.md` et reprise checkout actualisées. Restent découverte automatique/preuve d’absence de session, expiration explicite, cycle contestation/refund échoué, abonnements, facturation/avoirs et chantiers pédagogiques/Part-147. Objectif global non achevé.

### Lot 19 — coffre documentaire archivé et traçable

- Tour précédent classé **progression** : rapprochement Stripe ADMIN validé. Retour au coffre documentaire ; inspection confirmant suppression physique des lignes et absence de contrôle serveur des fichiers.
- Archivage propriétaire remplaçant la suppression, conservation des preuves, onglet Archives trilingue et historique personnel. Documents archivés exclus du dossier compagnie et téléchargements managers refusés, y compris par anciens liens ; compagnie active désormais exigée pour le partage.
- Métadonnées des documents immuables, désarchivage et DELETE/TRUNCATE interdits. Dépôts/archives/consentements journalisés dans une transaction, concurrence idempotente.
- Fichiers PDF/PNG/JPEG jusqu’à 10 Mio, encodage/taille/signature/dates contrôlés, empreinte SHA-256 des nouveaux dépôts. Écriture stockage exclusive empêchant l’écrasement en cas de collision de nom ; aucune empreinte inventée pour l’historique.
- Migration `20260913_passport_archive.sql` appliquée. 102 tests réussis, dont 65 PostgreSQL réels ; TypeScript et build réussis. Test disque de collision conservant les octets d’origine et tests d’archivage/concurrence/confidentialité/consentement. Erreur TypeScript intermédiaire des types MIME corrigée avec contrôle client explicite.
- Documentation `docs/passport-archive.md`. Restent conservation/pseudonymisation, quarantaine/authenticité, fichiers orphelins, export intégral, pagination et autres chantiers pédagogiques/Part-147/abonnements/fiscalité. Avertissement de bundle principal persistant, aucun déploiement ni manipulation de pièces personnelles réelles. Objectif global non achevé.

### Lot 20 — périmètre des classes à distance et quiz en direct

- Tour précédent classé **progression** : coffre archivé et testé. Inspection des classes révélant des lectures/écritures sans contrôle d’inscription et des corrigés de quiz ouverts renvoyés aux apprenants.
- Contrôles serveur de compte actif, inscription non annulée et salle active sur présence, participants, échanges et votes. Accès pédagogique exigé pour séance payante/formation interne.
- Modération ADMIN ou instructeur dans le périmètre de la formation ; aucune modération globale de toutes les classes pour le seul rôle instructor. Contrôles appliqués aussi aux opérations ciblant un message/sondage par identifiant.
- Corrigés et répartition de quiz ouverts masqués côté apprenant ; choix individuels propres, bornes et clôture vérifiées. Verrous sérialisant votes/clôture et heartbeats simultanés.
- Listes publiques/personnelles privées d’adresses de salle/replay ; indicateur de replay conservé. Webinaires internes/non publiés exclus, plus de secours par adresse email dans les noms de participants.
- 105 tests réussis, dont 68 PostgreSQL réels ; TypeScript et build réussis. Aucun appel réel de visioconférence, déploiement ou contrôle visuel navigateur.
- Documentation `docs/live-classroom-access.md`. Restent authentification vidéo externe/Jitsi, replays privés, affectations/qualifications instructeurs, admissions/places/paiements de séances, assiduité probante et archivage. Les API protégées ne suffisent pas à sécuriser les salles externes actuelles. Objectif global non achevé.

### Lot 21 — présence observée sans crédit des longues absences

- Tour précédent classé **progression** : API de classe protégées. Inspection du calcul d’engagement montrant le crédit de toute la durée première/dernière connexion, même en cas d’absence prolongée.
- Journal immuable des intervalles serveur, crédit uniquement des écarts positifs ≤45 secondes, intervalle long conservé avec zéro crédit. Cumul exact puis minutes arrondies vers le bas, aucun historique inventé.
- Heartbeats navigateur déclenchés après entrée Jitsi et arrêtés à la sortie/fermeture ; écouteur de chargement retiré au démontage. Documentation officielle Jitsi consultée.
- Journal paginé dans le panneau formateur, lecture limitée aux modérateurs de la classe. Qualification explicite comme durée de connexion observée, sans prétendre à un émargement signé.
- Migration `20260913_live_presence.sql` appliquée. 106 tests réussis, dont 69 PostgreSQL réels ; TypeScript et build réussis. Test d’horloge maîtrisée couvrant interruption/reprise/concurrence, cumul, pagination et journal immuable. Aucun appel vidéo réel ou déploiement.
- Documentation `docs/live-classroom-access.md` complétée. Restent fournisseur vidéo authentifié, événements serveur signés, émargement/validation, rétention et les autres chantiers du plan. Avertissement de bundle principal persistant. Objectif global non achevé.

### Lot 22 — réservations de séances sans surallocation

- Tour précédent classé **progression** : intervalles de présence conservés et testés. Inspection des admissions révélant capacité non verrouillée, compteurs seuls et inscriptions possibles sur classes fermées.
- Transactions avec verrou séance/webinaire, comptage des inscrits réels distincts, répétition idempotente, dernière place attribuée une seule fois. Les annulations de séance libèrent la place sans effacer l’ancienne inscription.
- Refus des nouvelles inscriptions après début et sur classes annulées/terminées ; compte actif, formation publiée/non archivée, accès pédagogique pour séances payantes et formations internes.
- 109 tests réussis, dont 72 PostgreSQL réels ; TypeScript et build réussis. Tests de concurrence, répétition, capacité après annulation et états refusés. Aucun prélèvement ou événement réel créé.
- Documentation `docs/live-classroom-access.md` complétée. Restent invitations/liste d’attente/annulation journalisée, tarification spécifique des séances, notifications et contrôle des modifications de capacité ADMIN, en plus des autres chantiers ouverts. Avertissement de bundle principal persistant, aucun déploiement. Objectif global non achevé.

### Lot 23 — annulation personnelle des réservations et conservation

- Tour précédent classé **progression** : admissions transactionnelles testées. Ajout du parcours utilisateur de libération de place avant début.
- Mes réservations sur la page séances, annulation personnelle, historique conservé et capacité recalculée sous verrou. Refus d’annulation étrangère/tardive/de participation déjà constatée ; répétitions idempotentes.
- Événements immuables d’inscription/annulation, identité et états terminaux des inscriptions protégés en base. Ancienne suppression ADMIN remplacée par annulation conservant les inscriptions, libellés trilingues adaptés.
- Migration `20260913_session_cancellations.sql` appliquée. 110 tests réussis, dont 73 PostgreSQL réels ; TypeScript et build contrôlés. Tests de concurrence, propriétaire, échéance, conservation et annulation ADMIN. Aucun remboursement ni événement réel déclenché.
- Documentation `docs/live-classroom-access.md` complétée. Restent annulation webinaires, notifications, liste d’attente, tarification séance et tous les autres chantiers ouverts. Objectif global non achevé.

### Lot 24 — studio accessible aux managers multi-organisations

- Tour précédent classé **progression** : annulation de réservation conservant les traces. Inspection du studio révélant des gardes d’interface limitées aux anciens rôles globaux, alors que l’API autorisait déjà les affiliations MANAGER.
- Liste serveur des espaces actifs, interface et menu reconnaissant les managers affiliés sans rôle global spécifique. Sélecteur de destination transmis aux créations manuelles et IA, nom rappelé dans les formulaires et badges d’organisation des cours.
- Compagnie inactive/inexistante refusée à la création même ADMIN ; affiliation réévaluée côté serveur. Espace sélectionné révoqué désactivant la création sans transfert silencieux.
- Retour vers le bon espace utilisateur, choix FR/EN/AR, organisations inactives retirées de `me.organizations`.
- 111 tests réussis, dont 74 PostgreSQL réels ; TypeScript et build réussis. Test multi-compagnies avec rôle user, création ciblée, refus compagnie suspendue et révocation d’affiliation. Aucun appel fournisseur IA, déploiement ou contrôle visuel navigateur.
- Documentation `docs/studio-ownership.md` complétée. Restent revue pédagogique indépendante, médias privés et quotas IA, ainsi que les autres chantiers du plan. Avertissement de bundle principal persistant. Objectif global non achevé.

### Lot 25 — clôture des examens résistante aux sessions incohérentes

- Tour précédent classé **progression** : studio multi-organisations validé. Inspection du worker montrant qu’une seule erreur hors CONFLICT arrêtait tout le lot expiré.
- Traitement ordonné de 100 sessions, erreurs isolées, journal immuable avec code normalisé et reprise différée de cinq minutes ; les sessions différées ne saturent plus la tête du lot.
- Alerte conformité ADMIN sur les sessions encore non finalisées, sans réponses ni erreurs techniques brutes. Message apprenant adapté à un résultat en cours de traitement ; aucun contournement d’épreuve/note.
- Migration `20260913_exam_finalization_failures.sql` appliquée. 112 tests réussis, dont 75 PostgreSQL réels ; TypeScript et build réussis. Test banque incohérente suivie d’une session valide, journal, différé et absence de résultat fabriqué. Échec initial du nouveau test lié au nom de champ de révision corrigé avant validation.
- Documentation `docs/exam-expiry-worker.md`. Restent supervision externe, alertes durables, réparation contrôlée des historiques et tous les autres chantiers du plan. Avertissement de bundle principal persistant ; aucun déploiement. Objectif global non achevé.

### Lot 26 — revue pédagogique liée au contenu publié

- Tour précédent classé **progression** : finaliseur d’examens résistant aux erreurs validé. Inspection publication montrant l’absence de preuve rattachée au statut éditorial « approuvé ».
- Copie de revue figée, empreinte canonique, décision motivée immuable et refus d’auto-approbation propriétaire/demandeur. Réviseurs dans le périmètre courant : ADMIN ou autre manager compagnie autorisé.
- Porte centrale de publication e-learning exigeant une approbation correspondant au contenu, `reviewId` dans la version publiée. Modification de corrigé/politique/contenu invalidant la correspondance ; aucune revue rétroactive fabriquée.
- Interface studio : demandes, revues à examiner, copie consultable avec supports/objectifs/évaluations et conclusion. Nouveaux cours en statut éditorial draft par défaut.
- Migration `20260913_pedagogical_reviews.sql` appliquée. 114 tests réussis, dont 77 PostgreSQL réels ; TypeScript et build réussis. Quatre scénarios existants ont d’abord échoué avec la nouvelle porte obligatoire, puis ont été adaptés au véritable parcours de revue, sans bypass. Nouveaux tests d’indépendance, copie immuable, refus/reprise et changement invalidant l’approbation.
- Documentation `docs/pedagogical-review.md` et publication mise à jour. Restent qualifications réviseurs, audit de tous les contributeurs, révocation externe, médias figés, notifications/pagination, vérification visuelle et autres chantiers du plan. Cette revue interne ne vaut pas agrément Part-147. Avertissement bundle persistant, aucun déploiement. Objectif global non achevé.

### Lot 27 — retrait traçable d’une approbation pédagogique

- Tour précédent classé **progression** : revue figée et porte de publication e-learning validées. Complément du cycle pour une erreur découverte après approbation.
- Retrait motivé par acteur autorisé sur le cours, trace immuable distincte de la décision initiale, répétition idempotente.
- Même verrou que publication, approbation retirée inutilisable pour republier ; dépublication seulement si la version courante dépend de cette revue. Nouvelle copie/revue possible après retrait.
- Interface affichant le retrait et son motif, confirmation précisant conservation des preuves et accès existants.
- Migration `20260913_review_withdrawals.sql` appliquée. 115 tests réussis, dont 78 PostgreSQL réels ; TypeScript et build réussis. Tests concurrence, accès étranger, conservation, refus republication, nouvelle revue et version plus récente intacte.
- Documentation `docs/pedagogical-review.md` complétée. Restent rappel pédagogique des apprenants, notifications/mesures correctives, audit des contributeurs, médias privés et autres chantiers ouverts. Avertissement bundle persistant, aucun déploiement. Objectif global non achevé.

### Lot 28 — confidentialité des conversations d’assistance

- Tour précédent classé **progression** : retrait de validation pédagogique testé. Inspection assistance révélant un accès global aux tickets accordé aux instructeurs/company_managers.
- Lecture et réponse réservées au propriétaire du ticket ou ADMIN ; liste globale et changement de statut ADMIN uniquement. Accès aux propres tickets conservé quel que soit le rôle.
- Entrées bornées et priorités validées ; projections utilisateur limitées aux champs utiles au fil.
- 116 tests réussis, dont 79 PostgreSQL réels ; TypeScript et build réussis. Tests routeur réel couvrant refus étrangers et accès propriétaire/ADMIN. Aucun email ni message externe envoyé.
- Documentation `docs/support-access.md`. Restent délégation explicite, journal du support, notifications/archivage et autres chantiers du plan. Avertissement bundle persistant, aucun déploiement. Objectif global non achevé.

### Lot 29 — rapprochement des abonnements Stripe

- Tour précédent classé **progression** : confidentialité support validée. Inspection abonnement révélant formule issue des métadonnées, événements anciens appliqués directement et activation sur toute facture client.
- Rapprochement sérialisé PostgreSQL avec lecture courante Stripe, références compagnie/client strictes, refus de remplacement implicite d’abonnement. Factures autonomes ignorées ; facture échouée/payée ne fait que déclencher la relecture.
- Formule issue du prix récurrent EUR configuré, période d’article et dernière facture payée liées au même abonnement/client. Essais, prix inconnus/ambigus, lignes multiples, quantités invalides et périodes expirées sans activation. Recontrôle du statut avant nouvelle attribution sous verrou compagnie.
- 122 tests réussis, dont 85 PostgreSQL réels ; TypeScript et build réussis. Six nouveaux tests couvrent prix, références, paiement, obsolescence et concurrence. Échec initial lié au hook de remise à zéro du mock Vitest retournant accidentellement une fonction de nettoyage, corrigé. Aucun appel Stripe réel.
- Documentation `docs/subscription-reconciliation.md`, références officielles Stripe consultées. Restent provenance/suspension des inscriptions d’abonnement, quotas de places, remplacement contrôlé, journal/anomalies, Checkout durable et autres chantiers du plan. Les droits historiques déjà attribués ne sont pas automatiquement révoqués par ce lot. Avertissement bundle persistant, aucun déploiement. Objectif global non achevé.

### Lot 30 — provenance des accès financés par abonnement

- Tour précédent classé **progression** : rapprochement Stripe validé. Complément nécessaire : les inscriptions attribuées ne portaient pas leur source d’abonnement et restaient utilisables après résiliation.
- Identifiant d’abonnement immuable sur les nouvelles inscriptions, contraintes compagnie/salarié et exclusivité avec une commande/licence. Aucune provenance historique inventée.
- Portes d’accès apprenant vérifiant abonnement courant actif/non expiré et salarié actif ; résultats/progression conservés. Renouvellement du même abonnement réutilisable ; remplacement avec nouvelle inscription. Recherche d’un autre accès valide à la même formation si le premier est suspendu.
- Migration `20260913_subscription_enrollments.sql` appliquée. 124 tests réussis, dont 87 PostgreSQL réels ; TypeScript et build réussis. Deux tests supplémentaires couvrant origine, concurrence, suspension, conservation et accès indépendant. Aucun appel externe.
- Documentation abonnement complétée. Restent quotas de places, suspension visible sur tableau de bord, traitement contrôlé des origines historiques, cycle commercial complet et autres chantiers. Avertissement bundle persistant ; aucun déploiement. Objectif global non achevé.

### Lot 31 — places payées et effectif Standard

- Tour précédent classé **progression** : provenance et suspension des accès d’abonnement validées. Quantité Stripe désormais persistée et comparée à l’effectif actif pour la formule Standard, conformément au Checkout existant qui facture tout l’effectif.
- Dépassement ou quantité non vérifiée suspendant attribution et accès issus de l’abonnement ; aucun sous-ensemble de salariés choisi implicitement. All Inclusive sans limite par salarié ; sources indépendantes conservées.
- Espace compagnie FR/EN/AR : effectif/places, alerte, nombres couverts adaptés et bouton de rapprochement. Retour d’actualisation ne prétend plus activer un essai ou tous les accès.
- Migration `20260913_subscription_quantity.sql` appliquée. 125 tests réussis, dont 88 PostgreSQL réels ; TypeScript et build réussis. Nouveau scénario dépassement/régularisation et assertion quantité Stripe. Nullabilité historique TypeScript corrigée avant validation finale.
- Documentation abonnement complétée. Restent configuration du portail Stripe pour ajustement de quantité, recette dédiée, audit/notifications d’effectifs, multi-compagnie et autres chantiers. Aucun appel externe, aucun débit, aucun déploiement. Avertissement bundle persistant. Objectif global non achevé.

### Lot 32 — facturation avec sélection explicite de compagnie

- Tour précédent classé **progression** : quantité payée et capacité Standard validées. Nouveau routeur billing et page `/abonnements` pour les responsables de plusieurs compagnies, avec autorisation en base à chaque opération, indépendamment de la compagnie principale du profil.
- Sélection FR/EN/AR, statut/période/capacité, portail, actualisation et souscription ; lien menu du compte. Retours Stripe conservant la compagnie choisie. Vue de facturation sans identifiants Stripe ; ancienne vue réservée aux managers/ADMIN autorisés.
- Refus de démarrer un second Checkout lorsqu’un abonnement est déjà rattaché. Les tentatives initiales non rattachées restent à rendre durables/idempotentes ; aucun remplacement implicite.
- 128 tests réussis, dont 91 PostgreSQL réels ; TypeScript et build réussis. Trois scénarios supplémentaires : multi-compagnie, refus/révocation et retours Stripe/abonnement existant. Fixture email unique corrigée après échec initial ; lien de connexion vérifié contre le routeur.
- Documentation `docs/company-billing.md`. Restent cycle Checkout complet, remplacement, rapprochement historique, configuration Stripe, recette visuelle et migration des autres fonctions compagnie. Aucun appel Stripe réel ni déploiement. Avertissement bundle persistant. Objectif global non achevé.

### Lot 33 — tentatives de souscription durables

- Tour précédent classé **progression** : espace de facturation multi-compagnie validé. Tentative désormais persistée avant Stripe, paramètres/formule/quantité/clé immuables, rattachement de session unique et conservation des états terminaux.
- Sérialisation par compagnie, reprise de la même requête après réponse perdue, fenêtre de trois heures et session demandée pour quatre heures. Pas de nouvelle tentative avant expiration vérifiée ; tentative ancienne sans identifiant renvoyée au rapprochement.
- Reprise/vérification dans `/abonnements`. Session terminée rapprochée avec l’abonnement courant même sans webhook ; erreur de lecture reprenable. Contrôle d’un abonnement rattaché entre-temps. Origine demandeur fournie par les routeurs.
- Migration `20260913_subscription_checkout.sql` appliquée. 132 tests réussis, dont 95 PostgreSQL réels ; TypeScript et build réussis. Quatre tests dédiés : concurrence/réponse perdue, immutabilité/expiration, confirmation sans webhook/reprise, fenêtre dépassée. Tests existants adaptés au nouvel appel idempotent. SDK simulé uniquement.
- Documentation `docs/company-billing.md` complétée, idempotence Stripe vérifiée dans la documentation officielle. Restent expiration volontaire, rapprochement sans identifiant hors fenêtre, journal fournisseur, remplacement contrôlé, recette réelle et autres chantiers. Avertissement bundle persistant ; aucun déploiement. Objectif global non achevé.

### Lot 34 — fermeture contrôlée des souscriptions en attente

- Tour précédent classé **progression** : souscriptions durables et reprise validées. Action de fermeture d’une session connue, après confirmation, accessible aux managers/ADMIN de la compagnie.
- Références revalidées, expiration Stripe puis état terminal enregistré ; erreur fournisseur suivie d’une relecture. Session toujours ouverte conservée en attente ; paiement terminé rapproché sans annoncer d’annulation ni autoriser une nouvelle tentative.
- Trace immuable du demandeur et du résultat observé, enregistrée avec le statut local. Aucun remboursement/résiliation d’abonnement déclenché par cette action.
- Migration `20260913_subscription_checkout_closure.sql` appliquée. 134 tests réussis, dont 97 PostgreSQL réels ; TypeScript et build réussis. Tests concurrence, journal, refus d’accès, erreur fournisseur et paiement gagnant la course. SDK simulé uniquement.
- Documentation facturation complétée avec référence officielle Stripe. Restent rapprochement sans identifiant hors fenêtre, remplacement contrôlé d’abonnement, recette fournisseur/visuelle et autres chantiers. Aucun déploiement, avertissement bundle persistant. Objectif global non achevé.

### Lot 35 — images et narrations IA privées par formation

- Tour précédent classé **progression** : fermeture de souscriptions testée. Reprise du studio, nouvelles générations image/audio exigeant formation et autorisation avant fournisseur puis avant stockage.
- Registre média immuable avec origine/format/taille/SHA-256, namespace privé, accès auteur ou apprenant dont la version attribuée référence le fichier. Publication/diapositives refusant références privées étrangères. Téléchargement privé inline, octets altérés refusés.
- Migration `20260913_course_media.sql` appliquée. 138 tests réussis, dont 100 PostgreSQL réels ; TypeScript et build réussis. Trois tests PostgreSQL et un HTTP ajoutés : périmètre, versions, révocation, intégrité, immutabilité, références et refus des routes IA étrangères. Utilisation de Array.from corrigée pour la cible TypeScript. Aucun appel IA réel.
- Documentation `docs/private-course-media.md`. Restent reprise des anciens médias publics, import/vidéo, antivirus, quotas, plages de lecture, orphelins, recette visuelle et autres chantiers. Aucun déploiement, avertissement bundle persistant. Objectif global non achevé.

### Lot 36 — import privé des supports et lecture vidéo partielle

- Tour précédent classé **progression** : registre privé pour nouvelles images/narrations IA validé. Import désormais proposé dans diapositives et chapitres : images, MP3, MP4, PDF, autorisation d’auteur et origine uploaded.
- Limite de 25 Mo compatible enveloppe JSON, Base64 canonique et en-têtes validés ; référence média privée conservant droits/version/empreinte. Composant d’import FR/EN/AR rappelant d’enregistrer le contenu.
- Lecture MP3/MP4 par plage d’octets avec vérification des droits et de l’empreinte avant réponse, plages impossibles refusées. Lecture mémoire entière encore utilisée.
- Migration `20260913_course_media_import.sql` appliquée. 140 tests réussis, dont 101 PostgreSQL réels ; TypeScript et build réussis. Scénarios supplémentaires import/provenance/format/taille et HTTP partiel avec intégrité. Aucun service externe appelé.
- Documentation médias complétée. Restent gros fichiers/transcodage/antivirus/quotas, anciens médias publics, génération vidéo et recette réelle/visuelle. Aucun déploiement ; avertissement bundle persistant. Objectif global non achevé.

### Lot 37 — retrait de l’accès public aux anciens médias

- Tour précédent classé **progression** : import privé et lecture partielle validés. Migration capturant les références historiques de médias dans contenus, versions et revues, sans réécriture des preuves.
- Répertoire `courses/` désormais privé. Auteur limité aux rattachements capturés, apprenant à son accès/version référente ; copier une URL dans un autre cours ne crée pas un droit. Médias non rattachés refusés. Registre immuable.
- Migration `20260913_legacy_course_media.sql` appliquée. 142 tests réussis, dont 102 PostgreSQL réels ; TypeScript et build réussis. Test du SQL réel de capture, permissions et absence d’élargissement par copie ; test HTTP du répertoire historique.
- Documentation médias complétée. Pas d’empreinte ancienne fabriquée ; fichiers/caches externes non réécrits. Restent rapprochement des orphelins/intégrité historique, éventuels visuels publics à republier explicitement, recette et autres chantiers. Aucun déploiement ; avertissement bundle persistant. Objectif global non achevé.

### Lot 38 — création atomique et traçable depuis un modèle

- Tour précédent classé **progression** : anciens médias rendus privés avec rattachements figés. Inspection modèles montrant une simple instanciation texte/objectifs, sans duplication complète, et des écritures successives pouvant laisser un cours partiel.
- Validation de structure/domaine/niveaux et droits de destination dans la transaction ; création atomique du brouillon, chapitres/objectifs, révision et copie source. Liens privés étrangers refusés avant création.
- Migration `20260913_template_instantiations.sql` appliquée ; source immuable et créateur conservés. Brouillon non publié/non approuvé, aucune évaluation fabriquée.
- 145 tests réussis, dont 105 PostgreSQL réels ; TypeScript et build réussis. Trois tests couvrant liens/sources, invalidité sans création partielle, destination/révocation. Domaine validé explicitement après erreur TypeScript initiale.
- Documentation `docs/course-templates.md`. La duplication complète avec médias/évaluations reste à construire, ainsi que les autres chantiers. Aucun service externe ni déploiement ; avertissement bundle persistant. Objectif global non achevé.

### Lot 39 — admission signée à la visioconférence

- Tour précédent classé **progression** : instanciation des modèles atomique validée. Remplacement de l’iframe publique par une admission JaaS signée, demandée explicitement à l’entrée et contrôlant compte/classe/rôle côté serveur.
- Jeton RSA lié à une salle littérale, dix minutes, privilèges modérateur dérivés du serveur, fonctions d’enregistrement/transcription/diffusion non accordées. Journal immuable sans JWT/clé ; aucun repli public sans configuration.
- Migration `20260913_live_video_tickets.sql` appliquée. 147 tests réussis, dont 107 PostgreSQL réels ; TypeScript et build réussis. Deux tests avec signatures RSA réelles locales, expiration/rôles/périmètre/absence de configuration. Fixture statut utilisateur corrigée de inactive à suspended, valeur du schéma.
- Documentation `docs/private-live-video.md` et exemples d’environnement sans secrets. Sources officielles JaaS consultées. Compte/clés et recette réelle requis ; pas de connexion fournisseur effectuée. Restent révocation distante, horaires/instructeurs affectés, événements d’assiduité signés, replays et autres chantiers. Aucun déploiement ; avertissement bundle persistant. Objectif global non achevé.

### Lot 40 — export personnel étendu et téléchargement depuis le profil

- Tour précédent classé **progression** : admission vidéo signée validée. Export existant incomplet pour coffre/examens/support et sans bouton de téléchargement dans le profil.
- Format JSON v2 ajoutant coffre/historique, KYC personnel, assistance, réponses/progression, affiliations historiques et présence observée, avec filtres de sujet en SQL. Corrigés et secrets d’authentification exclus ; pièces référencées par liens privés, sans octets embarqués.
- Bouton de téléchargement FR/EN/AR dans le profil, accessible aussi aux ADMIN pour leurs propres données. Aucune suppression/modification de preuves.
- 148 tests réussis, dont 108 PostgreSQL réels ; TypeScript et build réussis. Test propre/étranger, archives, KYC/KYB et secrets/corrigés. Aucun service externe.
- Documentation `docs/personal-export.md`. Restent archive exhaustive avec fichiers, grands volumes/instantané cohérent, inventaire complémentaire et autres chantiers. Aucun déploiement ; avertissement bundle persistant. Objectif global non achevé.

### Lot 41 — installation neuve versionnée sans démonstration implicite

- Tour précédent classé **progression** : export personnel enrichi validé. Entrée Docker dépendant encore de db:push et d’un seed automatique ; migration seule inutilisable sur une base vide.
- Base SQL sans données et manifeste immuable couvrant les migrations présentes, initialisation transactionnelle uniquement sur schéma vide, reçus contrôlés et continuité des bases existantes.
- Premier administrateur explicite, hachage du mot de passe, verrou concurrent, aucun écrasement/promotion implicite. Entrée Docker migrations + bootstrap ; démonstration uniquement sur option. Variables prix Stripe/JaaS/origine relayées.
- Vérification sur nouvelle base `raero_install_20260913_v1` : initialisation/répétition, zéro compte de démonstration, refus sans identifiants, premier ADMIN unique sous concurrence. Les 148 tests (108 PostgreSQL) passent sur cette base ; TypeScript/build, Bash et Compose validés. Migration historique également réussie.
- Documentation `docs/clean-install.md`. Restent image Docker réelle, privilèges/mot de passe du PostgreSQL intégré, santé/sauvegardes/supervision et autres chantiers. Aucun déploiement ; avertissement bundle persistant. Objectif global non achevé.

### Lot 42 — construction Docker et redémarrage réellement vérifiés

- Tour précédent classé **progression** : installation neuve versionnée validée. Image construite puis lancée sans réseau externe, avec volumes PostgreSQL et stockage propres au test.
- PostgreSQL 15.19 embarqué accepte la base de schéma ; premier ADMIN créé sans démonstration. Contrôles HTTP, secret inaccessible, connexion et session persistante après redémarrage réussis. Base conservant 1 utilisateur, 0 formation et 33 reçus.
- Premier arrêt révélant une récupération PostgreSQL après interruption. Entrée Bash corrigée pour superviser Node et arrêter PostgreSQL proprement ; délai Compose de 30 secondes. Image reconstruite, redémarrage et arrêt final propres attestés dans les journaux.
- Script de recette `scripts/docker-smoke.mjs`, documentation d’installation actualisée. Image et volumes de test conservés, conteneurs de recette arrêtés. Build Docker, syntaxe Bash et configuration Compose validés ; suite de 148 tests du lot précédent non répétée pour cette correction de supervision.
- Restent privilèges/secrets PostgreSQL, santé de la base, sauvegarde/restauration/supervision, recette visuelle et autres chantiers. Aucun fournisseur appelé ni déploiement. Objectif global non achevé.

### Lot 43 — suppression du secret PostgreSQL fixe et des privilèges administratifs

- Tour précédent classé **progression** : Docker réel et arrêt propre validés. Secret fixe remplacé par une génération persistante dans le volume PGDATA, fichier 0600 hors stockage HTTP, sans sortie ni argument SQL contenant le secret.
- Provisionnement retirant les cinq privilèges administratifs du rôle raero sur base neuve et existante. Authentification locale peer et TCP SCRAM limité à la base/rôle applicatif ; configuration du cluster intégré gérée au démarrage.
- Image reconstruite. Ancien volume conservant données et session, nouvelle installation avec migrations et ADMIN réussie. Ancien mot de passe, lecture serveur, création de rôle et usurpation locale de postgres refusés. Redémarrage avec secret persistant vérifié.
- Les 148 tests passent dans l’image, sous le rôle PostgreSQL restreint et NODE_ENV=test ; premier essai production sans origine publique de recette corrigé. Bash, scripts Node et Compose vérifiés. Documentation et script de contrôle ajoutés.
- Le rôle reste propriétaire pour les migrations et Node tourne encore comme root : séparation des rôles/processus, sauvegardes/santé/supervision et autres chantiers restent nécessaires. Aucun service externe appelé ni déploiement. Objectif global non achevé.

### Lot 44 — processus serveur sans privilèges système

- Tour précédent classé **progression** : secret et droits PostgreSQL durcis, 148 tests sous rôle restreint validés. Application lancée désormais sous node (UID/GID 1000), no-new-privs et sans capabilities, avec umask 0077.
- Stockage attribué au compte applicatif, code et données PostgreSQL protégés par leurs propriétaires. ADMIN_PASSWORD retiré de l’environnement du serveur après bootstrap. Supervision root conservée pour le cluster intégré.
- Image reconstruite. Recette sur volumes existants puis neufs : processus réel et permissions contrôlés, écritures de stockage possibles, code non modifiable, secrets PG illisibles ; HTTP, connexion et contrôles SQL réussis. Session conservée après redémarrage et PostgreSQL arrêté proprement.
- Script de recette et documentation ajoutés. Inspection initiale de /proc/environ depuis root refusée faute de capability ; contrôle réalisé depuis le même utilisateur node. Conteneurs de recette arrêtés et volumes conservés.
- Restent séparation SQL migration/exécution, santé/sauvegarde/restauration/supervision et chantiers fonctionnels ouverts. Aucun fournisseur appelé ni déploiement. Objectif global non achevé.

### Lot 45 — disponibilité liée à la base et exercice de panne

- Tour précédent classé **progression** : serveur sous node et permissions réelles validés. Deux routes de santé séparant vie HTTP et disponibilité du pool/table applicatifs, réponses minimales no-store, délai borné et requête SQL partagée.
- HEALTHCHECK Docker dirigé vers la disponibilité réelle. Image reconstruite et panne PostgreSQL provoquée dans le conteneur isolé : accueil/live 200, readiness 503, puis retour 200 après relance PG sans redémarrer Node.
- Script d’exercice ajouté ; premier blocage du contrôleur dû au tube de sortie hérité par PostgreSQL diagnostiqué et corrigé avec fichier de journal, puis exercice complet réussi.
- TypeScript/build Docker et 151 tests réussis (108 PostgreSQL, trois nouveaux tests HTTP). Conteneur de recette arrêté. Documentation actualisée.
- Restent supervision/alertes, sauvegarde/restauration, séparation SQL et fonctions ouvertes ; la santé ne certifie ni stockage ni fournisseurs externes. Aucun service externe appelé ni déploiement. Objectif global non achevé.

### Lot 46 — sauvegarde à froid et restauration réelle des deux volumes

- Tour précédent classé **progression** : disponibilité liée à PostgreSQL et panne réelle validées. Script hôte Python/Docker pour copie à froid PostgreSQL + stockage, source arrêtée proprement, contrôle des autres conteneurs écrivains et manifeste final avec empreintes/image/version.
- Restauration refusant archives altérées/chemins dangereux et volumes existants, source préservée. Restrictions explicites : volumes standard, image exacte, fenêtre exclusive, archives non chiffrées, environnement externe à conserver séparément.
- Recette réelle sur volumes synthétiques : source active refusée, sauvegarde et restauration réussies, donnée SQL et fichier binaire identiques, session HTTP préservée, compte/migrations et droits SQL validés. Archive altérée refusée avant création des volumes, destination existante refusée. Trois tests Python des archives réussis.
- Documentation `docs/backup-restore.md`. Volumes de source et restauration conservés, conteneurs de recette arrêtés. Aucun service externe ni bascule de production.
- Restent sauvegardes automatisées/hors serveur/chiffrées, alertes, test autre hôte et reprise/PITR, séparation SQL et chantiers fonctionnels ouverts. Objectif global non achevé.

### Lot 47 — confiance proxy explicite et configuration de production cohérente

- Tour précédent classé **progression** : sauvegarde/restauration à froid réelle validée. Suppression de trust proxy=true et des lectures directes d’en-têtes dans cookies/journal IP ; liste IP/CIDR explicite, raccourcis dangereux refusés.
- Cookies HttpOnly/SameSite=Lax, toujours Secure en production. Configuration invalide quittant avec code 1, puis arrêt propre PostgreSQL. Fichier Compose production aligné sur paramètres/arrêt du fichier local, image RAERO_IMAGE obligatoire sans latest par défaut ; référence à digest demandée dans la documentation.
- Exemples production sans mot de passe administrateur utilisable ni faux secrets fournisseur ; origines/prix/option seed/proxy renseignables. Aucun vrai secret modifié.
- 156 tests réussis (108 PostgreSQL, cinq nouveaux HTTP), TypeScript et build Docker réussis. Parité Compose et refus d’image absente vérifiés ; conteneurs isolés confirmant refus de confiance générale, session conservée et attributs du cookie de production. Conteneurs de recette arrêtés.
- Documentation `docs/http-production.md`. Restent reverse proxy/TLS réels, navigateur, publication CI contrôlée, exploitation et fonctions ouvertes. Aucun service externe appelé ni déploiement. Objectif global non achevé.

### Lot 48 — validation automatisée et publication conditionnée à la recette

- Tour précédent classé **progression** : proxy explicite, cookies de production et Compose cohérents validés. Workflow de validation réutilisable avec PG16 vide, TypeScript/Vitest/Python/Bash/Compose, construction Docker et recette.
- Publication dépendant de la validation ; candidat chargé et testé par identifiant exact avant push, tag SHA complet au lieu de latest implicite, digest rapporté. Aucun déclenchement distant ni publication exécutée.
- Script commun de recette sur ressources jetables sans réseau : connexion/cookies/droits système et SQL, panne/reprise PG, redémarrage, sauvegarde/restauration et session persistante. Nettoyage des ressources propres au script à la sortie.
- YAML analysé, Bash/Compose vérifiés, image construite et scénario local complet réussi, dont restauration et nettoyage ; trois tests Python réussis. Suite métier inchangée depuis les 156 tests du lot 47.
- Documentation `docs/continuous-validation.md`. Premier passage GitHub/amd64, protections de branche, registre, recette navigateur/fournisseurs et autres chantiers restent à vérifier. Aucun déploiement. Objectif global non achevé.

### Lot 49 — révocation après mot de passe/statut et codes à usage unique

- Tour précédent classé **progression** : publication conditionnée à la recette complète configurée et testée localement. Version de session portée par JWT et comparée au compte actif à chaque contexte API/fichier privé ; identifiant applicatif contrôlé. Cookies historiques traités comme version zéro.
- Migration nouvelle et immuable incrémentant la version après changement mot de passe/statut, effaçant les codes en attente et journalisant les versions/raison sans secrets. Une réactivation ne réhabilite pas les anciens cookies.
- Réinitialisation et validation 2FA atomiques sous concurrence. Défi lié à la version validée par mot de passe ; 2FA activée ne se replie plus sur une connexion directe lorsque SMTP manque.
- 160 tests réussis (112 PostgreSQL), TypeScript/build Docker et recette complète installation/redémarrage/restauration réussis. Aucun email/provider appelé ; volumes jetables nettoyés.
- Documentation `docs/session-security.md`. Restent révocation utilisateur/individuelle, réauthentification, origine et stockage des jetons de réinitialisation, protections distribuées et autres chantiers. Aucun déploiement. Objectif global non achevé.

### Lot 50 — origine des liens de récupération et empreintes des jetons

- Tour précédent classé **progression** : sessions révoquées après changement de sécurité et codes consommés atomiquement. Origine des liens désormais uniquement issue de PUBLIC_APP_URL/APP_ORIGIN, HTTPS canonique en production, origine navigateur ignorée.
- Demandes sans messagerie/origine valide conservant une réponse neutre sans création de jeton ni envoi. Jetons stockés en SHA-256 ; migration des valeurs historiques préservant les liens déjà envoyés sans toucher leur expiration.
- 164 tests réussis (115 PostgreSQL), dont origine falsifiée, configurations invalides, absence de fuite, empreinte non utilisable comme lien et SQL réel de migration. Messagerie simulée uniquement.
- TypeScript/build Docker et scénario complet installation/panne/reprise/redémarrage/sauvegarde/restauration réussis ; ressources jetables nettoyées. Documentation de sécurité des sessions actualisée.
- Restent code email 2FA, limitations distribuées, révocation utilisateur/réauthentification et autres chantiers. Aucun email réel ni fournisseur appelé, aucun déploiement. Objectif global non achevé.

### Lot 51 — déconnexion de tous les appareils depuis le profil

- Tour précédent classé **progression** : origine de récupération fixe et jetons hachés validés. Commande utilisateur FR/EN/AR avec mot de passe actuel et annonce de déconnexion du navigateur courant.
- Route limitée au compte connecté, essais bornés, relecture verrouillée du compte/statut/version et vérification du mot de passe. Incrément de version et effacement du défi 2FA en attente, événement immuable, cookie courant effacé et retour à la connexion.
- 166 tests réussis (117 PostgreSQL), dont erreur sans effet, propre/étranger, audit, cookie et concurrence. TypeScript et build réussis. Aucune migration nécessaire ; pas de répétition Docker pour ce changement applicatif.
- Documentation sessions actualisée. Restent recette navigateur, limitation distribuée, autres opérations sensibles et chantiers ouverts. Avertissement bundle persistant. Aucun fournisseur appelé ni déploiement. Objectif global non achevé.

### Lot 52 — protection et limitation persistante des défis email 2FA

- Tour précédent classé **progression** : déconnexion de tous les appareils avec réauthentification validée. Codes aléatoires stockés en HMAC lié au compte/version et secret serveur, comparaison en temps constant.
- Compteur PostgreSQL sous verrou, échecs validés avant retour, plafond huit essais avec invalidation du défi. Nouvelle émission conditionnée à la version validée par mot de passe et à une minute de délai en base.
- Nouvelle migration élargissant la colonne et ajoutant compteur/date ; anciens défis en clair effacés, nouvelle demande requise, sessions ouvertes préservées.
- 168 tests réussis (119 PostgreSQL), dont seize erreurs concurrentes, limite, réémission, réussite avant limite et liaison au compte. TypeScript/build et recette Docker complète installation/panne/reprise/sauvegarde/restauration réussis. Aucun envoi réel.
- Documentation sessions actualisée. Restent configuration 2FA avec preuve/réauthentification, facteurs avancés, limitations globales et autres chantiers. Aucun déploiement. Objectif global non achevé.

### Lot 53 — configuration 2FA avec preuves et révocation des autres sessions

- Tour précédent classé **progression** : défis HMAC et compteur SQL persistants validés. Remplacement du commutateur immédiat par parcours FR/EN/AR mot de passe + code email, activation et désactivation.
- Défis de finalités distinctes login/enable/disable, version/statut verrouillés, réglage inchangé avant confirmation, échecs SMTP sans activation. Confirmation consommée une fois et version avancée ; nouveau cookie seulement pour l’appareil vérifié.
- Migration nouvelle finalité/extension du déclencheur, audit two_factor_changed. Ancienne route directe supprimée. Code retiré du sujet d’email journalisé, finalité précisée et nom échappé.
- 172 tests réussis (123 PostgreSQL), TypeScript/build Docker et scénario complet avec restauration réussis. Messagerie simulée uniquement, ressources jetables nettoyées.
- Documentation sessions actualisée. Restent recette navigateur, récupération encadrée, facteurs avancés et autres chantiers. Aucun fournisseur réel ni déploiement. Objectif global non achevé.

### Lot 54 — inscription transactionnelle du compte et de sa compagnie

- Tour précédent classé **progression** : configuration 2FA avec preuves validée. Inscription regroupant organisation, compte et affiliation manager dans une transaction, verrou sur email normalisé et détection sans distinction de casse.
- Schéma commun de validation/bornes ; aucun ID de compagnie ou rôle fourni n’accorde un accès. Abonnement et vérification non accordés implicitement. Erreurs SQL remplacées par réponse générique côté route.
- 176 tests réussis (127 PostgreSQL), quatre nouveaux scénarios couvrant liens, concurrence, invalidité, périmètre et rollback réel après création de compagnie. Test de collision ESM initial corrigé ; route d’erreur et absence de cookie vérifiées ensuite par recette ciblée.
- TypeScript/build réussis ; pas de migration nouvelle ni répétition Docker nécessaire. Documentation `docs/registration.md`. Aucun email réel ni fournisseur appelé.
- Restent preuve email, invitations/doublons juridiques, limitations globales, recette navigateur et autres chantiers. Avertissement bundle persistant. Aucun déploiement. Objectif global non achevé.

### Lot 55 — suspension d’organisation sans restauration indue des affiliations

- Tour précédent classé **progression** : inscription transactionnelle validée. Statut compagnie séparé des décisions individuelles ; aucune réécriture des affiliations lors de suspension/réactivation.
- Affiliations effectives conditionnées à la compagnie active ; garde manager relue en base sans repli sur le rôle global. Contrôles ajoutés aux routes héritées d’échéances/synthèse/règles/TNA et au périmètre réel technicien/sign-off ; dossiers personnels exigeant encore le lien individuel actif.
- Nouvelle migration journal immuable des changements de statut, administrateur actif et compagnie verrouillés, répétition idempotente. Aucun historique ancien supposé/reconstruit.
- 180 tests réussis (131 PostgreSQL), TypeScript/build Docker et scénario complet avec restauration réussis. Mock de jointure et attente simultanée des refus dans les tests corrigés avant validation finale.
- Documentation `docs/organization-suspension.md`. Restent revue des affiliations anciennes ambiguës, sélection multi-org héritée, UI/journal/notifications, audit complémentaire et autres chantiers. Aucun fournisseur appelé ni déploiement. Objectif global non achevé.

### Lot 56 — consultation du journal de statut des compagnies

- Tour précédent classé **progression** : suspension séparée des affiliations et routes héritées durcies. Route de lecture réservée aux administrateurs actifs, projection limitée et pagination par identifiant sur 50 événements.
- Bouton Historique dans les compagnies, dialogue FR/EN/AR avec date/auteur/statuts, états chargement/erreur/vide et navigation. Noms actuels explicitement distingués de l’identifiant stable ; aucune preuve ancienne inventée.
- 182 tests réussis (133 PostgreSQL), dont portée/administrateur suspendu/champs et pagination sous nouvelles insertions. TypeScript/build réussis après corrections langue et BigInt ; avertissement bundle persistant.
- Documentation suspension actualisée. Aucune migration ni répétition Docker nécessaire. Restent recette navigateur, notifications et autres chantiers. Aucun fournisseur appelé ni déploiement. Objectif global non achevé.


### Lot 57 — conservation des compagnies et suppression des pertes partielles

- Tour précédent classé **progression** : consultation du journal validée. Bouton de suppression définitive retiré et ancienne route conservée en refus explicite, sans écriture. Service destructif retiré : il effaçait affiliations/règles avant une suppression pouvant échouer sur les références immuables.
- Nouvelle migration refusant DELETE/TRUNCATE des compagnies, même vides. Texte FR/EN/AR orientant vers la suspension auditée et réversible ; aucun archivage verrouillé complet revendiqué.
- 184 tests réussis (135 PostgreSQL), TypeScript/build réussis. Assertion corrigée pour la cause SQL encapsulée par Drizzle ; tentative TRUNCATE CASCADE séparée refusée, transaction annulée.
- Construction Docker et recette complète installation/panne/reprise/redémarrage/sauvegarde/restauration réussies ; ressources jetables nettoyées. Documentation suspension actualisée.
- Restent archivage distinct, autres suppressions historiques, recette navigateur et chantiers ouverts. Avertissement bundle persistant. Aucun fournisseur appelé ni déploiement. Objectif global non achevé.


### Lot 58 — archivage verrouillé des formations externes héritées

- Tour précédent classé **progression** : compagnies protégées contre la suppression. Remplacement du retrait destructif de pièces externes par archivage avec motif, date et auteur, preuve initiale conservée et aucune réactivation.
- Transaction avec compte actif, affiliation manager réelle, compagnie active et cohérence de la compagnie actuelle du technicien ; cas historiques ambigus réservés aux administrateurs. Concurrence idempotente sans écrasement du premier motif.
- Migration avec contrainte complète et déclencheurs interdisant modifications de preuve, modifications après archivage, DELETE et TRUNCATE. Ancienne route de suppression en refus explicite et service de mise à jour inutilisé retiré.
- Parcours FR/EN/AR dans le dossier avec motif/confirmation et erreurs, entrées archivées conservées à l’écran et identifiées dans le CSV avec métadonnées.
- 187 tests réussis (138 PostgreSQL), TypeScript/build et recette Docker complète avec sauvegarde/restauration réussis. TRUNCATE séparé refusé ; transaction annulée. Ressources jetables nettoyées.
- Documentation `docs/external-training-archive.md`. Restent recette navigateur, contenu des URLs documentaires historiques non garanti, autres parcours de qualifications et chantiers ouverts. Aucun fournisseur appelé ni déploiement. Objectif global non achevé.


### Lot 59 — duplication complète de formation avec médias privés

- Tour précédent classé **progression** : archivage des formations externes validé. Nouvelle action studio FR/EN/AR avec destination explicite, titre, état en cours et erreurs ; ouverture du brouillon créé.
- Transaction repeatable read avec droits réels source/destination. Copie des chapitres/objectifs/diapositives/interactions/QCM/corrigés et politiques ; nouveaux identifiants/remappage, exclusion des archives et rollback des références invalides. Aucune publication, revue approuvée ni donnée apprenant héritée.
- Migration provenance/instantané immuables et liens explicites aux fichiers privés conservés. Validation et lecture étendues aux copies, sans accorder de droit sur une URL étrangère ; réutilisation des octets existants et copies de copies.
- 190 tests réussis (141 PostgreSQL), dont droits apprenant/version/expiration. Test de référence invalide adapté à la protection SQL déjà présente ; itération Set corrigée pour la cible TypeScript.
- TypeScript/build et recette Docker complète avec restauration réussis. Documentation `docs/course-copy.md`. Restent recette navigateur, vérification physique des supports au moment de la copie, versionnage avancé/traduction, stockage historique et chantiers ouverts. Aucun fournisseur appelé ni déploiement. Objectif global non achevé.


### Lot 60 — admission vidéo et présence bornées par les horaires

- Tour précédent classé **progression** : duplication complète avec médias validée. Fenêtre explicite 15 minutes avant/15 minutes après, préparation modérateur 30 minutes avant, fin session/durée webinar requises.
- Refus des tickets et heartbeats hors fenêtre ; JWT plafonné à la fermeture prévue. Horaires/état exposés et affichés FR/EN/AR, actualisation des droits toutes les 15 secondes et destruction locale de l’iframe à fermeture/perte d’accès.
- 193 tests réussis (143 PostgreSQL), TypeScript/build réussis. Bornes exactes et tests RSA/présence/horaires invalides ; fixtures antérieures complétées avec une fin explicite.
- Documentation `docs/private-live-video.md` actualisée. Aucune migration ni nouvelle recette Docker nécessaire. Restent créneaux quotidiens multi-jours, révocation fournisseur, recette navigateur/JaaS, affectation instructeurs et autres chantiers. Aucun fournisseur appelé ni déploiement. Objectif global non achevé.


### Lot 61 — correction auditée des horaires de session

- Tour précédent classé **progression** : fenêtres vidéo/presence validées. Fin valide requise pour créer une session à distance, dates ISO avec fuseau, validation et explication des heures locales dans le formulaire.
- Bouton Horaires FR/EN/AR pour réparer/replanifier avec motif ; début/fin avec heures dans la liste. Route update strictement limitée aux horaires, ancien service générique retiré.
- Transaction administrateur actif/session verrouillée ; statuts terminaux refusés, inscriptions conservées, dates précédentes/nouvelles/motif/auteur immuables dans une nouvelle migration. Répétitions identiques sans événement doublon.
- 196 tests réussis (146 PostgreSQL), TypeScript/build et recette Docker complète avec restauration réussis. Ressources jetables nettoyées ; dernières améliorations des libellés revérifiées par build.
- Documentation `docs/session-scheduling.md`. Restent consultation du journal, notification des inscrits, éditeur des webinars distincts, recette navigateur et autres chantiers. Aucun fournisseur appelé ni déploiement. Objectif global non achevé.


### Lot 62 — consultation de l’historique des horaires

- Tour précédent classé **progression** : correction auditée validée. Bouton Historique disponible sur toutes les sessions, dialogue FR/EN/AR avant/après/motif/date/auteur et état vide sans reconstitution supposée.
- Route/service réservés aux administrateurs actifs, projection minimale sans secrets. Pagination de 50 événements par identifiant borné, navigation stable, erreur/réessai et invalidation après correction.
- 198 tests réussis (148 PostgreSQL), TypeScript/build réussis. Tests des droits/champs/dates historiques et pagination sous insertions, avec autre session exclue.
- Documentation `docs/session-scheduling.md` actualisée. Aucune migration ni recette Docker nouvelle nécessaire. Restent notification des inscrits, éditeur webinars, recette navigateur et chantiers ouverts. Aucun fournisseur appelé ni déploiement. Objectif global non achevé.


### Lot 63 — création et cycle administratif des webinaires

- Tour précédent classé **progression** : historique des horaires consultable. Section Webinaires FR/EN/AR dans le panneau sessions : création, début/durée, capacité et formation facultative, correction des horaires et statut avec motif.
- Services transactionnels administrateur actif avec journal avant/après/auteur/motif, concurrence idempotente et états terminaux conservés. Nouvelle migration événements immuables et refus DELETE/TRUNCATE des webinaires ; inscriptions préservées après annulation.
- Visibilité publique existante préservée : formations internes/non publiées masquées, création sur formation archivée refusée. Aucun droit de modération ou produit de paiement implicite.
- 201 tests réussis (151 PostgreSQL), TypeScript/build et recette Docker complète avec restauration réussis. Adresse fixe du précédent test de journal rendue unique après échec de répétition ; suite entière relancée avec succès. Ressources jetables nettoyées.
- Documentation `docs/admin-webinars.md` et planification sessions actualisées. Restent consultation de ce journal, notifications, affectations instructeurs, modifications de métadonnées/capacité, recette navigateur/JaaS et autres chantiers. Aucun fournisseur appelé ni déploiement. Objectif global non achevé.


### Lot 64 — édition des webinaires et capacité cohérente avec les inscriptions

- Tour précédent classé **progression** : administration des webinaires validée. Bouton Modifier FR/EN/AR avec titre/description/capacité/motif ; liste affichant personnes distinctes inscrites et places disponibles au total.
- Transaction administrateur actif/webinaire verrouillé, comptage partagé avec admission et refus de capacité insuffisante sans écriture partielle. Capacité vide explicitement sans limite pour préserver les valeurs historiques ; statuts terminaux et rattachement de formation conservés.
- Nouvelle migration étendant l’action du journal à metadata ; états avant/après immuables et répétition sans événement doublon.
- 203 tests réussis (153 PostgreSQL), dont concurrence réduction/admission, refus, journal et valeurs sans limite. TypeScript/build et recette Docker complète avec restauration réussis, ressources jetables nettoyées.
- Documentation `docs/admin-webinars.md` actualisée. Restent consultation du journal, notifications, affectations instructeurs, recette navigateur/JaaS et autres chantiers. Aucun fournisseur appelé ni déploiement. Objectif global non achevé.


### Lot 65 — consultation du journal des webinaires

- Tour précédent classé **progression** : édition/capacité avec concurrence validée. Bouton Historique accessible sur tous les webinaires, dialogue FR/EN/AR avec actions/différences/motif/auteur/date et création initiale.
- Projection SQL bornée des instantanés excluant URLs de salle/replay et champs supplémentaires, projection utilisateur sans secrets. Administrateur actif requis, pagination stable de 50 événements, erreurs/vide/navigation et invalidation après mutation.
- 205 tests réussis (155 PostgreSQL), TypeScript/build réussis. Tests de projection avec secrets dans la source, droits/terminalité et pagination sous insertions intercalées.
- Documentation `docs/admin-webinars.md` actualisée. Aucune migration ni nouvelle recette Docker nécessaire. Restent notifications, affectations instructeurs, recette navigateur/JaaS et chantiers ouverts. Aucun fournisseur appelé ni déploiement. Objectif global non achevé.


### Lot 66 — instructeurs explicitement affectés aux classes

- Tour précédent classé **progression** : consultation du journal webinaire validée. Boutons Instructeurs sur sessions/webinaires, recherche bornée des comptes actifs et affectation/retrait/réaffectation avec motif FR/EN/AR.
- Autorité de modération fondée sur affectation active + rôle instructeur, sans transfert des droits studio ; administrateurs conservés. Ancienne modération implicite des auteurs retirée sans fabriquer d’affectations historiques ; migration manuelle par l’administration nécessaire pour ces classes.
- Transactions salle/compte verrouillés, états terminaux et comptes invalides refusés à l’activation, retrait encore possible. Identités conservées et événements immuables ; compagnie suspendue/formation archivée bloque l’instructeur.
- Ticket exposant son rôle signé et interface vidéo fermée localement si ce rôle change à la relecture des droits ; révocation fournisseur distincte toujours requise.
- 208 tests réussis (158 PostgreSQL), TypeScript/build et recette Docker complète avec restauration réussis. Fixtures explicites et appel de test strict corrigés ; ressources jetables nettoyées.
- Documentation `docs/live-instructors.md` et vidéo actualisées. Restent qualifications réglementaires, journal détaillé, calendrier personnel, notifications, recette navigateur/JaaS et autres chantiers. Aucun fournisseur appelé ni déploiement. Objectif global non achevé.


### Lot 67 — classes personnelles à animer dans le tableau de bord

- Tour précédent classé **progression** : affectations instructeur explicites validées. Entrée FR/EN/AR « Mes classes à animer », période locale, liste chronologique et ouverture via la salle contrôlée.
- Sélection serveur du seul instructeur connecté/actif, affectations actives et contexte compagnie/formation valide ; aucune URL privée ni participant projeté. Sessions chevauchant la période et fin webinar calculée, annulations indiquées sans lien.
- Pagination de 50 départs avec identifiant de départage, rafraîchissement minute, erreurs/vide et intervalle borné. Liste personnelle ; calendrier graphique/export non revendiqués.
- 211 tests réussis (161 PostgreSQL), TypeScript/build réussis. Scénarios droits/retrait/contexte, chevauchement, pagination de dates identiques et limites.
- Documentation `docs/live-instructors.md` actualisée. Aucune migration ni nouvelle recette Docker nécessaire. Restent qualifications, journal détaillé, notifications, recette navigateur/JaaS et autres chantiers. Aucun fournisseur appelé ni déploiement. Objectif global non achevé.


### Lot 68 — historique consultable des affectations d’instructeurs

- Tour précédent classé **progression** : liste personnelle des classes validée. Historique dépliant FR/EN/AR dans le dialogue d’affectations, avec instructeur/acteur distincts, états/motif/date et noms actuels explicités.
- Lecture réservée à l’administrateur actif, projection sans secrets, filtrage type+identifiant de classe, pagination stable de 50 événements et invalidation après décision.
- 213 tests réussis (163 PostgreSQL), TypeScript/build réussis. Tests droits/projection, retrait/classe terminée et pagination sous insertions sans mélange de classes.
- Documentation `docs/live-instructors.md` actualisée. Aucune migration ni nouvelle recette Docker nécessaire. Restent qualifications, notifications, recette navigateur/JaaS et autres chantiers. Aucun fournisseur appelé ni déploiement. Objectif global non achevé.


### Lot 69 — contrôle persistant des demandes IA

- Tour précédent classé **progression** : historique d’affectations consultable. Réservation SQL par compte avant les cinq routes de génération, exclusion concurrente et quotas horaires text/image/speech configurables, échecs comptés.
- Nouvelle migration journal sans prompts/réponses/secrets, identité et résultat final immuables. Réservation de 15 minutes et délai HTTP fournisseur de 180 secondes ; issue inconnue conservée après panne, nouvelle admission possible après expiration sans idempotence fournisseur revendiquée.
- Bornes d’entrée et langue FR/EN/AR, compteurs/limites dans le studio, configurations Compose/exemple documentées. Type de langue du dialogue corrigé après échec initial TypeScript.
- 216 tests réussis (166 PostgreSQL), TypeScript/build, validation Compose et recette Docker complète avec restauration réussis. Callbacks simulés uniquement, ressources jetables nettoyées.
- Documentation `docs/ai-request-control.md`. Restent file/reprise durable, validation des sorties, coûts/tokens/quotas B2B, recette navigateur/fournisseur et autres chantiers. Aucun fournisseur appelé ni déploiement. Objectif global non achevé.


### Lot 70 — validation des réponses IA avant utilisation

- Tour précédent classé **progression** : contrôle persistant des demandes validé. Schémas de sortie bornés pour plans/diapositives/QCM, nombre et couverture exigés, réponses/options distinctes et indices valides, texte non vide et de type correct.
- JSON malformé/volumineux refusé sans recopier la sortie dans l’erreur, aucune correction silencieuse ni nouvelle génération automatique. Consigne arabe corrigée ; validation sémantique et revue humaine restent distinctes.
- 219 tests réussis (166 PostgreSQL), TypeScript/build réussis. Réponses HTTP simulées couvrant formes invalides, couverture, limites, réponses multiples, langue et signal d’expiration ; aucun fournisseur réel appelé.
- Documentation `docs/ai-output-validation.md`. Aucune migration ni nouvelle recette Docker nécessaire. Restent reprise durable, validation factuelle, audio multilingue/fournisseurs, recette navigateur et autres chantiers. Aucun déploiement. Objectif global non achevé.


### Lot 71 — création atomique des cours et diapositives

- Tour précédent classé **progression** : sorties IA validées. Schéma partagé de création, bornes et mini-QCM cohérents ; transaction unique cours/diapositives, sans cours partiel après erreur.
- Compte/destination/affiliation relus et verrouillés à l’enregistrement ; références privées étrangères refusées en création, duplication/import dédiés requis.
- 223 tests réussis (170 PostgreSQL), dont échec SQL sur la seconde diapositive et rollback intégral, retrait d’affiliation, supports étrangers et payloads invalides. TypeScript/build réussis.
- Documentation `docs/atomic-course-drafts.md`. Aucune migration ni nouvelle recette Docker nécessaire. Restent reprise durable de génération, validation factuelle, recette navigateur et autres chantiers. Aucun fournisseur appelé ni déploiement. Objectif global non achevé.


### Lot 72 — récupération des plans IA et conversion idempotente

- Tour précédent classé **progression** : création atomique des brouillons validée. Les plans complets validés sont désormais enregistrés avec demande, créateur, langue et destination avant retour au client ; droits relus avant l’appel puis à la sauvegarde.
- Nouvelle migration de conservation immuable, lien vers le cours autorisé une seule fois. Conversion verrouillée dans la même transaction que le cours/diapositives ; double appel ou réponse perdue retrouve le même cours sans nouvelle génération.
- Liste privée FR/EN/AR paginée des plans en attente, destination d’origine affichée, accès retiré avec l’affiliation ou suspension. Le dialogue conserve l’identifiant reçu et propose de reprendre la conversion sans relancer le fournisseur.
- 226 tests réussis (173 PostgreSQL), TypeScript/build réussis. Scénarios concurrence, isolement, droits retirés/rétablis, destination, immutabilité, QCM/langue et conversion refusée sans consommation du plan. Callbacks synthétiques, aucun fournisseur réel appelé.
- Construction Docker et recette installation/panne/reprise/redémarrage/sauvegarde/restauration réussies après la dernière modification ; ressources jetables nettoyées. Documentation `docs/ai-outline-recovery.md`, contrôles IA et brouillons actualisés.
- La reprise suppose une sortie complète déjà enregistrée : pas de reprise d’appel interrompu, ni idempotence fournisseur ou garantie factuelle. Restent file durable, coûts/quotas B2B, recette navigateur/fournisseur et autres chantiers. Aucun déploiement. Objectif global non achevé.


### Lot 73 — narration arabe et validation des réponses audio

- Tour précédent classé **progression** : récupération des plans enregistrés validée. Défaut Google corrigé : l’arabe sélectionne ar-XA au lieu de la voix anglaise ; FR/EN conservés, conformité des transports Google/Mistral vérifiée dans leurs documentations officielles.
- Texte nettoyé/non vide avant quota, JSON/base64 audio contrôlés et signature/taille avant stockage. Les erreurs HTTP audio n’exposent plus le corps fournisseur ; aucun retry payant automatique.
- 229 tests réussis (173 PostgreSQL), TypeScript/build réussis. Trois nouveaux tests HTTP simulés couvrent langues, transport, propriété, erreurs et absence de sauvegarde invalide.
- Documentation `docs/ai-speech-validation.md`. Aucune migration ni nouvelle recette Docker nécessaire. Restent limites fournisseur/découpage, bornage du flux, écoute et recette réelle, gestion des accents et autres chantiers. Aucun fournisseur réel appelé ni déploiement. Objectif global non achevé.


### Lot 74 — interactions vidéo transmises aux lecteurs

- Tour précédent classé **progression** : narration arabe et erreurs audio corrigées. Inspection du parcours vidéo : le champ videoCues était enregistré et pris en charge par SlideDeck, mais omis dans les trois projections UI.
- Transmission rétablie pour la prévisualisation auteur, le cours sans chapitres et les diapositives de chapitre. La source apprenant reste le curriculum existant, lié à sa version d’inscription.
- TypeScript/build réussis. Dernière suite complète : 229 tests (lot 73), pas de nouveau test qui reproduirait ces simples affectations. Contrôle de code uniquement, pas de preuve navigateur.
- Documentation `docs/interactive-video-delivery.md`. Activités locales distinctes des examens serveur ; restent validation des interactions, recette clavier/tactile/navigateur et génération vidéo complète, ainsi que les autres chantiers. Aucune migration ni nouvelle recette Docker nécessaire. Aucun fournisseur appelé ni déploiement. Objectif global non achevé.


### Lot 75 — validation des interactions vidéo à l’édition

- Tour précédent classé **progression** : champ des interactions transmis aux trois lecteurs. Schéma partagé éditeur/API pour QCM, parcours, zones cliquables et glisser-déposer ; bornes temporelles/collections, réponses cohérentes et cibles atteignables dans le cadre.
- Fin du filtrage silencieux des interactions incomplètes dans le dialogue : message FR/EN/AR et correction explicite requise. Compatibilité des valeurs historiques par défaut conservée ; aucune réécriture des versions publiées.
- 232 tests réussis (173 PostgreSQL), TypeScript/build réussis. Trois nouveaux tests couvrent formats valides, cas insolubles, bornes et cibles ambiguës/manquantes/réutilisées/hors cadre.
- Documentation `docs/interactive-video-delivery.md` actualisée. Restent comparaison à la durée vidéo réelle, accessibilité/recette navigateur, génération vidéo et autres chantiers. Aucune migration ni nouvelle recette Docker nécessaire. Aucun fournisseur appelé ni déploiement. Objectif global non achevé.


### Lot 76 — alternative clavier/tactile au glisser-déposer vidéo

- Tour précédent classé **progression** : configurations d’interactions validées. Éléments/zones deviennent des boutons natifs avec sélection, consigne FR/EN/AR, noms accessibles et focus visible ; le placement par sélection complète le drag existant.
- Fonction commune de placement : refus d’identifiants étrangers, unicité d’emplacement, retour de l’élément remplacé à la réserve, lecture des seules propriétés propres. Réinitialisation des états de placement/sélection.
- 234 tests réussis (173 PostgreSQL), TypeScript/build réussis. Deux nouveaux tests couvrent transitions de placement, immutabilité de l’état précédent et identifiants particuliers.
- Documentation des interactions actualisée. Recette navigateur clavier/tactile/lecteur d’écran non effectuée ; aucune conformité globale revendiquée. Restent génération vidéo et autres chantiers. Aucune migration ni nouvelle recette Docker nécessaire. Aucun fournisseur appelé ni déploiement. Objectif global non achevé.


### Lot 77 — mini-QCM cohérents et validation réelle des modifications d’activité

- Tour précédent classé **progression** : placement vidéo par sélection disponible. Correction de l’éditeur qui supprimait les options vides sans décaler les indices de réponses ; schéma QCM partagé et message FR/EN/AR, retrait explicite requis.
- Lacune du lot 75 identifiée : le schéma vidéo de route ne couvrait que la création, la modification restait générique. Contrôle désormais dans createSlide/updateSlide, vérifié via la route réelle.
- Modification d’activité verrouillée, fusionnée à l’état courant et validée dans la même transaction : deux patches partiels incompatibles ne créent pas de QCM invalide. Pas de réécriture des versions publiées.
- 237 tests réussis (176 PostgreSQL), TypeScript/build réussis après correction d’une annotation de retour. Trois nouveaux scénarios PostgreSQL, dont concurrence, retrait partiel, options vides et interaction vidéo invalide via la route générique.
- Documentation `docs/embedded-quiz-editing.md`, rectification de `docs/interactive-video-delivery.md`. Restent recette navigateur, génération vidéo et autres chantiers. Aucune migration ni nouvelle recette Docker nécessaire. Aucun fournisseur appelé ni déploiement. Objectif global non achevé.


### Lot 78 — activités vérifiées avant revue et publication

- Tour précédent classé **progression** : écritures de QCM et activités verrouillées/validées. Le contrôle commun de préparation, revue et publication examine maintenant les mini-QCM et repères vidéo de toutes les diapositives actives, y compris les données historiques/importées.
- Repères non vides sans vidéo refusés ; anomalies FR/EN/AR avec identifiant de diapositive et action « Corriger » dans le studio. Les activités absentes restent autorisées.
- 239 tests réussis (178 PostgreSQL), TypeScript/build réussis. Deux nouveaux tests vérifient anomalies, refus effectif de revue/publication sans enregistrement et rétablissement après correction.
- Documentation des interactions actualisée. Pas de réécriture/retrait automatique des versions existantes ; pas de téléchargement pour vérifier durée/disponibilité. Restent recette navigateur, génération vidéo et autres chantiers. Aucune migration ni nouvelle recette Docker nécessaire. Aucun fournisseur appelé ni déploiement. Objectif global non achevé.


### Lot 79 — début du chantier de génération vidéo IA

- Tour précédent classé **progression** : activités bloquantes avant publication identifiées. Vérification du protocole Google Veo dans sa documentation officielle ; adaptateur REST de démarrage, consultation et téléchargement, sans appel fournisseur réel.
- Configuration explicite du modèle, prompt/durée/format bornés, opérations distinctes sans resoumission lors du polling. JSON/MP4 bornés pendant lecture, redirections contrôlées et clé transmise uniquement à l’hôte API, erreurs génériques.
- 243 tests réussis (178 PostgreSQL), TypeScript/build réussis. Quatre nouveaux tests de transport simulé ; motif d’identifiant corrigé pour accepter les points des noms de modèles réels.
- **Chantier vidéo non terminé : adaptateur pas encore relié aux routes/studio.** Suite concrète dans `docs/ai-video-generation.md` : tâches persistantes privées, quota vidéo, conservation d’opération/issue inconnue, récupération idempotente en média privé, interface et configuration, tests SQL/migration/Docker. Poursuivre cette intégration au prochain tour.
- Aucune migration ni recette Docker nécessaire pour ce module non exposé. Recette fournisseur/navigateur encore à faire, aucun déploiement. Objectif global non achevé.


### Lot 80 — génération vidéo IA reliée au studio et aux tâches privées

- Tour précédent classé **progression** : adaptateur Google Veo testé. Nouvelle migration ai_video_jobs : identité/paramètres/destination conservés, états terminaux immuables, suppression/TRUNCATE refusés. Réservation avant fournisseur et identifiant client réutilisable sans resoumission.
- Routes auteur de démarrage/liste/vérification, quotas vidéo séparés 2/h par défaut (0–20), une vidéo active récente par compte. Les issues inconnues restent honnêtes, sans retry de génération automatique. Vérification connue et téléchargement récupérables.
- Verrous et droits actifs pendant récupération, média privé et lien au job enregistrés dans la même transaction ; récupération terminée idempotente, pause entre consultations même après erreur réseau. Fichier orphelin possible avant commit SQL documenté.
- Interface FR/EN/AR dans l’éditeur : paramètres, 50 dernières tâches personnelles, statuts, vérification explicite, prélecture MP4 et insertion volontaire avant sauvegarde de la diapositive. Pas de fuite de prompt/opération/URL fournisseur via la liste.
- 247 tests réussis (182 PostgreSQL), TypeScript/build, validation Compose, construction Docker et recette installation/panne/reprise/redémarrage/sauvegarde/restauration réussis. Quatre nouveaux tests SQL de concurrence/idempotence/droits/quota/reprise, fournisseurs et fichiers simulés ; ressources Docker jetables nettoyées.
- Configuration Compose/exemple et `docs/ai-video-generation.md` actualisés. Parcours applicatif vidéo présent, recette Google réelle et navigateur non réalisée. Pas de worker de récupération automatique, précision audiovisuelle/aéronautique et disponibilité modèle/région/facturation à vérifier. Aucun fournisseur réel appelé ni déploiement. Objectif global non achevé.


### Lot 81 — collecte automatique des vidéos déjà demandées

- Tour précédent classé **progression** : parcours vidéo studio et tâches privées validés. Au démarrage puis toutes les 30 secondes, collecte bornée à cinq opérations running dues ; aucun démarrage de génération, submitting/unknown ignorés.
- Exclusion locale des passes, sélection SQL avec SKIP LOCKED pour instances concurrentes et vérification manuelle, index partiel de tâches actives. Même contrôle d’auteur/destination, même transaction de résultat ; savepoint isolant une erreur SQL avant de poursuivre la file.
- Temporisation de 30 secondes après tentative automatique échouée ; compteurs serveur sans contenu privé. Une suspension d’auteur bloque les appels, droits rétablis permettent la reprise.
- 251 tests réussis (186 PostgreSQL), TypeScript/build, construction et recette Docker complète avec restauration réussis. Quatre nouveaux tests de concurrence, non-resoumission, droits et véritable rollback SQL média avec progression d’une autre tâche. Ressources jetables nettoyées.
- `docs/ai-video-generation.md` actualisé. Restent recette Google/navigateur, qualité audiovisuelle/aéronautique, gestion des fichiers orphelins et autres chantiers. Aucune clé réelle configurée, aucun fournisseur réel appelé ni déploiement. Objectif global non achevé.


### Lot 82 — langue de création indépendante de la langue d’interface

- Tour précédent classé **progression** : collecte automatique des vidéos connues validée. Défaut identifié : l’éditeur envoyait la langue UI pour texte/audio/QCM, même pour une formation d’une autre langue.
- Sélecteur FR/EN/AR dans les créations manuelle/IA et l’éditeur. Ce dernier reprend la langue du cours comme défaut ; choix explicite pour les nouvelles générations uniquement, contenu existant inchangé. Plan sauvegardé et langue restent figés lors d’une reprise.
- TypeScript/build réussis. Dernière suite complète : 251 tests (lot 81), pas de nouveau test reproduisant les affectations UI. Documentation `docs/studio-content-language.md`.
- Restent recette navigateur multilingue, narration locale du lecteur avec langue versionnée et autres chantiers. Aucun changement serveur/migration ni nouvelle recette Docker nécessaire. Aucun fournisseur appelé ni déploiement. Objectif global non achevé.


### Lot 83 — narration locale dans la langue du curriculum suivi

- Tour précédent classé **progression** : choix de langue explicite dans le studio. Les trois usages de SlideDeck transmettent maintenant la langue de contenu : brouillon en prévisualisation, training versionné de l’inscription dans les deux lecteurs apprenants.
- SpeechSynthesis choisit FR/EN/AR à partir de cette langue, sans modifier les boutons UI ni les fichiers audio. Repli UI pour les données anciennes inconnues, arrêt d’une narration lors d’un changement de langue de contenu.
- 251 tests réussis (186 PostgreSQL), TypeScript/build réussis. Scénario existant renforcé via l’API dashboard : langue arabe retenue pour l’ancienne inscription après publication anglaise pour une nouvelle.
- Documentation `docs/studio-content-language.md` actualisée. Source versionnée prouvée, prononciation/voix navigateur non testées. Restent recette réelle et autres chantiers. Aucune migration ni nouvelle recette Docker nécessaire. Aucun fournisseur appelé ni déploiement. Objectif global non achevé.

### Lot 84 — émission de facture figée et PDF multipage

- Tour précédent classé **progression** : langue de narration versionnée. Remplacement du PDF qui reprenait les noms actuels, tronquait les lignes et contenait des identifiants/mentions d’agrément fictifs.
- Configuration explicite de l’émetteur et formulaire acheteur FR/EN/AR ; aucune émission nouvelle sans coordonnées valides. Prix de commande et titres versionnés si disponibles, rapprochement des sommes avant émission.
- Compteur annuel et archive immuable sous verrou de commande ; fichier unique, instantané, empreinte et taille conservés. Nouvelle consultation idempotente, droits fondés sur l’archive et refus des octets altérés. Documents historiques conservés sans prétendre les certifier.
- 253 tests réussis (188 PostgreSQL), TypeScript/build, Compose, construction et recette Docker avec restauration réussis. Deux nouveaux tests SQL ; erreur de liaison Date SQL et compatibilité du retour pour commande étrangère corrigées avant validation finale.
- Spécimen synthétique de 60 lignes : six pages rendues et inspectées, toutes les lignes, montants et pieds de page vérifiés. Documentation `docs/invoice-archive.md` et configuration exemple actualisées.
- Restent identité juridique réelle, règles fiscales, avoirs, facturation électronique, police arabe PDF et recette navigateur. Aucun document commercial réel, appel fournisseur ou déploiement. Objectif global non achevé.

### Lot 85 — noms et descriptions arabes dans les factures

- Tour précédent classé **progression** : archive et PDF multipage validés. Remplacement d’Helvetica par Noto Sans Arabic embarquée, licence et provenance conservées. Libellés français accentués ; archives antérieures inchangées.
- Ordre bidirectionnel Unicode par paragraphe et ligne, segments arabes conservés pour la liaison des lettres, références/chiffres latins préservés, parenthèses reflétées. Découpage de références longues aux graphèmes ; mesures et rendu utilisent les mêmes segments.
- 255 tests réussis (188 PostgreSQL), TypeScript/build réussis. Deux nouveaux tests sur directions, parenthèses et largeur. Déclaration TypeScript locale car aucun paquet @types disponible ; appel de miroir individuel conforme à l’API, la fonction de carte de la version installée ne prenant pas la structure annoncée dans son README.
- Spécimen mixte FR/AR sur une page et facture de 60 lignes sur sept pages rendus et inspectés intégralement. Toutes les lignes, totaux et numéros de page vérifiés par extraction pour le document long.
- Construction, rendu de police dans Docker sous UID 1000 sans réseau et recette Docker complète avec restauration réussis ; ressources jetables nettoyées. Documentation de facturation actualisée.
- Restent traduction des libellés PDF, pagination interne des blocs exceptionnellement hauts, autres écritures et chantiers fiscaux précédents. Aucun document commercial réel, fournisseur appelé ou déploiement. Objectif global non achevé.

### Lot 86 — pagination des adresses et descriptions hautes

- Tour précédent classé **progression** : texte arabe/latin et police Docker validés. Le moteur permet désormais de dessiner un sous-ensemble des lignes mesurées ; paragraphes et cellules hauts continuent dans la zone disponible des pages suivantes.
- En-tête « Prestation (suite) » pour une description poursuivie, montants non répétés, conservation des blocs ordinaires et des pieds de page.
- 256 tests réussis (188 PostgreSQL), TypeScript/build réussis. Nouveau test avec vrai PDF et observation des coordonnées, unicité des 140 lignes d’adresse/description et des montants, présence de continuations.
- Spécimen haut de quatre pages inspecté intégralement ; extraction des 140 repères, total et pagination validée. Spécimen FR/AR régénéré et inspecté. Documentation actualisée ; aucune migration/dépendance modifiée, dernière recette Docker complète au lot 85.
- Restent traduction des libellés, règles fiscales, avoirs et autres chantiers de la plateforme. Aucun document commercial réel, fournisseur appelé ou déploiement. Objectif global non achevé.

### Lot 87 — langue de facture choisie et conservée

- Tour précédent classé **progression** : blocs hauts paginés. Sélecteur FR/EN/AR avant émission, validation de route, langue conservée dans l’instantané immuable ; récupération ultérieure inchangée même si une autre langue est demandée.
- Libellés traduits, hauteur des en-têtes adaptée, contenus déclarés non traduits avec explication dans le formulaire. Défaut français pour les anciens appelants/instantanés.
- Recette visuelle ayant révélé une inversion des groupes de dates arabes : isolation des dates/montants/taux, lignes de dates distinctes et retrait des contrôles directionnels avant dessin. Correction vérifiée avant validation finale.
- 259 tests réussis (188 PostgreSQL), TypeScript/build réussis. Trois nouveaux rendus testés, scénario SQL renforcé pour la langue immuable et scénario de date isolée ajouté au test de texte.
- Spécimens FR/EN d’une page chacun et AR de deux pages inspectés intégralement. Documentation actualisée ; aucune migration/dépendance, dernière recette Docker complète au lot 85. Restent fiscalité, avoirs, recette navigateur et autres chantiers. Aucun fournisseur réel appelé ni déploiement. Objectif global non achevé.

### Lot 88 — vérification publique fidèle au statut du certificat

- Tour précédent classé **progression** : langue de facture archivée. Retour au parcours apprenant ; défaut identifié du bandeau public toujours vert et de l’expiration ignorée.
- Statut serveur valid/expired/revoked, révocation prioritaire, échéance exacte expirée. Bandeau/icône/champ cohérents FR/EN/AR, dates locales en UTC. Projection publique minimale, identifiant interne utilisé seulement pour audit, code borné/validé.
- Retrait du lien PDF privé de la réponse publique et de ses boutons inutilisables sans droits ; indication de l’espace personnel. Retrait de l’affirmation d’agrément non établie sur cette page.
- 261 tests réussis (189 PostgreSQL), TypeScript/build réussis. Nouveau test SQL via route réelle et test de frontière temporelle. Aucun effacement de certificat ni annulation de réussite fondée sur un remboursement.
- `docs/certificate-verification.md` consigne les suites concrètes : transaction d’émission, origine du QR, mentions PDF, identité historique, intégrité et révocation auditée. Recette navigateur non effectuée ; aucune migration/dépendance/nouvelle recette Docker. Aucun fournisseur réel ou déploiement. Objectif global non achevé.

### Lot 89 — QR de certificat lié à l’adresse officielle

- Tour précédent classé **progression** : vérification publique corrigée. Origine du QR et URL imprimée issues de la configuration serveur canonique partagée avec la récupération de mot de passe. Origine navigateur ignorée ; validation HTTPS stricte en production, récupération historique sans réémission.
- Première émission bloquée avant écriture si configuration absente/invalide. Retrait des mentions d’agrément EASA et de direction codées en dur dans le modèle PDF ; référence présentée comme référence de formation.
- 263 tests réussis (191 PostgreSQL), TypeScript/build réussis. Deux nouveaux tests SQL de QR canonique, origine hostile ignorée, document existant et absence d’écriture sur configuration invalide.
- Spécimen synthétique rendu et inspecté sur une page, URL imprimée vérifiée. Documentation actualisée. Restent émission atomique, identité/scope/signataire vérifiés, archive et révocation auditée ; aucun certificat réglementaire opérationnel revendiqué.
- Aucune migration/dépendance, dernière recette Docker complète au lot 85. Aucun fournisseur réel appelé ni déploiement. Objectif global non achevé.

### Lot 90 — émission de certificat et preuves dans une transaction

- Tour précédent classé **progression** : QR canonique et mentions PDF corrigés. Verrou d’inscription pendant émission ; recherche du document existant après verrou. Certificat, objectifs et preuve personnelle écrits dans la même transaction, curriculum lu par son exécuteur.
- Création séparée d’une preuve historique sous transaction et verrou du certificat pour sérialiser les reprises. Aucun doublon historique supprimé ni contrainte rétrospective imposée.
- 266 tests réussis (194 PostgreSQL), TypeScript/build réussis. Trois nouveaux tests SQL de concurrence d’émission, véritable panne SQL de preuve avec rollback/reprise et concurrence de preuve historique. Assertion initiale adaptée à l’erreur PostgreSQL encapsulée par Drizzle ; déclencheur de panne retiré.
- Documentation de certification actualisée : fichier orphelin possible avant commit, contrôle concurrent complet des droits et archive historique encore à renforcer. Modèle PDF inchangé ; aucune migration/dépendance/nouvelle recette Docker nécessaire.
- Restent identité/scope/signataire vérifiés, archives et révocations auditées, autres chantiers de plateforme. Aucun fournisseur réel ou déploiement. Objectif global non achevé.

### Lot 91 — protection réelle du téléchargement des certificats

- Tour précédent classé **progression** : émission transactionnelle. Avant l’archive, inspection du serveur de fichiers révélant que certificates/ était encore public. Correction explicite du constat du lot 88 : retrait du lien seulement, protection du fichier non réalisée à ce stade.
- Namespace désormais privé, certificat référencé requis, titulaire actif ou administrateur actif. Tiers/managers sans droit implicite, comptes suspendus et fichiers orphelins refusés. Pièce jointe sans cache partagé ; document révoqué conservé pour son titulaire.
- 268 tests réussis (195 PostgreSQL), TypeScript/build réussis. Nouveau test HTTP de branchement/authentification simulée et nouveau test SQL des droits réels. Documentation rectifiée, copies déjà obtenues non rappelables.
- Archive immuable à poursuivre ; aucun changement PDF, migration ou dépendance, dernière recette Docker complète au lot 85. Aucun fournisseur réel appelé ni déploiement. Objectif global non achevé.

### Lot 92 — archive immuable et intégrité des certificats

- Tour précédent classé **progression** : téléchargement réellement privé. Nouvelle migration certificate_archives : instantané d’identité/contenu/preuve/URL, clé de stockage, taille et empreinte. Archive insérée dans la transaction d’émission ; UPDATE/DELETE/TRUNCATE refusés.
- Identité du certificat archivé protégée, suppression empêchée ; isValid peut encore évoluer en attendant le workflow de révocation. Date de réussite absente bloquante, sans date du jour inventée.
- Vérification publique et liste personnelle lisent les données archivées. Octets PDF contrôlés avant envoi privé ; anciennes émissions conservées sans empreinte rétrospective inventée.
- 270 tests réussis (197 PostgreSQL), TypeScript/build réussis. Deux nouveaux scénarios SQL, rollback d’archive et refus HTTP d’intégrité ajoutés aux scénarios existants. Lecture d’archive superflue introduite dans getEnrollmentById retirée avant validation finale.
- Construction et recette Docker finale avec restauration réussies, ressources jetables nettoyées ; image af4269f18d95d85a23f989e0317a4107e1b1cd338004c23ff9784495f1009d3f. Documentation actualisée, modèle PDF inchangé.
- Restent révocation auditée, identité/scope/signataire réglementaires et autres chantiers. Aucun fournisseur réel appelé ni déploiement. Objectif global non achevé.

### Lot 93 — parcours administratif de révocation motivée

- Tour précédent classé **progression** : archive et intégrité des nouvelles émissions. Onglet Certificats FR/EN/AR : recherche exacte, identité/titre/statut, motif et confirmation explicite, lecture d’historique. Consultation admin journalisée.
- Administrateur actif vérifié sous verrou, certificat verrouillé, événement acteur/motif/date et désactivation dans une transaction. Répétition/concurrence idempotentes, événement immuable, réactivation d’une révocation auditée refusée par PostgreSQL. Aucun faux historique pour les certificats anciennement invalides.
- 272 tests réussis (199 PostgreSQL), TypeScript/build réussis. Deux scénarios SQL via routes réelles couvrent droits, validation, concurrence, statut public, conservation du document et protections SQL.
- Migration additive, construction et recette Docker finale avec restauration réussies ; ressources jetables nettoyées. Documentation actualisée ; recette navigateur non effectuée.
- Restent prise en compte des certificats révoqués dans tous les usages de preuves, éventuelle correction/remplacement, cadre réglementaire et autres chantiers. Aucun fournisseur réel appelé ni déploiement. Objectif global non achevé.

### Lot 94 — validité des preuves dans le dossier compagnie

- Tour précédent classé **progression** : révocation motivée opérationnelle côté admin. Défauts identifiés dans la projection compagnie : expiration de certificat ignorée et couverture issue de preuves sans contrôle du certificat lié.
- Certificat explicitement valide/non expiré requis ; preuve LIVING non expirée, visible et rattachée à une formation requise. Pour une preuve liée, certificat valide du titulaire et même formation requis ; données manquantes écartées du calcul actuel.
- 274 tests réussis (200 PostgreSQL), TypeScript/build réussis. Nouveau test pur des cas invalides et scénario SQL révocation → dossier compagnie avec couverture retirée et historique conservé.
- Aucun effacement, gel automatique ni modification du calendrier de récurrence. Documentation précise la distinction entre couverture pédagogique et licence, ainsi que les autres usages encore à examiner (signatures/exports).
- Aucune migration/dépendance/UI ni nouvelle recette Docker ; dernière recette complète au lot 93. Aucun fournisseur réel appelé ni déploiement. Objectif global non achevé.

### Lot 95 — contrôle des preuves référencées par une signature

- Tour précédent classé **progression** : couverture actuelle compagnie corrigée. Défaut identifié : credentialId accepté sans validation de propriété, partage ou certificat associé.
- Contrôle transactionnel sous verrous partagés de la preuve/certificat : bon technicien, partage ou attribution à la compagnie, formation cohérente. VALIDATED exige preuve active/non expirée et certificat valide correspondant ; REJECTED peut conserver le constat d’une preuve révoquée.
- Identifiants/scopes/note bornés dans la route. La décision humaine sans référence explicite de preuve reste distincte d’une validation automatique documentaire.
- 275 tests réussis (201 PostgreSQL), TypeScript/build réussis. Nouveau scénario SQL via route réelle, refus sans écriture et acceptations valides ; assertions ciblées sur codes d’erreur repassées.
- Documentation `docs/signoff-evidence.md` : restent verrouillage complet des droits, instantané/immutabilité/idempotence et ciblage des preuves verrouillées. Aucune migration/dépendance/UI/nouvelle recette Docker ; dernière recette complète au lot 93. Aucun fournisseur réel appelé ni déploiement. Objectif global non achevé.

### Lot 96 — droits et conservation de preuve atomiques à la signature

- Tour précédent classé **progression** : référence de preuve sécurisée. Le service relit/verrouille acteur, compagnie, salarié, technicien et affiliations ; rôle MANAGER actif requis hors administrateur, association salarié/compte/compagnie vérifiée, affiliation réellement lue conservée.
- Preuve explicite verrouillée pour écriture et conservation posée dans la transaction seulement pour VALIDATED. Retrait du verrouillage ultérieur de toutes les preuves par la route de signature ; rejet et preuves non utilisées laissés inchangés.
- 275 tests réussis (201 PostgreSQL), TypeScript/build réussis. Scénario SQL renforcé sur paramètres devenus périmés après changement de rôle/activité/affiliation et conservation ciblée.
- Documentation actualisée ; instantanés, immutabilité, idempotence et autre chemin de verrouillage lors de lecture à poursuivre. Aucune migration/dépendance/UI/nouvelle recette Docker, dernière recette complète au lot 93. Aucun fournisseur réel appelé ni déploiement. Objectif global non achevé.

### Lot 97 — décisions de signature immuables et contexte conservé

- Tour précédent classé **progression** : droits et conservation de la preuve vérifiés dans la transaction. Migration additive signoff_snapshots : instantané nullable et refus PostgreSQL de modification, suppression et TRUNCATE des décisions.
- Chaque nouvelle signature conserve les noms du responsable et du technicien, le titre de formation et l’état de la preuve/certificat au moment de la décision. Lecture historique fondée sur cet instantané ; aucun historique reconstitué pour les anciennes signatures. Même en rejet, un certificat lié appartenant à une autre personne ou formation est refusé.
- 275 tests réussis (201 PostgreSQL), TypeScript/build réussis. Scénario SQL renforcé : changements ultérieurs de nom/titre/statut sans altération du constat passé, refus UPDATE/DELETE. Un test d’expiration d’examen inspecte désormais sa propre erreur : sa recherche dans la première page globale de 100 erreurs devenait instable avec l’accumulation des fixtures conservées.
- Construction Docker et recette complète, redémarrage puis sauvegarde/restauration réussis ; ressources jetables nettoyées. Image : sha256:8d2e1320a4d5740cac3db32493d99ac9acc51aca5fc56ccc1ba364edb5e96331. Avertissement de taille de bundle toujours présent.
- Restent rectification par nouvelle décision, reprise idempotente et examen du verrouillage à la consultation du dossier. Aucun fournisseur réel appelé ni déploiement. Objectif global non achevé.

### Lot 98 — consultation sans gel et retrait sans destruction des preuves

- Tour précédent classé **progression** : signatures immuables, recette Docker et restauration vérifiées. La lecture du dossier compagnie ne verrouille plus toutes les preuves ; suppression du service global devenu inutilisé. Aucun déverrouillage rétrospectif des données historiques.
- Retrait d’une preuve indépendante sous transaction/verrou de ligne : contrôle de propriété et de conservation, arrêt du partage par mise à null du marqueur, sans suppression de l’enregistrement ni rupture des références de décisions passées. Sérialisation avec une signature simultanée.
- 275 tests réussis (201 PostgreSQL), TypeScript/build réussis. Scénario SQL renforcé : lecture sans verrou, tiers refusé, preuve validée protégée, preuve rejetée retirée mais conservée, refus d’une nouvelle signature et concurrence signature/retrait cohérente.
- Pas de migration/dépendance/UI ; dernière recette Docker complète au lot 97. Restent historique détaillé du partage, portée multi-compagnies, reprise idempotente et rectification des décisions. Aucun fournisseur réel appelé ni déploiement. Objectif global non achevé.

### Lot 99 — reprise d’une signature sans décision en double

- Tour précédent classé **progression** : consultation sans verrouillage et retrait conservatoire. UUID de demande obligatoire sur la route de signature, index unique par responsable et empreinte des paramètres dans la décision immuable. Verrou transactionnel de demande après contrôle des droits, relecture historique pour les répétitions identiques, CONFLICT si le contenu diffère.
- Le bouton conserve la demande après erreur dans le composant et la renouvelle après succès. Pas de restauration après rechargement du navigateur ; les anciennes décisions n’obtiennent pas de faux identifiant. Le journal d’accès peut conserver plusieurs tentatives.
- 275 tests réussis (201 PostgreSQL), TypeScript/build réussis. Tests renforcés pour concurrence, conflit de contenu et reprise avec instantané original. Test d’accès étranger adapté à l’UUID obligatoire. Ancien serveur de développement sur la base jetable identifié puis arrêté : son collecteur interférait avec deux tests vidéo. Suite finale relancée sans ce processus.
- Migration additive, construction Docker et recette complète avec sauvegarde/restauration réussies ; image sha256:03fcaae9c1630dbc94871ebe9c168ef1e1bf8bf69aa57895b79fa708e61414cb. Ressources de recette nettoyées. Avertissement de bundle toujours présent ; pas de recette navigateur.
- Restent rectification explicite des décisions, partage multi-compagnies, journal de partage et autres chantiers. Aucun déploiement. Objectif global non achevé.

### Lot 100 — preuves limitées à leur compagnie destinataire

- Tour précédent classé **progression** : reprise de signature sans doublon, recette Docker validée. Le partage personnel exige une compagnie explicite et vérifie compte/compagnie/affiliation actifs dans la transaction. Suppression du choix arbitraire de la première affiliation.
- Projection compagnie limitée aux preuves de l’affiliation concernée. Signature VALIDATED ou REJECTED refusée pour une preuve d’une autre affiliation ou sans rattachement. Les certificats affichés exigent aussi une preuve visible active/non expirée de cette affiliation et de la même formation, puis les contrôles de validité existants.
- Nouveau scénario SQL via routes réelles : technicien dans deux compagnies, partages séparés, preuve assignée et preuve historique non rattachée, couverture et certificat isolés, signatures étrangères refusées, retrait sans effet sur l’autre compagnie, destination absente/suspendue refusée.
- Aucun effacement ou rattachement rétroactif. Une destination par enregistrement ; partage d’une source unique vers plusieurs compagnies et interface de sélection restent à développer. Pas de migration/dépendance/UI, dernière recette Docker complète au lot 99. Aucun fournisseur appelé ni déploiement. Objectif global non achevé.
- Validation finale : 276 tests réussis (202 PostgreSQL), TypeScript et build réussis ; avertissement de taille de bundle inchangé.

### Lot 101 — parcours personnel de partage et retrait des certificats

- Tour précédent classé **progression** : isolation des preuves par affiliation. Nouveau composant de dossier personnel FR/EN/AR : certificat valide, choix explicite de compagnie, destinataires, partages retirables, retraits verrouillés et confirmation avant retrait. États vide/chargement/erreur/succès via dossier et mutations existants.
- Route de partage d’un certificat existant : droits actuels et titulaire vérifiés sous verrous, validité requise, formation/échéance/objectifs dérivés du certificat (archive prioritaire). Sérialisation titulaire/affiliation/certificat et réutilisation du partage actif. Retrait conservatoire ; nouveau partage après retrait sans réécriture de l’ancien. Aucun PDF modifié, aucune validation automatique.
- Deux défauts révélés pendant la suite ont été corrigés : compteur administratif de conférence explicitement corrélé à webinars.id (nouveau test avec deux salles, 0 et 3 inscrits) ; émission refusée si le certificat déjà lié à une inscription concerne un autre titulaire/formation (nouveau test de refus, aucun PDF).
- Des fixtures sans inscription utilisaient abusivement un ID utilisateur comme ID inscription et pouvaient coïncider avec les inscriptions d’autres tests. Elles utilisent désormais un identifiant synthétique négatif hors séquence des inscriptions. Ancienne base raero_test conservée pour diagnostic, sans suppression ni réparation d’historique. Nouvelle base jetable raero_test_isolated, même conteneur/port 55477, initialisée par les migrations : utiliser désormais RAERO_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55477/raero_test_isolated.
- 278 tests réussis (204 PostgreSQL), TypeScript/build réussis. Scénario de partage renforcé : concurrence, destinataire personnel, propriété, invalidité/expiration, retrait/repartage et original intact. Pas de nouvelle migration/dépendance. Avertissement de bundle inchangé ; pas de recette navigateur.
- Restent formulaire déclaratif externe, historique détaillé de partage, rectification des signatures et autres chantiers. Aucun déploiement. Objectif global non achevé.
- Recette finale Docker avec contrôles HTTP, redémarrage, sauvegarde/restauration réussie ; image sha256:7613f3c3331e8372ab200658f67b7b024c3282543b9f5c159ebc5ca83b436616. Ressources jetables de recette nettoyées.

### Lot 102 — historique immuable du partage personnel

- Tour précédent classé **progression** : parcours personnel de partage et retrait, validations et recette Docker. Migration additive credential_sharing_events avec référence de preuve, événements personnels SHARED/WITHDRAWN, libellés et destination constatés, refus UPDATE/DELETE/TRUNCATE.
- Événement et mutation métier dans la même transaction pour partage déclaratif, certificat partagé et retrait ; une reprise de partage actif ne crée pas de doublon. Compte actif revérifié sous verrou avant retrait. Aucune reconstitution d’événements anciens.
- Historique personnel FR/EN/AR dépliable, 25 événements par page, curseur décroissant, états vide/erreur/reprise et chargement à la demande. Route limitée au titulaire authentifié. Les libellés des événements restent stables après renommage.
- 279 tests réussis (205 PostgreSQL), TypeScript/build réussis. Nouveau scénario SQL : pagination sans doublon, lecture tierce vide, libellés immuables, refus UPDATE/DELETE, refus de suppression d’une preuve référencée, échec SQL d’historique provoqué avec rollback du partage et du retrait. Test de partage concurrent renforcé pour un seul événement.
- L’ancien parcours d’effacement doit encore être repris : il comporte des suppressions incompatibles avec la conservation et n’est pas réputé opérationnel/conforme. Aucun effacement exécuté. Restent ce parcours, rectification de signature et autres chantiers. Pas de recette navigateur ni déploiement ; objectif global non achevé.
- Construction Docker et recette finale avec redémarrage et sauvegarde/restauration réussies ; ressources jetables nettoyées. Image sha256:a15240db53361ad0a3b3f6cd8c99029a359bf76416918f53b2f938daa91b9507. Avertissement de bundle inchangé.

### Lot 103 — fermeture atomique du profil sans destruction des justificatifs

- Tour précédent classé **progression** : historique immuable du partage. L’ancien effacement pouvait supprimer une partie du dossier puis échouer sur les preuves ou examens protégés. Remplacement par une fermeture explicitement décrite comme distincte d’un effacement complet des données.
- Transaction unique : droits actuels, mot de passe pour le titulaire, journal immuable account_closures, gel des preuves sans transfert de contrôle/affiliation, retrait des champs d’identité du profil et secrets, suspension avec rotation de session, fin des affiliations actives et détachement du compte dans le registre salariés. Examens, tentatives, certificats, factures et historiques conservés ; aucune suppression.
- Fermetures sérialisées et protection du dernier administrateur actif ; réactivation d’une fermeture auditée refusée par PostgreSQL. Interface personnelle FR/EN/AR avec mot de passe, confirmation et description de conservation. Libellés administratifs corrigés. Anciens noms de routes gardés, résultat métier actualisé.
- 282 tests réussis (208 PostgreSQL), TypeScript/build réussis. Trois scénarios SQL : droits/mot de passe, fermeture personnelle, preuve et examens intacts, session révoquée, journal et non-réactivation, rollback complet d’un échec d’audit, deux administrateurs en fermeture concurrente. Seuls des comptes synthétiques ont été fermés.
- La fermeture ne vaut pas effacement complet et ne résilie pas les abonnements compagnie. Restent dépôt/suivi/instruction des demandes de confidentialité et politique de conservation par catégorie, ainsi que les autres chantiers. Pas de recette navigateur ou déploiement ; objectif global non achevé. Documentation : docs/account-closure.md.
- Construction Docker et recette finale avec sauvegarde/restauration réussies ; ressources de recette nettoyées. Image sha256:9fe0321417c881524951b2edadfe3cd2c4907dbc67bd0e740fe3dbd1d275a62c. Avertissement de bundle inchangé.

### Lot 104 — droits actuels pour les fichiers, inscriptions et réservations

- Tour précédent classé **progression** : fermeture atomique et conservation. Les téléchargements privés relisent maintenant le compte, son statut/version de session et son rôle actuel ; les anciens objets utilisateur ou rôles transmis ne servent plus d’autorité.
- Accès pédagogique à une inscription conditionné au compte actuellement actif. Réservations session/webinaire et annulation personnelle verrouillent le compte dans la transaction avant la séance, pour sérialiser leur contrôle avec une fermeture.
- 282 tests réussis (208 PostgreSQL), TypeScript/build réussis. Scénario de fermeture renforcé : accès avant, refus fichier/inscription et nouvelles réservations après. Test fichiers : rôle fabriqué refusé, admin réel accepté puis refus après retrait du rôle, ancienne version de session refusée. Fixture unitaire pédagogique complétée avec statut actif.
- Pas de migration/UI/dépendance ni nouvelle recette Docker ; dernière recette complète au lot 103. Avertissement de bundle inchangé. Restent demandes de confidentialité, autres traitements en cours et révocation des accès prestataires selon leurs capacités. Aucun fournisseur appelé ou déploiement ; objectif global non achevé.

### Lot 105 — exports CSV cohérents et valeurs de formule marquées comme texte

- Tour précédent classé **progression** : droits après fermeture vérifiés. Quatre exports réunis sur un sérialiseur commun : salariés, récurrences, suivi administratif, dossier technicien. Champs tous entourés de guillemets, guillemets internes doublés, CRLF et BOM UTF-8.
- Préfixes de formule simples, pleine largeur et précédés de caractères invisibles marqués comme texte, ainsi que les débuts tabulation/CR/LF. Correction également des séparateurs et retours à la ligne auparavant susceptibles de casser les lignes des trois exports non échappés.
- Deux tests ciblés de format et de charges adverses ; aucune dépendance ou migration. Référence OWASP et limites de réenregistrement documentées dans docs/csv-exports.md ; aucune promesse de protection universelle ou de recette Excel réalisée.
- Pas de modification des champs métier/droits d’export, ni nouvelle recette Docker (dernière complète au lot 103). Restent autres chantiers de confidentialité, interface et exploitation. Aucun déploiement ; objectif global non achevé.
- Validation finale : 284 tests réussis (208 PostgreSQL), TypeScript/build réussis. Avertissement de taille de bundle inchangé.

### Lot 106 — validité et historique des certificats dans le rapport administratif

- Tour précédent classé **progression** : exports CSV corrigés. Le rapport affichait les numéros en vert sans vérifier la révocation/expiration. Ajout des états valide/expiré/révoqué/non émis/rattachement à vérifier, séparés de l’état pédagogique et de la fin d’accès.
- Tableau et CSV enrichis avec état, échéance propre du certificat et titulaire. Archive préférée pour titre/titulaire ; données actuelles conservées pour le compte, sans historique reconstruit pour les anciennes émissions. Numéros expirés/révoqués conservés mais sans signal de validité vert.
- Un seul certificat cohérent par inscription requis ; liens étrangers ou multiples signalés sans numéro arbitraire. Une seule ligne par inscription. Lecture remplacée par une requête avec jointures et regroupement, en gardant les droits admin et le journal d’accès.
- 285 tests réussis (209 PostgreSQL), TypeScript/build réussis. Nouveau scénario SQL des six situations et droits ; scénario d’archive renforcé après renommage. Aucun PDF, migration ou dépendance modifié ; avertissement de bundle inchangé.
- Rapport encore chargé intégralement ; pagination à compléter. Aucune détermination réglementaire automatique revendiquée. Pas de recette navigateur ou nouvelle recette Docker (dernière complète au lot 103), ni déploiement. Objectif global non achevé ; docs/administrative-report.md.

### Lot 107 — rapport paginé et CSV complet sans troncature silencieuse

- Tour précédent classé **progression** : état actuel et identité archivée des certificats dans le rapport. Route paginée à 50 inscriptions, ordre par identifiant décroissant et sélection des inscriptions avant jointure des certificats. Une inscription ambiguë reste une seule ligne ; curseur strict.
- Interface avec chargement de première page, suite et reprise sur erreur. Export séparé qui parcourt toutes les pages avant création du fichier, affiche la préparation et interrompt sur erreur ou curseur non progressant. Le CSV n’est pas limité aux lignes déjà affichées.
- 288 tests réussis (210 PostgreSQL), TypeScript/build réussis. Nouveau scénario SQL à plus de 50 inscriptions avec ajout pendant le parcours ; aucun doublon et ajout ultérieur exclu. Deux tests d’assemblage complet/échec/cycle ; fixtures de rapport et d’archive adaptées.
- Construction Docker et recette complète avec sauvegarde/restauration réussies ; image sha256:3eb142aec0307a1e00aaeb613560d43eb0b426cde36be5e4e841c89c3c5293a6. Ressources de recette nettoyées ; avertissement de bundle inchangé. Pas de migration/dépendance ou recette navigateur.
- Les valeurs métier peuvent évoluer entre pages ; pas d’instantané global revendiqué. L’export complet reste en mémoire navigateur. Autres chantiers de confidentialité, exploitation et interface encore ouverts. Aucun déploiement ; objectif global non achevé.

### Lot 108 — export personnel version 3 avec les archives et historiques récents

- Tour précédent classé **progression** : rapport paginé et export CSV complet validés. Ajout au JSON personnel des décisions concernant le titulaire, événements de partage, archives de certificats/factures, motifs de révocation des certificats du titulaire et fermeture éventuelle du compte.
- Filtres SQL par personne, jointures de titularité pour certificats/révocations, projections explicites sans clés de stockage ou empreintes de reprise. Aucun accès ajouté à la vérification publique. Pas de PDF inclus ; formatVersion passe de 2 à 3.
- 289 tests réussis (211 PostgreSQL), TypeScript/build réussis. Nouveau scénario avec deux titulaires et leurs archives/historiques, fermeture synthétique et exclusion du second titulaire/des métadonnées internes. Tests antérieurs de secrets/corrigés conservés.
- Pas de migration/UI/dépendance ou nouvelle recette Docker (dernière complète au lot 107). Export utilisateur encore réservé aux sessions actives ; délivrance après fermeture, demandes de confidentialité et catégories auteur/IA restent à compléter. Aucune exhaustivité ou conformité globale revendiquée ; docs/personal-export.md.
- Avertissement de bundle inchangé. Aucun compte réel fermé ni déploiement ; objectif global non achevé.

### Lot 109 — dépôt de demandes de confidentialité dans le support privé

- Tour précédent classé **progression** : export personnel v3 enrichi. Ajout des types accès aux données/rectification/effacement au support existant, lien depuis le dossier personnel et sélection FR/EN/AR avec description obligatoire. Catégorie visible côté titulaire et administrateur.
- Migration requestKind, défaut GENERAL pour les anciens tickets, modification de la catégorie originale refusée. Création compte actif sous verrou et transaction ticket/message : aucune demande sans son message si l’écriture échoue. Aucun changement de compte au dépôt.
- 291 tests réussis (213 PostgreSQL), TypeScript/build réussis. Deux scénarios SQL des types, isolation, validation, conservation de catégorie, transaction et auteur suspendu. Emails neutralisés dans les tests ; aucun message réel envoyé.
- Dépôt et suivi utilisent le fil et le statut existants ; fermeture d’un ticket ne prouve pas l’exécution d’un effacement. Réception après fermeture du compte, décision motivée, journal immuable, délais et livraison sécurisée restent à compléter. Pas de recette navigateur ou déploiement ; objectif global non achevé. Documentation : docs/privacy-requests.md.
- Construction Docker et recette finale avec sauvegarde/restauration réussies ; image sha256:a29968d7682de28530f7263bc7960dab5e3cedfb70ad7af8452b6bcf98f9be3b. Ressources jetables nettoyées, avertissement de bundle inchangé.

### Lot 110 — suivi de support journalisé et clôture motivée des demandes de confidentialité

- Tour précédent classé **progression** : dépôt typé dans le support privé. Migration support_status_events : création et transitions journalisées, acteur/nom/états/explication/date conservés ; UPDATE/DELETE/TRUNCATE refusés, références de tickets conservées.
- Mutation de statut avec administrateur actif relu sous verrou, ticket verrouillé, mise à jour et événement atomiques. Répétition identique sans doublon. Explication obligatoire pour clôturer une demande de confidentialité, recueillie dans l’interface admin.
- Historique du fil FR/EN/AR réservé titulaire/admin actifs, paginé à 25 événements, rafraîchi pendant consultation, avec texte de clôture visible au titulaire. Inclusion dans l’export personnel par filtrage du ticket. Erreurs de réponse et de changement de statut affichées.
- 293 tests réussis (215 PostgreSQL), TypeScript/build réussis. Deux nouveaux scénarios de concurrence/raison/droits actuels/pagination/export/immutabilité et rollback d’échec SQL. Aucune reconstitution d’événements anciens.
- La clôture est un acte de suivi, pas la preuve d’un effacement. Décisions structurées, pièces d’exécution, délais, messages historiques et parcours après fermeture restent à compléter. Pas de recette navigateur ni déploiement ; objectif global non achevé.
- Construction Docker et recette complète avec sauvegarde/restauration réussies ; image sha256:871799f9aa39522b0c7832b08e5bc6802947c3343964587107240099100f0d56. Ressources de recette nettoyées, avertissement de bundle inchangé.

### Lot 111 — lecture et réponse de support sous droits actuels

- Tour précédent classé **progression** : journal de statut et clôture expliquée. Lecture et réponse vérifient désormais l’acteur actif et sa propriété du ticket ou son rôle admin dans le service, avec verrous sur acteur/ticket pendant la transaction.
- Message et mise à jour du ticket atomiques. Lecture du fil par jointure limitée au nom/rôle de l’auteur, sans requête d’email inutile ; ordre stable par date et identifiant. Aucune promesse d’immutabilité du contenu des messages ajoutée.
- 294 tests réussis (216 PostgreSQL), TypeScript/build réussis. Nouveau scénario SQL : droits directs, retrait du rôle admin, suspension du titulaire et rollback complet d’un échec de mise à jour du ticket.
- Pas de migration/UI/dépendance ni nouvelle recette Docker (dernière complète au lot 110). Avertissement de bundle inchangé. Décisions structurées, délais et parcours après fermeture restent ouverts avec les autres chantiers. Aucun email réel ou déploiement ; objectif global non achevé.

### Lot 112 — dictionnaires chargés selon la langue choisie

- Tour précédent classé **progression** : lecture et réponse de support protégées par droits actuels. Extraction exacte des 1 651 clés et replis de chaque langue vers trois JSON, chargés à la demande. Fournisseur avec chargement initial, reprise d’erreur, conservation des écrans pendant changement et protection contre les réponses asynchrones anciennes.
- Préférence arabe désormais restaurée après rechargement ; langue/direction HTML et stockage suivent un chargement réussi. Variables répétées remplacées littéralement, y compris `$&`.
- 297 tests réussis (216 PostgreSQL), TypeScript/build réussis. Comparaison des trois dictionnaires aux anciennes valeurs sans différence. Entrée + français : 620 976 octets contre 721 563, soit environ −14 % ; gzip environ −12,5 %. Une requête de dictionnaire ajoutée ; aucune mesure de latence réelle. Avertissement Vite >500 kB toujours présent.
- Pas de migration/dépendance, recette navigateur ou déploiement. Les JSON deviennent les fichiers de traduction à modifier. Documentation : docs/frontend-loading.md. Objectif global non achevé.
- Construction Docker et recette complète avec sauvegarde/restauration réussies ; image sha256:a221c41a9c900831c31834faf1e6f7915d86ad87be9e74fe75604e7189ad52a7. Contrôles HTTP, session après redémarrage, permissions et rôle PostgreSQL validés ; ressources de recette nettoyées. Ces contrôles n’exécutent pas React dans un navigateur.

### Lot 113 — reprise compréhensible des erreurs et chargement traduit

- Tour précédent classé **progression** : dictionnaires séparés et réduction mesurée du JavaScript initial. Remplacement de la trace technique affichée dans l’écran d’erreur global par des textes FR/EN/AR, rechargement et retour à l’accueil ; indication des changements non enregistrés potentiellement perdus. Diagnostic conservé dans la console.
- Indication de chargement des routes visible et traduite, statut accessible, spinner décoratif respectant la réduction des animations. Suppression de maximum-scale=1 qui limitait le zoom mobile.
- TypeScript/build réussis ; aucune modification métier, migration ou dépendance. Suite SQL non relancée pour ces modifications d’affichage ; dernière complète au lot 112 : 297 tests dont 216 PostgreSQL. Dernière recette Docker complète au lot 112. Avertissement de taille du bundle toujours présent.
- Pas de recette navigateur, mesure d’accessibilité globale ou déploiement. Les erreurs précédant le JavaScript initial et les erreurs asynchrones hors rendu ne sont pas couvertes par cette limite React. Documentation : docs/frontend-loading.md. Objectif global non achevé.

### Lot 114 — chargement du lecteur distinct des absences de données

- Tour précédent classé **progression** : erreur globale compréhensible, chargement traduit et zoom mobile. Le lecteur attend l’authentification et les inscriptions avant de conclure à un accès absent. Requête d’inscriptions activée seulement après authentification.
- Attente des réponses de contenu/progressions/questions/tentatives avant affichage du cours ou de l’examen ; les tableaux vides de repli ne masquent plus les erreurs initiales. Message FR/EN/AR et reprise des requêtes manquantes, bouton désactivé pendant chargement.
- QCM de chapitre avec reprise de lecture. Les données déjà présentes restent affichées en cas d’erreur de rafraîchissement pour éviter de démonter le QCM pour cette seule raison. Aucune création de tentative par la reprise des lectures.
- 297 tests réussis (216 PostgreSQL), TypeScript/build réussis ; pas de tests DOM ou recette navigateur de ces états. Pas de migration/dépendance ni nouvelle recette Docker (dernière complète au lot 112). Avertissement Vite toujours présent.
- Les autres erreurs de mutation et la reprise d’émission des certificats restent à améliorer. Documentation : docs/learning-loading.md. Aucun déploiement ; objectif global non achevé.

### Lot 115 — réussite et émission du certificat distinguées

- Tour précédent classé **progression** : états de lecture et reprise du cours. Suppression des promesses de certificat disponible à la seule réussite du QCM ; états FR/EN/AR de préparation, numéro confirmé, erreur/réponse vide et demande initiale.
- Reprise de l’émission depuis les parcours diapositives et modules, y compris après rechargement avec réussite relue. Bouton désactivé pendant demande ; affichage détaillé du résultat conservé dans le parcours modules. Tableau de bord accessible sans prétendre à la validité du document.
- Même mutation et contrôles serveur d’émission ; aucun changement de PDF ou de règle métier. Suppression de l’origine navigateur inutile dans cet appel.
- 297 tests réussis (216 PostgreSQL), TypeScript/build réussis ; scénarios existants d’émission concurrente, répétition et rollback inclus. Aucun test DOM ou recette navigateur de ces états. Pas de migration/dépendance, nouvelle recette Docker ou déploiement ; dernière recette Docker complète au lot 112. Avertissement de taille Vite persistant.
- Documentation : docs/learning-loading.md. Les autres chantiers opérationnels, réglementaires et de recette restent ouverts ; objectif global non achevé.

### Lot 116 — accès mobile aux chapitres et à l’examen final

- Tour précédent classé **progression** : émission du certificat distinguée de la réussite et reprise disponible. Constat : l’unique accès au QCM final du parcours modules était dans la barre latérale masquée sous lg.
- Ajout d’un sélecteur natif de chapitres avec état terminé et d’un accès au QCM final sur petit écran. Même prérequis partagé avec la barre latérale ; explication visible lorsque verrouillé. Accès final ajouté en bas du dernier chapitre pour toutes les tailles.
- Barre de titre et navigation de bas de page autorisent les retours à la ligne ; contenu central rétractable. Traductions existantes réutilisées. Aucun changement des règles serveur ou du parcours diapositives seul.
- TypeScript/build réussis. Suite métier non relancée pour ce lot d’affichage ; dernière complète au lot 115 : 297 tests dont 216 PostgreSQL. Pas de recette navigateur/mobile/clavier/RTL ni de conformité d’accessibilité revendiquée. Protection des réponses non enregistrées lors d’un changement volontaire de chapitre à compléter.
- Documentation : docs/learning-loading.md. Aucun déploiement ; objectif global non achevé.
- Construction Docker et recette complète réussies, incluant les lots d’interface 113–116 ; image sha256:08e961d50503d65a6d8a5cf4cb7099551e77c38cf952fed5c4df2806db638c13. HTTP, session persistée après redémarrage, permissions PostgreSQL et sauvegarde/restauration validés ; ressources de recette nettoyées. La recette n’exécute pas React dans un navigateur. Avertissement de taille du bundle toujours présent.

### Lot 117 — confirmation de sortie d’un QCM actif

- Tour précédent classé **progression** : navigation mobile et accès au QCM final, recette Docker validée. Signal d’activité du QCM transmis au lecteur, y compris pendant démarrage, et retiré après résultat/erreur de démarrage/démontage.
- Confirmation FR/EN/AR avant navigation par les commandes de chapitre, précédent/suivant, accès final et tableau de bord. Rappel explicite du chronomètre continu et du risque pour les réponses non enregistrées. Refus sans changement de navigation.
- Gestionnaire beforeunload temporaire pendant le QCM pour demander l’avertissement natif de fermeture/rechargement. Affichage contrôlé par le navigateur ; aucun engagement de protection universelle. Historique SPA et arrêts de processus non couverts, aucune sauvegarde ou pause automatique ajoutée.
- TypeScript/build réussis ; règles serveur inchangées, dernière suite complète au lot 115 (297 tests, 216 PostgreSQL), dernière recette Docker complète au lot 116. Pas de nouvelle dépendance/migration ou recette navigateur. Documentation : docs/learning-loading.md.
- Aucun déploiement ; objectif global non achevé. Protection de l’historique et autres limites de reprise à poursuivre avec les chantiers globaux.

### Lot 118 — reprise du démarrage et tentative affichée selon le serveur

- Tour précédent classé **progression** : confirmation de sortie du QCM actif. Ajout de la reprise après erreur de démarrage ; une réponse vide produit une erreur visible au lieu d’un chargement indéfini.
- Reprise sans incrément local de nouvelle tentative ; explication FR/EN/AR de la conservation du chronomètre d’une session active et des règles applicables après expiration. Numéro affiché et proposition de tentative suivante basés sur le numéro serveur reçu, distinct du déclencheur local.
- Nouveau scénario SQL de reprise de deuxième tentative avec numéro client périmé : identité, questions, échéance et réponses/révision conservées, aucune troisième session créée. 298 tests réussis (217 PostgreSQL), TypeScript/build réussis.
- Aucune modification des règles serveur, migration ou dépendance. Pas de recette navigateur de réponse perdue ou nouvelle recette Docker (dernière complète au lot 116). Avertissement Vite persistant. Documentation : docs/learning-loading.md.
- Aucun déploiement ; objectif global non achevé, autres chantiers et limites de navigation/reprise toujours ouverts.

### Lot 119 — seuil annoncé cohérent avec la session conservée

- Tour précédent classé **progression** : reprise de démarrage et numéro serveur. La réponse de démarrage/reprise expose maintenant passingScore issu de l’instantané ; l’indication du lecteur utilise cette valeur au lieu du seuil actuel fourni par le cours/chapitre.
- Même seuil retourné lors de la reprise d’une session réussie. Replis des anciennes sessions sans instantané alignés sur les comportements existants de correction ; aucun historique inventé, aucune règle de notation ou donnée historique modifiée.
- 298 tests réussis (217 PostgreSQL), TypeScript/build réussis. Tests renforcés après modification du cours/chapitre : seuil conservé à la reprise et dans le résultat. Relance ciblée finale des 11 tests SQL d’examen réussie après enrichissement du scénario de chapitre.
- Pas de migration/dépendance, recette navigateur ou nouvelle recette Docker (dernière complète au lot 116). Avertissement Vite persistant. Documentation : docs/learning-loading.md. Aucun déploiement ; objectif global non achevé.

### Lot 120 — chronomètre affiché depuis l’heure serveur et aperçu local demandé

- Tour précédent classé **progression** : seuil affiché issu de la session. Démarrage API enrichi de serverNow ; compteur affiché ancré sur cette heure et le temps monotone du navigateur, sans dépendance à Date.now côté candidat. Nouvelle ancre à chaque reprise. Le serveur conserve seul la décision d’expiration.
- Deux tests du décompte face aux changements d’horloge locale, limites à zéro et reprise. 300 tests réussis (217 PostgreSQL), TypeScript/build réussis. La latence de réponse et certaines suspensions du navigateur peuvent encore décaler l’estimation affichée ; aucune synchronisation périodique ou recette navigateur ajoutée.
- L’utilisateur demande ensuite explicitement le lancement local et une URL Tailscale. Image raero-local-preview:20260913 construite, conteneur raero-local-preview avec volumes dédiés raero-local-preview-db et raero-local-preview-storage, démonstration activée, aucun fournisseur réel configuré. Port hôte 127.0.0.1:3174 ; relais TCP Tailscale sur 3174, les relais préexistants 3092/3093 conservés.
- Compte Tailscale ne permettant pas les certificats TLS : tentative HTTPS arrêtée, instance locale en NODE_ENV=preview avec assets compilés et cookies HTTP pour ce réseau privé. Aucun changement des protections du mode production dans le code. Origine : http://macstudio-de-sano.tailbdfa51.ts.net:3174. Ce mode ne convient pas à une publication Internet.
- Accueil HTTP 200, connexion admin et session authentifiée vérifiés via l’URL Tailscale avec un gestionnaire de cookies. Configuration et accès privés hors projet dans /Users/sano/Desktop/SOFT/147/raero-local-preview.env et Acces-R-AERO-local.txt (0600). Aucun secret consigné ici. Redémarrage automatique du conteneur configuré ; ancienne instance HTTPS arrêtée conservée, volumes partagés réutilisés uniquement par l’instance active.
- Lancement local autorisé réalisé ; aucune mise en production ni exposition publique/Funnel. Objectif global non achevé.

### Lot 121 — identifiants de demande compatibles avec l’aperçu HTTP privé

- Tour précédent classé **progression** : chronomètre ancré sur l’heure serveur, lancement local et accès Tailscale vérifiés. Constat de deux usages navigateur de crypto.randomUUID, indisponible dans les contextes HTTP distants non sécurisés.
- Fonction UUID v4 commune : natif si disponible, sinon crypto.getRandomValues, aucun Math.random. Utilisée pour validations et vidéo IA en conservant les identifiants de reprise déjà en mémoire. Trois tests natif/repli/absence de source sûre.
- 303 tests réussis (217 PostgreSQL), TypeScript/build réussis. Documentation des limites de l’aperçu et de son exploitation : docs/local-preview.md. Aucun paiement, message ou appel de génération réel effectué ; objectif global non achevé.
- Image locale reconstruite ; assets compilés copiés dans le conteneur actif sans redémarrage. Accueil identique à l’index validé et assets d’entrée accessibles via Tailscale. Les anciens assets du conteneur sont conservés pour les pages déjà ouvertes. Aucun changement du serveur depuis l’image précédente ; prochaine création du conteneur depuis l’image reconstruite cohérente.

### Lot 122 — soumission figée et reprise explicite du résultat

- Tour précédent classé **progression** : compatibilité des identifiants dans l’aperçu HTTP. Premier jeu soumis conservé pour les reprises ; champs texte/choix/associations verrouillés pendant envoi et réponse inconnue. Reprise manuelle avec même session et mêmes réponses.
- Réponse vide traitée comme résultat non confirmé ; message FR/EN/AR. L’expiration déclenche au plus un envoi automatique par session, pas une boucle chaque seconde après erreur. Échéance et correction restent décidées côté serveur.
- Sauvegardes différées non parties annulées après début d’envoi, statut d’autosauvegarde masqué ; requêtes déjà en vol toujours régies par les contrôles serveur existants.
- Suite complète 303 tests réussis (217 PostgreSQL) ; scénario SQL renforcé pour confirmer qu’un autre payload après soumission ne remplace pas le résultat enregistré. TypeScript/build réussis. Pas de recette navigateur/DOM des états de soumission ; aucune persistance locale du jeu figé après fermeture ajoutée.
- Documentation : docs/learning-loading.md. Aucun appel réel de paiement, messagerie ou génération ; objectif global non achevé.
- Relance ciblée finale des 11 tests SQL d’examen réussie. Image locale reconstruite et assets mis à jour sans redémarrage ; index servi via Tailscale identique au build validé. Anciennes ressources statiques conservées pour les pages ouvertes. Avertissement de taille Vite persistant.

### Lot 123 — état du lecteur séparé par formation et compte

- Tour précédent classé **progression** : jeu soumis figé et reprise explicite. Identification de l’instance React par compte et slug ; un changement recrée l’état du lecteur au lieu de réutiliser chapitre/réussite/mutation de certificat du contexte précédent.
- Nettoyage de la référence de session d’autosauvegarde lors du départ ou redémarrage, pour ignorer les anciens retours. Requêtes déjà parties non annulées côté serveur ; données enregistrées inchangées.
- TypeScript/build réussis ; changement de cycle de vie client sans modification des règles serveur. Pas de recette navigateur/DOM de navigation ou changement de compte ; dernière suite complète au lot 122 : 303 tests (217 PostgreSQL).
- Documentation : docs/learning-loading.md. Aucun paiement, message ou appel de génération réel ; objectif global non achevé.
- Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale vérifié identique au build. Anciennes ressources conservées pour les pages déjà ouvertes ; avertissement de taille Vite persistant.

### Lot 124 — accusé de sauvegarde retrouvé sans nouvelle écriture

- Tour précédent classé **progression** : état du lecteur séparé par compte/formation. La sauvegarde reconnaît une répétition identique de la révision immédiatement précédente sous le verrou de session et retourne sa révision/heure conservées sans écrire.
- Refus maintenu pour contenu différent, révision plus ancienne, autre candidat ou session terminée/expirée. Aucun écrasement automatique des conflits ; modifications locales entre demande perdue et reprise restent à résoudre si elles divergent.
- Nouveau scénario SQL de répétitions concurrentes, révision unique et date inchangée puis refus d’anciennes révisions/tiers/expiration. Scénario CAS précédent adapté à la répétition identique. 304 tests réussis (218 PostgreSQL), TypeScript/build réussis. Pas de migration/dépendance.
- Documentation : docs/learning-loading.md. Aucun appel de génération, paiement ou message réel ; objectif global non achevé.
- Construction Docker et recette complète avec sauvegarde/restauration réussies : image sha256:ada0e60ac24217fc804d9b54f0ac1bb519506f6b65a18546f1e4122bc9bdbb6c. Ressources jetables nettoyées. Mise à jour du conteneur d’aperçu avec les mêmes volumes ; ancienne instance arrêtée conservée sous raero-local-preview-before124.
- Index servi via Tailscale identique au build et session admin ouverte avant remplacement encore valide après redémarrage. Pas de nouvelle connexion nécessaire pour ce contrôle ; aucune donnée de démonstration réinitialisée volontairement. Avertissement de taille Vite persistant ; pas de recette navigateur.

### Lot 125 — états des certificats et erreurs du tableau de bord apprenant

- Tour précédent classé **progression** : sauvegarde identique reconnue après perte d’accusé et mise à jour serveur local vérifiée. Ajout des états valide/expiré/révoqué aux cartes de certificats, fonction commune et textes FR/EN/AR ; documents archivés toujours accessibles.
- Erreurs et reprises distinctes pour formations/certificats/commandes/affiliations, requêtes conditionnées à l’authentification. Chargement explicite des commandes, compteurs indisponibles représentés par un tiret ; aucune erreur initiale assimilée à une absence dans ces sections.
- Dates selon langue de l’interface et actions des cartes pouvant revenir à la ligne. L’état temporel affiché dépend encore de l’heure du navigateur ; aucune validation réglementaire autonome revendiquée.
- 304 tests réussis (218 PostgreSQL), TypeScript/build réussis. Tests existants de statut des certificats inclus ; pas de recette navigateur/DOM des erreurs. Aucune migration/dépendance/règle métier modifiée. Documentation : docs/learner-dashboard.md.
- Objectif global non achevé ; aucun paiement, message ou appel de génération réel.
- Image d’aperçu reconstruite et assets remplacés sans redémarrage. Index vérifié via Tailscale identique au build validé ; anciennes ressources conservées pour les pages ouvertes. Dernière recette complète Docker/sauvegarde/restauration au lot 124, avertissement de bundle persistant.

### Lot 126 — lecture groupée des certificats du titulaire

- Tour précédent classé **progression** : états de certificats et reprises de chargement du tableau de bord. Remplacement des lectures multiples par certificat par une requête avec jointures, filtrée par titulaire et ne sélectionnant que le fragment training des snapshots.
- Priorité archive puis version inscrite puis formation actuelle conservée ; erreur de version introuvable conservée sans archive. Tri stable date/identifiant. Aucun corrigé de version sélectionné ou transmis.
- Nouveau scénario SQL de trois chemins de titre, renommage et document d’un autre titulaire, sans métadonnées internes dans la réponse. Fixture corrigée pour respecter la longueur du code de vérification et le déclencheur qui fixe la version à l’inscription. 305 tests réussis (219 PostgreSQL), TypeScript/build réussis.
- Aucune migration/dépendance ou mesure de latence réelle. Liste encore non paginée. Documentation : docs/learner-dashboard.md. Correctif serveur préparé dans les sources ; pas de redémarrage de l’aperçu pour ce lot (serveur actif lot 124, interface lot 125), à intégrer lors de la prochaine mise à jour serveur groupée.
- Aucun paiement, message ou appel de génération réel ; objectif global non achevé.

### Lot 127 — lecture groupée des inscriptions et mise à jour serveur groupée

- Tour précédent classé **progression** : certificats lus par jointures, validation des archives/versions. Liste des inscriptions convertie en une requête, avec fragment training de la version inscrite et formation actuelle pour les anciens parcours.
- Filtre SQL par titulaire, erreur de version manquante et contrat de réponse conservés. Tri date/identifiant stable ; aucun corrigé de snapshot sélectionné.
- Scénario SQL enrichi pour version conservée après renommage, ancien parcours et isolation ; 305 tests réussis (219 PostgreSQL), TypeScript/build réussis. Pas de migration/dépendance, pagination ou mesure de latence. Documentation : docs/learner-dashboard.md.
- Objectif global non achevé ; aucun paiement, message ou appel de génération réel.
- Construction et recette Docker complète, incluant sauvegarde/restauration, réussies ; ressources jetables nettoyées. Lots serveur 126/127 appliqués ensemble à l’aperçu avec volumes conservés ; ancienne instance arrêtée sous raero-local-preview-before127.
- Index Tailscale identique au build, session antérieure toujours authentifiée et routes d’inscriptions/certificats accessibles après remplacement. Pas de recette navigateur, avertissement Vite persistant.

### Lot 128 — accès et erreurs de salle à distance explicites

- Tour précédent classé **progression** : lectures d’inscriptions/certificats regroupées et mise à jour serveur validée. URL de salle contrôlée avant requête ; erreurs de lecture distinguées de l’absence de salle, avec reprise FR/EN/AR.
- Refus d’accès lors d’un rafraîchissement entraînant le démontage de la vidéo intégrée et l’arrêt du heartbeat ; erreur réseau transitoire avec données conservée et signalée. La détection reste liée au rafraîchissement, sans révocation globale du JWT fournisseur revendiquée.
- Explication du contexte sécurisé requis et bouton de visioconférence désactivé dans l’aperçu HTTP distant. Replays non bloqués par cette condition. Configuration JaaS et HTTPS réels toujours nécessaires ; aucun appel fournisseur effectué.
- TypeScript/build réussis ; aucune règle serveur, migration ou dépendance modifiée. Pas de recette navigateur des effets vidéo/erreurs. Documentation : docs/local-preview.md. Objectif global non achevé.
- Suite complète : 305 tests réussis (219 PostgreSQL). Image locale reconstruite et assets mis à jour sans redémarrage ; index Tailscale identique au build validé. Avertissement de bundle persistant ; dernière recette Docker complète au lot 127.

### Lot 129 — bonne réponse conservée après retrait des options vides

- Tour précédent classé **progression** : erreurs de salle et contexte sécurisé explicités. Correction du formulaire de QCM live : les options vides étaient retirées sans remapper la correction, pouvant désigner une autre réponse ou produire un index invalide.
- Remappage de la sélection selon les indices d’origine ; réponse vide/inexistante refusée avec message FR/EN/AR. Sondages sans correction conservés. Limites de saisie question/options alignées sur API et sélection de correction avec nom/état accessibles.
- Deux tests de remappage, texte arabe, brouillon non modifié et sélection invalide. 307 tests réussis (219 PostgreSQL), TypeScript/build réussis. Aucune règle serveur/migration/dépendance modifiée ; pas de recette navigateur ou séance réelle.
- Documentation : docs/local-preview.md. Aucun paiement, message ou appel de génération réel ; objectif global non achevé.
- Image d’aperçu reconstruite et assets actualisés sans redémarrage ; index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes, avertissement de bundle persistant. Dernière recette Docker complète au lot 127.

### Lot 130 — votes confirmés et erreurs de sondage visibles

- Tour précédent classé **progression** : remappage correct des options de QCM live. Chargement/erreur/absence distingués dans les sondages, reprise de lecture, mutations désactivées sur données en erreur.
- Échecs de vote/clôture signalés sur la carte concernée ; actualisation demandée après succès ou erreur, sans nouvelle mutation automatique. Choix enregistrés affichés uniquement depuis myChoices serveur, avec état pressé accessible.
- Résultats masqués du QCM ouvert non affichés comme 0 %. Correction disponible après clôture présentée avec coche/texte, sans modifier les règles de masquage serveur.
- TypeScript/build réussis ; pas de test navigateur/DOM ou nouvelle suite métier pour ces modifications d’affichage. Dernière complète au lot 129 : 307 tests, 219 PostgreSQL. Pas de migration/dépendance ou séance réelle.
- Documentation : docs/local-preview.md. Objectif global non achevé.
- Image locale reconstruite, assets copiés sans redémarrage et index vérifié via Tailscale identique au build validé. Anciennes ressources conservées ; avertissement de taille Vite persistant. Dernière recette Docker complète au lot 127.

### Lot 131 — brouillon conservé et erreurs du chat/questions explicites

- Tour précédent classé **progression** : choix enregistrés et erreurs de sondage visibles. Envoi de chat/questions avec verrou immédiat contre soumissions simultanées ; suppression du brouillon après succès uniquement si sa révision locale est inchangée.
- Erreur/réponse vide conservant le brouillon, message FR/EN/AR et actualisation du fil. Aucun renvoi automatique ; absence actuelle d’idempotence serveur explicitée pour éviter de promettre une élimination des doublons après perte d’accusé.
- Lecture distinguant chargement/erreur/absence, reprise et blocage d’actions en cas d’erreur. Erreurs de marquage des questions visibles, limites de saisie API et noms accessibles ajoutés.
- TypeScript/build réussis ; pas de test DOM/navigateur ou envoi réel. Dernière suite complète au lot 129 : 307 tests, 219 PostgreSQL. Pas de migration/dépendance/règle serveur modifiée. Documentation : docs/local-preview.md.
- Objectif global non achevé.
- Image locale reconstruite et assets actualisés sans redémarrage ; index servi via Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; avertissement de taille Vite persistant. Dernière recette Docker complète au lot 127.

### Lot 132 — reprise idempotente des messages live

- Tour précédent classé **progression** : brouillon conservé et erreurs de messages visibles. UUID de demande réutilisé après erreur dans le composant monté ; transaction sérialisée par auteur/demande et index unique, contenu/type/salle liés à la demande.
- Droits vérifiés à chaque appel ; identifiants non exposés dans le fil. Migration additive nullable et clients anciens compatibles sans dédoublonnage. Pas de persistance navigateur après fermeture/recharge/changement de panneau.
- 308 tests réussis, TypeScript/build réussis. Nouveau test PostgreSQL de concurrence, conflit, auteurs distincts et retrait d’accès. Documentation : docs/local-preview.md. Pas de message réel ou recette navigateur. Objectif global non achevé.

- Image locale reconstruite, recette Docker complète réussie (redémarrage, panne/reprise PostgreSQL, sauvegarde/restauration). Aperçu remplacé avec volumes conservés ; URL Tailscale et index du build confirmés, session antérieure et lectures inscriptions/certificats préservées. Image : sha256:5b7056edf7e83f328bc511ad600fca80db4429d7601cecce92997dd50d040311.

### Lot 133 — lecture de salle fondée sur le compte courant

- Tour précédent classé **progression** : reprise des messages idempotente, migration et aperçu local vérifiés. getLiveAccess relit statut/rôle/nom à partir de l’identifiant, refuse les comptes inactifs et ignore les anciens champs de rôle/nom fournis. requireLiveRoom partage cette lecture ; route sans cast any.
- Test PostgreSQL de rôle fourni périmé, nom actuel, rôle formateur retiré et suspension bloquant lecture/envoi. 309 tests réussis, TypeScript/build réussis ; aucune migration ou dépendance ajoutée.
- Durcissement du service interne, sans allégation de rôle navigateur accepté précédemment. Révocations concurrentes et jetons fournisseur restent des limites distinctes. Documentation : docs/local-preview.md. Objectif global non achevé.

- Recette Docker complète réussie, image sha256:563e5ed36e863ee033597a519588f645702a58b09e8642e7701c8c4991ce4efb. Aperçu local remplacé avec volumes conservés ; HTTP Tailscale/index du build, session antérieure et lectures inscriptions/certificats vérifiés. Pas de recette navigateur.

### Lot 134 — première confirmation d’une question conservée

- Tour précédent classé **progression** : état courant des comptes vérifié pour la lecture des salles et aperçu mis à jour. La modération remplaçait answeredByUserId à chaque appel ; écriture désormais conditionnelle à l’absence de confirmation, sans changement de schéma.
- Réservé au type qa ; reprises autorisées sans remplacement du premier modérateur. Droits de salle toujours contrôlés avant chaque appel. Test PostgreSQL : participant/non-affecté refusés, confirmation puis reprise par autre modérateur, concurrence, chat refusé et suspension refusée même sur une question déjà traitée.
- Pas de journal d’audit immuable ni de reconstitution historique revendiqués ; révocations concurrentes restent à traiter séparément. Documentation : docs/local-preview.md. Objectif global non achevé.

310 tests réussis, TypeScript/build réussis. Aucun compte réel modifié, aucune question réelle marquée ; pas de recette navigateur.

Recette Docker complète réussie avec sauvegarde/restauration. Aperçu local actualisé avec volumes conservés ; index via Tailscale, session antérieure et lectures inscriptions/certificats vérifiés après redémarrage.

### Lot 135 — votes de salle lus ensemble

- Tour précédent classé **progression** : première confirmation des questions préservée et aperçu actualisé. Remplacement de la lecture de votes par sondage par une lecture groupée des votes des sondages de la salle ; comptage en une passe, projections explicites et ordre date/id stable.
- Contrat de masquage des QCM et choix propres inchangé ; test PostgreSQL de plusieurs sondages, zéro vote, choix multiples, isolation d’autre salle, modérateur/participant et clôture.
- Les votes restent chargés en mémoire et les deux lectures ne forment pas un instantané unique. Aucune pagination ou performance mesurée revendiquée. Pas de migration/dépendance ; documentation docs/local-preview.md. Objectif global non achevé.

311 tests réussis, TypeScript/build réussis. Compatibilité de l’itération Set ajustée au target TypeScript existant, sans changer la configuration. Aucun vote réel effectué et pas de recette navigateur.

Recette Docker complète réussie avec sauvegarde/restauration. Aperçu local actualisé avec volumes conservés ; index via Tailscale, session antérieure et lectures inscriptions/certificats vérifiés après redémarrage.

### Lot 136 — suivi de participation avec erreurs explicites

- Tour précédent classé **progression** : lectures de votes groupées et aperçu actualisé. Participants, scores et journal de présence distinguent chargement/erreur/absence, proposent une reprise et masquent les données périmées en cas d’erreur.
- Présence indiquée par texte en plus de la couleur ; date/heure complètes dans le journal, navigation protégée pendant la lecture, message d’erreur FR/EN/AR sans détail technique brut.
- TypeScript/build réussis ; dernière suite complète au lot 135 : 311 tests. Pas de modification serveur/migration/dépendance ni de recette navigateur. Documentation : docs/local-preview.md. Objectif global non achevé.

Image locale reconstruite et assets actualisés sans redémarrage ; index vérifié via Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes. Dernière recette Docker complète au lot 135 ; avertissement de taille Vite persistant.

### Lot 137 — état local isolé par salle et compte

- Tour précédent classé **progression** : erreurs de suivi de participation explicites, aperçu actualisé. Frontière React avec clé compte/type/id de salle pour réinitialiser brouillons, mutations, erreurs, vidéo et journal lors d’un changement d’identité ou de salle. Nettoyage vidéo/heartbeat existant exécuté au démontage.
- Panneau actif choisi parmi les panneaux disponibles : scores démontés après retrait du rôle, panneaux live remplacés par questions en replay. État pressé accessible des boutons.
- TypeScript/build réussis ; pas de recette navigateur/DOM de ces transitions. Pas de migration/dépendance/règle serveur modifiée ; dernière suite métier complète au lot 135 : 311 tests. Documentation : docs/local-preview.md. Objectif global non achevé.

Image locale reconstruite et assets actualisés sans redémarrage ; index vérifié via Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes. Dernière recette Docker complète au lot 135 ; avertissement de taille Vite persistant.

### Lot 138 — certificats du coffre rattachés à la bonne inscription

- Tour précédent classé **progression** : état des salles isolé et panneaux adaptés aux droits/replay. Inspection du coffre : repli trainingId pouvait attribuer un ancien certificat à une nouvelle inscription ; badge « certifié » ignorait la révocation.
- Sélection unique par inscription avec même formation/titulaire, absence de repli et état de revue si ambigu/incohérent. État partagé valide/expiré/révoqué, documents historiques accessibles et dates localisées.
- Chargement/erreur des deux lectures distincts d’une liste vide, reprise et masquage en cas d’erreur. Tests purs de nouvelles inscriptions, anciens documents sans lien, ambiguïté, titulaire et cours différents. Pas de nouvelle règle serveur/migration/dépendance. Documentation : docs/local-preview.md. Objectif global non achevé.

313 tests réussis avec maxWorkers=4/minWorkers=1, après un dépassement du délai de 5 s dans signoffEvidence lors du premier passage parallèle (délai inchangé). Les deux nouveaux tests sont dans server/, conformément à la découverte Vitest. TypeScript/build réussis ; pas de recette navigateur. Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Dernière recette Docker complète au lot 135.

### Lot 139 — erreurs de lecture du coffre et de ses archives

- Tour précédent classé **progression** : certificats rattachés strictement, états révoqué/expiré visibles et aperçu actualisé. Les onglets documentaires distinguent première lecture, erreur et absence ; reprise disponible sans empêcher l’accès aux onglets archives/conformité.
- Erreur d’actualisation conservant les formulaires montés avec avertissement de données issues de la dernière lecture. Archives/historique : reprise indépendante, cache masqué sur erreur, état vide confirmé. Texte FR/EN/AR sans message technique brut.
- TypeScript/build réussis, dernière suite métier lot 138 : 313 tests. Pas de règle serveur/migration/dépendance modifiée ni de test navigateur/DOM. Documentation docs/local-preview.md. Objectif global non achevé.

Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes. Dernière recette Docker complète au lot 135 ; avertissement de taille Vite persistant.

### Lot 140 — préparation de fichier et soumissions du coffre

- Tour précédent classé **progression** : chargements/erreurs du coffre explicites et aperçu actualisé. Verrou immédiat commun aux deux formulaires de dépôt, depuis FileReader jusqu’à résolution/rejet de la mutation. Champs/fermeture bloqués pendant l’opération ; échec local visible FR/EN/AR conservant les valeurs.
- Lecture terminée après démontage ne déclenchant plus la mutation ; requête déjà partie non annulée. Pas d’idempotence serveur revendiquée pour les pertes de réponse ou plusieurs onglets.
- TypeScript/build réussis ; pas de recette DOM/navigateur ou document réel. Dernière suite métier lot 138 : 313 tests. Pas de migration/dépendance/règle serveur modifiée. Documentation docs/local-preview.md ; objectif global non achevé.

Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes. Dernière recette Docker complète au lot 135 ; avertissement de taille Vite persistant.

### Lot 141 — échéance de document distincte de qualification validée

- Tour précédent classé **progression** : préparation des fichiers avec verrou local et erreurs visibles. La liste des pièces de qualification affichait « Valide » dès qu’un document non expiré ou sans date existait. Désormais états documentaires explicites, échéance inconnue distinguée et dépôt non présenté comme validation.
- FR/EN/AR ; texte d’absence de date corrigé et badge acceptant plusieurs lignes. Deux tests purs des dates inconnues, bornes et dossiers mixtes. Aucun changement de règles serveur, migration ou dépendance.
- Documentation docs/local-preview.md. Pas de recette navigateur ou document réel ; calcul horaire local au rendu. Objectif global non achevé.

315 tests réussis avec quatre workers, TypeScript/build réussis. Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 135.

### Lot 142 — brouillons du profil protégés des actualisations

- Tour précédent classé **progression** : échéances des pièces distinctes de validation, aperçu actualisé. Profil et qualifications conservent le brouillon local après modification au lieu de le remplacer à chaque actualisation auth.me. Champs bloqués pendant la sauvegarde ; succès libérant la synchronisation, erreur conservant la saisie.
- Onglets du coffre avec clé de compte, réinitialisant les états locaux lors du changement de personne. Pas de gestion de conflits multi-appareils ou persistance après fermeture revendiquée.
- TypeScript/build réussis ; dernière suite métier lot 141 : 315 tests. Pas de recette navigateur/DOM ou profil réel modifié. Aucun changement serveur/migration/dépendance. Documentation docs/local-preview.md ; objectif global non achevé.

Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 135.

### Lot 143 — purge des caches entre connexions

- Tour précédent classé **progression** : brouillons du profil protégés et aperçu actualisé. Connexion/2FA/inscription réussies annulent les lectures et purgent les caches avant d’installer le compte et naviguer. Déconnexion confirmée ou déjà non authentifiée purge puis installe null.
- Erreur de déconnexion ne passant plus par une fausse déconnexion finally ; erreur visible FR/EN/AR dans le menu et bouton bloqué pendant la demande. Test QueryClient réel : données privées, variables de mutation, réponse tardive annulée et nouveau compte préservé.
- Limites : autres onglets/appareils, mutations déjà envoyées, fichiers téléchargés et jetons fournisseur distincts. Pas de règle serveur/migration/dépendance modifiée. Documentation docs/local-preview.md ; objectif global non achevé.

316 tests réussis avec quatre workers, TypeScript/build réussis. Pas de recette DOM/navigateur ni déconnexion réelle d’utilisateur. Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Dernière recette Docker complète au lot 135.

### Lot 144 — notification de changement de session entre onglets

- Tour précédent classé **progression** : purge des caches à la connexion/déconnexion et aperçu actualisé. Signal sans donnée de compte via canal et stockage ; réception étrangère entraînant démontage, purge et recharge. Signal propre au canal ignoré, réception répétée traitée une fois, nettoyage HMR.
- Tests de signalisation simulée incluant propre/autre onglet, repli, blocage et nettoyage. Brouillons non enregistrés abandonnés lors d’une transition ; mutations déjà envoyées, anciennes pages sans ce code, autres origines/appareils et expiration serveur hors de ce mécanisme.
- Pas de migration/dépendance/règle serveur modifiée. Documentation docs/local-preview.md ; pas de recette multi-onglets réelle. Objectif global non achevé.

319 tests réussis avec quatre workers, TypeScript/build réussis. Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Dernière recette Docker complète au lot 135. Aucun changement de session réel déclenché par les vérifications HTTP.

### Lot 145 — opérations de sécurité raccordées aux transitions locales

- Tour précédent classé **progression** : notifications entre onglets et aperçu actualisé. Révocation globale/fermeture confirmées : champs secrets vidés, cache purgé, compte local absent et signal avant navigation ; délai d’affichage après fermeture supprimé.
- Réinitialisation confirmée : champs vidés, cache purgé, signal et navigation complète vers connexion après écran de réussite. Changement confirmé du double facteur signalant la nouvelle session, compte courant actualisé. Pas de signal sur erreur ou demande de code/email.
- TypeScript/build réussis ; dernière complète lot 144 : 319 tests. Aucun compte/session réel modifié ni email envoyé. Pas de règle serveur/migration/dépendance ou recette navigateur. Documentation docs/local-preview.md ; objectif global non achevé.

Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Dernière recette Docker complète au lot 135. Aucun changement de session réel déclenché par la vérification HTTP.

### Lot 146 — champs du coffre reliés à leurs libellés

- Tour précédent classé **progression** : opérations de sécurité raccordées aux transitions locales et aperçu actualisé. Association htmlFor/id pour champs réutilisables, description, qualification, fichier et type de document ; identifiants useId uniques par instance.
- Formats/aide reliés aux sélecteurs de fichiers, boutons de retrait annonçant la qualification en FR/EN/AR. TypeScript/build réussis, références inspectées. Pas de recette navigateur/clavier/lecteur d’écran ; dernière suite complète lot 144 : 319 tests.
- Aucun changement serveur/migration/dépendance ou document réel. Documentation docs/local-preview.md ; objectif global non achevé.

Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 135.

### Lot 147 — réponses API exclues du cache HTTP

- Tour précédent classé **progression** : libellés du coffre associés et aperçu actualisé. Audit HTTP : fichiers privés déjà no-store, API sans directive explicite. Middleware private, no-store sur /api/trpc avant parseur, couvrant réponses privées, lots, refus et corps malformés.
- Deux tests HTTP Express/adaptateur tRPC réel avec fixtures : succès privé, lot public/privé, 401 et JSON invalide, réponse statique non modifiée. Pas de migration/dépendance. Documentation docs/local-preview.md.
- Politique des prochaines réponses, sans effacement de téléchargements/copies existants. Aucun compte ou document réel modifié ; objectif global non achevé.

321 tests réussis avec quatre workers, TypeScript/build réussis. Recette Docker complète réussie avec sauvegarde/restauration. Aperçu local remplacé avec volumes conservés ; index via Tailscale, session antérieure et lectures inscriptions/certificats vérifiés après redémarrage. En-tête private, no-store confirmé sur les trois routes API via Tailscale. Pas de recette navigateur.

### Lot 148 — compte actif vérifié par le service du coffre

- Tour précédent classé **progression** : API no-store et aperçu serveur vérifiés. Inspection de reprise des dépôts révélant des contrôles de compte actif absents au service : lectures personnelles désormais vérifiées ; dépôt/archivage avec verrou utilisateur en partage, partage avec vérification sous verrou existant.
- Stockage du dépôt placé après contrôle du propriétaire dans la transaction. Test PostgreSQL de refus après suspension sans écriture fichier, modification de document, d’historique ou de partage.
- Le stockage n’est pas transactionnel avec la base ; orphelins sur erreur SQL et idempotence des reprises restent des travaux distincts. Pas de migration/dépendance. Documentation docs/local-preview.md ; objectif global non achevé.

322 tests réussis avec quatre workers, TypeScript/build réussis. Recette Docker complète réussie avec sauvegarde/restauration. Aperçu remplacé avec volumes conservés ; index Tailscale, session antérieure et lectures documents/archives/historique du coffre vérifiés après redémarrage, en-tête no-store confirmé. Pas de recette navigateur ni mutation réelle de document.

### Lot 149 — reprise idempotente des dépôts documentaires

- Tour précédent classé **progression** : compte actif contrôlé dans le coffre et aperçu actualisé. Migration additive UUID/index unique par propriétaire ; demande sérialisée avant stockage, identité liée aux métadonnées et SHA-256. Reprise identique retrouvant le document, conflit sinon ; compte actif toujours exigé.
- Deux formulaires réutilisant un UUID en mémoire pour une même charge utile après erreur, nouveau UUID après changement/réussite. Anciennes pages sans UUID compatibles sans dédoublonnage. Document archivé retrouvé avec message spécifique, sans réactivation.
- Test PostgreSQL concurrence, nombre d’écritures fichier/événements, conflits, isolation propriétaire, archive, immutabilité et suspension. 323 tests réussis, TypeScript/build réussis. Pas de dépôt réel ou recette navigateur.
- Limites : absence de persistance après démontage/recharge, stockage non transactionnel avec PostgreSQL et orphelins possibles en cas d’échec SQL. Documentation docs/local-preview.md ; objectif global non achevé.

Recette Docker complète réussie avec sauvegarde/restauration. Migration appliquée à l’aperçu lors de son remplacement avec volumes conservés ; index Tailscale, session antérieure et lectures documents/archives/historique vérifiés après redémarrage. En-tête no-store confirmé. Aucun document réel déposé.

### Lot 150 — dépôt non confirmé explicite et coffre actualisé

- Tour précédent classé **progression** : dépôts idempotents, migration et aperçu vérifiés. Erreur persistante dans les deux formulaires expliquant la reprise sans changer fichier/champs ; actualisation documents/archives/historique sur erreur pour retrouver un résultat déjà enregistré.
- Aucun renvoi automatique, erreurs réinitialisées à ouverture/tentative. Lecture locale qualifiée pour la tentative courante, sans allégation sur un dépôt antérieur.
- TypeScript/build réussis ; dernière suite complète lot 149 : 323 tests. Pas de recette navigateur/panne réelle ou dépôt réel. Aucun changement serveur/migration/dépendance. Documentation docs/local-preview.md ; objectif global non achevé.

Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 149.

### Lot 151 — navigation dans l’historique complet du coffre

- Tour précédent classé **progression** : dépôts non confirmés explicités et aperçu actualisé. Nouvelle route historyPage avec filtre propriétaire actif, limite 100+1 et curseur décroissant ; ancienne route tableau conservée. Index existant réutilisé, pas de migration.
- Interface FR/EN/AR pages anciennes/dernières, blocage pendant lecture et reprise d’erreur. Invalidation des deux routes après opérations documentaires. Test PostgreSQL de 206 événements, arrivée d’un nouvel événement pendant parcours, isolation et suspension.
- Pas d’instantané global revendiqué, aucun historique réel modifié, pas de recette navigateur. Documentation docs/local-preview.md ; objectif global non achevé.

324 tests réussis avec quatre workers, TypeScript/build réussis. Recette Docker complète réussie avec sauvegarde/restauration. Aperçu remplacé avec volumes conservés ; index Tailscale, session antérieure, ancienne route history et nouvelle route historyPage vérifiés après redémarrage. En-tête no-store confirmé ; aucune action réelle ajoutée à l’historique.

### Lot 152 — brouillons KYC/KYB préservés avant soumission

- Tour précédent classé **progression** : historique du coffre paginé et aperçu actualisé. Inspection du centre de vérification : actualisations de pièces pouvaient écraser le formulaire, et la soumission portait sur des valeurs serveur anciennes lorsque le formulaire était modifié.
- Brouillon préservé pour le même dossier éditable, sauvegarde requise avant soumission, confirmation d’abandon lors des changements via les commandes de page. Actions principales bloquées pendant opération ; motif de revue réinitialisé par dossier et bloqué pendant décision.
- Pas de conflit multi-appareils ou persistance après navigation externe revendiqués ; pas de règle serveur/migration/dépendance modifiée. Documentation docs/local-preview.md ; objectif global non achevé.

TypeScript/build réussis ; dernière suite complète lot 151 : 324 tests. Pas de recette DOM/navigateur ni dossier KYC/KYB réel modifié. Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Dernière recette Docker complète au lot 151.

### Lot 153 — lectures KYC/KYB avec reprise et organisations explicites

- Tour précédent classé **progression** : brouillons protégés avant soumission et aperçu actualisé. Listes/détail : message de lecture FR/EN/AR, reprise, cache masqué sur erreur et absence confirmée uniquement après réussite.
- Nouveau KYB bloqué pendant indisponibilité des organisations ; affiliation responsable requise expliquée. Organisation d’un dossier existant identifiable même hors affiliations du relecteur. Espace réinitialisé par compte/rôle.
- TypeScript/build réussis ; dernière suite complète lot 151 : 324 tests. Pas de règle serveur/migration/dépendance modifiée ni de recette navigateur ou dossier réel. Documentation docs/local-preview.md ; objectif global non achevé.

Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 151.

### Lot 154 — erreurs et préparation de pièce KYC/KYB

- Tour précédent classé **progression** : lectures du centre avec reprise et aperçu actualisé. Dépôt extrait du gestionnaire JSX, validation taille/format explicite, erreurs lecture/envoi distinctes FR/EN/AR et état de progression.
- Verrou immédiat de préparation ; FileReader abandonné au démontage et aucune mutation déclenchée après départ. Requête déjà envoyée non annulée ; actualisation après erreur pour vérifier une éventuelle pièce déjà enregistrée. Pas d’idempotence KYC/KYB revendiquée.
- TypeScript/build réussis, dernière complète lot 151 : 324 tests. Pas de recette navigateur ou document réel ; aucun changement serveur/migration/dépendance. Documentation docs/local-preview.md ; objectif global non achevé.

Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 151.

### Lot 155 — droits actuels des comptes dans le service KYC/KYB

- Tour précédent classé **progression** : disponibilité effective du conteneur et HTTP 200 via Tailscale vérifiés à la demande de lancement local. Reprise du changement KYC/KYB resté non livré : résultats terminaux inspectés, 325 tests réussis et build réussi.
- Le service recharge le rôle et le statut en base avant accès, sauvegarde et décision ; listes personnelle et administrateur également contrôlées. Les objets acteur périmés ou avec rôle administrateur falsifié ne suffisent plus à autoriser ces appels internes. Le contexte HTTP rechargeait déjà le compte ; aucune vulnérabilité de rôle fourni par le navigateur revendiquée.
- Test PostgreSQL : suspension refusant lecture/sauvegarde/dépôt/soumission/archivage/liste, rétrogradation refusant file/lecture/décision, dossier et pièce conservés. Ces relectures ne verrouillent pas le compte durant toute la transaction : pas de sérialisation globale avec suspension concurrente revendiquée.
- Aucun dossier réel modifié, aucune migration ou dépendance. Objectif global non achevé.

TypeScript confirmé, recette Docker complète réussie avec sauvegarde/restauration. Aperçu remplacé avec volumes conservés ; index Tailscale identique au build, session antérieure conservée et lectures auth.me/verification.mine/verification.queue vérifiées avec en-tête private, no-store. Aucun dossier réel modifié.

### Lot 156 — reprise des dépôts KYC/KYB sans doublon

- Tour précédent classé **progression** : droits actuels KYC/KYB et aperçu serveur vérifiés. Les pièces ne disposaient pas d’identité de demande ; ajout d’un UUID facultatif par déposant, d’une empreinte SHA-256 et d’un index unique via nouvelle migration additive.
- Sous verrou du dossier et de la demande, contrôle d’accès actuel puis comparaison dossier/nature/nom/type/contenu. Une reprise identique retrouve la pièce, même après soumission ou archivage, sans nouvelle écriture fichier/événement ; tout autre contenu pour cette demande échoue. Nouvelle pièce toujours soumise au statut éditable. Anciennes pages sans UUID compatibles, sans dédoublonnage.
- Interface : UUID réutilisé en mémoire pour la même charge utile après erreur, renouvelé après réussite/changement ; nature sélectionnée conservée pendant actualisation du même dossier. Message de reprise FR/EN/AR et retour explicite si la pièce retrouvée est archivée. Changement de dossier/démontage/recharge perdant cette reprise locale.
- Documents verrouillés en base contre modification de preuve/suppression/troncature, avec seul premier archivage permis. Deux tests PostgreSQL couvrent concurrence, nombre d’écritures, conflits, portée par déposant/dossier, compte suspendu, affiliation retirée, soumission et archive. 327 tests réussis, TypeScript/build réussis ; assertion d’immutabilité renforcée ensuite avant archivage, recette ciblée/Docker réussie.
- Stockage hors transaction PostgreSQL : orphelin possible sur erreur SQL, pas de persistance navigateur ni de recette réseau/navigateur revendiquée. Aucun justificatif réel déposé. Objectif global non achevé.

Recette ciblée renforcée réussie (11 tests KYC/KYB), recette Docker complète réussie avec sauvegarde/restauration. Aperçu remplacé avec volumes conservés et migration additive appliquée ; index Tailscale identique au build, session antérieure et lectures auth.me/verification.mine/verification.queue vérifiés avec private, no-store. Aucun justificatif réel déposé.

### Lot 157 — file de revue KYC/KYB paginée et filtrée

- Tour précédent classé **progression** : reprise idempotente des pièces et aperçu migré/vérifié. La file administrateur ne donnait accès qu’aux 200 premiers résultats ; nouvelle route queuePage, curseur décroissant sur l’identifiant de création, filtre de statut facultatif et limite 50+1. Ancienne route tableau conservée.
- Liste renvoyant uniquement identifiant/type/nom légal/statut ; détail et pièces toujours chargés après sélection. Compte actif et rôle administrateur relus en base. Index statut/id via nouvelle migration additive.
- Interface FR/EN/AR : attente de revue par défaut, tous statuts ou statut choisi, dossiers anciens et retour/actualisation des derniers. Filtre/page réinitialisant la sélection, actions bloquées pendant mutations/lecture ; reprise d’erreur existante conservée. Mutations invalidant les deux routes de file.
- Test PostgreSQL au-delà de 200 dossiers, arrivée pendant navigation, changement de statut déjà parcouru, absence de doublons, limites/cursor invalide, forme minimale et droits retirés. 328 tests, TypeScript/build réussis.
- Pas d’instantané global : un changement de statut modifie les résultats filtrés, retour aux derniers pour actualiser les nouveaux dossiers. Aucun dossier réel modifié, aucune recette navigateur. Objectif global non achevé.

Recette Docker complète réussie avec sauvegarde/restauration. Aperçu remplacé avec volumes conservés et migration d’index appliquée ; index Tailscale identique au build, session antérieure, ancienne queue et nouvelle queuePage (tous statuts/attente) vérifiés en lecture avec private, no-store. Aucun dossier réel modifié.

### Lot 158 — affectation des diapositives sans objectif Part-66

- Tour précédent classé **progression** : file KYC/KYB complète et aperçu vérifiés. Reprise du parcours auteur depuis le code : le sélecteur de chapitre de SlideEditorDialog était conditionné à objectives.length > 0. Une formation sans objectif Part-66 ne pouvait donc pas affecter ses diapositives par cet éditeur, alors que la préparation e-learning exige des chapitres.
- Sélecteur de chapitre rendu indépendamment de la liste d’objectifs ; objectif restant facultatif. États de chargement/erreur/reprise séparés, sélection conservée et identifiée par numéro si sa liste est indisponible. Aucune sélection remise à zéro par une erreur ; champs indisponibles bloqués, reste du brouillon éditable.
- Libellés FR/EN/AR : chapitre non choisi, absence de chapitre avec marche à suivre, sélection indisponible et reprise. Label du sélecteur objectif lié au champ. TypeScript/build réussis ; contrôle locales et application de l’interface réussis.
- Aucun changement serveur, migration ou dépendance ; dernière suite complète lot 157 : 328 tests. Pas de génération IA, de formation réelle modifiée ou de recette navigateur. Objectif global non achevé.

Les trois tests de locales réussissent. Image locale reconstruite et assets actualisés sans redémarrage ; index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 157.

### Lot 159 — propositions IA relues avant application à la diapositive

- Tour précédent classé **progression** : affectation des diapositives sans objectif Part-66 et aperçu actualisés. Inspection de l’éditeur : réponses IA appliquées directement au texte/média/QCM, pouvant remplacer une saisie effectuée pendant la génération.
- Résultats texte/image/voix/QCM désormais conservés comme proposition distincte avec contenu à relire, actions Appliquer au brouillon/Écarter et messages FR/EN/AR. Aucun remplacement automatique du brouillon. Application explicite fusionnant uniquement les champs produits, puis sauvegarde normale.
- Verrou immédiat entre générations et sauvegarde ; sauvegarde bloquée pendant génération et tant que la proposition n’est pas résolue. Formulaire et fermeture bloqués pendant la sauvegarde. Réponse après démontage ignorée par l’interface et éditeur réinitialisé par identifiant de diapositive.
- TypeScript/build et trois tests de locales réussis. Aucun changement serveur/migration/dépendance, dernière suite complète lot 157 : 328 tests. Aucun appel fournisseur réel, pas de recette navigateur des transitions.
- Les propositions restent en mémoire et leur fermeture ne révoque pas une demande fournisseur déjà envoyée. Les imports privés et jobs vidéo suivent encore leurs propres flux ; ce lot concerne les quatre générations immédiates. Objectif global non achevé.

Image locale reconstruite et assets actualisés sans redémarrage ; index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 157.

### Lot 160 — cycle de vie des imports pédagogiques privés

- Tour précédent classé **progression** : propositions IA séparées du brouillon et aperçu actualisés. Lecture du composant partagé d’import : absence d’abandon FileReader et de garde après fermeture, permettant une mutation après départ ou un callback tardif.
- Verrou immédiat par import, FileReader abandonné au démontage, contrôle avant envoi et avant application du résultat. Composant réinitialisé par formation/nature ; éditeur de chapitre réinitialisé par formation/chapitre.
- Validation format/taille, erreur de lecture et import non confirmé visibles séparément en FR/EN/AR. Formats acceptés affichés. Aucun renvoi automatique ; après envoi non confirmé, possibilité de fichier stocké et de copie lors d’un renvoi explicitée.
- Aucun changement serveur/migration/dépendance ni fichier réel importé. TypeScript/build initiaux réussis, revalidation finale et actualisation locale réussies après ajout de la frontière chapitre et du libellé de format. Dernière suite complète lot 157 : 328 tests.
- Pas de recette FileReader/navigateur, d’annulation serveur après envoi, de dédoublonnage ou de coordination globale import/sauvegarde revendiqués. Objectif global non achevé.

TypeScript et build finaux réussis. Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 157.

### Lot 161 — lectures du studio et préparation de publication explicites

- Tour précédent classé **progression** : cycle de vie des imports privés et aperçu actualisés. Inspection du studio : listes/compteurs vides pendant chargement ou panne et résultat de préparation antérieur pouvant rester affiché après erreur.
- Chargement/erreur/reprise pour espaces, formations, versions, revues en attente et diapositives. Listes en erreur masquées ; cours déjà chargé conservé avec message signalant la dernière lecture pour éviter de démonter ses sous-éditeurs. Absence de formation/diapositive déclarée uniquement après lecture réussie.
- Résultat de préparation masqué en erreur/actualisation, publication initiale/nouvelle version bloquée tant que le résultat n’est pas disponible et prêt. Retrait de publication indépendant de la préparation, opérations principales non répétables pendant leur mutation. Prévisualisation/ajout/ordre dépendant de la lecture des diapositives ; erreurs d’ajout/ordre signalées.
- TypeScript/build et trois tests de locales réussis. Aucun changement serveur/migration/dépendance ni publication réelle. Pas de recette navigateur/panne réelle ; règles serveur de revue indépendante inchangées. Dernière suite complète lot 157 : 328 tests. Objectif global non achevé.

Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 157.

### Lot 162 — imports coordonnés avec les éditeurs pédagogiques

- Tour précédent classé **progression** : lectures/préparation du studio et aperçu actualisés. Les éditeurs pouvaient encore enregistrer le contenu avant la fin d’un import, entraînant une sauvegarde sans le rattachement attendu.
- L’import partagé acquiert l’accès auprès de son éditeur avant lecture et le libère une seule fois à la fin ou au démontage. Chapitre et diapositive bloquent sauvegarde et modifications pendant l’import ; un second import de la même instance est refusé.
- Diapositive : imports, générations immédiates et sauvegarde mutuellement exclusifs ; proposition IA à résoudre avant nouvel import. Chapitre : garde immédiate contre double sauvegarde, formulaire/fermeture bloqués pendant mutation et callbacks tardifs ignorés après démontage.
- Message d’attente FR/EN/AR ; fermeture autorisée pendant import, avec garde de résultat du lot 160. Les jobs vidéo déjà soumis restent indépendants ; aucune annulation serveur ou idempotence ajoutée.
- TypeScript/build et trois tests de locales réussis. Aucun fichier réel ou appel IA, aucun changement serveur/migration/dépendance. Pas de recette navigateur des transitions, dernière suite complète lot 157 : 328 tests. Objectif global non achevé.

Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 157.

### Lot 163 — parcours intégré auteur compagnie vers examens apprenant

- Tour précédent classé **progression** : imports coordonnés avec sauvegarde et aperçu actualisé. Revalidation des moyens de recette : CUA retourne browsers=[] ; Google Chrome est déclaré actif mais getApp échoue cgWindowNotFound. Aucune recette graphique réalisée.
- Ajout d’un test intégré dans makerAccess.integration.test.ts : compagnie sans objectifs Part-66, deux chapitres/diapositives et QCM via routes métier, contrôle de préparation, refus de publication prématurée et d’auto-revue, décision administrateur indépendant puis publication.
- Attribution via route métier : lot avec membre étranger refusé sans inscription partielle, attribution valide et reprise sans doublon. Lecture apprenant liée à la version publiée, lecture étrangère refusée, corrigés absents de la session, final bloqué avant les deux QCM, réussite finale et reprise avec un seul résultat puis inscription terminée.
- Les comptes/affiliations et le cours initial sont des fixtures SQL ; le reste du parcours passe par les callers tRPC sur PostgreSQL isolé. Ce test n’est ni une recette HTTP ni navigateur, ne vérifie pas l’émission PDF et ne sollicite aucun fournisseur.
- 11 tests studio ciblés et TypeScript réussis ; suite complète réussie : 329 tests avec quatre workers. Aucun changement de code applicatif, migration ou dépendance. Aperçu restant au lot 162 ; objectif global non achevé.

Aucune reconstruction ou relance de l’aperçu nécessaire pour ce lot de tests ; code applicatif et données de prévisualisation inchangés.

### Lot 164 — attribution compagnie avec sélection et résultat explicites

- Tour précédent classé **progression** : parcours intégré compagnie/apprenant validé, 329 tests réussis. Inspection du formulaire : sélection modifiable pendant envoi, dépassement possible de la limite API de 100 et personnes sélectionnées absentes d’une liste actualisée.
- Sélection figée pendant mutation, limite 100 et compteur FR/EN/AR. Contrôle immédiat d’envoi ; indisponibilité/actualisation des candidats bloquant l’attribution, reprise de lecture explicite. Personnes devenues indisponibles signalées et retirées uniquement par action de l’utilisateur.
- Résultat créé/existant affiché dans la page en plus du toast. Erreur : sélection conservée, liste réactualisée, attribution non confirmée expliquée et reprise manuelle. La protection serveur existante conserve les inscriptions valides lors d’une nouvelle attribution ; aucun renvoi automatique.
- TypeScript/build initiaux et tests des locales réussis ; revalidation des libellés et actualisation locale réussies. Aucun changement serveur/migration/dépendance, aucune attribution réelle. Pas de recette navigateur ; dernière suite complète lot 163 : 329 tests. Objectif global non achevé.

Build final et trois tests de locales réussis. Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 157.

### Lot 165 — confirmation d’abandon des brouillons pédagogiques

- Tour précédent classé **progression** : attribution compagnie avec sélection protégée et aperçu actualisés. Fermeture des éditeurs de chapitre/diapositive sans avertissement d’abandon constatée dans leurs callbacks.
- Comparaison du brouillon courant à son état initial ; proposition IA et opération en cours également considérées. Bouton Annuler, croix, Échap et fermeture externe du dialogue passent par une confirmation native si nécessaire. Sauvegarde en cours restant non fermable, réussite fermant normalement.
- Hook partagé pour confirmation et écoute beforeunload active uniquement pendant le risque d’abandon. Message FR/EN/AR spécifique si opération déjà envoyée, sans promettre son annulation serveur. Retour manuel à l’état initial n’exige plus de confirmation hors opération/proposition.
- TypeScript/build et trois tests de locales réussis. Aucune persistance de brouillon ajoutée, pas de garde générale des navigations SPA ni garantie d’avertissement sur fermeture forcée/mobile. Pas de recette navigateur. Aucun changement serveur/migration/dépendance ; dernière suite complète lot 163 : 329 tests. Objectif global non achevé.

Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 157.

### Lot 166 — noms des commandes du studio et états des corrigés

- Tour précédent classé **progression** : confirmation d’abandon des brouillons et aperçu actualisés. Inspection des commandes iconographiques : actions sur les diapositives dépourvues de nom accessible, sélection des bonnes réponses exprimée uniquement visuellement.
- Noms FR/EN/AR des commandes monter/descendre/modifier/archiver identifiant la diapositive ; retrait d’option/interactions identifié par numéro. Boutons de corrigé du mini-QCM et du QCM vidéo avec nom et aria-pressed reflétant leur sélection. Vignette de liste décorative avec alt vide, titre voisin conservé.
- TypeScript/build et trois tests de locales réussis. Pas de recette clavier/lecteur d’écran ou navigateur ; aucune conformité d’accessibilité globale revendiquée. Aucun changement serveur/migration/dépendance ; dernière suite complète lot 163 : 329 tests. Objectif global non achevé.

Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 157.

### Lot 167 — limites d’import et refus explicites

- Tour précédent classé **progression** : commandes accessibles du studio et aperçu actualisés. Inspection serveur : limite HTTP JSON 50 MiB cohérente avec limite d’import 25 MiB/base64 ; refus de taille/encodage/signature jusque-là levés comme Error génériques.
- Refus de requêtes importées maintenant BAD_REQUEST ; médias générés invalides restent INTERNAL_SERVER_ERROR. Interface distinguant un rejet BAD_REQUEST d’un envoi non confirmé, en FR/EN/AR.
- Test via caller de l’API avec PostgreSQL et stockage simulé : charge synthétique à en-tête PDF de exactement 25 MiB acceptée et empreinte vérifiée, un octet de plus refusé malgré même longueur base64, contenu/signature/encodage invalides refusés. Une seule écriture stockage et ligne média. Ce n’est pas une validation complète du format PDF ni un test HTTP de cette taille.
- 330 tests réussis avec quatre workers, TypeScript/build initiaux réussis. Complément interface suivi de revalidation/build/recette Docker réussis. Aucun fichier réel importé, aucune migration/dépendance ; objectif global non achevé.

TypeScript/build finaux réussis et recette Docker complète réussie avec sauvegarde/restauration. Aperçu remplacé avec volumes conservés ; index Tailscale identique au build, session antérieure et lectures auth.me/maker.courses vérifiés. Import mal encodé refusé via HTTP 400/BAD_REQUEST et no-store avant stockage ; aucun média réel déposé. Le contrôle HTTP ne couvre pas la charge maximale de 25 MiB.

### Lot 168 — indices de corrigé préservés dans l’éditeur de questions

- Tour précédent classé **progression** : limites d’import/refus serveur et aperçu actualisés. Inspection de QuestionDialog : filtrage des options vides sans remappage du corrigé, suppression de colonnes d’appariement sans décalage des indices restants et vrai/faux réécrit en français à l’ouverture.
- Préparation partagée conservant les positions et refusant options vides, indices invalides/dupliqués, corrigé multiple pour choix unique/vrai-faux et appariements incomplets. Aucun filtre silencieux ni réparation implicite du corrigé ; options seulement normalisées par trim.
- Suppression volontaire gauche/droite : seules les paires liées à l’élément supprimé sont retirées et les indices suivants sont décalés. Libellés vrai/faux existants conservés et éditables ; passage volontaire vers ce type initialisant deux libellés traduits et remettant le corrigé à choisir.
- Quatre tests de régression sur décalage de corrigé, cardinalité/indices, appariements incomplets et conservation des liens par leurs libellés. 334 tests réussis, TypeScript/build réussis. Aucun changement serveur/migration/dépendance ni question réelle modifiée ; pas de recette navigateur. Objectif global non achevé.

Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 167.

### Lot 169 — réponses libres alignées sur la publication

- Tour précédent classé **progression** : indices de corrigé préservés et aperçu actualisés. L’éditeur proposait encore une regex, alors que courseReadiness refuse déjà les réponses libres contenant une regex pour publication.
- Nouvelle saisie centrée sur les mots-clés/expressions acceptées, avec explication du comportement existant : présence d’au moins une alternative, casse/accents ignorés. Ancienne regex affichée sans édition ; sa conversion en mots-clés exige une confirmation explicite et au moins une alternative. Aucune ancienne question réécrite automatiquement.
- Éditeur réinitialisé par formation/question, empêchant le transfert du brouillon et de la confirmation de remplacement entre questions. Test PostgreSQL du blocage de revue avec regex, remplacement, snapshot de revue sans regex et correction par alternatives. Première exécution du nouveau test corrigée pour lire le snapshot par reviewSnapshot, la demande ne le renvoyant pas.
- 335 tests réussis, TypeScript/build réussis. Aucun changement des règles serveur ou des anciennes versions, migration ou dépendance. Pas de recette navigateur ni question réelle modifiée. Objectif global non achevé.

Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 167.

### Lot 170 — brouillon et sauvegarde de question protégés

- Tour précédent classé **progression** : réponses libres alignées sur publication et aperçu actualisés. L’éditeur de questions permettait encore de modifier le corrigé pendant une sauvegarde, puis de perdre cette saisie à la fermeture automatique.
- Verrou immédiat contre double envoi, champs/fermeture bloqués pendant création ou mise à jour, callbacks après démontage ignorés. Brouillon conservé sur erreur et banque actualisée ; état d’enregistrement/échec persistant FR/EN/AR. Pas de renvoi automatique.
- Garde d’abandon partagée appliquée à tous les champs, appariements et confirmation de remplacement d’une ancienne regex. Fermeture explicite et beforeunload protégés comme les autres éditeurs ; ni persistance après départ ni garde générale SPA revendiquées.
- La création de question ne possède pas encore d’UUID de reprise : message invitant à consulter la banque actualisée avant nouvelle tentative, une première création pouvant déjà exister. Aucun dédoublonnage serveur revendiqué.
- TypeScript/build initiaux et trois tests de locales réussis ; revalidation finale/actualisation locale réussies après clarification du message et invalidation de la banque. Aucun changement serveur/migration/dépendance, dernière suite complète lot 169 : 335 tests. Pas de question réelle modifiée ni recette navigateur. Objectif global non achevé.

TypeScript/build finaux et trois tests de locales réussis. Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes ; dernière recette Docker complète au lot 167.

### Lot 171 — reprise de création des questions

- Tour précédent : vérification de disponibilité locale/Tailscale, sans changement applicatif. Reprise du lot en cours : six tests en échec ont révélé le branchement erroné du nouveau gestionnaire sur modules.create. Schéma et gestionnaire des chapitres restaurés, gestionnaire raccordé à maker.content.questions.create.
- UUID facultatif normalisé, empreinte du contenu, verrou transactionnel par auteur/demande et registre immutable séparé des questions. Même demande retrouvée, contenu différent refusé ; question modifiée ou archivée retrouvée sans réécriture ni réactivation. Vérification des droits et du statut actif avant reprise. Pas de verrou transactionnel sur les changements concurrents de rôle/affiliation.
- Éditeur réutilisant le même UUID pour le même contenu et conservant l’ordre initial malgré actualisation de la banque. UUID en mémoire uniquement : fermeture/rechargement ou contenu changé ne bénéficient pas de cette reprise. Messages distincts de création et modification FR/EN/AR. Routes anciennes et requêtes sans UUID compatibles, sans dédoublonnage.
- Trois tests PostgreSQL ajoutés : concurrence, conflits, isolation auteurs, reprise après modification/archive, registre immutable, révocation des droits, compatibilité sans UUID et ordre des clés JSON. Après correction : 338 tests réussis, TypeScript/build réussis. Migration additive 20260913_question_creation_requests.sql ; aucune migration existante modifiée. Pas de question réelle créée ni de recette navigateur.
- Recette Docker complète et sauvegarde/restauration réussies. Aperçu remplacé avec volumes conservés, migration additive appliquée. Index Tailscale identique au build, session administrateur antérieure et lectures des formations/questions vérifiées avec no-store. Conteneur healthy. Objectif global non achevé.

### Lot 172 — mots-clés vides après normalisation

- Tour précédent classé progression : reprise UUID des créations de question validée et intégrée. Inspection du correcteur : includes(normalize(keyword)) acceptait toute réponse non vide lorsque le mot-clé devenait vide (espaces ou diacritiques isolés). Le contrôle de publication vérifiait seulement trim.
- Normalisation existante extraite dans shared/freeTextAnswer.ts sans changer son alphabet de diacritiques. Mot-clé utilisable exigé dans l’éditeur et pour chaque alternative avant publication/revue ; correcteur ignorant les alternatives vides ou non textuelles. Alternatives valides, casse, accents et expressions arabes conservés. Regex historiques inchangées ; toujours refusées pour nouvelle publication.
- Deux tests de correction et un test PostgreSQL de blocage de revue ajoutés. 341 tests réussis, TypeScript/build réussis. Aucune migration, note stockée, tentative ou question réelle modifiée. Les feedbacks historiques étant recalculés à la lecture, une ancienne réponse admise par ce défaut peut désormais être indiquée incorrecte alors que son score archivé reste conservé ; versionnement/persistance du feedback historique restant à traiter explicitement. Aucune recette navigateur.
- Recette Docker et sauvegarde/restauration réussies. Aperçu remplacé avec volumes conservés ; index Tailscale identique au build, session antérieure et lectures formations/préparation pédagogique vérifiées avec no-store. Objectif global non achevé.

### Lot 173 — correction des tentatives conservée avec la note

- Tour précédent classé progression : mots-clés normalisés sécurisés et aperçu actualisé. Correction du défaut restant : réponse à une soumission déjà terminée recalculait chaque résultat alors que le score était conservé.
- Colonne feedback nullable ajoutée aux tentatives. Nouvelle soumission calculant une seule fois les résultats par question, les utilisant pour le score et les enregistrant dans la même transaction. Reprise lisant exclusivement le détail enregistré. Migration additive interdisant UPDATE, DELETE et TRUNCATE des tentatives, sans réécriture des anciennes lignes.
- Ancienne tentative sans feedback : score/réussite conservés, feedback vide et feedbackAvailable=false ; explication FR/EN/AR dans le lecteur. Pas de reconstitution historique prétendue. Progression des objectifs utilisant le feedback lorsqu’il existe ; son ancien calcul reste en place pour les tentatives sans feedback (limite historique encore à auditer).
- Trois tests PostgreSQL : enregistrement/reprise malgré modification de banque, immutabilité des tentatives, résultat conservé différent du correcteur actuel, absence explicite pour historique. Le premier test tentait initialement de modifier le snapshot de session déjà immutable ; corrigé pour vérifier le refus, sans modifier cette protection. Ajustement de l’itération au niveau de compilation TypeScript existant.
- 344 tests réussis, TypeScript/build et recette Docker avec sauvegarde/restauration réussis. Aperçu remplacé avec volumes conservés ; index Tailscale identique au build, session antérieure et lectures auteur vérifiées avec no-store. Aucun examen réel soumis, aucune note historique recalculée, pas de recette navigateur. Objectif global non achevé.

### Lot 174 — historique de résultats accessible au retour dans le cours

- Tour précédent classé progression : feedback immutable des examens enregistré et aperçu actualisé. Inspection du lecteur : chapitre réussi retournant seulement une mention de réussite, écran final masquant le détail après rechargement.
- Composant de consultation des tentatives enregistrées, avec lignes dépliables natives, note/réussite et détail de correction. Chapitres : accessible avant démarrage et après réussite ; limite épuisée explicitée sans proposer un démarrage voué au refus serveur. Examen final : historique identifié dans la consultation du cours et après réussite, ainsi que dans le parcours sans chapitres. Pas de démarrage/soumission déclenché par consultation.
- Nouveau feedback conservant aussi le texte de question, utilisé dans l’historique. Ancien feedback sans texte affichant un numéro, sans reconstruire le libellé depuis la banque actuelle ; anciennes tentatives sans feedback signalées comme telles. Actualisation de la liste finale après soumission confirmée. Aucun ajout de route, migration ou réécriture des résultats existants.
- Test PostgreSQL existant renforcé sur conservation du texte et reprise après modification de banque. 344 tests réussis ; TypeScript/build initiaux réussis. TypeScript/build finaux et recette Docker avec sauvegarde/restauration réussis. Aperçu remplacé avec volumes conservés ; index Tailscale identique au build, session antérieure et lecture des inscriptions vérifiées avec no-store. Pas de recette navigateur, aucun examen réel soumis. Objectif global non achevé.

### Lot 175 — préparation explicite avant démarrage d’un QCM

- Tour précédent classé progression : historique des corrections accessible et aperçu actualisé. Inspection du lecteur : sélection du final ou fin du diaporama montait QuizView et lançait immédiatement startExam.
- Écran ExamEntry commun aux chapitres et au final. Seuil de réussite, durée configurée, nombre de tentatives disponibles calculé depuis les résultats, historique et bouton explicite démarrer/reprendre. Information FR/EN/AR sur le chronomètre déjà actif qui continue pendant l’absence et ne redémarre pas à zéro.
- Consultation ne montant pas QuizView avant clic, donc sans création de session. Limite atteinte affichée avec historique sans bouton de démarrage. Échec de lecture des tentatives bloquant le démarrage avec reprise de lecture ; actualisation en cours désactivant le bouton. Serveur restant autorité sur disponibilité, session active, seuil et temps restant.
- TypeScript/build et trois tests de locales réussis. Aucun changement serveur, migration, dépendance ni examen réel lancé. Dernière suite complète et recette Docker lot 174 : 344 tests. Pas de recette navigateur. Image locale reconstruite, assets actualisés sans redémarrage et index Tailscale identique au build validé. Anciennes ressources conservées pour les pages ouvertes. Objectif global non achevé.

### Lot 176 — progression rafraîchie et erreurs de lecture visibles

- Tour précédent classé progression : écran de préparation avant démarrage des QCM et aperçu actualisés. Inspection des callbacks : objectifs non invalidés après résultat, inscriptions non actualisées après final, erreurs de requêtes avec cache laissées sans message.
- Résultat final confirmé actualisant tentatives, objectifs et inscriptions ; résultat de chapitre actualisant objectifs même après échec, progression des modules et inscriptions après réussite. Les données restent celles du serveur ; aucun objectif marqué acquis localement.
- Message de rafraîchissement échoué FR/EN/AR partagé entre les deux présentations du lecteur. Reprise seulement des lectures en erreur, bouton désactivé pendant leur actualisation. Données déjà reçues et sous-arbre du QCM conservés ; les erreurs initiales sans données gardent le traitement bloquant existant. Cette modification ne remplace pas la gestion spécifique des erreurs de soumission/sauvegarde du QCM.
- TypeScript/build initiaux et trois tests de locales réussis ; ajustement final de l’invalidation des objectifs de chapitre suivi de revalidation/build réussis. Image locale reconstruite et assets actualisés sans redémarrage ; index Tailscale identique au build validé, anciennes ressources conservées pour les pages ouvertes. Aucun changement serveur/migration/dépendance, examen réel ou note modifiée. Dernière suite complète et recette Docker au lot 174 : 344 tests. Pas de recette navigateur. Objectif global non achevé.

### Lot 177 — diffusion admin : destinataires cohérents et résultat des canaux

- Tour précédent classé progression : progression/erreurs de rafraîchissement du lecteur et aperçu actualisés. Inspection de la messagerie : résultat SMTP ignoré, succès affiché et brouillon vidé même sans envoi, destinataire unique refusé par audience obligatoire, ciblage compagnie différent entre ancien companyId et affiliations (y compris inactives).
- Service adminBroadcast : rôle/statut admin relus, cible unique ou audience validée, comptes actifs seulement, compagnie ACTIVE avec affiliations ACTIVE dédupliquées. Une même liste alimente notifications et e-mails. Notifications insérées transactionnellement par lots avant les envois ; canal inApp honoré. Liens limités à chemins internes ou HTTPS, HTML du message échappé. Ancienne fonction broadcastNotification conservée mais route admin redirigée.
- Résultat séparant notifications, destinataires, e-mails acceptés selon sendEmail, échecs et non-envoyés (SMTP absent/adresse manquante). Exceptions par destinataire comptées sans stopper les autres. Acceptation SMTP ne prouvant pas réception en boîte. Bilan de composition persistant et toast de diffusion ; brouillon conservé sur résultat incomplet ou modifications intervenues pendant envoi. Pas de reprise automatique ou globale conseillée ; requête sans UUID, perte d’accusé pouvant encore produire des doublons.
- Trois tests PostgreSQL via API, SMTP entièrement simulé : affiliations dupliquées/révoquées, compte suspendu et ancien companyId exclus, adresse absente, échec/exceptions, SMTP non configuré, destinataire unique, canal email seul, cibles/canaux/liens invalides, compagnie suspendue et administrateur rétrogradé. 347 tests, TypeScript/build réussis.
- Aucune migration ou dépendance, aucun e-mail réel ni notification réelle créés. Pas encore de boîte d’envoi durable, de journal des erreurs consultable après rechargement ou de reprise ciblée : chantier restant. Pas de recette navigateur. Recette Docker et sauvegarde/restauration réussies. Aperçu remplacé avec volumes conservés ; index Tailscale identique au build, session antérieure vérifiée. Requête de diffusion à cible invalide refusée en HTTP 400/BAD_REQUEST avant envoi, avec no-store. Objectif global non achevé.

### Lot 178 — acceptation SMTP explicite et erreurs sans données privées

- Tour précédent classé progression : ciblage admin et bilan séparé des canaux corrigés et intégrés. Inspection de sendEmail : toute résolution de sendMail déclarée réussie, destinataire/sujet consignés et réponse brute du fournisseur retournée/loguée.
- Succès seulement si liste accepted non vide et liste rejected présente/vide. Réponse absente/incomplète ou refus partiel signalé non confirmé. Configuration avec port entier 1–65535 exigée ; transport créé dans le try. Délais de connexion et greeting 10 s, socket 20 s (délais par phase/inactivité, pas une durée totale garantie).
- Logs du service email limités à événements fixes, sans adresse/sujet/corps ou réponse brute. Erreur d’authentification distinguée, autres exceptions qualifiées de non-confirmation avec invitation à vérifier le fournisseur avant reprise. Aucun renvoi automatique. Acceptation SMTP ne prouvant toujours pas la livraison finale.
- Trois tests à transport Nodemailer simulé : configuration absente/ports invalides, acceptation vide/partielle/incomplète et acceptation valide, délais transmis, confidentialité des logs/résultats face à erreurs contenant des données privées. 350 tests, TypeScript/build réussis. Aucun e-mail réel envoyé ; pas de test de fournisseur réel, migration ou dépendance.
- Recette Docker et sauvegarde/restauration réussies. Aperçu remplacé avec volumes conservés ; index Tailscale identique au build, session administrateur antérieure et no-store vérifiés. Boîte d’envoi durable, journal administrateur après rechargement et reprises ciblées toujours à construire. Objectif global non achevé.

### Lot 179 — journal durable des diffusions administrateur

- Tour précédent classé progression : acceptation SMTP et confidentialité des erreurs corrigées, aperçu actualisé. Ajout du journal jusque-là absent après rechargement.
- Tables broadcast_runs et broadcast_outcomes : métadonnées de diffusion, auteur/cible, comptes de destinataires/notifications et bilan SMTP agrégé. Corps, adresses e-mail et réponses SMTP non copiés dans le journal. Création du journal et des notifications dans la même transaction avant SMTP ; bilan final ajouté après la boucle d’envoi. Absence de bilan signifiant en cours ou résultat incomplet, sans assimilation à un échec ni à une réussite.
- Deux tables immutables contre UPDATE/DELETE/TRUNCATE ; unicité du bilan par diffusion et validation SQL de la somme des résultats. Migration additive, aucune ancienne ligne reconstruite. Première exécution arrêtée sur syntaxe CASE ; absence d’application vérifiée dans raero_migrations avant correction des parenthèses, puis migration appliquée normalement.
- API admin avec statut/rôle relus, pagination descendante stable de 50 lignes. Composant FR/EN/AR dans la composition d’e-mails : détails, compteurs, auteur, état incomplet explicite, actualisation et pages anciennes. Lectures actualisées après réussite ou erreur d’une diffusion ; aucun bouton de renvoi.
- Deux tests PostgreSQL supplémentaires avec SMTP simulé : journal visible pendant envoi retenu par une promesse, bilan persistant et immutable, total incohérent refusé, pagination face à une nouvelle arrivée, refus aux non-admin/suspendus et curseur invalide. 352 tests réussis, TypeScript/build initiaux réussis ; TypeScript/build finaux et recette Docker avec sauvegarde/restauration réussis. Aperçu remplacé avec volumes conservés ; index Tailscale identique au build, session antérieure et lecture du journal vide vérifiées avec no-store.
- Aucune diffusion réelle envoyée ni donnée historique réécrite, pas de recette navigateur. Le journal couvre les diffusions admin nouvelles, pas les messages automatiques. Pas de file d’envoi durable/reprise ciblée, pas d’UUID empêchant un second envoi après perte d’accusé, et pas de bilan par destinataire : chantier restant. Objectif global non achevé.

### Lot 180 — reprise UUID des diffusions sans nouvel envoi

- Tour précédent classé progression : journal durable admin intégré et validé. Demande répétée après perte d’accusé pouvait encore créer un deuxième lot de notifications/e-mails.
- Migration additive requestId/fingerprint nullable dans broadcast_runs, paire cohérente et index unique auteur/UUID. Empreinte du contenu d’entrée normalisé ; verrou transactionnel par auteur/demande, recherche d’une diffusion existante avant résolution des destinataires et création atomique journal/notifications. Bilan existant retourné sans nouveau SMTP ; bilan absent refusé CONFLICT avec indication journal/en cours/incomplet. Aucun verrou SQL maintenu pendant SMTP.
- Statut/rôle admin relus avant toute reprise. Changement de contenu/canal avec le même UUID refusé. Reprise d’un bilan après suspension d’un ancien destinataire permise sans lui envoyer de nouveau message. UUID identique d’un autre administrateur indépendant. Métadonnées de reprise exclues de la projection du journal.
- Deux formulaires admin réutilisant un UUID en mémoire par demande inchangée. Changement de demande/rechargement ne conserve pas cette protection ; absence d’UUID reste compatible sans dédoublonnage. Message explicatif dans la composition, aucune relance ciblée des échecs proposée. Ce mécanisme ne garantit pas l’unicité de livraison SMTP au-delà d’une demande et ne résout pas une interruption entre envoi et bilan.
- Deux tests PostgreSQL avec SMTP simulé : demande concurrente pendant envoi retenu par promesse, casse UUID/ordre des clés, une notification/un appel SMTP, reprise de bilan, conflits, destinataire suspendu, admin rétrogradé, séparation auteurs et projection sans empreinte. 354 tests réussis. Import useRef manquant révélé par TypeScript puis corrigé ; TypeScript/build et recette Docker avec sauvegarde/restauration réussis. Aperçu remplacé avec volumes conservés ; index Tailscale identique au build, session antérieure et lecture du journal vérifiées avec no-store.
- Aucune diffusion réelle envoyée, aucune migration déjà appliquée modifiée, pas de recette navigateur. File d’envoi durable, états par destinataire et reprises ciblées restant à construire. Objectif global non achevé.

### Lot 181 — résultat conservé par destinataire de diffusion

- Tour précédent classé progression : UUID de reprise intégré et validé. Journal jusque-là limité au bilan global, sans détail exploitable si interruption avant ce bilan.
- Migration additive broadcast_recipients/broadcast_recipient_outcomes, lignes immutables contre UPDATE/DELETE/TRUNCATE. Destinataires dédupliqués enregistrés dans la transaction de création de diffusion/notifications, avant SMTP. Un résultat unique par destinataire ajouté immédiatement après son traitement : accepté, non confirmé, non envoyé pour configuration/adresse absente, e-mail non demandé.
- Absence de résultat qualifiée en attente ou résultat inconnu, sans déduire si un SMTP a été tenté. Échec d’écriture du résultat arrêtant la boucle (non absorbé comme échec SMTP), laissant le bilan global incomplet et conservant les résultats précédemment enregistrés. Aucun renvoi automatique ; reprise UUID du bilan ne crée aucun nouveau détail/envoi.
- API administrateur avec contrôle rôle/statut frais, diffusion existante exigée, pagination de 50 lignes indexée par diffusion/id. Détail chargé à la demande dans le journal, actualisation et pagination FR/EN/AR. Compte identifié par son ID, sans copie de l’adresse e-mail ou d’un corps de message ; anciennes diffusions sans détail signalées sans reconstitution.
- Deux tests PostgreSQL avec SMTP simulé : résultats non confirmé/adresse absente, conservation à la reprise UUID, immutabilité et absence d’adresse dans la projection, pagination 55 destinataires et résultats inconnus, refus d’accès non-admin/suspendu et diffusion absente. 356 tests, TypeScript/build initiaux réussis. TypeScript/build finaux et recette Docker avec sauvegarde/restauration réussis. Aperçu remplacé avec volumes conservés ; index Tailscale identique au build, session antérieure et journal vide vérifiés avec no-store, lecture des destinataires d’une diffusion inexistante refusée en HTTP 404.
- Aucune diffusion réelle envoyée, aucune migration déjà appliquée modifiée, pas de recette navigateur. Pas encore de file d’envoi exécutable ni de reprise ciblée ; une absence de résultat après SMTP reste ambiguë et ne doit pas provoquer de renvoi aveugle. Objectif global non achevé.

### Lot 182 — autorisation et adresse relues avant chaque e-mail de diffusion

- Tour précédent classé progression : résultats par destinataire intégrés et validés. Inspection de la boucle : liste initiale conservée même après modification de droits pendant une diffusion longue.
- Avant chaque appel SMTP : relecture du rôle/statut de l’administrateur, du statut et de l’adresse du compte ciblé ; diffusion compagnie exigeant encore affiliation ACTIVE et compagnie ACTIVE. Adresse différente de celle sélectionnée au départ refusée, sans redirection silencieuse. Configuration SMTP vérifiée à chaque itération également.
- Nouveau statut immutable skipped_access, libellé FR/EN/AR « droits ou adresse modifiés », comptabilisé parmi non-envoyés. Migration additive élargissant la contrainte de statuts, après vérification de son nom en base ; aucune migration appliquée réécrite.
- Test PostgreSQL/SMTP simulé couvrant six changements après le premier appel : compte suspendu, adresse changée, affiliation inactive, compagnie suspendue, administrateur rétrogradé ou suspendu. Chaque scénario : une acceptation, un destinataire ignoré et un seul appel SMTP. 357 tests, TypeScript/build réussis.
- Vérification juste avant SMTP, sans atomicité entre base et fournisseur : un envoi déjà engagé ne peut pas être rappelé et une modification après cette vérification reste possible. Les notifications internes créées dans la transaction initiale restent conservées. Aucune promesse de révocation rétroactive ou de sérialisation globale.
- Aucun e-mail réel envoyé, pas de recette navigateur. Recette Docker et sauvegarde/restauration réussies. Aperçu remplacé avec volumes conservés ; index Tailscale identique au build, session antérieure et lecture du journal vérifiées avec no-store. File d’envoi durable et reprises ciblées restant à construire ; objectif global non achevé.

### Lot 183 — reprise ciblée des e-mails explicitement non envoyés

- Tour précédent classé progression : droits/adresse relus avant SMTP, aperçu validé. Ajout d’une reprise explicite des destinataires skipped_configuration, skipped_missing_email ou skipped_access ; états accepted/unconfirmed, absence de résultat et e-mail non demandé refusés.
- Migration additive broadcast_payloads (corps/lien conservés pour nouvelles diffusions) et broadcast_retries (liaison source destinataire → diffusion enfant unique, périmètre compagnie hérité). Tables immutables ; anciennes diffusions sans contenu non reconstituées et reprise indisponible. Le corps est désormais conservé séparément du journal de métadonnées pour permettre cette fonction ; accès de prévisualisation réservé aux administrateurs actifs.
- Prévisualisation du contenu conservé et du destinataire/adresse actuels. Confirmation envoie un seul e-mail, sans notification interne supplémentaire. Adresse attendue vérifiée à la mutation et avant SMTP ; rôle/statut, affiliation/compagnie et configuration vérifiés à nouveau. Périmètre compagnie transmis à toutes les générations de reprise.
- Verrou transactionnel par destinataire source et contrainte unique empêchant deux diffusions enfants, y compris appels concurrents avec UUID différents. Reprise d’un enfant déjà créé retrouvant son bilan ; bilan encore absent refusé sans nouvel envoi. Une reprise elle-même explicitement non envoyée peut être reprise depuis son propre destinataire, avec périmètre hérité.
- Dialogue FR/EN/AR en lecture seule avant bouton de confirmation, fermeture bloquée pendant mutation, verrou d’envoi immédiat. Journal affichant l’identifiant de diffusion pour retrouver une reprise existante. Aucun bouton pour forcer le renvoi d’un résultat SMTP ambigu.
- Trois tests PostgreSQL/SMTP simulé : contenu prévisualisé/échappé, concurrence et une seule reprise SMTP sans notifications, immutabilité contenu/liaison, exclusion succès/non-confirmé/absence de résultat/historique sans corps, adresse changée, SMTP disparu après validation, affiliation révoquée sur génération suivante et admin rétrogradé. 360 tests, TypeScript/build initiaux réussis ; TypeScript/build finaux et recette Docker avec sauvegarde/restauration réussis. Aperçu remplacé avec volumes conservés ; index Tailscale identique au build, session antérieure et journal vérifiés avec no-store, prévisualisation d’une source inexistante refusée en HTTP 404.
- Aucun e-mail réel envoyé, pas de recette navigateur, aucune migration déjà appliquée réécrite. Traitement toujours synchrone par requête, sans worker de file d’envoi ; messages automatiques non couverts. Conservation du nouveau contenu à intégrer à l’audit global de confidentialité/rétention. Objectif global non achevé.

### Lot 184 — noms et titres multilingues dans les certificats PDF

- Tour précédent classé progression : reprise ciblée des e-mails intégrée et validée. Inspection du certificat : nom et titre rendus en Helvetica, sans prise en charge correcte de l’arabe ni contrôle des débordements.
- Compétence PDF appliquée ; marqueur d’opération exécuté avant création de trois spécimens de QA. Réutilisation de la police Noto Sans Arabic embarquée et du moteur de lignes bidirectionnelles déjà utilisé pour les factures. Noms, titres et référence de formation rendus sans inverser les lettres des séquences arabes ; références latines conservées dans les contenus mixtes.
- Zones de texte explicites avec réduction de taille jusqu’à un minimum et retour à la ligne. Si le contenu ne peut pas tenir, émission refusée PRECONDITION_FAILED plutôt que tronquée ou prolongée sur une seconde page. Motif de précondition affiché dans l’état de certificat du lecteur. Espacement vertical des éléments ajusté pour séparer titres, référence et détails.
- Trois PDF de test (nom français accentué, nom arabe/titre mixte, nom et titre longs mixtes) générés dans tmp/pdfs/lot184, rendus avec Poppler puis inspectés visuellement : lisibles, sans chevauchement visible, une page A4 paysage chacun. Identifiants et référence SPECIMEN, aucune émission réelle ni écriture d’archive.
- Trois tests : préservation des textes FR/AR et référence latine dans le rendu d’une page, refus d’identité dépassant la zone. 363 tests, TypeScript/build initiaux réussis ; TypeScript/build finaux et recette Docker avec sauvegarde/restauration réussis. Aperçu remplacé avec volumes conservés ; index Tailscale identique au build, session antérieure et lecture des certificats vérifiées avec no-store.
- Aucune nouvelle police/dépendance/migration ; licence de la police existante conservée. Anciens PDF archivés inchangés. Libellés fixes toujours en français, pas de traduction intégrale du certificat ni validation de tous les scripts Unicode. Pas de conformité réglementaire du document revendiquée. Objectif global non achevé.


### Lot 185 — certificats localisés et langue archivée

- Tour de statut précédent classé sans progression fonctionnelle : disponibilité Docker/Tailscale confirmée uniquement. Reprise des modifications de certificats en cours ; journaux terminaux relus avant toute nouvelle exécution.
- Libellés du certificat FR/EN/AR selon la langue de la version de formation attachée à l’inscription ; cours courant utilisé pour les inscriptions historiques sans version, français par défaut pour langue inconnue. Nom du titulaire et titre conservés dans leur langue originale.
- Langue enregistrée dans le snapshot immutable de la nouvelle archive (champ JSON facultatif, sans migration). Changement ultérieur du catalogue ne régénérant pas le certificat déjà émis. Dates affichées en calendrier grégorien UTC, mois écrit en arabe pour limiter l’ambiguïté numérique.
- Trois spécimens QA français/anglais/arabe rendus avec Poppler et inspectés : une page chacun, libellés lisibles et absence de chevauchement visible. Dernière version arabe inspectée après ajustement de date et ponctuation du numéro. Aucune émission réelle et aucun PDF historique modifié.
- 368 tests réussis, dont rendu trilingue, normalisation de langue/date UTC et intégration PostgreSQL prouvant la langue de version archivée et absence de régénération après changement du catalogue. TypeScript et build réussis. Recette Docker et sauvegarde/restauration réussies.
- Aperçu remplacé avec volumes conservés et ancien conteneur before185 arrêté pour retour arrière. Index Tailscale identique au build, session administrateur antérieure, lecture des certificats avec no-store et police embarquée lisible vérifiés.
- Pas de validation réglementaire du modèle ni de recette navigateur revendiquées. Validation globale des parcours, fournisseurs réels et exigences réglementaires restant à effectuer ; objectif global non achevé.


### Lot 186 — objectifs historiques sans recalcul de correction

- Tour précédent classé progression : certificats trilingues intégrés et vérifiés. Inspection du suivi des objectifs révélant un recalcul des anciennes réponses sans feedback avec le corrigé actuel, pouvant modifier la conclusion affichée après édition du cours.
- Suppression de ce recalcul. L’objectif utilise exclusivement le feedback enregistré de la tentative réussie retenue (ou la plus récente si aucune réussite). Une question sans détail dans une tentative existante ajoute un compteur unavailableQuestionCount et empêche de confirmer l’objectif ; absence de tentative reste simplement non complétée. Les règles de sélection de tentative sont conservées.
- Indication FR/EN/AR dans la liste des objectifs : détail historique indisponible, objectif non confirmable et résultat d’examen conservé. Aucune réécriture de score, résultat, archive ou certificat. Pas de migration ni nouvelle dépendance. La cartographie des objectifs des inscriptions historiques non versionnées dépend encore du catalogue courant ; pas de reconstitution revendiquée.
- Deux tests PostgreSQL couvrent absence de tentative, résultat historique sans feedback et résultat avec feedback, puis modification du corrigé : conclusion stable, résultat réussi conservé. 370 tests, TypeScript et build réussis. Première insertion automatisée des traductions interrompue sur clé non trouvée ; format plat des clés vérifié et correction appliquée, puis contrôles complets relancés après ajout des tests.
- Recette Docker et sauvegarde/restauration réussies. Aperçu remplacé avec volumes conservés ; ancien conteneur before186 arrêté pour retour arrière. Index Tailscale identique au build, session administrateur antérieure et lecture des inscriptions avec no-store vérifiés. Pas de recette navigateur. Objectif global non achevé.


### Lot 187 — échéances mensuelles sans débordement de fin de mois

- Tour précédent classé progression : suivi des objectifs sans recalcul historique intégré. Inspection des échéances révélant trois appels setMonth locaux pouvant reporter le 31 janvier en mars pour une période d’un mois et dépendre du fuseau du serveur.
- Fonction partagée addCalendarMonths : ajout des mois calendaires en UTC, jour limité au dernier jour du mois cible, heure/millisecondes conservées, date source non mutée, entrées non entières/dates invalides et résultats hors plage refusés. Appliquée aux nouvelles échéances d’inscription, de certificat et aux nouvelles récurrences créées par analyse des besoins (TNA).
- Aucun changement des périodes métier configurées, dates historiques, archives ou échéances Stripe fournies par le prestataire. Convention logicielle de fin de mois, sans prétendre valider les périodes réglementaires de formation. Pas de migration ou dépendance.
- Sept nouveaux tests : mois de février ordinaire/bissextile, anniversaire du 29 février, changement d’année, mois négatif, heure UTC autour d’un changement saisonnier et entrées invalides. 377 tests, TypeScript et build réussis. Test d’archive renforcé sur période de douze mois après 29 février, avec échéance attendue le 28 février ; dix tests d’intégration certificat relancés et réussis après ce renforcement. Stockage simulé, aucune émission réelle.
- Recette Docker et sauvegarde/restauration réussies. Aperçu remplacé avec volumes conservés ; ancien conteneur before187 arrêté pour retour arrière. Index Tailscale identique au build, session administrateur antérieure et lecture des certificats avec no-store vérifiés. Pas de recette navigateur. Objectif global non achevé.


### Lot 188 — historique KYC/KYB paginé et anciens motifs visibles

- Tour précédent classé progression : échéances calendaires corrigées et intégrées. Inspection KYC/KYB : détail du dossier chargeant tous les événements avec leurs snapshots complets, interface limitée à l’action/date et au seul motif courant.
- Nouvelle lecture history à contrôle d’accès frais par dossier et page : 50 événements, curseur ID descendant borné entier SQL, projection id/auteur/action/date et motif uniquement pour approved/rejected/needs_information. Snapshots previous/current conservés en base mais exclus de cette réponse. Événements retirés de la réponse detail ; tous ses consommateurs de code recherchés et adaptés.
- Composant d’historique réinitialisé au changement de dossier, pages anciennes et actualisation des derniers événements, motifs précédents affichés en texte. États chargement/erreur/nouveau chargement FR/EN/AR et invalidation après mutations. Une erreur masque les lignes en cache. Pas de mutation historique, migration ou nouvelle dépendance.
- Test PostgreSQL de 56 événements puis nouvelle arrivée entre pages : ordre stable et absence de doublons, projection minimale, motif seulement sur décision, detail sans snapshots d’événements, curseurs invalides et interdiction aux tiers/comptes suspendus. Test KYB complété pour refuser aussi l’historique après révocation d’affiliation. 378 tests, TypeScript et build réussis ; tests KYC ciblés relancés après renforcement KYB.
- Recette Docker et sauvegarde/restauration réussies ; 13 tests KYC ciblés réussis. Aperçu remplacé avec volumes conservés, ancien conteneur before188 arrêté. Index Tailscale identique au build, session antérieure et lecture KYC avec no-store vérifiés ; historique inexistant refusé HTTP 403. Pas de recette navigateur. Volume des justificatifs et liste personnelle encore non paginés. Pas de validation juridique du processus KYC/KYB revendiquée. Objectif global non achevé.


### Lot 189 — pièces KYC/KYB paginées et métadonnées d’archive consultables

- Tour précédent classé progression : historique KYC/KYB paginé intégré. Inspection des justificatifs : chargement de toutes les pièces actives dans detail et absence de consultation des métadonnées des pièces archivées.
- Nouvelle lecture documentsPage par dossier, filtre actuel/archivé et curseur ID descendant de 50 lignes. Rôle/statut et accès personne/compagnie relus à chaque page. Projection limitée aux informations utiles à l’affichage ; URL rendue nulle pour pièce archivée, sans empreinte ni UUID de dépôt. Les téléchargements archivés restent refusés par la barrière de stockage existante.
- Réponse detail limitée aux informations du dossier ; consommateurs recherchés et adaptés. Interface FR/EN/AR avec listes actuelles/archivées, dates de dépôt/archivage, actualisation et pages anciennes, états vide/chargement/erreur. Changement de dossier réinitialisant le composant ; mutations invalidant la liste. Archivage proposé seulement sur pièces actuelles d’un dossier modifiable.
- Test PostgreSQL de 55 pièces : pagination sans doublon, déplacement d’une pièce vers les archives, projection et URL nulle, refus de téléchargement, accès tiers/suspendu et curseurs invalides. Contrôle KYB après affiliation révoquée renforcé ; contrôle de soumission avec seule pièce archivée renforcé. 379 tests, TypeScript et build réussis ; tests KYC ciblés relancés après dernier renforcement.
- Pas de suppression de fichier ni restauration automatique, migration ou nouvelle dépendance. Liste personnelle des dossiers encore non paginée. Recette Docker et sauvegarde/restauration réussies, 14 tests KYC ciblés réussis. Aperçu remplacé avec volumes conservés, ancien conteneur before189 arrêté. Index Tailscale identique au build, session antérieure et lecture KYC avec no-store vérifiés ; pièces archivées d’un dossier inexistant refusées HTTP 403. Pas de recette navigateur. Objectif global non achevé.


### Lot 190 — encodage strict des justificatifs KYC/KYB

- Tour précédent classé progression : pièces actives/archivées paginées intégrées. Inspection du validateur : expression de caractères Base64 mais pas de longueur multiple de quatre ni de contrôle des bits de bourrage ; Buffer.from acceptait silencieusement des variantes mal formées.
- Limite de longueur encodée avant décodage selon 8 Mio, longueur multiple de quatre et comparaison du réencodage canonique exigées. Taille décodée non vide et au maximum 8 Mio conservée, message de borne corrigé. Aucun changement de format produit par FileReader ni des documents déjà stockés.
- Deux tests ajoutés : variantes de bourrage, bits non canoniques, caractères supplémentaires/retours à la ligne/préfixe data URL, signatures PDF/PNG/JPEG, limite exacte et dépassement décodé/encodé. Test de dépôt UUID renforcé : entrée mal formée refusée BAD_REQUEST sans appel au stockage, document ou événement ajouté, puis dépôt canonique réussi avec le même UUID.
- 381 tests, TypeScript et build réussis. Validation toujours limitée à l’encodage/taille/signature initiale : ne prouve pas l’intégrité structurelle complète d’un PDF/image ni l’absence de contenu malveillant. Pas de nouvelle dépendance ou migration, aucun justificatif réel envoyé.
- Recette Docker et sauvegarde/restauration réussies. Aperçu remplacé avec volumes conservés, ancien conteneur before190 arrêté. Index Tailscale identique au build, session antérieure et lecture KYC avec no-store vérifiés. Pas de recette navigateur. Objectif global non achevé.


### Lot 191 — reprise de création de chapitre sans doublon

- Tour précédent classé progression : encodage des justificatifs renforcé et intégré. Inspection du studio : création de question protégée par UUID, création de chapitre encore sans reprise après accusé perdu.
- Nouveau service createAuthorModule avec schéma d’entrée du studio, UUID facultatif normalisé et empreinte canonique de la demande. Acteur actif relu et droits d’auteur vérifiés avant recherche de reprise. Verrou transactionnel auteur/UUID, création du chapitre et liaison de reprise atomiques.
- Migration additive module_creation_requests : unicités auteur/UUID et chapitre, registre immutable contre UPDATE/DELETE/TRUNCATE. Reprise retournant le chapitre sans réécrire ses modifications ultérieures ni réactiver son archive ; UUID utilisé avec autre contenu/formation refusé CONFLICT. Liens de contenu contrôlés avant création nouvelle. Route admin historique conservée.
- Formulaire de chapitre gardant un UUID en mémoire pour chaque demande inchangée ; ordre stocké dans l’état initial du formulaire. Message FR/EN/AR de reprise après erreur, confirmation distinguant création, chapitre retrouvé et chapitre retrouvé archivé. Changement de contenu génère un autre UUID ; fermeture/rechargement ne conserve pas cette identité. Aucune promesse de dédoublonnage entre demandes distinctes ou appels historiques sans UUID.
- Trois tests PostgreSQL : concurrence avec casse UUID, un chapitre/un registre, conflits, permissions et auteurs indépendants, modification/archivage conservés à la reprise, registre immutable, révocation d’affiliation, ordre des clés et compatibilité sans UUID. 384 tests réussis ; TypeScript/build initiaux réussis, contrôles finaux relancés après amélioration des messages.
- Pas de migration appliquée réécrite, pas de nouveau fournisseur ou dépendance. Création de diapositives encore sans UUID et contrôle des éditions concurrentes restant à traiter. TypeScript/build finaux et recette Docker avec sauvegarde/restauration réussis. Aperçu remplacé avec volumes conservés et ancien conteneur before191 arrêté ; index Tailscale identique au build, session antérieure et lecture des inscriptions avec no-store vérifiés. Pas de recette navigateur. Objectif global non achevé.


### Lot 192 — reprise de création manuelle de diapositive

- Tour précédent classé progression : chapitres protégés contre les doublons de reprise, aperçu intégré. Inspection de l’ajout manuel de diapositive révélant une nouvelle création à chaque essai et ordre recalculé sur la liste actualisée.
- Nouveau service createAuthorSlide : acteur actif et droits d’auteur relus, UUID/empreinte et verrou transactionnel par auteur/demande, création et registre atomiques. Migration additive slide_creation_requests immutable avec unicités auteur/UUID et diapositive. Reprise retournant l’ID existant sans écraser édition/archivage. Demande différente sous même UUID refusée.
- Validation existante des activités réutilisée avant insertion : QCM et interactions vidéo toujours contrôlés, liens chapitre/objectif validés. ID de réponse conservé pour les consommateurs existants. Imports devenus inutilisés retirés du routeur.
- Bouton d’ajout conservant la demande complète, dont ordre, dans une carte en mémoire par utilisateur/formation jusqu’à confirmation ; verrou immédiat de clic. Reprise conservée pendant navigation interne entre formations, sans persistance après rechargement. Succès invalidant la formation de la demande même si l’utilisateur a changé de vue. Messages FR/EN/AR pour erreur/reprise/archive retrouvée.
- Trois tests PostgreSQL : concurrence, identité unique, conflits/permissions, modification/archivage conservés, immutabilité, affiliation révoquée, compatibilité sans UUID, ordre des clés. Test renforcé pour QCM invalide sans diapositive ni registre ajouté. 387 tests réussis ; six tests ciblés création/locales réussis après derniers ajouts.
- Pas de création réelle dans l’aperçu ni migration appliquée modifiée. Pas de dédoublonnage automatique des générations IA ou demandes distinctes. Première vérification TypeScript arrêtée sur itération Map incompatible avec la cible du projet ; remplacée par forEach. TypeScript/build finaux et recette Docker avec sauvegarde/restauration réussis. Aperçu remplacé avec volumes conservés et ancien conteneur before192 arrêté ; index Tailscale identique au build, session antérieure et lecture des inscriptions avec no-store vérifiés. Pas de recette navigateur. Objectif global non achevé.


### Lot 193 — détection des éditions concurrentes de diapositives

- Tour précédent classé progression : ajout de diapositives avec reprise UUID intégré. Inspection de l’édition : verrou SQL sérialisant les patchs mais aucun contrôle de la version chargée par l’auteur, permettant l’écrasement silencieux d’un formulaire ancien.
- Migration additive slides.revision (entier initial zéro) et trigger SQL incrémentant à chaque UPDATE, y compris réordonnancement ou écriture directe. Nouvelle révision technique de brouillon, distincte des versions publiées immutables de formation ; snapshots déjà publiés inchangés.
- Mutation updateSlide acceptant expectedRevision facultatif validé entier SQL. Comparaison sous verrou de ligne avant validation/écriture, refus CONFLICT en cas de décalage ou archive. Éditeur envoyant la révision de son ouverture ; brouillon conservé après refus, message FR/EN/AR et invalidation de la liste pour relecture. Aucun rechargement automatique du formulaire ni écrasement forcé.
- Test PostgreSQL : deux patchs avec même révision, une seule réussite ; brouillon ancien refusé sans modification du contenu ; changement direct d’ordre détecté ; nouvelle révision acceptée après rapprochement ; compatibilité de patch historique sans expectedRevision, bornes d’entrée et refus bas niveau d’édition archivée. 388 tests, TypeScript et build réussis ; test diapositive ciblé relancé après renforcement archive.
- Contrôle optionnel pour compatibilité des anciens appels : pas de protection globale revendiquée pour clients n’envoyant pas expectedRevision, chapitres/questions ou toutes les générations IA. Rapprochement manuel des brouillons, pas de fusion automatique ni reprise d’accusé d’édition perdu. Réordonnancement entraînant aussi un conflit conservateur.
- Aucune migration appliquée modifiée. Quatre tests de diapositives ciblés réussis, recette Docker et sauvegarde/restauration réussies. Aperçu remplacé avec volumes conservés et ancien conteneur before193 arrêté ; index Tailscale identique au build, session antérieure et lecture des cours auteur avec no-store vérifiés. Révisions présentes dans la lecture des diapositives du premier cours accessible. Pas de recette navigateur. Objectif global non achevé.


### Lot 194 — rapprochement des conflits dans l’éditeur de diapositive

- Tour précédent classé progression : révision de diapositive et refus des écrasements concurrents intégrés. Suite du parcours, jusque-là limité à une consigne de copie manuelle avant fermeture.
- Bouton de comparaison après CONFLICT, lecture fraîche des diapositives autorisées et maintien du brouillon en cas d’échec ou diapositive disparue/archivée. Formulaire verrouillé pendant lecture/comparaison ; annulation revenant au brouillon inchangé.
- Rapprochement à trois versions (base d’ouverture, brouillon, dernière version) : changements indépendants réunis, changements identiques sans conflit et choix explicite requis pour chaque groupe contradictoire. Groupes titre, texte, image+description, audio, vidéo+interactions, chapitre+objectif et QCM complet. Aucun assemblage automatique d’options de QCM provenant d’une version et de bonnes réponses provenant de l’autre.
- Interface FR/EN/AR à comparaison côte à côte ; détails complexes d’interactions consultables dans le texte de comparaison. Application prépare uniquement le brouillon et adopte la révision comparée ; bouton Enregistrer toujours nécessaire, validation QCM/vidéo/liens conservée et nouveau conflit possible si autre modification entre comparaison et enregistrement. Pas de fusion textuelle ligne par ligne ni d’écriture forcée.
- Trois tests purs : changements indépendants sans mutation des entrées, conflits nécessitant choix et cohérence du groupe QCM, changements identiques/locaux conservés. 391 tests, TypeScript/build réussis. Empreinte SHA256 du bundle serveur identique au serveur d’aperçu ; modification d’interface seulement, sans migration.
- Image construite et ressources d’interface copiées dans le conteneur sans arrêt du service, anciens fichiers hachés conservés. Index Tailscale identique au nouveau build vérifié. Pas de nouvelle recette Docker complète : code serveur inchangé vérifié par empreinte. Pas de recette navigateur. Objectif global non achevé.


### Lot 195 — refus d’écrasement concurrent des chapitres et questions

- Tour précédent classé progression : comparaison des conflits de diapositives intégrée. Inspection des autres éditeurs : chapitres et questions sans contrôle de la version de brouillon chargée.
- Migration additive revision sur training_modules et quiz_questions, triggers SQL incrémentant chaque UPDATE, y compris modifications directes, réordonnancement et archivage. Versions publiées et tentatives/corrigés enregistrés non réécrits.
- Helpers d’édition sous verrou de ligne : absence NOT_FOUND, archive ou révision dépassée CONFLICT avant écriture. Routes du studio acceptant expectedRevision entier SQL facultatif et l’excluant des champs de contenu. Éditeurs envoyant la révision chargée et conservant leur brouillon à l’erreur, message FR/EN/AR et invalidation des listes pour relecture.
- Deux tests PostgreSQL (chapitre/question) : une seule réussite de deux éditions concurrentes avec même révision, ancien patch refusé sans changement, écriture directe détectée, révision actualisée acceptée, appel historique sans révision compatible, bornes invalides et refus bas niveau de modification archivée.
- 393 tests, TypeScript et build réussis. Pas de migration appliquée modifiée. Contrôle facultatif pour compatibilité des anciens clients ; pas de fusion assistée des chapitres/questions à ce stade, ni contrôle des éditions concurrentes d’objectifs/catalogue. Rapprochement manuel des brouillons encore nécessaire pour ces deux éditeurs.
- Recette Docker et sauvegarde/restauration réussies. Aperçu remplacé avec volumes conservés et ancien conteneur before195 arrêté ; index Tailscale identique au build, session antérieure et lectures auteur avec no-store vérifiés. Lectures des chapitres/questions du premier cours accessible réussies mais listes vides : pas de preuve de projection des révisions sur données locales non vides. Migration confirmée appliquée dans les logs du conteneur ; comportement des révisions couvert sur fixtures PostgreSQL. Pas de recette navigateur. Objectif global non achevé.


### Lot 196 — rapprochement des versions de chapitre dans le studio

- Tour précédent classé progression : chapitres/questions avec détection des écrasements concurrents intégrés. Suite du parcours pour chapitres, jusque-là limité à conservation du brouillon et consigne de rapprochement manuel hors éditeur.
- Bouton de comparaison après CONFLICT : lecture fraîche des chapitres autorisés, refus si chapitre disparu/archivé en conservant le brouillon. Formulaire/imports/enregistrement verrouillés pendant lecture ou comparaison, annulation retournant au brouillon inchangé.
- Moteur existant de rapprochement extrait en fonction à groupes et composant renommé DraftConflictResolution pour les deux éditeurs réellement utilisateurs (diapositive/chapitre). Groupes de chapitre : titre, description, contenu, vidéo, PDF, durée, ordre, caractère obligatoire, politique QCM complète. Changements indépendants réunis, conflits avec choix obligatoire ; seuil/tentatives/temps QCM choisis ensemble pour éviter un assemblage involontaire de règles.
- Application préparant le brouillon et adoptant la révision comparée sans écriture serveur ; enregistrement explicite ensuite, nouvelle modification concurrente toujours refusée. Messages et comparaison FR/EN/AR, booléens affichés Oui/Non, données absentes distinguées par tiret. Pas de fusion ligne par ligne et pas encore de rapprochement assisté des questions d’examen.
- Deux tests supplémentaires : changements de chapitre indépendants sans mutation de la base/brouillon, conflit de politique QCM et conservation cohérente du groupe choisi. 395 tests, TypeScript/build initiaux réussis ; contrôles finaux relancés après ajustement du libellé vidéo pour chapitre.
- TypeScript/build finaux et construction de l’image réussis. Interface copiée dans le conteneur sans arrêt, anciens fichiers hachés conservés. Index Tailscale identique au build et bundle serveur identique par SHA256 vérifiés ; pas de nouvelle recette Docker complète pour cette modification d’interface seule. Pas de migration, nouvelle dépendance ou recette navigateur. Objectif global non achevé.


### Lot 197 — rapprochement des questions d’examen dans le studio

- Tour précédent classé progression : comparaison de chapitres intégrée. Extension au troisième éditeur déjà protégé par révision, celui des questions d’examen.
- Lecture fraîche de la banque autorisée après conflit, maintien du brouillon si lecture échoue ou question devient inaccessible. Éditeur verrouillé pendant lecture/comparaison ; annulation revenant aux saisies intactes. Version attendue et ordre de la question désormais conservés dans l’état de rapprochement.
- Groupe de correction indivisible : type, énoncé, options gauche/droite, bonnes réponses, associations, mots-clés/ancienne règle, confirmation de remplacement, points et explication. Placement chapitre/objectif et ordre séparés pour réunir leurs changements indépendants. Aucun mélange automatique d’un nouvel énoncé avec un corrigé concurrent.
- Préparation du brouillon rapproché sans enregistrement, état de règle historique et confirmation restitués selon la version choisie. Nouvelle règle historique adoptée imposant sa propre confirmation de remplacement ; contrôles QCM/QCU, associations et mots-clés conservés au bouton Enregistrer. Révision comparée envoyée au serveur, nouveau changement concurrent toujours refusé.
- Composant partagé FR/EN/AR adapté aux questions ; bonnes réponses et associations affichées avec numéros commençant à 1, type de question traduit. Ancien message générique de conflit devenu inutilisé retiré des trois dictionnaires.
- Trois nouveaux tests : correction locale + placement/ordre distants indépendants, conflit de changement de type conservant toute l’évaluation choisie, confirmation d’ancienne règle non transférée à une règle modifiée. 398 tests, TypeScript/build initiaux réussis ; contrôles finaux relancés après libellés et nettoyage.
- TypeScript/build finaux et image Docker réussis. Interface copiée sans arrêt du service, anciens fichiers hachés conservés. Index Tailscale identique au build et bundle serveur identique par SHA256 vérifiés. Pas de nouvelle recette Docker complète pour cette modification d’interface seule. Pas de migration, nouvelle dépendance ou recette navigateur. Fusion de texte ligne par ligne non proposée. Objectif global non achevé.


### Lot 198 — réordonnancement atomique des diapositives

- Tour précédent classé progression : comparaison de questions intégrée. Inspection du déplacement de diapositives : une écriture hors transaction par ligne et aucune révision attendue, permettant un ordre partiel après erreur et l’écrasement d’un réordonnancement concurrent.
- Réordonnancement sous transaction, verrouillage des lignes dans l’ordre stable de leurs IDs, vérification des lignes existantes/non archivées et d’une seule formation. Révisions attendues facultatives comparées avant écriture. Liste non vide sans doublons et révisions alignées exigées. Seules les positions modifiées sont écrites, préservant les révisions pour un ordre déjà identique.
- Studio envoyant les révisions associées aux IDs dans l’ordre demandé ; verrou de clic immédiat, flèches désactivées pendant l’actualisation. Listes et disponibilité de publication invalidées après réussite ou échec pour permettre de repartir de l’état actuel. Aucun changement d’ordre local optimiste à annuler.
- Deux tests PostgreSQL : concurrence avec même base, un seul ordre accepté et positions cohérentes, ordre identique sans écriture, entrées invalides ; erreur SQL synthétique sur dernière position annulant tout changement d’ordre/révision, reprise sans révisions compatible et archive refusée. Premier test d’erreur cherchait le message au niveau Drizzle au lieu de sa cause ; assertion corrigée pour vérifier précisément la cause SQL, puis suite complète relancée.
- 400 tests, TypeScript et build réussis. Pas de migration ni nouvelle dépendance. Listes partielles historiques encore acceptées, créations simultanées non sérialisées par verrou de formation et réordonnancement des objectifs non traité par ce lot. Pas de protection revendiquée pour anciens clients omettant les révisions.
- Recette Docker et sauvegarde/restauration réussies. Aperçu remplacé avec volumes conservés et ancien conteneur before198 arrêté ; index Tailscale identique au build, session antérieure et lectures auteur des cours/diapositives avec no-store vérifiés. Aucun déplacement réel demandé dans l’aperçu. Pas de recette navigateur. Objectif global non achevé.


### Lot 199 — déplacement fonctionnel des chapitres

- Tour précédent classé progression : réordonnancement atomique de diapositives intégré. Inspection du studio : poignée graphique de chapitre sans action de déplacement, pas de mutation dédiée de réordonnancement.
- Nouvelle mutation d’auteur modules.reorder avec liste unique complète et révisions obligatoires. Droits vérifiés pour chaque chapitre ; transaction verrouillant les chapitres actifs de la formation dans l’ordre stable de leurs IDs. Liste partielle, révision dépassée, archive ou liste d’une autre formation refusées avant écriture. Mise à jour des seules positions modifiées, toute erreur annulant le déplacement complet.
- Boutons Monter/Descendre avec libellés accessibles FR/EN/AR remplaçant la poignée inactive des chapitres. Verrou de clic immédiat, blocage aux extrémités et pendant chargement/mutation ; invalidation des listes et de la disponibilité de publication après succès/erreur. Aucun ordre optimiste affiché avant confirmation.
- Trois tests PostgreSQL : concurrence et aucune écriture pour ordre identique, rollback de toutes positions/révisions après panne SQL synthétique et refus archive, liste complète exigée après nouveau chapitre et auteur étranger refusé. 403 tests, TypeScript et build réussis ; tests de réordonnancement chapitre relancés après préfixe de fonction SQL de test rendu distinct de celui des diapositives.
- Aucun changement des versions publiées. Création d’un chapitre après lecture des lignes non sérialisée par verrou de formation ; ne revendique pas de verrouillage des insertions concurrentes. Pas de migration ou nouvelle dépendance ; réordonnancement d’objectifs restant à traiter.
- Trois tests ciblés de réordonnancement chapitre réussis ; recette Docker et sauvegarde/restauration réussies. Aperçu remplacé avec volumes conservés et ancien conteneur before199 arrêté ; index Tailscale identique au build, session antérieure et lectures auteur cours/chapitres avec no-store vérifiés. Liste locale testée vide, tests de déplacement effectués uniquement sur fixtures PostgreSQL. Aucun déplacement réel dans l’aperçu, pas de recette navigateur. Objectif global non achevé.


### Lot 200 — audit transversal de préparation opérationnelle

- Tour précédent classé progression : déplacement de chapitres intégré et vérifié. Audit relisant routes/pages, sélection de tests métier, configuration Vitest, documentation des fournisseurs et de CI, plus état runtime authentifié.
- Nouvelle matrice docs/operational-readiness.md couvrant landing, utilisateurs, apprentissage/examens, studio, B2B, IA multimédia, distanciel, vault, Stripe, abonnements, factures, KYC/KYB, agrément admin, références produit, exploitation et confidentialité. Chaque exigence distingue éléments présents/preuves ciblées et validations manquantes ; aucun statut global d’achèvement.
- Lecture actuelle admin.settings.get : Stripe non configuré, webhook absent, SMTP non configuré, texte/image/voix de tous les fournisseurs IA indisponibles. Variables initiales du conteneur JaaS et identité de facturation absentes. Relevé limité à indicateurs, aucune valeur de clé/adresse ou secret masqué consignée. Pas d’appel fournisseur ni d’action de paiement, émission ou diffusion.
- Vérification effective que le répertoire n’est pas un dépôt Git. La présence des fichiers de workflow ne prouve donc pas leur exécution distante. Vitest en environnement Node confirmé ; contrôles HTTP et 403 tests du lot 199 ne valent pas recette navigateur.
- todo.md corrigé : ancienne affirmation de validation globale et mots de passe de démonstration retirés, renvoi vers audit actuel et fichier d’accès privé. Liste V1 conservée comme historique. Liens locaux de la matrice vérifiés existants.
- Pas de changement applicatif, test répété ou remplacement de conteneur nécessaire pour ces documents. Aperçu toujours lot 199. Progrès de ce tour : preuves runtime nouvelles et audit de périmètre, pas uniquement répétition de statut. Objectif global non achevé ; travaux locaux encore possibles, pas d’impasse globale malgré fournisseurs absents.


### Lot 201 — réordonnancement atomique des objectifs pédagogiques

- Dernier tour de développement (lot 200) classé progression par audit et preuves runtime ; tour d’accès Tailscale suivant limité à une vérification HTTP et du conteneur. Reprise du travail applicatif après inspection actuelle de CLAUDE, plan et implémentation.
- Ancienne boucle d’écritures indépendantes remplacée par transaction avec verrouillage stable des objectifs par ID. Liste non vide, IDs entiers positifs uniques, lignes existantes/non archivées et même formation exigés avant écriture. Positions historiques commençant à zéro préservées ; seules les positions modifiées sont écrites.
- Deux tests PostgreSQL : erreur SQL synthétique sur une écriture tardive annulant toutes les positions, puis reprise réussie ; doublons/IDs invalides, objectif manquant, formations mélangées, auteur étranger et archive refusés sans modification résiduelle.
- 405 tests (93 fichiers), TypeScript, build et recette Docker sauvegarde/restauration réussis. Journaux /tmp/raero-lot201-{focused,tests,check,build,docker,smoke}.log. Aperçu remplacé avec volumes conservés, ancien conteneur before201 arrêté ; index Tailscale identique au build, session antérieure admin et no-store vérifiés. Aucun déplacement réel dans l’aperçu.
- Pas de migration, dépendance ou recette navigateur. Ce lot corrige atomicité et cohérence de formation ; il ne fournit pas encore de révision attendue, de protection contre un ordre périmé ni de boutons de déplacement des objectifs. Listes partielles historiques encore acceptées. Objectif global non achevé.


### Lot 202 — déplacement des objectifs dans le studio avec contrôle d’ordre

- Tour précédent classé progression : atomicité du réordonnancement intégrée. Inspection actuelle du studio confirmant absence de boutons de déplacement et absence de contrôle d’ordre chargé.
- Boutons Monter/Descendre FR/EN/AR, libellés accessibles incluant le titre, limites de liste et chargement/mutation désactivés. Verrou immédiat contre double clic, invalidation de toutes les listes d’objectifs et disponibilité de publication après réponse ; aucun ordre local optimiste.
- Paramètre expectedSortOrders facultatif pour compatibilité des anciens appels, toujours transmis par le studio. Comparaison sous verrou avec positions exactes chargées, y compris null historique. Quand fourni, toute la liste active de la formation est verrouillée et exigée ; ordre périmé, nouvel objectif déjà présent ou liste incomplète refusés. Positions normalisées à zéro après succès.
- Deux tests SQL supplémentaires : deux déplacements concurrents depuis même ordre, un seul accepté, liste partielle et longueur incohérente refusées, reprise sur ordre frais, nouveau membre invalidant l’ancienne liste ; normalisation des positions null. TypeScript a détecté le champ nullable historique ; contrat et test adaptés puis contrôles relancés.
- 407 tests (93 fichiers), TypeScript/build et recette Docker sauvegarde/restauration réussis ; journaux /tmp/raero-lot202-{tests,check,build,docker,smoke}.log. Aperçu remplacé, volumes conservés, ancien before202 arrêté ; index Tailscale conforme, session antérieure admin et no-store vérifiés. Aucun déplacement réel ni recette navigateur.
- Pas de migration ni nouvelle dépendance. Contrôle limité à l’ordre et à la composition de liste : aucune révision de texte d’objectif, aucune sérialisation des insertions après lecture, appels historiques sans positions toujours sans contrôle d’ordre périmé. Objectif global non achevé.


### Lot 203 — protection des brouillons d’objectifs contre les écritures concurrentes

- Tour précédent classé progression : déplacement d’objectifs intégré et vérifié. Inspection actuelle du formulaire et de sa mutation montrant une sauvegarde sans contrôle de version.
- Migration additive objective_revision : compteur non nul et déclencheur utilisant la fonction de révision existante, incrémenté à toute mise à jour, déplacement compris. Schéma et liste de migrations enregistrés ; aucune migration antérieure modifiée.
- Mise à jour sous transaction et verrou de ligne, refus si absent/archivé ou révision attendue dépassée. API auteur acceptant la révision bornée séparément des données éditables ; paramètre facultatif pour anciens clients. Formulaire transmettant sa révision initiale, conservant les champs en cas de conflit et actualisant la liste en arrière-plan. Message persistant FR/EN/AR invitant à copier le brouillon avant fermeture et réouverture ; pas de fusion automatique dans ce lot.
- Test PostgreSQL supplémentaire : deux sauvegardes de même révision, une seule acceptée ; absence d’écriture après conflit, reprise sur version fraîche, changement d’ordre détecté, révision négative refusée, ancien appel compatible, archive protégée même via helper direct.
- 408 tests (93 fichiers), TypeScript/build et recette Docker sauvegarde/restauration réussis. Journaux /tmp/raero-lot203-{tests,check,build,docker,smoke}.log. Aperçu remplacé avec volumes conservés, ancien before203 arrêté ; index Tailscale conforme, session antérieure admin et no-store vérifiés. Aucune édition réelle dans l’aperçu ni recette navigateur.
- Les clients historiques omettant la révision ne bénéficient pas du contrôle de brouillon périmé ; création d’objectif sans UUID de reprise et rapprochement visuel des brouillons restent à traiter. Aucune modification des versions de formation déjà publiées. Objectif global non achevé.


### Lot 204 — comparaison des brouillons d’objectifs pédagogiques

- Tour précédent classé progression : révision d’objectifs intégrée et vérifiée. Inspection actuelle du formulaire et composant partagé de comparaison avant extension.
- Après conflit, lecture fraîche de la liste autorisée et comparaison avec le brouillon initial ; échec de lecture ou objectif inaccessible laissant les saisies en place. Champs et sauvegarde bloqués pendant lecture/comparaison. Annulation revenant au brouillon intact ; application préparant le formulaire et adoptant la révision comparée, sans écriture serveur. Enregistrement explicite restant requis et contrôlé par révision.
- Définition indivisible code/titre/description/niveau de connaissances ; chapitre, caractère obligatoire et ordre séparés. Composant partagé étendu avec libellés FR/EN/AR. Message de conflit adapté pour proposer la comparaison plutôt que copier puis fermer. Fermeture du dialogue conserve son comportement existant ; pas de sauvegarde durable du brouillon.
- Deux tests de rapprochement : définition locale avec placement/ordre distants compatibles, conflit de définition imposant choix complet sans mélange automatique des niveaux et descriptions. 410 tests (94 fichiers), TypeScript/build réussis ; journaux /tmp/raero-lot204-{tests,check,build,docker}.log.
- SHA256 du bundle serveur identique à celui en exécution vérifié. Image Docker reconstruite et fichiers publics copiés sans arrêt, anciens fichiers hachés conservés ; index Tailscale conforme au build. Pas de migration, dépendance ou nouvelle recette Docker complète requise pour interface seule ; aucune recette navigateur. Objectif global non achevé.


### Lot 205 — protection de sortie du brouillon d’objectif

- Tour précédent classé progression : comparaison d’objectifs intégrée. Inspection du formulaire montrant une fermeture directe sans avertissement, contrairement aux éditeurs de chapitres/questions ; lecture du hook useDraftExitGuard avant réutilisation.
- Avertissement avant fermeture explicite d’un brouillon modifié ou d’une comparaison et protection native beforeunload. Fermeture du dialogue bloquée pendant sauvegarde/lecture ; bouton Annuler désactivé durant ces opérations. Référence initiale réajustée après rapprochement à la version serveur comparée, pour détecter correctement les changements restant à enregistrer.
- Verrou immédiat commun sauvegarde/comparaison contre doubles appels avant rendu React ; callbacks de résultat vérifiant le montage avant modification de l’interface et notification. Pas de stockage durable ni de protection générale des navigations internes SPA revendiquée. Reprise d’une création après réponse réseau perdue toujours sans UUID serveur.
- TypeScript et build réussis, relecture du code modifié ; aucune nouvelle suite de tests répétant ce câblage de hook existant. Dernière suite complète : 410 tests au lot 204, pas de recette navigateur. Journaux /tmp/raero-lot205-{check,build,docker}.log.
- Bundle serveur SHA256 identique à celui en exécution. Image reconstruite, interface copiée sans interruption, anciens fichiers hachés conservés et index Tailscale conforme vérifié. Pas de migration ou nouvelle dépendance. Objectif global non achevé.


### Lot 206 — reprise des créations d’objectifs sans doublon

- Tour précédent classé progression : protection du brouillon d’objectif. Inspection actuelle du service de création de chapitres et de la mutation d’objectifs avant adaptation du mécanisme de reprise existant.
- Nouveau service objectiveCreation : entrée canonique, UUID facultatif normalisé, empreinte SHA256, acteur actif et droits de formation relus, transaction avec verrou par acteur/demande. Objectif et registre créés ensemble. Reprise identique retournant le même ID sans réécrire ni restaurer une archive ; charge différente avec même UUID refusée.
- Migration additive objective_creation_requests, index unique acteur/UUID, lien unique objectif et déclencheur immutable ; schéma et migration enregistrés. Ancienne création sans UUID compatible. Studio conservant UUID et signature de formulaire tant que le dialogue reste ouvert, nouveau UUID si contenu change ; messages FR/EN/AR de récupération ou archive.
- Trois tests PostgreSQL adaptés au contrat objectif : concurrence, UUID en majuscules, refus charge différente, auteur étranger/suspendu, édition et archive préservées, registre immutable ; révocation d’affiliation entreprise ; anciennes requêtes et ordre canonique des clés. 413 tests (95 fichiers), TypeScript/build réussis. Libellés français et noms locaux corrigés après première suite, TypeScript/build finaux réussis.
- Recette Docker sauvegarde/restauration réussie ; journaux /tmp/raero-lot206-{tests,check,build,docker,smoke}.log. Aperçu remplacé, volumes conservés, ancien before206 arrêté ; index Tailscale conforme, session antérieure admin et no-store vérifiés. Aucune création réelle dans l’aperçu ni recette navigateur.
- UUID du formulaire non conservé après fermeture/rechargement ; aucune sérialisation des changements de droits avec toute la transaction. Pas de nouvelle dépendance. Objectif global non achevé.


### Lot 207 — pagination des dossiers personnels KYC/KYB

- Tour précédent classé progression : reprise de création d’objectifs. Inspection actuelle de VerificationCenter et de ses routes révélant une liste personnelle complète non bornée.
- Nouvelle minePage : 50 dossiers par page, curseur ID décroissant stable, projection id/kind/legalName/status seulement ; utilisateur actif et affiliations MANAGER actives de sociétés actives relus. KYC personnel et KYB autorisés explicitement distingués. Ancienne mine conservée pour compatibilité.
- Interface utilisant minePage uniquement en vue personnelle ; commandes derniers/plus anciens FR/EN/AR, chargement bloquant les déplacements et confirmation des brouillons avant changement de page. Sélection, note et formulaire réinitialisés ; erreurs conservant l’affichage d’erreur existant plutôt que des données périmées. Mutations invalidant aussi les pages personnelles.
- Test SQL supplémentaire : 55 sociétés gérées, projection minimale, arrivée d’un KYC sans perturber la seconde page, société supplémentaire, révocation d’affiliation et utilisateur suspendu. Fixture initiale omettant subjectKey rejetée ; corrigée vers des sociétés distinctes et clés canoniques avant relance. 414 tests (95 fichiers), TypeScript/build réussis.
- Recette Docker et sauvegarde/restauration réussies ; journaux /tmp/raero-lot207-{tests,check,build,docker,smoke}.log. Aperçu remplacé avec volumes conservés et before207 arrêté ; index Tailscale, session antérieure admin, minePage et no-store vérifiés. La lecture locale valide le contrat HTTP, les pages non vides sont couvertes par fixtures SQL. Aucun dossier réel créé, aucune recette navigateur.
- Pas de migration/dépendance. Pas de filtre de statut personnel ou recherche ajoutés ; ancien endpoint mine non borné reste disponible. Objectif global non achevé.


### Lot 208 — résumés privés et bornés sur les anciennes listes KYC/KYB

- Tour précédent classé progression : pagination personnelle. Recherche actuelle de tous les consommateurs hors tests : interface utilisant exclusivement minePage/queuePage ; anciennes routes encore exposées avec dossiers complets et mine non bornée.
- mine et queue conservées sous forme de tableaux, mais projection limitée à id/kind/legalName/status, tri ID décroissant et limite 200. Branche entreprise de mine explicitement KYB ; aucun justificatif/adresse/note renvoyé par une liste. Détail autorisé restant disponible via detail, consultation exhaustive via endpoints paginés.
- Modification du contrat des routes historiques : consommateurs extérieurs éventuels utilisant leurs anciens champs détaillés doivent appeler detail ; aucune utilisation locale de ces champs trouvée. Aucun dossier supprimé.
- Test PostgreSQL avec 205 sociétés : plafond et ordre, projection exacte des deux routes, accès détail préservé, liste étrangère vide et revue admin interdite à un utilisateur. 415 tests (95 fichiers), TypeScript/build et recette Docker sauvegarde/restauration réussis ; journaux /tmp/raero-lot208-{tests,check,build,docker,smoke}.log.
- Aperçu remplacé avec volumes conservés et before208 arrêté ; index Tailscale conforme, session antérieure admin, mine/queue et no-store vérifiés. Contrôles de listes non vides en fixtures SQL ; pas de dossier réel créé ni recette navigateur. Pas de migration/dépendance. Objectif global non achevé.


### Lot 209 — contrôle des modifications simultanées KYC/KYB

- Tour précédent classé progression : listes historiques bornées et minimisées. Inspection actuelle de saveVerification montrant une sérialisation des écritures mais aucun contrôle du brouillon chargé.
- Migration additive verification_revision : compteur et déclencheur à toute mise à jour du dossier ; schéma et liste de migrations mis à jour. expectedRevision facultatif et borné, null pour une création attendue. Sous verrou existant, une révision dépassée ou un dossier déjà présent pour une création attendue sont refusés avant écriture et événement.
- Interface conservant la révision lors du chargement effectif du formulaire ; brouillon modifié ne prenant pas silencieusement la révision d’un rafraîchissement. Création envoyant null. Conflit déclenchant actualisation et message FR/EN/AR ; ancien comportement de réhydratation lorsque le statut verrouille le dossier conservé. Pas de fusion de brouillons ; anciens appels sans révision compatibles mais non protégés contre brouillon périmé.
- Test PostgreSQL : deux sauvegardes concurrentes depuis même révision, une acceptée ; historique limité à création et modification acceptée, création attendue refusée sans changement, reprise avec révision fraîche et entrée négative refusée. 416 tests (95 fichiers), TypeScript/build réussis ; build final après ajustement du message.
- Recette Docker sauvegarde/restauration réussie ; journaux /tmp/raero-lot209-{tests,check,build,docker,smoke}.log. Aperçu remplacé avec volumes conservés et before209 arrêté ; index Tailscale conforme, session antérieure admin et no-store vérifiés. Aucun dossier réel modifié ni recette navigateur. Objectif global non achevé.


### Lot 210 — soumission et décision KYC/KYB liées à la version consultée

- Tour précédent classé progression : révision des sauvegardes de dossiers. Inspection actuelle des transitions et de la saisie de décision montrant qu’un dossier corrigé puis resoumis pouvait recevoir une décision préparée lors du cycle précédent.
- expectedRevision facultatif borné ajouté aux mutations submit/review et au helper de transition. Contrôle sous verrou après droits et état admissible, avant mise à jour et événement. Interface envoyant la version courante lors de soumission ; version de revue fixée au début de rédaction de la note, non remplacée par un rafraîchissement.
- Erreurs de transition actualisant le dossier. Message FR/EN/AR après conflit de revue demandant de consulter les informations actuelles et de réécrire le motif ; nouvelle saisie depuis note vide fixant la nouvelle révision. Note remise à zéro après succès. Anciennes requêtes sans révision restent compatibles et ne bénéficient pas de cette protection.
- Test PostgreSQL supplémentaire : soumission après modification refusée avec révision périmée ; demande de complément, correction et resoumission ; décision de l’ancien cycle refusée sans modification ni événement, décision sur version actuelle acceptée. 417 tests (95 fichiers), TypeScript/build finaux et recette Docker sauvegarde/restauration réussis ; journaux /tmp/raero-lot210-{tests,check,build,docker,smoke}.log.
- Aperçu remplacé avec volumes conservés et before210 arrêté ; index Tailscale conforme, session antérieure admin et no-store vérifiés. Aucune soumission/décision réelle, aucune recette navigateur. Pas de migration/dépendance. Objectif global non achevé.


### Lot 211 — révision des dossiers lors des changements de justificatifs

- Tour précédent classé progression : transitions KYC/KYB contrôlées par révision. Inspection actuelle des dépôts/archives montrant que les modifications de pièces ne faisaient pas avancer la révision du dossier.
- Ajout effectif et archivage effectif mettant à jour updatedAt dans la même transaction, déclencheur existant incrémentant la révision. Reprise d’un dépôt existant, même archivé, retournant sans nouvelle révision ni événement. Aucun changement rétroactif des historiques.
- Archivage relisant la pièce après acquisition du verrou de dossier : une seconde demande simultanée observe désormais l’archive déjà effectuée et n’insère pas un événement supplémentaire.
- Test PostgreSQL supplémentaire : ajout puis reprise, soumission depuis ancienne révision refusée, deux archives simultanées avec une seule révision et un seul événement, reprise du dépôt archivé sans réactivation. 418 tests (95 fichiers), TypeScript/build et recette Docker sauvegarde/restauration réussis ; journaux /tmp/raero-lot211-{tests,check,build,docker,smoke}.log.
- Aperçu remplacé avec volumes conservés et before211 arrêté ; index Tailscale conforme, session antérieure admin et no-store vérifiés. Aucune pièce réelle ajoutée/archivée ni recette navigateur. Pas de migration/dépendance. Objectif global non achevé.


### Lot 212 — protection de sortie des saisies et motifs KYC/KYB

- Tour précédent classé progression : révision de justificatifs et archivage concurrent corrigés. Inspection actuelle de canLeave montrant qu’il ignorait les motifs de revue ; lien Mon espace sans garde et aucune protection native beforeunload.
- Réutilisation du hook useDraftExitGuard existant, actif pour formulaire modifié, motif même partiellement saisi ou opération en cours. Commandes existantes de sélection, pagination, changement de mode, filtre et nouveau dossier bénéficiant désormais du contrôle des notes de revue aussi. Lien Mon espace confirmant les abandons et bloqué pendant busy ; protection native rechargement/fermeture ajoutée.
- Message FR/EN/AR mentionnant formulaire et motif. Aucune persistence de données privées dans le navigateur. Garde limitée aux commandes raccordées et au beforeunload ; ne prétend pas intercepter toute navigation SPA ou les liens de PublicNav.
- TypeScript/build et relecture du câblage réussis ; dernière suite complète 418 tests au lot 211, pas de test miroir de hook ni recette navigateur. Journaux /tmp/raero-lot212-{check,build,docker}.log.
- Bundle serveur SHA256 identique à celui en exécution. Image reconstruite et interface copiée sans arrêt, anciens fichiers hachés conservés ; index Tailscale conforme vérifié. Pas de migration/dépendance ni nouvelle recette Docker complète pour interface seule. Objectif global non achevé.


### Lot 213 — traduction arabe du parcours coffre documentaire

- Tour précédent classé progression : protection de sortie KYC/KYB. Recherche et inspection actuelle du dépôt Passport : reprise existante, mais 83 libellés passport encore anglais dans le dictionnaire arabe.
- Traduction des 83 libellés : identité, types de pièces, formulaire de dépôt, états de transfert, validité, formations et certificats, profil, qualifications Part-66 et suivi des certificats de type. Paramètres {percent}/{count}/{rating} conservés par vérification automatique ; noms R-AERO/EASA/Part-66 conservés.
- Aucun libellé de la famille passport sans caractère arabe après modification. Cela vérifie le périmètre de traduction, pas la qualité visuelle RTL ni la traduction de toute l’application. Pas de recette navigateur ni de relecture linguistique externe.
- Trois tests de dictionnaires/interpolation réussis, TypeScript/build réussis ; dernière suite métier complète 418 tests au lot 211. Journaux /tmp/raero-lot213-{locales,check,build,docker}.log.
- Bundle serveur SHA256 identique à celui en exécution. Image reconstruite et interface copiée sans interruption, anciens fichiers hachés conservés ; index Tailscale conforme vérifié. Pas de migration/dépendance ni nouvelle recette Docker complète pour traductions seules. Objectif global non achevé.


### Lot 214 — erreurs de dépôt documentaire dans le registre administrateur

- Tour précédent classé progression : traduction arabe du coffre. Inspection actuelle d’ApprovalCenter montrant un catch silencieux sur lecture FileReader, pas de contrôle MIME/non-vide local, champs modifiables pendant lecture et absence de verrou immédiat.
- Gestion explicite FR/EN/AR des erreurs fichier/lecture/envoi non confirmé. Vérification taille non nulle jusqu’à 8 Mo et MIME PDF/JPEG/PNG avant lecture ; contrôles serveur inchangés. FileReader annulé au démontage, callbacks d’interface conditionnés au montage.
- Verrou immédiat, métadonnées et fichier capturés pour une tentative, fieldset bloquant les modifications pendant lecture/envoi. Fichier et champ natif vidés après succès, confirmation affichée. Échec réseau actualisant la liste et invitant à vérifier les versions avant nouvelle tentative ; aucun mécanisme serveur de reprise UUID ajouté.
- TypeScript/build et relecture de l’implémentation réussis. Dernière suite métier complète 418 tests au lot 211 ; pas de test miroir de callbacks ni recette navigateur. Journaux /tmp/raero-lot214-{check,build,docker}.log.
- Bundle serveur SHA256 identique à celui en exécution. Image reconstruite et interface copiée sans interruption, anciens fichiers hachés conservés ; index Tailscale conforme vérifié. Pas de migration/dépendance ni nouvelle recette Docker complète pour interface seule. Objectif global non achevé.


### Lot 215 — reprise des dépôts documentaires d’agrément

- Tour précédent classé progression : traitement des erreurs de dépôt administrateur. Inspection actuelle du serveur confirmant validation stricte partagée déjà présente, mais stockage indépendant de toute reprise après réponse perdue.
- Migration additive approval_upload_requests : requestId et empreinte nullable, index unique déposant/demande. Dépôt avec UUID normalisé, empreinte canonique des métadonnées et hash fichier, droits admin/actif relus. Transaction verrouillée par acteur/demande, document existant identique retourné sans stockage ni nouvel événement ; changement de contenu refusé. Anciennes requêtes sans UUID compatibles ; documents historiques intacts.
- Interface conservant signature et UUID de la tentative en mémoire, réutilisés à contenu identique après erreur et remis à zéro après succès. Fermeture/rechargement non couverts par cette reprise ; stockage orphelin après échec SQL non réconcilié dans ce lot.
- Test SQL supplémentaire : trois dépôts simultanés avec UUID normalisé, un document/un événement ; empreinte différente et base64 invalide refusés, ordre de clés sans impact, administrateur suspendu refusé à la reprise. 419 tests (95 fichiers), TypeScript/build et recette Docker sauvegarde/restauration réussis ; journaux /tmp/raero-lot215-{tests,check,build,docker,smoke}.log.
- Aperçu remplacé avec volumes conservés et before215 arrêté ; index Tailscale conforme, session antérieure admin et no-store vérifiés. Aucun dépôt administratif réel ni recette navigateur. Pas de nouvelle dépendance. Objectif global non achevé.


### Lot 216 — autorisation fraîche de toutes les opérations du registre d’agrément

- Tour précédent classé progression : reprise des dépôts documentaires. Inspection de createContext et adminProcedure : contexte HTTP relisant déjà utilisateur/session, middleware admin vérifiant seulement ce contexte. Registre hors upload sans seconde lecture fraîche.
- Procédure locale commune aux sept opérations approval : utilisateur relu avant gestion métier, administrateur actif requis, contexte remplacé par cette identité fraîche. Vérification spécifique upload devenue redondante remplacée par utilisation du contexte contrôlé.
- Test SQL supplémentaire avec contexte initial conservé : overview/saveProfile/setStatus/upload/createFinding/updateFinding/closeFinding tous refusés après suspension puis retrait du rôle admin ; aucun document/événement créé. Défense des contextes périmés, pas de preuve d’une ancienne faille HTTP systématique. Aucune sérialisation du changement de rôle pendant toute la transaction métier revendiquée.
- 420 tests (95 fichiers), TypeScript/build et recette Docker sauvegarde/restauration réussis ; journaux /tmp/raero-lot216-{tests,check,build,docker,smoke}.log. Aperçu remplacé, volumes conservés et before216 arrêté ; index Tailscale conforme, session antérieure admin, overview et no-store vérifiés.
- Aucune modification réelle du registre ni recette navigateur. Pas de migration/dépendance, pas de changement du middleware global. Objectif global non achevé.


### Lot 217 — affichage du registre après erreur ou changement d’identité

- Tour précédent classé progression : autorisation fraîche des sept procédures. Inspection actuelle d’ApprovalCenter montrant un simple message d’erreur au-dessus des données mises en cache et des formulaires, avec états locaux conservés sur changement d’identité.
- Contenu administratif (résumés/formulaires/documents/écarts/historique) masqué lorsque overview est en erreur. Section de reprise FR/EN/AR et bouton Réessayer désactivé pendant la lecture. En-tête générique restant visible, aucun résultat vide présenté comme une lecture réussie.
- Workspace monté avec clé utilisateur/rôle, suivant le mécanisme déjà présent dans le centre de vérification. Changement d’identité réinitialisant tous les états locaux et exécutant le nettoyage FileReader existant. Pas de détection instantanée d’une révocation distante revendiquée avant retour serveur/auth.
- TypeScript/build et relecture réussis ; dernière suite complète 420 tests au lot 216, pas de test miroir de conditions JSX ni recette navigateur. Journaux /tmp/raero-lot217-{check,build,docker}.log.
- Bundle serveur SHA256 identique à celui en exécution. Image reconstruite et interface copiée sans interruption, anciens fichiers hachés conservés ; index Tailscale conforme vérifié. Pas de migration/dépendance ni nouvelle recette Docker complète pour interface seule. Objectif global non achevé.


### Lot 218 — brouillon et révision du dossier organisme

- Tour précédent classé progression : affichage du registre après erreur/changement d’identité. Inspection actuelle du formulaire montrant réhydratation automatique à chaque refresh et sauvegarde sans contrôle de version.
- Migration additive operator_approval_revision : compteur incrémenté à toute mise à jour (statut compris). saveProfile acceptant expectedRevision facultatif/null et comparant sous verrou existant avant toute écriture ; contrôle séparé des valeurs persistées. Ancienne requête sans révision compatible.
- Formulaire marquant les saisies modifiées, conservant leur version de départ pendant rafraîchissements ; champs désactivés et verrou immédiat pendant sauvegarde. Réhydratation après succès ou abandon explicite, bouton de rechargement après conflit. Avertissement beforeunload et retour Administration pour ce brouillon ; autres formulaires non couverts par cette garde.
- Test SQL supplémentaire : statut enregistré après chargement, ancienne sauvegarde refusée sans remise en préparation ni événement ; version fraîche acceptée et révision incrémentée, création attendue null refusée si organisme existe. 421 tests (95 fichiers), TypeScript/build finaux et recette Docker sauvegarde/restauration réussis ; journaux /tmp/raero-lot218-{tests,check,build,docker,smoke}.log.
- Aperçu remplacé avec volumes conservés et before218 arrêté ; index Tailscale conforme, session antérieure admin, overview et no-store vérifiés. Aucun profil/statut réel modifié ni recette navigateur. Contrôle de révision des décisions setStatus encore à traiter ; pas de nouvelle dépendance. Objectif global non achevé.


### Lot 219 — décisions d’agrément contrôlées par révision

- Tour précédent classé progression : brouillon/révision du dossier organisme. Inspection actuelle de setStatus et du formulaire montrant l’absence de contrôle de version pour les décisions.
- expectedRevision facultatif borné comparé sous verrou avant validations documentaires et écriture. Décision périmée refusée sans événement. Interface fixant la version au premier changement du formulaire, conservée pendant rafraîchissements ; verrou immédiat contre double envoi, champs désactivés pendant mutation ou modifications non enregistrées du dossier organisme.
- Succès vidant motif et références documentaires. Échec actualisant le registre et conservant la décision préparée ; action explicite pour effacer la décision et actualiser. Ancien appel sans version compatible et non protégé contre décision périmée. Pas de validation réglementaire nouvelle revendiquée.
- Test SQL supplémentaire : ancienne décision après changement de périmètre refusée sans modification/événement ; deux décisions concurrentes avec même révision, une acceptée. 422 tests (95 fichiers) réussis. Erreur TypeScript initiale useRef sans argument corrigée, TypeScript/build finaux réussis.
- Recette Docker sauvegarde/restauration réussie ; journaux /tmp/raero-lot219-{tests,check,build,docker,smoke}.log. Aperçu remplacé avec volumes conservés et before219 arrêté ; index Tailscale conforme, session antérieure admin et no-store vérifiés. Aucune décision réelle ni recette navigateur. Pas de migration/dépendance. Objectif global non achevé.


### Lot 220 — révision des plans d’action et de leur clôture

- Tour précédent classé progression : décisions d’agrément contrôlées par révision. Inspection actuelle des écarts montrant des écritures verrouillées sans version de brouillon attendue.
- Migration additive approval_finding_revision : compteur et déclencheur à toute mise à jour. updateFinding/closeFinding acceptant révision facultative bornée, comparée sous verrou avant écriture et événement. Indépendance de clôture existante conservée.
- Interface fixant révision à la sélection de l’écart, actualisée après sauvegarde propre ; champs et sélection désactivés pendant mutation. Erreur persistante et rafraîchissement après conflit, nouvelle sélection rechargeant le plan. Clôture bloquée si champs du plan diffèrent de la version courante, avec message FR/EN/AR.
- Test SQL supplémentaire : deux modifications de même révision, une acceptée ; plan prêt modifié après consultation, ancienne clôture refusée sans événement et clôture sur version actuelle acceptée. 423 tests (95 fichiers), TypeScript/build finaux et recette Docker sauvegarde/restauration réussis ; journaux /tmp/raero-lot220-{tests,check,build,docker,smoke}.log.
- Aperçu remplacé avec volumes conservés et before220 arrêté ; index Tailscale conforme, session antérieure admin et no-store vérifiés. Aucun écart réel modifié/clôturé ni recette navigateur. Anciennes requêtes sans révision toujours compatibles et non protégées contre brouillon périmé. Pas de nouvelle dépendance. Objectif global non achevé.


### Lot 221 — historique du registre d’agrément consultable par pages

- Tour précédent classé progression : révision des plans d’action. Inspection actuelle montrant l’historique affiché depuis overview limité aux 200 derniers événements.
- Nouvelle historyPage protégée par procédure admin fraîche, curseur ID positif borné et 50 lignes avec nextCursor. Historique immutable inchangé ; tri ID stable plutôt que timestamp pouvant être partagé. Vue historique utilisant cette route, commandes derniers/plus anciens FR/EN/AR, états chargement/vide/erreur avec reprise et données périmées masquées après erreur. Toutes mutations invalidant aussi cet historique.
- Test SQL supplémentaire : 55 événements à même date, première page exacte, nouvelle arrivée non insérée dans la seconde, aucun chevauchement, utilisateur suspendu refusé. 424 tests (95 fichiers), TypeScript/build et recette Docker sauvegarde/restauration réussis ; journaux /tmp/raero-lot221-{tests,check,build,docker,smoke}.log.
- Aperçu remplacé avec volumes conservés et before221 arrêté ; index Tailscale conforme, session antérieure admin, nouvelle route et no-store vérifiés. Listes non vides validées sur fixtures SQL, aucune écriture réelle ni recette navigateur. overview conserve son ancien tableau events borné pour compatibilité ; pas de filtre/recherche historique ajouté.
- Pas de migration/dépendance. Objectif global non achevé.


### Lot 222 — reconstruction du bilan de diffusion après interruption finale

- Tour précédent classé progression : pagination de l’historique d’agrément. Inspection actuelle des diffusions : résultats par destinataire persistés, mais panne avant bilan global laissant une reprise signalée incomplète même si tous les résultats existent.
- Finalisation commune sous verrou transactionnel par diffusion, bilan existant retourné ou agrégation des résultats individuels. Écriture seulement si leur nombre correspond exactement aux destinataires attendus ; accepted/unconfirmed/skipped conservant leur sens. Reprise d’une demande existante pouvant ainsi réparer le seul bilan sans nouvel envoi ni notification. Journal incomplet toujours refusé ; aucun envoi automatique des statuts absents ou incertains.
- Test SQL/SMTP simulé supplémentaire : panne synthétique d’insertion du bilan après résultats individuels, puis deux reprises concurrentes ; une ligne de bilan, un seul appel SMTP simulé, deux notifications initiales inchangées et compteurs exacts. 425 tests (95 fichiers), TypeScript/build et recette Docker sauvegarde/restauration réussis ; journaux /tmp/raero-lot222-{tests,check,build,docker,smoke}.log.
- Aperçu remplacé avec volumes conservés et before222 arrêté ; index Tailscale conforme, session antérieure admin et no-store vérifiés. Aucun message réel envoyé, aucune réparation réelle déclenchée et pas de recette navigateur. Pas de migration/dépendance. Travailleur SMTP durable général non implémenté par ce lot. Objectif global non achevé.


### Lot 223 — récupération explicite du bilan depuis le journal des diffusions

- Tour précédent classé progression : reconstruction interne de bilan complet. Inspection actuelle du journal et des routes révélant que cette réparation exigeait encore de répéter la demande originale.
- Nouvelle mutation recoverBroadcastOutcome, droits admin actifs relus, appel du finaliseur du lot 222. Journal incomplet refusé avec PRECONDITION_FAILED ; bilan existant retourné, sans aucun appel d’envoi. Bouton Reconstituer le bilan dans les entrées sans bilan, explication FR/EN/AR précisant aucun message envoyé ; indisponible pendant requête/mutation et actualisation après résultat.
- Test SQL/SMTP simulé : journal incomplet refusé sans bilan, résultat explicite non envoyé ajouté en fixture puis réparation réussie, sendEmail jamais appelé et administrateur suspendu refusé. Première fixture omettait l’audience/destinataire obligatoire ; corrigée, suite complète relancée.
- 426 tests (95 fichiers), TypeScript/build et recette Docker sauvegarde/restauration réussis ; journaux /tmp/raero-lot223-{tests,check,build,docker,smoke}.log. Aperçu remplacé avec volumes conservés et before223 arrêté ; index Tailscale conforme, session antérieure admin et no-store vérifiés.
- Aucun message réel ni réparation de diffusion réelle exécutés, pas de recette navigateur. Pas de migration/dépendance. Reprise des envois interrompus avec résultats absents et travailleur SMTP durable toujours hors de ce lot. Objectif global non achevé.


### Lot 224 — traduction arabe du parcours compagnie et dossier technicien

- Tour précédent classé progression : récupération explicite des bilans de diffusion. Inspection actuelle du dictionnaire arabe montrant 176 valeurs anglaises dans companyDashboard et technicianFileDialog.
- Traduction des libellés de salariés/import-export, échéances et entraînement périodique, informations société, abonnements, analyse des besoins, dossier technicien, attestations et décisions du responsable. Références techniques Part-66/R-AERO/TNA/CSV conservées. Distinction entre données de suivi fournies et détermination humaine de conformité conservée.
- Vérification des paramètres d’interpolation pour chaque remplacement, aucun libellé de ces deux familles sans caractère arabe après modification. Ce contrôle ne constitue pas une validation linguistique externe ni une recette RTL ; textes contractuels et comportements métier existants non modifiés.
- Trois tests de dictionnaires/interpolation, TypeScript/build réussis ; dernière suite métier complète 426 tests au lot 223. Journaux /tmp/raero-lot224-{locales,check,build,docker}.log.
- Bundle serveur SHA256 identique à celui en exécution. Image reconstruite et interface copiée sans interruption, anciens fichiers hachés conservés ; index Tailscale conforme vérifié. Pas de migration/dépendance ni nouvelle recette Docker complète pour traductions seules. Objectif global non achevé.


### Lot 225 — lecture et erreurs de l’import CSV compagnie

- Tour précédent de simple vérification d’accès classé sans progression applicative ; disponibilité Docker/Tailscale revalidée avant reprise. Inspection du code actuel : lecture FileReader non protégée, aucune gestion des erreurs/annulations, contrôle désactivé seulement après le début de la mutation.
- Verrou immédiat couvrant lecture et envoi, état occupé dès la sélection, fermeture du dialogue bloquée pendant le traitement, rejet explicite des fichiers vides/illisibles, erreur persistante FR/EN/AR distinguant lecture et résultat d’envoi incertain. Réinitialisation du champ fichier après traitement permettant de resélectionner le même fichier. Lecture annulée au démontage et callbacks d’interface ignorés après démontage.
- Aucun nouvel envoi automatique en cas d’erreur : le message demande de vérifier la liste avant de réessayer car le serveur importe ligne par ligne. Ce verrou ne garantit pas l’idempotence entre onglets ou après rechargement. Parseur CSV serveur, validation métier et caractère partiel des insertions inchangés ; ils restent à approfondir. Pas de protection de toutes les navigations SPA ni de recette navigateur.
- TypeScript, trois tests de dictionnaires et build réussis ; journaux /tmp/raero-lot225-{check,locales,build,docker}.log. Dernière suite métier complète : 426 tests au lot 223. Aucun import réel exécuté et aucun test UI ne prouve encore les interactions FileReader.
- SHA256 serveur identique à l’instance en exécution ; image reconstruite et frontend copié sans interruption. Index Tailscale comparé au build, HTTP 200. Aucune migration/dépendance. Objectif global toujours en cours.


### Lot 226 — parseur CSV et validation des salariés

- Tour précédent classé progression : gestion de lecture/envoi dans le dialogue d’import. Inspection serveur confirmant une découpe naïve sur chaque retour ligne et point-virgule, sans traitement des guillemets, ni validation des e-mails ou des longueurs avant insertion.
- Nouveau parseur employeeCsv : séparateur point-virgule, BOM UTF-8, guillemets doublés, champs multilignes, CR/LF/CRLF et numéros de lignes physiques. Lecture complète avant insertions ; guillemets cassés, en-têtes inconnus/manquants ou alias en double refusés globalement. Limites 1 Mio UTF-8 et 1 000 salariés non vides. Alias français/anglais historiques conservés ; colonnes inconnues désormais explicitement refusées au lieu d’être ignorées.
- Validation Zod des champs requis, adresse e-mail et longueurs alignées sur employees. Nombre de colonnes incorrect ou champs invalides signalés par ligne ; lignes valides importées comme auparavant, sans modifier les salariés existants. Échec SQL signalé sans recopier l’adresse personnelle. Le format reste celui indiqué dans le dialogue, sans détection automatique des CSV à virgules ; espaces après fermeture de guillemets refusés. L’export de tableau localisé ne constitue pas un modèle de réimport garanti.
- Quatre tests de parseur (export cité/échappé, accents/arabe/multiligne, lignes invalides, ambiguïtés/en-têtes, limites) et un test PostgreSQL prouvant les champs enregistrés et zéro nouvelle insertion après un document syntaxiquement cassé malgré une première ligne valide. Correction d’un usage de spread Set incompatible avec la cible TypeScript, puis suite complète validée : 431 tests, 97 fichiers. TypeScript/build et recette Docker sauvegarde/restauration réussis, journaux /tmp/raero-lot226-{focused,tests,check,build,docker,smoke}.log.
- Instance locale remplacée, volumes conservés et ancien conteneur before226 arrêté. Index Tailscale comparé au build ; session admin antérieure encore valide et no-store vérifiés. Aucun import réel dans l’aperçu, aucune recette navigateur, aucune migration/dépendance.
- Limites restantes : import partiel en cas d’erreur de ligne/SQL, absence d’idempotence durable entre requêtes/onglets, droits non verrouillés pendant tout le traitement, limites serveur non encore affichées en amont dans le dialogue. Ni dédoublonnage d’effectif ni invitations automatiques ajoutés. Objectif global toujours non achevé.


### Lot 227 — modèle et consignes d’import CSV

- Tour précédent classé progression : parseur et validation serveur déployés. Relecture du dialogue et du parseur confirmant l’absence de modèle téléchargeable et de limites affichées avant la sélection.
- Modèle UTF-8 BOM téléchargeable avec les neuf en-têtes stables du format d’import, sans salarié exemple. Affichage des mêmes en-têtes depuis une constante partagée avec le modèle ; bloc LTR défilable pour le contenu technique en interface arabe. Label du fichier relié à son contrôle et aux consignes.
- Consignes FR/EN/AR : colonnes requises, séparateur, UTF-8, 1 Mio/1 000 salariés, import déclenché dès la sélection et caractère partiel des insertions. Refus des fichiers de plus de 1 Mio avant FileReader avec message explicite et champ réinitialisé. Le serveur reste responsable du comptage des salariés et de la validation des contenus ; aucune invitation ni import automatique ajouté.
- Test du modèle réellement consommé par le dialogue : aucune ligne exemple, en-têtes acceptés par le parseur après remplissage avec point-virgule cité. Huit tests ciblés (cinq CSV, trois dictionnaires), TypeScript et build réussis. Journaux /tmp/raero-lot227-{tests,check,build,docker}.log ; dernière suite complète 431 tests au lot 226, pas de nouvelle recette serveur pour ce frontend.
- SHA256 serveur identique à l’instance en cours. Image reconstruite et interface copiée sans redémarrage ; index Tailscale comparé au build, HTTP 200. Aucun import réel, pas de recette navigateur du téléchargement ou du contrôle de taille. Limites métier du lot 226 toujours présentes, sauf limites désormais annoncées avant sélection. Objectif global non achevé.


### Lot 228 — destination et droits d’import conservés dans la transaction

- Tour précédent classé progression : modèle CSV et consignes déployés. Inspection de la mutation révélant que requireManagedCompany vérifiait la compagnie du contexte puis importEmployeesCSV relisait users.companyId sans conserver cette destination ni revérifier les droits. Un changement entre ces lectures pouvait modifier la destination effective.
- La mutation passe désormais l’identifiant autorisé au service. Transaction avec verrous partagés sur compagnie, compte et affiliation manager active : compagnie active, compte actif et compagnie sélectionnée inchangée requis ; rôle administrateur relu ou affiliation manager exigée. Ces verrous sont conservés jusqu’au commit. Un changement de destination déjà effectué produit CONFLICT ; droits révoqués/suspensions produisent FORBIDDEN. Base indisponible : erreur au lieu d’un faux bilan vide réussi.
- Lignes validées insérées via savepoints pour préserver le fonctionnement partiel si une ligne échoue en SQL. Parsing syntaxique toujours complet avant toute écriture. Les insertions du fichier deviennent visibles au commit de la transaction ; aucune idempotence durable ajoutée. Les modifications d’accès concurrentes attendent la fin de l’import si les verrous sont déjà acquis ; il ne s’agit pas d’une annulation rétroactive.
- Fixture CSV existante adaptée à une véritable affiliation manager. Nouveaux tests PostgreSQL : destination changée, compte suspendu, affiliation révoquée, société suspendue même pour admin, absence d’écritures dans les deux sociétés, admin actif autorisé ; trigger synthétique échouant sur la ligne médiane et vérification des lignes avant/après conservées via savepoint. Pas de test d’ordonnancement concurrent des verrous dans ce lot.
- 434 tests, 97 fichiers, TypeScript/build et recette Docker sauvegarde/restauration réussis. Journaux /tmp/raero-lot228-{tests,check,build,docker,smoke}.log. Instance remplacée, volumes conservés, before228 arrêté ; index Tailscale conforme et session admin antérieure/no-store vérifiés. Aucun import métier réel, aucune migration/dépendance et aucune recette navigateur.
- Les autres mutations compagnie ne bénéficient pas automatiquement de ces contrôles transactionnels ; revue transversale encore nécessaire. Doublons/rejeu de CSV, audit métier d’import et parcours fournisseurs restent à compléter. Objectif global non achevé.


### Lot 229 — preuve concurrente des verrous d’import

- Tour précédent classé progression : destination et droits protégés dans la transaction. Relecture du service et de ses tests confirmant que les refus avant import et savepoints étaient testés, mais pas le blocage effectif des changements concurrents.
- Nouveau test PostgreSQL sur base isolée : trigger de fixture maintient l’import à son insertion via verrou consultatif détenu sur connexion indépendante. L’attente réelle est observée dans pg_locks, avec sondage borné ; aucun simple délai supposant l’import arrivé au bon endroit.
- Pendant cette attente, suspension du compte, suspension de la compagnie et révocation de l’affiliation sont chacune refusées par lock_timeout (SQLSTATE 55P03). Après libération, import validé avec un salarié ; révocation réussie puis second import refusé FORBIDDEN, effectif toujours d’un salarié. Trigger/fonction temporaires et connexion retirés en finally.
- Quatre tests PostgreSQL ciblés passent, dont ce scénario concurrent (374 ms dans le journal), et TypeScript passe. Journaux /tmp/raero-lot229-{tests,check}.log. Dernière suite complète : 434 tests au lot 228 ; le nouveau test n’est pas présenté comme une nouvelle exécution complète.
- Aucun changement de code de production, d’image ou de données d’aperçu ; pas de redéploiement nécessaire. La preuve concerne cet ordonnancement précis, pas tous les scénarios de blocage/interblocage ou toutes les mutations B2B. Objectif global toujours non achevé.


### Lot 230 — préparation du CSV avant import explicite

- Tour précédent classé progression : preuve concurrente des verrous. Relecture du dialogue confirmant qu’une sélection déclenchait encore immédiatement la mutation ; la consigne le signalait mais aucune étape n’autorisait d’abandonner une sélection avant envoi.
- Lecture locale séparée de startImport. Après lecture, nom du fichier affiché et bouton Importer les salariés activé ; aucune mutation à la sélection. Consignes FR/EN/AR mises à jour et états lecture/envoi distincts. Le fichier préparé demeure uniquement en mémoire du composant, sans persistance navigateur.
- Fermeture avant envoi efface sélection, résultat et erreur via un gestionnaire commun (bouton, croix/échappement). Verrou immédiat maintenu pour lecture et mutation. Sélection effacée après toute tentative d’envoi, y compris réponse incertaine, pour éviter une seconde action directe ; la liste est actualisée aussi après une erreur d’envoi afin de vérifier un éventuel résultat déjà enregistré. Une resélection explicite reste possible et n’est pas dédoublonnée côté serveur.
- TypeScript, huit tests ciblés (dictionnaires/CSV) et build réussis. Journaux /tmp/raero-lot230-{check,tests,build,docker}.log. Ces tests ne vérifient pas les clics ni FileReader : recette navigateur encore absente. Pas de validation des lignes en amont affichée ; le message précise que validation/import commencent avec le bouton.
- SHA256 serveur identique au conteneur. Image reconstruite et interface copiée sans interruption ; index Tailscale comparé au build, HTTP 200. Aucun import réel ni migration/dépendance. Dernière suite complète 434 tests au lot 228, puis test concurrent ajouté et vérifié au lot 229. Objectif global non achevé.


### Lot 231 — états indisponibles du tableau de bord compagnie

- Tour précédent classé progression : sélection de CSV séparée de l’envoi. Relecture de CompanyDashboard montrant que les données employees/recurrencies étaient ramenées à des tableaux vides sans utiliser les états de requête, produisant des compteurs zéro et listes vides pendant chargement ou erreur.
- Conservation des objets de requête compagnie/effectif/échéances, activés seulement une fois authentifié. Avant affichage du tableau de bord : chargement explicite tant qu’une requête initiale attend, panneau générique FR/EN/AR en cas d’erreur et panneau de rattachement si la compagnie est absente. Bouton relançant les trois lectures, désactivé durant une lecture active ; retour de navigation disponible.
- Une erreur de ces lectures masque aussi leurs données précédemment mises en cache et les actions de tableau, pour ne pas présenter un état ancien comme disponible. Cela ne garantit pas une révocation instantanée avant une nouvelle réponse et ne remplace pas les contrôles serveur. Un échec d’échéances masque temporairement l’ensemble de ce tableau de bord ; granularité par onglet encore améliorable.
- Trois tests de dictionnaires, TypeScript et build passent ; journaux /tmp/raero-lot231-{check,tests,build,docker}.log. Pas de nouveau test miroir des conditions JSX ni de recette navigateur. Les erreurs propres aux requêtes abonnement, consolidation et règles ne sont pas couvertes par ce panneau et restent à traiter.
- Bundle serveur identique au conteneur en cours, image reconstruite et frontend copié sans interruption. Index Tailscale conforme au build, HTTP 200 ; aucune migration/dépendance ni modification métier réelle. Objectif global toujours non achevé.


### Lot 232 — état réel de l’abonnement dans l’interface compagnie

- Tour précédent classé progression : états de lecture principaux. Inspection de l’onglet abonnement et de getSubscriptionViewForCompany/hasSubscriptionCapacity/learningAccess : une réponse absente tombait sur les offres, toute formule non none était titrée active, capacityAvailable ne contrôlait ni statut ni expiration alors que les compteurs annonçaient salariés couverts et modules débloqués.
- Requête abonnement activée après authentification ; état de chargement propre à l’onglet, panneau de réessai en erreur ou réponse null, masquant offres/actions et anciennes données de cet onglet. Une absence de réponse ne devient plus une absence d’abonnement.
- Titre neutre Formule, retrait de la pastille verte inconditionnelle et statut absent affiché Non renseigné. Compteurs désormais effectif actif et formations réglementaires au catalogue, avec leurs valeurs descriptives réelles ; aucune déduction d’accès à partir de la capacité seule. Message FR/EN/AR sur les conditions d’accès à rapprocher des contrôles serveur existants. Compte Stripe absent décrit comme tel, sans inventer un mode démo ; promesse de renouvellement automatique de recyclage retirée de cette vue.
- TypeScript, trois tests de dictionnaires et build réussis ; journaux /tmp/raero-lot232-{check,tests,build,docker}.log. Pas de recette navigateur, de transaction Stripe ou de modification des règles de facturation/accès serveur. Statuts fournisseur encore affichés bruts ; aucune validation d’exploitation Stripe déduite de ces changements.
- SHA256 serveur identique au conteneur ; image reconstruite et frontend copié sans redémarrage. Index Tailscale conforme, HTTP 200. Aucune migration/dépendance. Objectif global toujours non achevé.


### Lot 233 — états et actions de l’analyse des besoins

- Tour précédent classé progression : abonnement factuel et erreurs de lecture. Inspection de la consolidation/TNA confirmant que les erreurs de règles/catalogue/consolidation étaient assimilées à des valeurs absentes ou zéro et que les actions restaient disponibles pendant des opérations voisines.
- États des trois requêtes conservés et activation après authentification. Onglet analyse : chargement avant premières réponses, panneau d’erreur avec relecture en cas d’échec ou consolidation null, contenu ancien masqué. Aucune règle et aucun regroupement affichés seulement à partir de réponses disponibles.
- Fieldset désactivé pendant lectures/ajout/retrait/analyse ; invalidations attendues dans les callbacks de succès afin de conserver cet état pendant l’actualisation. Message persistant pour mutation en erreur, y compris retrait auparavant silencieux, et bouton relisant consolidation/règles/catalogue/échéances ; erreurs de mutations réinitialisées seulement après quatre réponses réussies. Aucun nouvel envoi automatique à la relecture.
- Formulaire conservé en mémoire lors d’une erreur de lecture ; pas de persistance ou protection globale de navigation ajoutée. Désactivation React ne constitue pas un verrou immédiat entre événements ni une idempotence serveur. Une analyse légitime côté serveur ne dépend pas de ce seul contrôle d’interface ; aucune règle métier serveur modifiée.
- Trois tests de dictionnaires, TypeScript/build réussis ; TypeScript/build relancés après ajout du bouton de relecture. Journaux /tmp/raero-lot233-{tests,check,build,docker}.log. Pas de recette navigateur ou d’exécution d’analyse réelle.
- Serveur SHA256 identique au conteneur ; image reconstruite et frontend copié sans interruption, index Tailscale conforme HTTP 200. Aucune migration/dépendance. Objectif global toujours non achevé.


### Lot 234 — archivage conservatoire des règles de besoins

- Tour précédent classé progression : états et actions TNA. Inspection serveur confirmant un DELETE physique dans deleteRoleRequirement. Aucun archivage des règles n’était présent ; les analyses sélectionnaient toutes les règles de leur périmètre.
- Migration additive role_requirement_archive : archivedAt/archivedBy (FK utilisateur et paire obligatoire), interdiction SQL des suppressions/troncatures, modifications autorisées seulement pour archiver une règle active sans changer sa définition. Une règle archivée est verrouillée. Les données existantes restent actives, sans reconstitution fictive d’auteur historique.
- Route historique deleteRoleRequirement conservée, effet remplacé par archivage transactionnel et bouton Archiver FR/EN/AR. Auteur actif relu ; manager rattaché à la société de la règle avec affiliation active/société active, ou admin actif. Ligne verrouillée : archivages concurrents conservent les premières date/auteur. Refus d’accès explicite plutôt qu’un succès false ignoré par l’interface. Règles archivées exclues des listes actives et des lectures initiales de runTNA ; échéances existantes conservées.
- Test PostgreSQL : règle appliquée à un premier salarié, tiers refusé, double archivage concurrent, métadonnées/definition conservées, second salarié sans échéance pour la règle archivée, échéances antérieures identiques, DELETE/modification/désarchivage SQL refusés et acteur suspendu refusé même pour répétition. 436 tests, 98 fichiers, TypeScript/build et Docker sauvegarde/restauration passent. Journaux /tmp/raero-lot234-{tests,check,build,docker,smoke}.log.
- Aperçu remplacé avec volumes conservés et before234 arrêté. Index Tailscale conforme, session antérieure et lecture authentifiée des règles/no-store vérifiés. Aucun archivage métier réel ; contrôle HTTP d’une liste ne prouve pas les chemins non vides, couverts par fixture. Pas de recette navigateur.
- Limites : pas encore de vue utilisateur des règles archivées ni d’auteur de création historique ; l’archivage ne révoque pas les échéances passées. Une analyse ayant déjà lu la règle peut encore terminer ; coordination transactionnelle de runTNA et de l’archivage non couverte. Politique de conservation légale à valider ; objectif global non achevé.


### Lot 235 — validation des nouvelles règles et formation ciblée

- Tour précédent classé progression : archivage des règles. Relecture de createRoleRequirement confirmant des nombres non bornés/non entiers, chaînes non bornées, insert any sans validation de la formation ciblée.
- Schéma partagé roleRequirementInput strict : identifiant SQL positif, période entière de 1 à 120 mois (limite produit, non prescription réglementaire), limites de longueurs alignées sur la table, trim des textes. API et formulaire l’utilisent ; bouton d’ajout désactivé si invalide et champ période min/max/step, consigne FR/EN/AR. Le service valide également ses appels directs avec companyId explicite.
- Transaction de création relisant/verrouillant la formation : existence, publication et absence d’archivage requises ; formation détenue par une organisation seulement pour les règles de cette organisation, jamais règle globale ou d’une autre organisation. Pas de faux succès en absence de base. Les droits auteur restent ceux vérifiés par la route ; pas de nouveau verrou transactionnel sur l’acteur dans ce lot.
- Test de schéma : périodes zéro/négatives/fractionnaires/hors limite, identifiants incorrects, longueurs et injection de destination refusés, trim et bornes acceptés. Test SQL : formation absente/brouillon/archivée, cible d’une autre organisation ou globale sur cours interne refusées sans insertion ; cible interne publiée de sa compagnie acceptée. 438 tests, 99 fichiers, TypeScript/build et Docker sauvegarde/restauration passent ; journaux /tmp/raero-lot235-{tests,check,build,docker,smoke}.log.
- Aperçu remplacé, volumes conservés et before235 arrêté, index Tailscale conforme et session antérieure/no-store vérifiés. Aucune création réelle de règle ni recette navigateur. Pas de migration/dépendance.
- Limites : anciennes règles non réécrites/non auditées par cette validation ; publication actuelle d’une cible peut évoluer ensuite, runTNA reste à renforcer. Catalogue de sélection UI reste celui existant (parcours de sélection des formations internes à compléter). Aucun avis réglementaire ni conformité globale établi ; objectif non achevé.


### Lot 236 — analyse des besoins atomique et lancements simultanés

- Tour précédent classé progression : validation des nouvelles règles. Relecture de runTNA révélant une succession check/insert hors transaction : deux analyses pouvaient constater simultanément une échéance absente, et une erreur laissait un résultat partiel déjà visible.
- Transaction et verrou consultatif par compagnie sérialisant les appels runTNA. Règles actives du périmètre sélectionnées en SQL, verrouillées en lecture dans l’ordre des identifiants ; compagnie active requise et verrouillée, effectif existant verrouillé dans l’ordre des identifiants. Un même instant de départ sert aux nouvelles échéances. Erreur d’insertion : rollback de toutes les créations de cet appel, échéances antérieures non modifiées.
- Les règles lues restent stables jusqu’au commit ; un archivage concurrent attend si l’analyse détient déjà leur verrou. Les nouvelles règles ou nouveaux salariés arrivés après la lecture sont traités lors d’une analyse suivante. Aucun verrou de prédicat global ni remise en cause des résultats historiques.
- Deux tests PostgreSQL : trois analyses concurrentes, un seul résultat créateur et aucune duplication salarié/formation pour la cible, rejeu identique ; trigger échouant au second salarié, aucun nouvel enregistrement après échec, reprise réussie et compagnie suspendue refusée. 440 tests, 100 fichiers, TypeScript/build et Docker sauvegarde/restauration passent. Journaux /tmp/raero-lot236-{tests,check,build,docker,smoke}.log.
- Instance remplacée, volumes conservés et before236 arrêté ; index Tailscale conforme et session antérieure/no-store vérifiés. Aucune analyse métier réelle, aucune migration/dépendance et aucune recette navigateur.
- Limites : sérialisation propre aux appels runTNA, pas une contrainte d’unicité couvrant tous les autres producteurs d’échéances ; droits de l’acteur contrôlés par la route mais non verrouillés pendant toute l’analyse. Règles historiques, cibles devenues indisponibles et priorité entre règles concurrentes à auditer. Objectif global toujours non achevé.


### Lot 237 — périmètre compagnie des règles et vue des compétences

- Tour précédent classé progression : analyse transactionnelle. Inspection de createRoleRequirement révélant que tout administrateur créait companyId=null, même depuis une compagnie sélectionnée. La mutation utilise maintenant la compagnie du contexte pour tous les rôles, avec contrôle de société active. Compatibilité maintenue pour l’API admin sans compagnie : création globale, qui n’est pas proposée depuis ce tableau exigeant une compagnie.
- Interface : périmètre global/compagnie visible sur les règles, explication de destination pour la nouvelle règle, archivage des règles globales masqué aux non-admins. Aucun sélecteur permettant au client d’injecter un autre companyId.
- Première suite : deux tests de compétences perturbés par une nouvelle fixture globale sans filtre, conduisant à remonter la lecture de règles dans server/access.ts. Celle-ci ne filtrait pas les règles archivées depuis le lot 234 ; correction ajoutée. Fixture globale dotée d’un filtre unique puis archivée après vérification ; première fixture globale persistée archivée seulement dans la base de tests isolée avec un auteur synthétique, sans suppression.
- Test API : admin avec compagnie produit une règle visible seulement dans celle-ci, compagnie suspendue refusée, admin sans compagnie garde la création globale historique. Test d’archivage étendu à un salarié affilié sans échéance pour vérifier que la règle archivée ne crée plus d’exigence dans la vue des compétences. Une première version de ce test omettait l’affiliation nécessaire et était refusée à juste titre ; fixture complétée avant relance.
- Suite finale : 441 tests, 100 fichiers ; TypeScript/build et Docker sauvegarde/restauration passent. Journaux /tmp/raero-lot237-{tests,check,build,docker,smoke}.log. Les échéances existantes restent des exigences de suivi, même après archivage d’une règle ; elles ne sont pas effacées de la vue.
- Aperçu remplacé, volumes conservés et before237 arrêté ; index Tailscale conforme, session antérieure/no-store vérifiés. Aucune création/archivage métier réel, pas de migration/dépendance ou de recette navigateur. Audit des autres lectures et historique des règles encore à poursuivre ; objectif global non achevé.


### Lot 238 — consultation des règles archivées

- Tour précédent classé progression : périmètre des règles et exclusion des archives dans la vue des compétences. Relecture des routes/composants confirmant l’absence de vue des règles conservées après archivage.
- Nouvelle lecture company.roleRequirementHistory : compte actif relu, compagnie/affiliation manager active vérifiées (admin sans compagnie limité aux archives globales), filtrage SQL compagnie courante ou global. Projection explicite de définition et métadonnées d’archivage, 50 lignes plus curseur avant identifiant. Aucun nom/e-mail d’auteur exposé ; attribution par identifiant de compte.
- Composant repliable dans l’onglet analyse, lecture à l’ouverture, première page/actualisation et page suivante, chargement/erreur/absence distincts. Définition complète (formation identifiée, période et deux critères), périmètre et date/auteur affichés en FR/EN/AR. Classement annoncé par numéro de règle décroissant, pas par date d’archivage. Invalidation de l’historique après modification de règles/analyse via le rafraîchissement existant.
- Test SQL avec 55 archives : première page attendue, règle active et autre compagnie exclues, nouvelle archive entre pages sans chevauchement, révocation manager et compte admin suspendu refusés. 442 tests, 101 fichiers, TypeScript/build et Docker sauvegarde/restauration réussis ; journaux /tmp/raero-lot238-{tests,check,build,docker,smoke}.log.
- Aperçu remplacé, volumes conservés et before238 arrêté. Index Tailscale conforme, session antérieure et contrat HTTP de l’historique/no-store vérifiés. Ce contrôle HTTP peut porter sur une liste vide ; les cas non vides sont vérifiés en fixture. Aucun archivage réel ni recette navigateur.
- Pas de migration/dépendance. Les archives restent consultables, sans désarchivage, édition ni effacement ; aucun journal complet de création historique reconstitué. Les archives ajoutées avec un identifiant supérieur nécessitent un retour première page. Le cache peut conserver une réponse jusqu’à relecture, sans révocation instantanée garantie. Objectif global non achevé.


### Lot 239 — droits courants dans la transaction d’analyse

- Tour précédent classé progression : historique des règles. Relecture de runTNA et de la route : contrôle de compagnie initial, mais pas de relecture/verrou de l’acteur dans la transaction d’analyse.
- Identifiant d’acteur désormais obligatoire dans le service ; la route le fournit depuis le contexte authentifié, jamais depuis une saisie client. Après verrou de la compagnie, compte relu et verrouillé en lecture : actif, même compagnie sélectionnée, administrateur actuel ou affiliation manager active verrouillée. Droits conservés jusqu’au commit. Compagnie changée : CONFLICT ; compte ou affiliation invalide : FORBIDDEN, avant toute insertion.
- Fixtures des appels internes adaptées à un acteur autorisé, sans chemin de service permettant d’omettre l’acteur. Nouveau test PostgreSQL : destination changée, compte suspendu, rôle admin retiré sans affiliation, affiliation inactive refusés avec zéro échéance ; affiliation activée puis analyse réussie. Pas de test d’ordonnancement concurrent de ces nouveaux verrous dans ce lot.
- 443 tests, 101 fichiers, TypeScript/build et Docker sauvegarde/restauration réussis ; journaux /tmp/raero-lot239-{tests,check,build,docker,smoke}.log. Aperçu remplacé, volumes conservés et before239 arrêté ; index Tailscale conforme et session antérieure/no-store vérifiés.
- Aucun lancement d’analyse réel ni recette navigateur, pas de migration/dépendance. Les changements d’accès attendent la fin d’une analyse qui détient déjà les verrous ; aucune annulation rétroactive promise. Les autres producteurs d’échéances et la validation des règles historiques restent à auditer. Objectif global non achevé.


### Lot 240 — critères de règle explicites et champs étiquetés

- Tour précédent classé progression : droits transactionnels TNA. Relecture du plan actuel et de ruleMatchesEmployee : combinaison OR des recherches poste/licence, tandis que la liste active masquait le second critère quand le premier existait. L’historique les affichait séparément sans exprimer la combinaison.
- Liste et historique affichent les deux critères reliés explicitement par OU lorsqu’ils sont tous deux présents. Consigne FR/EN/AR : correspondance textuelle sans casse, un seul des deux critères suffit, absence des deux critères concerne l’effectif actif. Aucun changement de logique serveur ou de critères existants.
- Formulaire : libellés visibles associés aux identifiants des quatre champs texte/sélection et à la période ; aide commune liée par aria-describedby. Longueurs de texte limitées à 255/128/64 comme le schéma serveur, période déjà bornée conservée. Cela ne constitue pas une recette clavier/lecteur d’écran ou RTL.
- Quatre tests ciblés (dictionnaires et schéma de règle), TypeScript/build passent. Journaux /tmp/raero-lot240-{tests,check,build,docker}.log ; dernière suite complète 443 tests au lot 239. Pas de test miroir des conditions JSX ni de recette navigateur.
- Bundle serveur identique au conteneur ; image reconstruite et frontend copié sans redémarrage. Index Tailscale conforme HTTP 200, aucune règle réelle modifiée, pas de migration/dépendance. Objectif global non achevé.


### Lot 241 — formations internes dans le choix des règles

- Tour précédent classé progression : critères OR explicites. Relecture du formulaire et de getPublicTrainings : seules les formations ownerOrgId=null alimentaient le sélecteur, malgré la possibilité serveur de créer une règle pour une formation interne de sa compagnie.
- Nouvelle lecture company.roleRequirementCourses : compte actif relu, compagnie active et affiliation manager requises sauf admin ; sélection SQL des cours publiés non archivés appartenant à la compagnie ou au catalogue public. Projection limitée à id/title/ownerOrgId, tri titre puis id. Un administrateur dans ce parcours reste limité à sa compagnie sélectionnée et au public.
- Le formulaire utilise cette lecture et deux groupes visibles FR/EN/AR : formations internes et catalogue public. Aide précisant la sélection des cours publiés/non archivés. Les états d’erreur/chargement et le blocage des actions de l’onglet continuent d’utiliser l’objet de requête ; aucune nouvelle attribution de formation automatique.
- Test PostgreSQL : cours interne propre et public présents avec projection exacte ; autre compagnie, brouillon et archive exclus ; manager révoqué et admin suspendu refusés ; admin actif ne reçoit pas les cours étrangers. 444 tests, 102 fichiers, TypeScript/build et Docker sauvegarde/restauration passent. Journaux /tmp/raero-lot241-{tests,check,build,docker,smoke}.log.
- Aperçu remplacé, volumes conservés et before241 arrêté ; index Tailscale conforme et session antérieure/no-store vérifiés. Aucun cours/règle métier créé ni recette navigateur du sélecteur. Pas de migration/dépendance.
- Limites : liste de titres complète non paginée, recherche et grands catalogues à améliorer ; création de règle revalide toujours la cible car la liste ne garantit pas son état au moment de l’envoi. Aucun paiement, accès apprenant ou validation pédagogique déduit de la présence dans ce sélecteur. Objectif global non achevé.


### Lot 242 — périodicités contradictoires avant nouvelles échéances

- Tour précédent classé progression : formations internes sélectionnables. Relecture du traitement : plusieurs règles applicables à une même formation utilisaient implicitement la période de la première règle lue, les suivantes constatant ensuite l’échéance nouvellement insérée.
- Regroupement des règles correspondantes par salarié/formation. Si aucune échéance n’existe et que les périodes diffèrent, PRECONDITION_FAILED avec identifiants du salarié, de la formation et jusqu’à dix règles impliquées. La transaction annule tous ses nouveaux ajouts. Même période : une seule échéance. Aucun choix automatique de période minimale, maximale ou de priorité globale/compagnie inventé.
- Message persistant FR/EN/AR expliquant le conflit et la nécessité de revoir les règles ; détail serveur français conservé avec identifiants. Le traitement spécifique dans l’interface exige le code PRECONDITION_FAILED et le préfixe actuel du message pour ne pas confondre une compagnie absente avec ce conflit ; contrat d’erreur structuré multilingue encore améliorable.
- Test PostgreSQL : premier salarié sans conflit, second avec périodes 24/12, aucune échéance conservée après refus ; archivage de la règle contradictoire, ajout d’une règle concordante et reprise donnant une seule échéance par salarié. Ajout ultérieur d’une période différente ne réécrit pas les échéances déjà suivies. 445 tests, 102 fichiers, TypeScript/build et Docker sauvegarde/restauration passent ; journaux /tmp/raero-lot242-{tests,check,build,docker,smoke}.log. TypeScript/build relancés après précision de la détection d’erreur UI.
- Aperçu remplacé, volumes conservés et before242 arrêté ; index Tailscale conforme, session antérieure/no-store vérifiés. Aucun lancement d’analyse ou archivage réel, pas de migration/dépendance ni recette navigateur.
- Limites : contrôle des nouvelles échéances uniquement, pas audit/réconciliation de la périodicité de tout suivi existant ; anciennes règles à période invalide ou cible devenue indisponible toujours à traiter. Arbitrage des règles applicables laissé au responsable habilité ; aucune interprétation réglementaire. Objectif global non achevé.


### Lot 243 — recherche dans l’effectif compagnie

- Tour précédent classé progression : conflits de périodicité. Inspection de la liste compagnie montrant l’affichage intégral de l’effectif sans filtre, peu pratique pour retrouver un salarié dans une liste importante.
- Filtre local sur les données déjà autorisées/chargées : prénom, nom, e-mail, poste, licence/catégories, qualifications de type, département et base. Recherche sans casse, mots séparés par espaces devant tous être présents dans l’ensemble des champs ; aucun nouvel appel serveur ni stockage du texte de recherche.
- Label associé, aide FR/EN/AR, bouton d’effacement, compteur de résultats avec role=status et message distinct en absence de correspondance. Les compteurs globaux restent ceux de l’effectif chargé. Export inchangé et explicitement nommé effectif complet ; aide précisant qu’il ne se limite pas au filtre. Barre d’actions accepte les retours à la ligne.
- Trois tests de dictionnaires, TypeScript/build réussis ; journaux /tmp/raero-lot243-{tests,check,build,docker}.log. Pas de nouveau test miroir de cette transformation de liste ni recette navigateur. Recherche exacte de sous-chaînes après passage en minuscules : pas de suppression des accents/diacritiques, de recherche phonétique ou de pagination serveur ajoutée.
- Serveur SHA256 identique au conteneur ; image reconstruite et frontend copié sans interruption, index Tailscale conforme HTTP 200. Aucun salarié réel modifié ou export réel exécuté, pas de migration/dépendance. Dernière suite métier complète 445 tests au lot 242. Objectif global non achevé.


### Lot 244 — indicateurs ouvrant les échéances filtrées

- Tour précédent classé progression : recherche dans l’effectif. Relecture des cartes et du tableau d’échéances : compteurs purement descriptifs et absence de filtre de statut.
- Cartes transformées en boutons : salariés ouvre l’effectif complet et efface sa recherche ; à jour/à renouveler/en retard ouvre l’onglet échéances avec le statut correspondant. Boutons clavier avec contour de focus déclaré, sans modification des données métier.
- Filtre de statut étiqueté (tous, à jour, bientôt, en retard, non commencé), compteur des lignes affichées et message de résultat vide distinct. Export toujours complet et explicitement nommé ainsi. Statuts calculés côté serveur conservés ; l’interface ne recalcule ni dates ni conformité.
- Trois tests de dictionnaires, TypeScript/build passent ; journaux /tmp/raero-lot244-{tests,check,build,docker}.log. Pas de tests miroir de filtre JSX ni de recette navigateur/clavier ; présence des attributs/styles ne prouve pas une validation d’accessibilité.
- Bundle serveur identique au conteneur. Image reconstruite et frontend copié sans interruption, index Tailscale conforme HTTP 200. Aucun export ou changement d’échéance réel, pas de migration/dépendance. Dernière suite complète 445 tests au lot 242. Objectif global non achevé.


### Lot 245 — indisponibilité explicite des offres et de la FAQ

- Tour précédent classé progression : accès aux échéances filtrées. Retour à Home.tsx et au contenu statique : pas de compteur de réussite dans ce composant, mais offres/FAQ utilisaient un rendu de remplacement sans distinguer chargement et échec de leur lecture. Cette inspection ne constitue pas un audit de toutes les promesses administrables de la plateforme.
- Offres : chargement explicite, erreur FR/EN/AR avec bouton de relecture désactivé pendant la requête, affichage des offres seulement après réponse disponible. Réponse vide conserve le parcours devis existant. FAQ : même séparation des états ; réponses statiques conservées seulement quand la réponse réussie ne contient pas d’entrées, plus comme remplacement silencieux après erreur.
- Une erreur de relecture masque les anciennes données de la section concernée ; les autres sections restent accessibles. Aucun prix, contenu administrable, fournisseur ou condition commerciale modifié. Le lien/devis reste accessible ailleurs sur la page.
- TypeScript/build et trois tests de dictionnaires réussis ; ces tests de dictionnaires ne couvrent pas directement homeCopy, dont l’usage des trois langues est vérifié par TypeScript. Journaux /tmp/raero-lot245-{tests,check,build,docker}.log. Pas de nouveau test miroir de conditions JSX ni recette navigateur.
- Bundle serveur identique au conteneur ; image reconstruite et frontend copié sans interruption. Index Tailscale conforme HTTP 200. Aucun téléchargement PDF réel ou changement métier, pas de migration/dépendance. Dernière suite métier complète 445 tests au lot 242. Objectif global non achevé.


### Lot 246 — contrôle vidéo et préférence de mouvement

- Tour précédent classé progression : offres/FAQ avec états explicites. Inspection de Home : playing était modifié par les promesses play et les clics, pas par les événements du lecteur ; préférence de réduction des animations contrôlée seulement au montage.
- État du bouton piloté par onPlay/onPause/onEnded/onEmptied, clic lisant la propriété paused du lecteur. Suppression du setPlaying après résolution de play, qui pouvait devenir obsolète après une pause. Écoute des changements prefers-reduced-motion : activation met en pause, désactivation ne relance pas automatiquement une vidéo. Autoplay initial conserve le respect de la préférence et une commande manuelle reste disponible.
- Nettoyage de l’écouteur et pause au démontage. Vidéo décorative, poster, URL et texte du bouton inchangés ; aucune nouvelle collecte ou ressource externe.
- TypeScript/build passent, journaux /tmp/raero-lot246-{check,build,docker}.log. Pas de nouveau test miroir d’événements DOM, de recette navigateur, de contrôle effectif d’autoplay ou de bascule système exécuté ; cette limite interdit une déclaration de validation complète d’accessibilité. Pas de relance des tests métier/traductions sans changement correspondant.
- Bundle serveur identique au conteneur ; image reconstruite et frontend copié sans interruption, index Tailscale conforme HTTP 200. Pas de migration/dépendance. Objectif global non achevé.


### Lot 247 — demande de devis et présentation factuelle

- Tour précédent classé progression : contrôle vidéo d’accueil. Relecture de QuoteRequest et de sa route : soumission non verrouillée immédiatement, champs encore éditables pendant l’envoi, nouvelle demande réutilisant le formulaire précédent, erreur seulement en toast. Les textes annonçaient agrément EASA, conformité Part-145/66, support dédié et délai 24–48 h non étayés par les preuves d’exploitation du projet.
- Verrou immédiat de soumission jusqu’à résolution/rejet de la mutation ; fieldset désactivé pendant l’envoi ; erreur persistante indiquant résultat incertain et risque d’enregistrement déjà effectué. Saisie conservée en mémoire après erreur. Nouvelle demande après succès efface les valeurs et l’état de mutation. Conversion du nombre par Number au lieu de parseInt, sans troncature silencieuse.
- Textes FR/EN/AR remplacés par descriptions factuelles de plateforme et d’étude de demande, sans affirmer agrément/conformité juridique ni délai garanti. Ce retrait ne constitue pas une détermination du statut réglementaire réel de l’organisme ; celui-ci reste à établir avec ses documents d’autorité.
- TypeScript, trois tests de dictionnaires et build passent ; journaux /tmp/raero-lot247-{tests,check,build,docker}.log. Aucun devis ni e-mail réel envoyé, pas de recette navigateur ni de nouveau test miroir des callbacks UI.
- Bundle serveur identique au conteneur ; image reconstruite et frontend copié sans interruption, index Tailscale conforme HTTP 200. Pas de migration/dépendance. Validation métier serveur, persistance/idempotence de demande et notification à approfondir ; ce verrou ne couvre pas les onglets/rechargements et ne garantit pas la livraison SMTP. Objectif global non achevé.


### Lot 248 — validation des devis et référence persistée

- Tour précédent classé progression : interface de devis et présentation factuelle. Relecture de quotes.create/createQuoteRequest confirmant chaînes non bornées, noms vides acceptés côté serveur, nombre non entier possible, service retournant null si base absente et succès sans référence d’insertion.
- Schéma partagé quoteRequestInput strict : noms requis après trim, e-mail valide, longueurs alignées sur quote_requests, effectif entier positif borné au type SQL, message limité à 10 000 caractères. API et formulaire l’utilisent. Service valide également ses appels directs avec userId interne explicite ou null, refus des champs métier injectés ; indisponibilité de base produit une erreur.
- Insertion returning id : succès et quoteId renvoyés après écriture effective. Référence affichée dans l’écran de confirmation ; labels reliés aux champs, maxLength et contraintes d’effectif côté interface, message de validation visible, aucune troncature automatique des textes serveur.
- Test de schéma : blancs, e-mail, bornes, effectifs, statuts/userId injectés refusés, trim/bornes acceptés. Test PostgreSQL : appels invalides sans enregistrement, référence correspondant à la ligne enregistrée, statut received, auteur authentifié conservé et auteur null pour anonyme. 447 tests, 104 fichiers, TypeScript/build et Docker sauvegarde/restauration passent ; journaux /tmp/raero-lot248-{tests,check,build,docker,smoke}.log.
- Aperçu remplacé, volumes conservés et before248 arrêté ; index Tailscale conforme et session antérieure/no-store vérifiés. Aucun devis/e-mail réel envoyé, pas de migration/dépendance ni recette navigateur.
- Limites : notification SMTP toujours après insertion et avant réponse, donc panne après écriture pouvant laisser un résultat incertain ; idempotence durable et reprise notification non ajoutées. Référence publique n’est pas une autorisation d’accès à un devis. Validation des longueurs ne valide pas juridiquement un SIRET ou un numéro de téléphone. Objectif global non achevé.


### Lot 249 — reprise des demandes de devis sans double création

- Tour précédent classé progression : vérification effective du conteneur actif, routage Tailscale et HTTP 200 pour livrer l’URL demandée. Relecture du code et de ../CLAUDE/CLAUDE.md avant reprise : création de devis sans idempotence durable, notification exécutée après insertion.
- UUID optionnel validé et normalisé en minuscules dans le schéma partagé. Journal quote_creation_requests immuable (mise à jour, suppression et truncate interdits), référence unique vers le devis et empreinte SHA-256 des champs normalisés et de userId. Transaction avec verrou consultatif par UUID : une seule insertion en concurrence ; même contenu/auteur retrouve quoteId, contenu ou auteur différent refuse avec CONFLICT. Reprise sans réécriture du devis ou de son statut. Appels anciens sans UUID compatibles, sans déduplication.
- Formulaire : UUID conservé en mémoire pour une nouvelle tentative du même contenu normalisé, régénéré si contenu changé ou nouvelle demande. Utilise le générateur existant compatible aperçu HTTP privé. Aucun stockage local des coordonnées. Route : une reprise confirmée ne renvoie pas la notification administrateur.
- Tests PostgreSQL : cinq appels simultanés, un seul dossier et un seul résultat initial ; reprise après changement de statut, ordre de champs différent, espaces normalisés et UUID majuscule ; contenu/auteur modifiés refusés et journal protégé. Test route avec e-mail simulé : un envoi initial, aucun nouvel envoi sur reprise. UUID invalide refusé. 449 tests / 104 fichiers, TypeScript, build et smoke Docker avec sauvegarde/restauration passent ; journaux /tmp/raero-lot249-{focused,tests,check,build,docker,smoke}.log.
- Aperçu remplacé, volumes conservés, ancien conteneur before249 arrêté. Index Tailscale HTTP 200 identique au build, session administrateur antérieure conservée et no-store vérifié. Aucun devis ni e-mail métier réel créé/envoyé et aucune recette navigateur ; fixtures seulement en base isolée.
- Limites : rechargement, fermeture du formulaire ou autre onglet ne conservent pas l’UUID ; une modification de contenu crée une nouvelle intention. Le journal protège les requêtes portant le même UUID, pas toutes les demandes similaires. Notification encore sans file durable : panne avant envoi ou échec SMTP ne déclenche pas de récupération via cette reprise. UUID/référence ne confèrent aucun accès au contenu du devis. Validations fournisseurs, parcours navigateur, conformité et autres écarts de docs/operational-readiness.md restent ouverts ; objectif global non achevé.


### Lot 250 — statuts des devis : concurrence et historique

- Tour précédent classé progression : déduplication durable des créations de devis, vérifiée et déployée. Inspection actuelle : updateQuoteRequestStatus écrivait sans auteur ni contrôle de version ; préparation Stripe modifiait également le statut sans historique. Gouvernance ../CLAUDE/CLAUDE.md appliquée.
- Révision de statut dans quote_requests, incrémentée par trigger uniquement si le statut change. Schéma strict d’update exige id entier positif, statut autorisé et expectedRevision. Service verrouille le devis, relit/verrouille l’administrateur actif, refuse version périmée/compte révoqué/devis absent et n’annonce plus de succès si base absente. Retour à un ancien statut ne rend pas une ancienne révision valide.
- Journal quote_status_events append-only, déclenché par la base pour les changements de statut, avec ancien/nouveau statut, révision, date et auteur lorsqu’il est renseigné par la transaction. Préparation de commande transmet l’auteur et revérifie son rôle/statut sous verrou. Écritures SQL sans contexte gardent un auteur null, sans identité inventée. Pas de reconstitution historique et aucun nouvel enregistrement pour un statut inchangé.
- Route d’historique admin uniquement, pagination 50 par id décroissant limitée au devis. Composant repliable dans la fiche, attribution par numéro de compte, états chargement/erreur/vide, rafraîchissement et suite, FR/EN/AR. Tableau transmet la révision, désactive les changements pendant mutation/relecture, conserve une erreur visible et permet de relire explicitement ; liste masquée si sa requête échoue.
- Tests PostgreSQL : deux décisions simultanées, un succès/un conflit, attribution, no-op, aller-retour du statut, révision obligatoire, compte suspendu, immutabilité, écriture sans auteur et pagination de 55 événements sans mélange de devis. Tests checkout existants enrichis : un événement pour une conversion concurrente, aucun lors d’un échec, admin suspendu refusé. Test route : historique interdit aux visiteurs/utilisateurs et révision transmise pour l’admin. 452 tests / 105 fichiers, TypeScript et build passent ; journaux /tmp/raero-lot250-{focused,tests,check,build}.log.
- Limites : ce suivi trace les statuts, pas toutes les coordonnées du devis ; aucune preuve juridique d’acceptation client ni transition métier supplémentaire imposée. Les anciens clients doivent désormais envoyer expectedRevision pour cette mutation. Les écritures directes restent traçables avec auteur inconnu, et le contexte SQL n’est pas une authentification indépendante de l’application. Aucun devis métier réel modifié, aucun appel Stripe réel/e-mail, aucune recette navigateur. Objectif global non achevé.

- Déploiement lot250 : image et smoke Docker/restauration validés (/tmp/raero-lot250-{docker,smoke}.log). Aperçu remplacé, volumes conservés, before250 arrêté. Index Tailscale HTTP 200 conforme au build, session précédente/no-store conservés ; endpoint historique lu avec un id inexistant (contrat vide seulement, contenu/pagination prouvés par fixtures isolées).


### Lot 251 — préparation d’une commande attachée à son devis

- Tour précédent classé progression : historique immuable des statuts, concurrence et déploiement validés. Inspection QuoteManageDialog/AdminDashboard : composant toujours monté conservant lignes, compagnie et lien entre deux devis ; catalogue sans état d’erreur et proposant des formations internes/brouillons ; édition et fermeture possibles pendant envoi ; textes affirmant une notification client non effectuée par cette route.
- Instance du dialogue indexée sur le devis (ou état fermé), donc brouillon et résultat distincts à chaque ouverture/dossier. Verrou immédiat contre doubles clics, fermeture ignorée pendant mutation, avertissement de perte du brouillon à la fermeture et beforeunload. Après tentative, lignes et acheteur figés ; reprise utilise les mêmes conditions et le mécanisme serveur existant, sans nouvelle politique Stripe. Succès avec URL affiche le lien et bloque une nouvelle création ; résultat absent n’annonce pas un succès.
- Données catalogue/compagnies avec chargement/erreur/rafraîchissement ; catalogue UI limité aux formations publiques publiées avec version et non archivées. Ajout choisit une formation absente, listes évitent doublons, suppression nommée pour accessibilité. Contraintes et validation locale quantités entières 1..100 (1 en personnel), prix TTC positifs à deux décimales et bornés, compagnie active et formations encore disponibles. Contrôles serveur restent autoritaires, dont accès de l’acheteur à la compagnie.
- Succès invalide listes devis/commandes et historique. Erreur persistante explique l’incertitude et la reprise sans changement des conditions. Textes FR/EN/AR retirent les affirmations de lien envoyé/posté au client et distinguent lien disponible du paiement. TypeScript initial a révélé retour API nullable et mauvais chemin d’invalidation commandes : corrigés avant validation finale.
- TypeScript, trois tests de dictionnaires et build passent ; /tmp/raero-lot251-{check,tests,build}.log. Pas de test miroir des callbacks UI, pas de recette navigateur ni paiement/e-mail réel. Bundle serveur SHA-256 identique au conteneur : c0557c5d7a2c1b1b4a197f87854773821ec87d6dfc6c130202e3d863d801b815. Dernière suite backend complète : 452 tests au lot250, non relancée pour ces seuls changements d’interface.
- Limites : avertissement beforeunload dépend du navigateur ; pas de garde de toutes les navigations SPA et brouillon non durable. Fermer après une tentative n’annule pas la commande. Les erreurs métier avant création demandent de fermer/rouvrir pour modifier ; vérification des commandes nécessaire si résultat incertain. Calcul HT à partir du TTC selon le taux existant inchangé, aucune validation fiscale ni transaction Stripe réelle. La liste des compagnies reste celle des admins ; autorisation acheteur contrôlée par le serveur. Objectif global non achevé.

- Déploiement lot251 : image reconstruite (/tmp/raero-lot251-docker.log), frontend copié dans le conteneur actif sans redémarrage ; index Tailscale HTTP 200 identique au build. Pas de migration ni nouvelle sauvegarde/restauration pour ce lot frontend.


### Lot 252 — états client et messagerie des devis

- Tour précédent classé progression : préparation des commandes isolée par dossier et interface déployée. Relecture MyQuotes/QuoteThread : erreurs assimilées à des listes vides, absence de verrou immédiat sur Entrée, saisie modifiable pendant envoi puis effacée au succès, erreurs d’envoi invisibles et dates toujours françaises.
- MyQuotes distingue chargement auth, erreur auth avec relecture, visiteur, chargement données, erreur avec rafraîchissement et vide réel. Données mises en cache masquées sur erreur. Dates selon langue, texte aligné au sens de lecture et aria-expanded sur la conversation.
- QuoteThread distingue chargement/erreur/vide ; rafraîchissement explicite et composition bloquée si lecture indisponible. Verrou immédiat de soumission, champ désactivé pendant envoi, invalidation attendue, erreur persistante conservant le texte et signalant le risque d’enregistrement déjà effectué. Entrée ignorée pendant composition IME ; bouton d’envoi et champ nommés pour accessibilité. Dates FR/EN/AR. Aucun message/e-mail réel envoyé.
- TypeScript, trois tests de dictionnaires et build passent ; journaux /tmp/raero-lot252-{check,tests,build}.log. Pas de nouveau test miroir du câblage React ni de recette navigateur. Serveur SHA-256 inchangé c0557c5d7a2c1b1b4a197f87854773821ec87d6dfc6c130202e3d863d801b815 ; dernière suite serveur complète 452 tests lot250, non relancée.
- Limites : conservation du brouillon uniquement tant que la conversation reste montée ; fermeture/navigation ou erreur de la liste parente peut démonter la conversation. Verrou local sans idempotence durable : vérifier les messages avant une nouvelle tentative, pas de garantie contre doublons après résultat incertain. Routes de messages et notifications inchangées ; leur validation bornée et reprise durable restent à approfondir. Objectif global non achevé.

- Déploiement lot252 : image reconstruite (/tmp/raero-lot252-docker.log), frontend copié sans redémarrage ; index Tailscale HTTP 200 conforme au build. Pas de migration ni nouvelle restauration pour ce lot frontend.


### Lot 253 — accès transactionnel aux conversations de devis

- Tour précédent classé progression : états client/messagerie et déploiement frontend. Inspection serveur : autorisation seulement dans route avant écriture, service direct sans validation/autorisation, texte non borné, lecture marquant toute la conversation avant de la charger et recherches auteurs N+1.
- Schémas partagés stricts quoteThreadInput/quoteMessageInput : id positif borné SQL, texte trim requis et maximum 10 000 caractères, champs auteur/destinataire injectés refusés. Formulaire utilise le schéma et maxLength. Service d’écriture valide ses appels directs et ne retourne plus null en l’absence de base.
- Helper transactionnel relit/verrouille en partage devis et compte actif, autorise rôle admin actuel, userId du devis ou correspondance d’e-mail actuelle (règle existante conservée). Lecture et insertion exécutées sous ces verrous. La route reçoit en interne auteur/rôle/devis vérifiés pour la notification et retourne uniquement le message au client. Ancien marquage autonome supprimé car il n’avait plus d’appelant.
- Lecture : jointure projetant nom/rôle au lieu de relire chaque compte entier, ordre date/id stable ; seuls les ids effectivement lus et provenant d’un autre auteur sont marqués lus. Une lecture interdite n’effectue aucune modification. Les champs de compte sensibles ne sont pas sélectionnés pour l’attribution.
- Deux tests PostgreSQL : blancs/longueur/injection refusés, extérieur interdit, propriétaire/admin autorisés, trim/auteur enregistrés, lecture marquant seulement la réponse entrante, admin suspendu interdit, correspondance e-mail insensible à la casse pour devis anonyme puis e-mail changé refusé, rattachement explicite accepté, erreur n’altérant pas le lu. 454 tests / 106 fichiers, TypeScript/build passent ; journaux /tmp/raero-lot253-{focused,tests,check,build}.log.
- Limites : lecture encore non paginée, isRead partagé (pas un accusé individuel par admin), noms/rôles affichés actuels et non instantané historique. Test de concurrence avec insertion précisément entre sélection et marquage non ajouté ; portée du marquage vérifiée dans le code et comportement entrant/sortant en base. Correspondance e-mail conservée sans nouvelle règle de vérification d’identité. Pas d’UUID de message/outbox durable ; une erreur SMTP après insertion peut encore laisser un résultat incertain. Aucun message/e-mail réel, aucune recette navigateur. Objectif global non achevé.

- Déploiement lot253 : image, smoke Docker et restauration validés (/tmp/raero-lot253-{docker,smoke}.log), aperçu remplacé avec volumes conservés, before253 arrêté. Index Tailscale HTTP 200 conforme au build et session antérieure/no-store vérifiés. Aucune lecture de conversation métier sur l’aperçu pour éviter de modifier ses accusés de lecture. Pas de migration.


### Lot 254 — reprise durable des messages de devis

- Tour précédent classé progression : accès transactionnel et validation des conversations déployés. Relecture des sources confirmant insertion simple et notifications après persistance, sans identifiant de reprise.
- UUID optionnel strict, normalisé en minuscules dans quoteMessageInput ; journal quote_message_requests immuable avec référence unique au message et empreinte SHA-256 du devis, auteur et contenu normalisé. Verrou consultatif UUID et insertion message/journal atomiques. Reprise retrouve le message existant après nouvelle vérification des droits actifs, refuse contenu/devis/auteur différents, ne modifie pas son état lu.
- Route retourne le message retrouvé sans nouvelle notification. Formulaire conserve en mémoire l’UUID du même contenu/devis entre tentatives, le renouvelle si contenu changé et l’efface après succès. Utilise le générateur existant compatible HTTP privé. Aucun texte de conversation stocké dans le navigateur de façon durable. Appels sans UUID conservés, sans déduplication.
- Tests SQL : cinq envois concurrents, un seul message et résultat initial ; reprise après lecture, espaces normalisés et UUID majuscule ; collisions de contenu/devis/auteur refusées, UUID invalide refusé, suspension refusant même une reprise, journal protégé contre modification/suppression. Test route avec transport simulé : une notification initiale et aucune notification de reprise. 456 tests / 106 fichiers, TypeScript/build passent ; /tmp/raero-lot254-{focused,tests,check,build}.log.
- Limites : UUID perdu au démontage/rechargement, pas de déduplication entre intentions différentes ou anciens clients. La protection évite une notification répétée sur reprise, mais ne garantit pas sa livraison : panne avant envoi ou échec SMTP non repris automatiquement, outbox durable encore absente. Aucun message/e-mail réel et aucune recette navigateur. Objectif global non achevé.

- Déploiement lot254 : image/smoke Docker/sauvegarde-restauration validés (/tmp/raero-lot254-{docker,smoke}.log), migration appliquée au remplacement de l’aperçu, volumes conservés, before254 arrêté. Index Tailscale HTTP 200 conforme au build, session antérieure et no-store vérifiés ; aucune conversation métier lue ou modifiée sur l’aperçu.


### Lot 255 — liste personnelle des devis paginée en base

- Tour précédent classé progression : reprise durable des messages, testée et déployée. Relecture getMyQuotes confirmant SELECT de tous les devis puis filtre JavaScript utilisant l’e-mail du contexte ; toutes les colonnes renvoyées et aucune limite de liste.
- Schéma strict de curseur beforeId positif entier borné SQL. Service relit/verrouille le compte actif et applique userId OU e-mail actuel insensible à la casse directement dans la requête. Ne reçoit plus d’e-mail fourni par l’appelant. Erreur réelle si base absente ou compte inactif. Admin conserve une liste personnelle, distincte de sa liste d’administration.
- Projection limitée id, companyName, status, createdAt, trainingTypes ; coordonnées, message initial et autres colonnes ne transitent plus pour cet écran. Pagination par id décroissant, 51 lignes pour détecter la suite, 50 renvoyées. Contrat myList désormais {entries,nextBeforeId}, client adapté. Ordre par référence explicite, rafraîchir depuis le début et pages précédentes, vide de page distinct du vide initial ; changement de page ferme la conversation ouverte.
- Test PostgreSQL : 55 demandes propres (userId/e-mail), demande étrangère exclue, projection minimale exacte, arrivée entre deux lectures sans doublon/décalage, première page actualisée, liste personnelle admin, changement d’e-mail, curseurs/champs injectés invalides et compte suspendu. 457 tests / 107 fichiers, TypeScript/build passent ; /tmp/raero-lot255-{focused,tests,check,build}.log.
- Limites : pas de recherche, filtre de statut ou nombre total ; ordre par id plutôt que chronologie strictement fondée sur createdAt. Aucune mesure de charge/plan SQL à grande échelle ni nouvel index dans ce lot. Correspondance e-mail historique conservée ; pas de nouvelle politique KYC. Navigation entre pages démonte le fil et son brouillon non durable (limite déjà présente à la fermeture du fil). Clients de l’ancien contrat tableau doivent être mis à jour. Aucun devis/message/e-mail métier créé ni recette navigateur. Objectif global non achevé.

- Déploiement lot255 : image/smoke Docker/restauration validés (/tmp/raero-lot255-{docker,smoke}.log), aperçu remplacé avec volumes conservés, before255 arrêté. Index Tailscale HTTP 200 conforme, session antérieure/no-store et contrat myList {entries,nextBeforeId} vérifiés en lecture seule ; pagination non vide prouvée par fixtures isolées. Pas de migration.


### Lot 256 — catalogue et fiche de formation : états et présentation

- Tour précédent classé progression : liste personnelle des devis filtrée/paginée et déployée. Retour au parcours public de formation. Inspection Catalogue/TrainingDetail : erreur assimilée à zéro résultat ou fiche introuvable, toute erreur panier présentée comme besoin de connexion, prix TTC arrondis à l’euro, langue autre que français affichée anglais et filtre arabe absent.
- Erreurs catalogue/fiche explicites avec rafraîchissement, données en cache masquées sur erreur et filtres conservés. Fiche absente uniquement après succès sans formation ; retour catalogue disponible sur erreur. Erreur panier distingue UNAUTHORIZED des autres échecs, reste visible et invite à vérifier le panier avant renvoi ; succès invalide les requêtes panier.
- Prix TTC affichés via Intl/toLocaleString en EUR dans la langue courante, avec les centimes du montant reçu. Aucun montant stocké ni calcul de paiement modifié. Ajout filtre arabe (API acceptant déjà cette langue), fiche distinguant FR/EN/AR et affichant la valeur brute pour langue inconnue. Labels de filtres associés à leurs champs, placement recherche au début selon sens de lecture et bouton panier nommé.
- TypeScript, trois tests dictionnaires et build passent ; /tmp/raero-lot256-{check,tests,build}.log. Pas de nouveau test miroir du câblage UI ni de recette navigateur. Serveur identique au conteneur SHA-256 740a2373140c830b89baef46bdee926c45de19a4dd2979f27eab9ad74a406102 ; dernière suite backend complète 457 tests lot255, non relancée pour ce lot frontend.
- Limites : pas de preuve de disponibilité d’un cours réellement en arabe, traduction interface distincte de traduction du contenu. Requête catalogue encore filtrée en mémoire côté serveur et retour vide si getDb absent, à approfondir ; aucun contrôle de charge/filtrage paginé ajouté. Prix manquant/zéro et commercialisation liés au comportement existant, pas de validation fiscale. Ajout panier toujours sans nouvelle idempotence durable ; aucun panier/paiement métier modifié pendant vérification. Objectif global non achevé.

- Déploiement lot256 : image reconstruite (/tmp/raero-lot256-docker.log), frontend copié sans redémarrage ; index Tailscale HTTP 200 identique au build. Aucune migration ni nouvelle restauration pour ce lot frontend.


### Lot 257 — filtres SQL et projection publique du catalogue

- Tour précédent classé progression : états du catalogue/fiche, prix avec centimes et filtre arabe déployés. Inspection getPublicTrainings/getFeaturedTrainings/getTrainingBySlug : SELECT de toutes les colonnes, filtres applicatifs après lecture globale et succès vide/null si base absente.
- Schéma partagé strict catalogueInput pour API et appels directs : chaînes trim bornées (type/domaine 32, langue 8, recherche 255), catégorie entière positive bornée SQL. Champs non reconnus refusés ; slug requis borné 255 pour fiche, validation directe aussi. Champ de recherche UI maxLength 255.
- Filtres type/domaine/langue/catégorie appliqués SQL avec visibilité publié/public/non archivé. Recherche insensible à la casse sur titre/description via strpos, caractères %/_ traités littéralement, description null gérée ; valeurs inconnues de type/domaine renvoient vide sans erreur d’enum SQL. Ordre conserve featured/titre puis ajoute id pour départager.
- Projection publique explicite commune catalogue, sélection accueil et fiche : description/objectifs/prérequis/public/tarifs/politiques affichées et informations catalogue conservés ; propriétaires, reviewStatus, versions de travail, archive et configuration non affichée de l’examen exclus. Base absente produit une erreur au lieu d’une fausse liste vide/fiche absente. Pas de changement de droits d’achat ou d’accès pédagogique.
- Test PostgreSQL : filtres combinés/langue arabe/catégorie, trim/casse, recherche description, caractères %/_ littéraux, filtre inconnu vide, données internes/brouillons/archives exclues, projection ne contenant pas métadonnées ciblées, entrées invalides et slug vide refusés. 458 tests / 108 fichiers, TypeScript/build passent ; /tmp/raero-lot257-{focused,tests,check,build}.log.
- Limites : catalogue non paginé et aucune mesure de charge/plan SQL ; liste publique commune contient aussi les champs utiles à la fiche, donc pas une projection minimale de carte. Recherche non accent-insensible et sans classement de pertinence ; casse selon PostgreSQL. Prix publics existants conservés, sans validation fiscale ; référence Part-147 affichée ne vaut pas validation d’agrément. Aucun contenu métier réel modifié, pas de requête fournisseur payante ni recette navigateur. Objectif global non achevé.

- Déploiement lot257 : image/smoke Docker/restauration validés (/tmp/raero-lot257-{docker,smoke}.log), aperçu remplacé, volumes conservés, before257 arrêté. Index Tailscale HTTP 200 conforme, session antérieure/no-store et réponse catalogue publique lus ; visibilité/filtres/projection sur données contrôlées prouvés par fixtures isolées. Pas de migration.


### Lot 258 — fiche de formation : document délivré et données manquantes

- Tour précédent classé progression : catalogue SQL/projection publique, contrôles et déploiement. Relecture TrainingDetail et locales : garantie générique « Certificat inclus » et conformité de traçabilité Part-147 non rattachée à une preuve de formation, taux TVA 20 % affiché en dur, tarif entreprise arrondi à l’euro et valeurs par défaut inventées pour niveau/domaine absents.
- Relecture issueCertificate : génération conditionnée au parcours completed et à une tentative finale réussie persistée, avec contrôles d’intégrité supplémentaires. Texte FR/EN/AR décrit la capacité de génération PDF numéroté/vérifiable et invite à confirmer nature/portée du document avant inscription ; aucune affirmation de conformité globale. Aucun mécanisme d’émission ni décision réglementaire modifié.
- Prix HT affiché comme HT sans taux fiscal affirmé dans cette fiche ; tarifs HT/entreprise localisés à deux décimales. Aucun montant ni calcul serveur modifié. Niveau/domaine/langue manquants affichés non renseignés ; valeurs inconnues conservées au lieu de présenter une valeur arbitraire. Description/objectifs/prérequis/public cible conservent leurs sauts de ligne pour la lecture.
- TypeScript, trois tests de dictionnaires et build passent ; /tmp/raero-lot258-{check,tests,build}.log. Pas de nouveau test miroir d’édition de texte ni recette navigateur. Serveur identique SHA-256 919c911e05d2b5d94754c4a2279d0d734ab5725020c0cb12b8dcee07d310bfc8 ; dernière suite complète 458 tests lot257, non relancée pour ce lot frontend.
- Limites : nature réglementaire du document par formation et validation de contenu/agrément restent à établir ; édition de présentation ne résout pas cette validation métier. Paramètres d’examen affichés gardent les valeurs/fallbacks existants. Le taux employé par les calculs commerciaux backend n’est pas modifié ni validé fiscalement ici. Aucun certificat/paiement/message métier émis. Objectif global non achevé.

- Déploiement lot258 : image reconstruite (/tmp/raero-lot258-docker.log), frontend copié sans redémarrage ; index Tailscale HTTP 200 conforme au build. Pas de migration ni nouvelle restauration pour ce lot frontend.


### Lot 259 — progression de lecture monotone et reprise visible

- Tour précédent classé progression : fiche factuelle et déploiement frontend. Inspection du lecteur montrant des états initiaux/rafraîchissements déjà traités et une sauvegarde de progression des diapositives sans erreur visible. Inspection updateEnrollmentProgress : écrasement direct du pourcentage, possibilité de recul avec requête tardive, statut not_started pouvant remplacer in_progress et statuts non completed pouvant être réactivés.
- Schéma partagé learningProgressInput : id SQL positif, pourcentage entier 0..100 (colonne integer), statuts de lecture not_started/in_progress uniquement. Route et service direct le valident ; erreur réelle si getDb absent. Mise à jour SQL atomique greatest(valeur courante, valeur reçue), ne faisant pas reculer in_progress ; limitée aux inscriptions not_started/in_progress. Completed/expired/failed inchangés. Lecture à 100 % n’accorde pas completed ni completedAt.
- Lecteur conserve le maximum demandé dans l’instance du parcours et affiche une erreur de sauvegarde avec reprise de cette valeur. Pas de redémarrage du diaporama ni de l’examen lors d’une reprise de progression. Aucun changement aux réponses, chronomètre ou soumission du QCM ; contrôles d’accès de route existants conservés.
- Tests PostgreSQL ciblés : sauvegarde 80 puis 20/not_started, valeurs concurrentes, lecture100 sans completion, pourcentages invalides/fractions/statut completed refusés, lignes completed/expired/failed strictement inchangées. 18 tests ciblés (dont 17 examens) passent, TypeScript et build également ; journaux /tmp/raero-lot259-{focused,check,build}.log.
- Limites : reprise locale tant que l’instance du cours reste montée, pas de file hors ligne ; les changements de modules/autres producteurs de progression ne sont pas tous refondus. Service conserve son absence de retour pour une ligne exclue ou inexistante, route requireEnrollment contrôlant l’accès avant appel ; pas de nouvelle protection transactionnelle des affiliations dans ce lot. Aucun parcours/quiz/certificat réel modifié ni recette navigateur. Objectif global non achevé.

- Validation/déploiement lot259 : 459 tests / 109 fichiers, image/smoke Docker/restauration validés (/tmp/raero-lot259-{tests,docker,smoke}.log), aperçu remplacé avec volumes conservés, before259 arrêté. Index Tailscale HTTP 200 conforme au build, session antérieure/no-store vérifiés. Pas de migration ni progression métier réelle modifiée.


### Lot 260 — erreurs de chargement des médias pédagogiques

- Tour précédent classé progression : progression monotone/reprise et déploiement validés. Inspection SlideDeck/LearningPlayer : vidéo/audio natifs sans retour applicatif de chargement en erreur ; PDF déjà proposé en lien séparé. Aucun faux état terminé induit par ce changement.
- LearningVideo conserve les props natives (contrôles, style, timeupdate) et la ref utilisée par les interactions vidéo, ajoute une erreur lisible et recharge explicite depuis le début via load(). Utilisé pour vidéos de diapositives et de modules. Erreur liée à la source et effacée au chargement réussi/reprise ; instance réinitialisée au changement de diapositive/source.
- Audio de narration : erreur native rendue avec même action de rechargement, contrôles natifs conservés. Textes FR/EN/AR, rôle alert. Cadre vidéo de module adapté pour que l’erreur soit hors du ratio vidéo. Aucun autoplay forcé ni validation de chapitre déclenchée par chargement/reprise ; les réponses locales aux interactions vidéo ne sont pas réinitialisées par ce rechargement.
- TypeScript, trois tests de dictionnaires et build passent ; /tmp/raero-lot260-{check,tests,build}.log. Aucun test miroir de callbacks DOM ni recette navigateur : erreur média réelle, reprise, codecs, focus/RTL et interactions cue après reprise non vérifiés visuellement. Serveur identique SHA-256 a589aefccfa316f57d94014a4523475119c9d2749d6bfccb875c88c1a480cca2 ; dernière suite complète 459 tests lot259, non relancée.
- Limites : pas de traitement des images/PDF ni de délais pour source bloquée sans événement error ; refus d’autoplay n’est pas assimilé à une erreur de fichier. La reprise redémarre le média et exige l’action native de lecture. Aucun média fournisseur généré ni contenu pédagogique réel modifié. Objectif global non achevé.

- Déploiement lot260 : image reconstruite (/tmp/raero-lot260-docker.log), frontend copié sans redémarrage ; index Tailscale HTTP 200 conforme au build. Pas de migration ni nouvelle restauration pour ce lot frontend.


### Lot 261 — benchmark des parcours publics et priorités métier

- Tour précédent classé progression : états média et déploiement frontend. Relecture docs/product-references.md et audit opérationnel confirmant comparaison initiale limitée à quelques repères et benchmark détaillé ouvert.
- Recherche web et lecture de six pages officielles de trois acteurs : LTT (Training Finder, eLibrary, MAINTAIN360), Storm Aviation (Technical Training, Learning Solutions), SR Technics (Training Services). Sources exactes liées dans docs/benchmark-training-journeys.md. Les annonces commerciales sont distinguées des fonctionnalités réellement testées ; ni agréments, gains commerciaux, efficacité pédagogique ni fonctionnalités des espaces privés validés.
- Confrontation au code actuel : schémas trainings/sessions, runTNA, accès compagnie, lecteur et références des tests pertinents. Écarts retenus : portée de programme encore largement en texte libre ; runTNA applique des règles de récurrence et ne constitue pas une analyse pédagogique complète ; parcours par rôle et scénarios à vérifier de bout en bout. Priorités assorties de critères de preuve, pas de fonctionnalités présentées comme déjà livrées.
- Nouveau document benchmark-training-journeys.md, renvoi depuis product-references.md et complément ciblé dans operational-readiness.md. Vérification des liens locaux et du nombre de sources externes ; aucune suite logicielle relancée pour ces seuls documents. L’audit historique n’est pas transformé en nouvelle validation complète.
- Limites de collecte : iframe de recherche LTT non testée, ouverture du calendrier externe SR Technics en erreur, aucune inscription/connexion concurrente, aucun contact/message/achat, aucune copie de média ou manuel. Pas de recette navigateur comparative ni conclusion de supériorité. Aucun changement applicatif/déploiement pour ce lot ; aperçu du lot260 conservé. Objectif global non achevé.


### Lot 262 — présentation exacte du suivi des récurrences

- Tour précédent classé progression : comparaison publique sourcée et critères métier documentés. Application du premier écart : relecture CompanyDashboard/locales/runTNA confirme bouton « Lancer la TNA » et description de formation obligatoire, alors que le service crée des récurrences manquantes selon règles.
- Libellés FR/EN/AR remplacés par suivi des récurrences par règles et création des suivis manquants. Explication des règles actives, salariés actifs, conservation des suivis existants et date initiale calculée depuis l’exécution + période. Précise absence d’inscription au cours/validation de compétence et nécessité de définir/revoir les règles côté responsable formation.
- Résultat de mutation conservé visiblement tant que le composant garde son état ; zéro ajout distingué d’une couverture de tous les besoins. Callback typé, count provenant directement de r.created, plus de fallback fictif à zéro. Aucune logique métier/API ni règle modifiée et aucune action runTNA exécutée sur les données d’aperçu.
- TypeScript, trois tests dictionnaires et build passent ; /tmp/raero-lot262-{check,tests,build}.log. Pas de test miroir de texte/callback ni recette navigateur. Serveur identique SHA-256 a589aefccfa316f57d94014a4523475119c9d2749d6bfccb875c88c1a480cca2 ; dernière suite complète 459 tests lot259, non relancée pour ce lot frontend.
- Limites : le renommage n’est pas une analyse pédagogique complète ; futurs besoins/objectifs/programmes/évaluations restent dans le benchmark. Date de création du suivi ne prouve pas une formation antérieure ni une échéance réglementaire validée. Le résultat affiché n’est pas un historique durable des exécutions. Objectif global non achevé.

- Déploiement lot262 : image reconstruite (/tmp/raero-lot262-docker.log), frontend copié sans redémarrage ; index Tailscale HTTP 200 conforme au build. Pas de migration ni nouvelle restauration pour ce lot frontend.


### Lot 263 — récurrences vers formations encore disponibles

- Tour précédent classé progression : présentation exacte du suivi par règles et déploiement. Inspection runTNA/createRoleRequirement : contrôle du cours lors de création de règle, mais aucune revalidation lors de création ultérieure de récurrences. Deux anciennes fixtures utilisaient un cours non publié pour un scénario positif.
- Pour chaque suivi absent, après contrôle des périodes, lecture/verrouillage en partage du cours ; refuse cible absente, non publiée, archivée ou détenue par une autre compagnie. Même critère de disponibilité que la création de règle (pas de nouvelle exigence de version publiée dans ce lot). Erreur PRECONDITION_FAILED avec références de formation/règle uniquement. L’ensemble de la transaction est annulé si une cible indisponible empêche un nouvel ajout.
- Suivis existants laissés intacts, y compris si le programme est ensuite retiré ; un nouveau salarié concerné déclenche en revanche le contrôle avant création. UI FR/EN/AR explique le problème et la conservation de zéro nouvel ajout dans l’exécution échouée ; détail des références affiché pour corriger/archiver la règle.
- Fixtures positives actualisées avec cours publié. Nouveau test PostgreSQL couvre draft/archived/foreign/missing, absence d’ajout partiel, reprise après archivage de règle, conservation des suivis existants après retrait du cours et refus d’un nouvel ajout. Huit tests ciblés, TypeScript/build passent ; /tmp/raero-lot263-{focused,check,build}.log.
- Limites : pas d’archivage automatique des règles ou suivis, pas de migration/réparation des données historiques ni nouvelle décision métier. Le contrôle n’est effectué que lorsqu’un suivi manque ; les anciens suivis ne sont pas recertifiés. Pas de test orchestrant précisément un archivage concurrent pendant le verrou du cours dans ce lot. Validation des anciennes périodes hors bornes et revue complète des règles restent à approfondir. Aucun suivi/cours métier réel modifié, aucun e-mail ni recette navigateur. Objectif global non achevé.

- Validation/déploiement lot263 : 460 tests / 109 fichiers, image/smoke Docker/restauration validés (/tmp/raero-lot263-{tests,docker,smoke}.log), aperçu remplacé avec volumes conservés, before263 arrêté. Index Tailscale HTTP 200 conforme, session antérieure/no-store vérifiés. Pas de migration ni exécution de règles sur les données métier.


### Lot 264 — visibilité des cours associés aux règles

- Tour précédent classé progression : contrôle des cibles avant nouveaux suivis, testé et déployé. Inspection getRoleRequirements : chargement de toutes les règles actives avant filtre JS puis lecture de toutes les colonnes du cours sans condition de propriétaire. Une règle ancienne mal rattachée pouvait renvoyer un cours d’une autre compagnie.
- Filtre SQL règles globales/de la compagnie et actives, tri stable par id. Jointure cours autorisée pour cours public publié/non archivé ou cours appartenant à la compagnie consultée ; titre d’un cours étranger/retiré du public non renvoyé. Règle conservée avec training:null pour permettre son examen/archivage. Projection cours limitée id/title/isPublished/archivedAt, sans corps pédagogique/propriétaire/tarifs/métadonnées internes. Plus de N+1 ni faux vide si getDb absent.
- Route : contrôle requireManagedCompany aussi pour admin ayant une compagnie sélectionnée ; admin sans compagnie conserve la lecture globale. UI affiche une indication de formation indisponible si jointure absente ou cours propre non publié/archivé, avec invitation à revoir le programme/la règle. Pas d’archivage automatique.
- Nouveau test PostgreSQL : périmètre compagnie/global, règle étrangère exclue, règle globale vers cours étranger masquée, cours public/propre/archivé propre avec projection exacte, cours public retiré masqué, aucune chaîne de contenu étranger dans la réponse, règle archivée exclue. Quatre tests ciblés, TypeScript/build passent ; /tmp/raero-lot264-{focused,check,build}.log.
- Limites : liste des règles non paginée, libellés historiques de règles déjà autorisées restent visibles ; pas d’audit des données libres qu’ils contiennent. Pas de remise en état des anciennes associations, pas de nouvelle autorisation par rôle d’auteur à l’intérieur d’une compagnie. Aucun accès métier réel modifié et aucune recette navigateur. Objectif global non achevé.

- Validation/déploiement lot264 : 461 tests / 110 fichiers, image/smoke Docker/restauration validés (/tmp/raero-lot264-{tests,docker,smoke}.log), aperçu remplacé avec volumes conservés, before264 arrêté. Index Tailscale HTTP 200 conforme, session antérieure/no-store vérifiés. Pas de migration ni mutation des règles métier.


### Lot 265 — périodes anciennes invalides dans les règles

- Tour précédent classé progression : visibilité cloisonnée des cours associés, testée et déployée. Relecture de roleRequirementInput, addCalendarMonths et runTNA : création de règle limitée à 1..120 mois, mais ancien enregistrement pouvant encore atteindre le calcul sans revalidation. addCalendarMonths accepte volontairement les mois négatifs pour ses autres usages.
- Lorsqu’un suivi manque, validation de toutes les périodes du groupe via le même schéma que la saisie avant contrôle des conflits/calcul des dates. Erreur PRECONDITION_FAILED avec références de règle/formation pour valeur invalide ; transaction entière annulée. Pas de changement au helper calendrier générique.
- UI : indique les règles hors plage lors de la lecture et rend l’erreur explicite à l’exécution, FR/EN/AR. Limite 1..120 décrite comme technique, pas réglementaire. Suivis existants conservés ; correction proposée par revue/archivage/remplacement de règle, sans écrasement automatique.
- Nouveau cas PostgreSQL : périodes 0, -1, 121 et maximum SQL, erreur ciblée et absence d’ajout partiel, conservation des suivis historiques, reprise sans nouvel ajout après archivage. Six tests ciblés, TypeScript/build passent ; /tmp/raero-lot265-{focused,check,build}.log.
- Limites : revalidation seulement avant création d’un suivi manquant, pas d’audit/réécriture de toutes les anciennes échéances ; aucune détermination de période métier appropriée. Références dans les erreurs serveur restent françaises avec explication UI trilingue, comme les erreurs précédentes. Aucun suivi/règle métier réel modifié, aucune recette navigateur. Objectif global non achevé.

- Validation/déploiement lot265 : 462 tests / 110 fichiers, image/smoke Docker/restauration validés (/tmp/raero-lot265-{tests,docker,smoke}.log), aperçu remplacé avec volumes conservés, before265 arrêté. Index Tailscale HTTP 200 conforme, session antérieure/no-store vérifiés. Pas de migration ni exécution de règles sur les données métier.


### Lot 266 — préparation de la recette fournisseur et accès local

- Tour précédent : progression, disponibilité concrète de l’aperçu confirmée pour la demande utilisateur (conteneur healthy, transfert Tailscale actif, HTTP 200). L’application est déjà lancée ; aucun redémarrage nécessaire.
- Relecture de la gouvernance, de la matrice opérationnelle, du relevé fournisseur horodaté et des services Stripe/webhooks, abonnements, SMTP, vidéo privée, vidéo IA et identité de facture. Le relevé docs/provider-status-lot266.json indique Stripe/webhook, SMTP, texte/image/voix IA et variables initiales JaaS/émetteur absents au moment indiqué ; pas de nouvelle lecture des secrets ni de nouvelle mesure fournisseur dans cette reprise.
- Nouveau docs/provider-acceptance.md : préconditions et résultats attendus pour paiement, rejeu, refus, remboursement, abonnements, e-mails, création IA interne/B2B, classe à deux participants et factures. Dossier de preuve lié à une version ; tous les scénarios réels restent non exécutés. La configuration vidéo IA nécessite une vérification distincte des indicateurs texte/image/voix.
- Écarts conservés explicitement : outbox générale, révocation fournisseur effective, politiques commerciales et corrections de facturation. Configuration de recette demandée précédemment, réponse non disponible à la rédaction ; aucun nouvel envoi de question.
- Vérification documentaire : JSON lisible, liens relatifs du protocole présents. Aucun code applicatif changé, aucun test logiciel relancé, aucun déploiement, message externe, paiement, génération ou appel vidéo réalisé. Objectif global toujours non achevé.


### Lot 267 — récupération de mot de passe sans faux succès

- Tour précédent classé progression documentaire : protocole fournisseur concret créé, scénarios encore non exécutés. Relecture Login et routes de récupération : le client annonçait le même succès sur erreur réseau et succès API ; le serveur répond volontairement de façon neutre, notamment sans SMTP.
- Login distingue désormais demande reçue et réponse non confirmée. Message persistant, FR/EN/AR, sans révéler l’existence du compte ni affirmer la réception du mail. Le formulaire reste accessible pour réessayer, avec invitation à consulter la boîte avant nouvelle demande. Introduction corrigée et traduite en arabe.
- Verrou immédiat contre double soumission ; champ et retour désactivés pendant la requête ; adresse normalisée par trim ; suppression de l’origine cliente inutile, l’origine serveur reste inchangée. Étiquette liée au champ et état aria-busy, résultat status/alert. Pas de changement aux jetons, au serveur, au SMTP ou à la connexion/2FA.
- TypeScript, trois tests de langues et build passent. Dernière retouche des textes suivie d’une nouvelle vérification langues/build. Journaux /tmp/raero-lot267-{check,locales,build,docker}.log. Bundle serveur identique au conteneur avant copie (3ecce2d0275a3eb87a18943064671b58f3516250cff11cf3aca3b76cc8ae12e9). Image reconstruite, fichiers publics actualisés sans redémarrage ; HTTP 200 et index Tailscale identique au build.
- Limites : aucune recette navigateur, récupération réelle ou réception SMTP testée ; suite serveur complète non relancée pour ce changement client seul. La neutralité API ne prouve toujours pas l’envoi, et la relance volontaire reste soumise au throttling serveur existant. Aucun e-mail envoyé ni compte métier modifié. Objectif global non achevé.


### Lot 268 — confirmation durable du changement de mot de passe

- Tour précédent classé progression : demande de récupération corrigée et déployée. Relecture ResetPassword, contrat de route, consommation atomique du jeton et nettoyage du cache de session. L’interface précédente ne gardait pas les erreurs et redirigeait automatiquement après 1,5 seconde.
- Confirmation de succès conservée avec retour connexion déjà présent ; suppression du temporisateur. Champs effacés au succès, cache/session toujours nettoyés. Erreur persistante trilingue expliquant l’incertitude et la vérification par connexion/nouveau lien, sans exposer un message serveur brut.
- Verrou immédiat contre double soumission, champs désactivés pendant la requête, bornes de longueur alignées avec la route, étiquettes associées aux champs, aria-busy et annonces status/alert. Contrôle de longueur du jeton avant affichage du formulaire ; aucune prétention de valider son expiration côté client. Messages de cette page traduits en arabe.
- TypeScript, trois tests de langues et build réussis ; journaux /tmp/raero-lot268-{check,locales,build,docker}.log. Bundle serveur inchangé (3ecce2d0275a3eb87a18943064671b58f3516250cff11cf3aca3b76cc8ae12e9), image reconstruite et fichiers publics copiés sans redémarrage. HTTP Tailscale 200 et index identique au build.
- Limites : aucune recette navigateur ni consommation réelle de jeton sur l’aperçu ; suite serveur non relancée pour ce changement client seul. Traitement serveur des erreurs et mécanisme de récupération inchangés. Aucun e-mail envoyé ni mot de passe métier modifié. Objectif global non achevé.


### Lot 269 - Erreurs publiques de reinitialisation

- Tour precedent : progression, confirmation durable du changement de mot de passe livree. Inspection auth.resetPassword : err.message exposait toutes les exceptions comme BAD_REQUEST, y compris des details techniques potentiels.
- InvalidPasswordResetTokenError identifie les deux refus de jeton existants. La route retourne un BAD_REQUEST fixe pour cette classe seule ; les autres exceptions deviennent INTERNAL_SERVER_ERROR avec texte fixe et sans cause jointe. Hash, consommation atomique et revocation de session inchanges.
- Deux nouveaux tests de frontiere : exception typee, panne avec marqueurs sensibles, erreur ordinaire imitant le texte metier et rejet null. Test PostgreSQL renforce sur le type et le refus API du rejeu. 18 tests cibles, TypeScript et build passent.
- Premiere suite a quatre workers : 463 succes et un timeout de 5 s dans privacySupport.integration.test.ts. Reprise ciblee : deux succes en 3,08 s. getAdminTickets effectue une lecture globale puis une requete utilisateur par ticket ; causalite exacte du timeout non mesuree. Aucun timeout modifie ou test retire. Suite complete a un worker : 464 tests / 111 fichiers passent en 65,10 s. Performance de la liste support a corriger separement.
- Journaux /tmp/raero-lot269-{focused,check,build,tests,privacy-recheck,tests-recheck,docker,smoke}.log. Image et smoke Docker avec sauvegarde/restauration passent. Conteneur remplace avec volumes conserves, before269 arrete. Index Tailscale HTTP 200 conforme au build, ancienne session admin/no-store verifies, cookie temporaire supprime. Pas de migration.
- Le premier script de verification post-deploiement a echoue sur un encodage Python avant execution ; script ASCII corrige execute avec succes. Aucun test navigateur, aucune panne technique reelle provoquee sur l'apercu, aucun mot de passe metier modifie, aucun e-mail envoye. Audit des autres routes non couvert. Objectif global non acheve.


### Lot 270 - Lecture groupee des tickets administrateur

- Tour precedent : progression, erreurs publiques de reset assainies et deployees ; timeout de privacySupport observe, puis suite verte en execution sequentielle. Relecture getAdminTickets : une lecture globale et une lecture utilisateur par ticket.
- Remplacement par une jointure gauche en une seule requete SQL, projection auteur limitee a name/email, forme de reponse conservee. Ordre updatedAt descendant puis id descendant pour les dates identiques. Base absente : erreur explicite au lieu de faux tableau vide. Aucun changement aux droits admin ni aux conversations.
- Nouveau test PostgreSQL : plusieurs auteurs, identite nulle, ordre stable, projection exacte sans hash/openId/role ; compteur select verifie une seule requete pour la liste. Quatre tests cibles passent, dont privacySupport et supportAccess. TypeScript/build passent.
- Suite a quatre workers : 465 tests / 112 fichiers passent en 21,48 s, sans timeout sur cette execution. Ce resultat ne constitue pas un benchmark de charge. Journaux /tmp/raero-lot270-{focused,check,build,tests,docker,smoke}.log. Image et smoke Docker avec sauvegarde/restauration valides.
- Apercu remplace avec volumes conserves ; before270 arrete. HTTP Tailscale 200, index conforme, ancienne session admin/no-store et forme de support.adminList verifies sans afficher de contenu. Cookie temporaire supprime. Aucun ticket metier modifie, aucun envoi externe.
- Limites : liste toujours non paginee, volume de reponse non borne ; erreurs de liste dans le client a revoir. Jointure gauche conserve les tickets sans auteur, mais aucun cas d'auteur orphelin injecte dans ce test. Pas de recette navigateur ou charge concurrente mesuree. Objectif global non acheve.


### Lot 271 - Pagination et recherche des demandes support

- Tour precedent : progression, suppression du N+1 et deploiement verifies. Relecture liste support : reponse encore non bornee, absence de filtres serveur et confusion client entre echec et vide.
- Nouveau schema strict supportListInput : beforeId entier SQL positif, statut OPEN/PENDING/CLOSED optionnel, recherche trim bornee a 255 caracteres. Une requete jointe, recherche litterale insensible a la casse dans sujet/nom/email, filtre statut et id, limite 51 pour retourner 50 entries et nextBeforeId. Aucun contenu de conversation recherche ou ajoute.
- Tri par id descendant (creation), abandon du tri par activite pour eviter les deplacements dus aux reponses pendant la pagination ; explication visible FR/EN/AR. API adminList passe du tableau a {entries,nextBeforeId}, consommateurs connus et tests adaptes. Pas de mode tableau non borne conserve.
- Client : recherche et statut remettent le curseur au debut ; page suivante et actualisation depuis le debut, fermeture du fil lors du changement de vue. Chargement/erreur/vide distingues ; donnees cachees masquees sur erreur, bouton reessayer. Dates localisees, statut etiquete et desactive pendant refetch.
- Tests SQL : une requete/projection conservees, 55 tickets sur deux pages, nouvelle arrivee exclue des pages suivantes, absence de doublons, filtre statut, recherche sujet/nom/email, casse/trim/symboles %_ litteraux, vide et saisies invalides. Fixture privacySupport isolee par recherche auteur unique pour ne pas dependre de l'activite d'autres workers. Huit tests cibles puis 466 tests / 112 fichiers a quatre workers passent. TypeScript/build valides.
- Journaux /tmp/raero-lot271-{focused,check,build,tests,docker,smoke}.log. Image et smoke Docker avec sauvegarde/restauration passent. Apercu remplace, volumes conserves, before271 arrete. HTTP Tailscale 200, index conforme, ancienne session admin/no-store et contrat pagine verifies sans afficher de contenu. Cookie temporaire supprime.
- Limites : pagination sur donnees vivantes, pas de snapshot historique ; changement de statut ou d'identite peut modifier l'appartenance aux filtres. Recherche sans index specialise, pas de benchmark de charge ni recette navigateur/RTL. Liste personnelle et historique de conversation hors ce lot. Aucun ticket metier modifie, aucun message envoye. Objectif global non acheve.


### Lot 272 - Demandes support cote utilisateur

- Tour precedent : progression, pagination/recherche administrateur testees et deployees. Relecture Support : formulaire modifiable pendant envoi, notification seulement temporaire, erreurs de liste confondues avec liste vide, chargement auth affiche comme visiteur.
- Etats auth/loading/error/visiteur distingues. Liste avec erreur persistante, cache masque sur erreur et actualisation explicite. Dates localisees et bouton de fil aria-expanded/text-start. Liste personnelle toujours non paginee.
- Formulaire natif et validation via supportRequestInput existant ; champs etiquetes, bornes et desactivation pendant requete, verrou immediat contre double soumission. Message de creation non confirmee conserve le brouillon et invite a verifier la liste avant renvoi. Succes avec reference persistante et ouverture du fil apres invalidation. Messages FR/EN/AR.
- Pas de nouvel identifiant de deduplication serveur : un renvoi volontaire peut encore creer une autre demande ; aucune relance automatique ajoutee. Brouillon uniquement en memoire de la page, pas de persistance apres rechargement/navigation. Aucun comportement d'effacement automatique pour les demandes de confidentialite.
- TypeScript, trois tests de langues et build passent ; /tmp/raero-lot272-{check,locales,build,docker}.log. Bundle serveur identique au conteneur (067e006a0961a4a33f74db0ef70f3a86625acb4984c64ed94cc43f7c4e37a518). Image reconstruite, fichiers publics copies sans redemarrage ; HTTP Tailscale 200 et index identique au build.
- Suite serveur complete et smoke non repetes pour changement client seul. Aucune recette navigateur, aucun ticket metier cree/modifie, aucun message externe envoye. Fil de conversation et pagination personnelle a traiter separement. Objectif global non acheve.


### Lot 273 - Conversation support et envoi incertain

- Tour precedent : progression, formulaire support utilisateur et erreurs de lecture corriges/deployes. Relecture TicketThread et route reply : champ modifiable pendant mutation, Enter pouvait soumettre a nouveau, erreur de lecture affichee comme conversation vide. Notification serveur apres insertion peut laisser une reponse incertaine.
- Fil avec etats chargement/erreur/vide distincts, cache masque en erreur et bouton de reprise. Saisie et envoi desactives pendant mutation et sans lecture valide. Verrou immediat, Enter preventDefault avec respect de composition IME, limite 10000 alignee avec la route. Champ et bouton iconique etiquetes.
- Texte efface seulement apres succes, erreur persistante FR/EN/AR avec actualisation pour verifier avant renvoi. Invalidation attendue avant fin de mutation. Historique de statut dispose aussi d'une reprise en erreur. Dates localisees, marge logique RTL, fond du message propre corrige en oklch avec alpha valide (ancienne concatenation 22 invalide).
- TypeScript, trois tests de langues et build passent ; journaux /tmp/raero-lot273-{check,locales,build,docker}.log. Bundle serveur inchange (067e006a0961a4a33f74db0ef70f3a86625acb4984c64ed94cc43f7c4e37a518). Image reconstruite et fichiers publics actualises sans redemarrage. HTTP Tailscale 200, index conforme au build.
- Limites : pas de deduplication serveur ni garantie de livraison SMTP ajoutee, renvoi volontaire peut dupliquer ; brouillon perdu si fermeture du fil/navigation. Historique de messages non pagine, polling existant conserve. Pas de recette navigateur, aucun message reel envoye, suite serveur/smoke non repetes pour changement client seul. Objectif global non acheve.


### Lot 274 - Reprise des reponses support sans doublon

- Tour precedent : progression, fil support avec erreurs/reprise et protection locale livre. Relecture postTicketMessage : insertion atomique mais aucun identifiant de reprise. Les helpers SMTP avalent deja leurs erreurs ; une reponse HTTP perdue reste un cas d'incertitude.
- Nouveau supportMessageInput strict (ids SQL, contenu trim 1..10000, UUID optionnel normalise). Migration 20260913_support_message_requests.sql : ledger UUID primaire, message unique lie par FK, empreinte auteur/ticket/texte et date ; trigger interdit UPDATE/DELETE/TRUNCATE. Aucun texte ou secret duplique dans le ledger.
- Transaction : verrou UUID avant controles participant actuels, empreinte canonique, rejeu identique retourne le message sans modifier updatedAt ; reuse changee refusee CONFLICT. Message, date du ticket et ledger atomiques. Droits revalides sur rejeu. Anciens appels sans UUID conservent leur insertion sans deduplication.
- Route reply preserve la forme publique du message et saute les notifications sur rejeu. Interface conserve le meme UUID pour la reprise du texte inchange dans le meme fil ; changement de texte/ticket cree une autre reference et succes efface la reference. Pas de persistance apres fermeture/rechargement.
- Tests PostgreSQL : concurrence (une insertion), normalisation UUID/trim, rejets texte/ticket/auteur differents, compte suspendu, date conservee au rejeu, ledger immuable, bornes invalides. Test rollback existant renforce avec absence de ledger. Test route : meme message au rejeu et un seul appel SMTP simule ; aucun envoi reel. Quatre tests cibles, TypeScript/build puis 468 tests / 112 fichiers passent.
- Journaux /tmp/raero-lot274-{focused,check,build,tests,docker,smoke}.log. Image/migration/smoke/restauration valides. Apercu remplace avec volumes conserves, before274 arrete. HTTP Tailscale 200 et index conforme, ancienne session admin/no-store verifies, cookie temporaire retire.
- Limites : pas d'outbox generale, notification perdue non reprise automatiquement ; ledger garantit le message et non la livraison SMTP. Creation de ticket non dedupliquee, ancien client sans UUID non protege. Aucun test navigateur, aucun message metier envoye. Objectif global non acheve.


### Lot 275 - Creation de demandes support sans doublon

- Tour precedent : progression, deduplication des reponses support testee/deployee. Relecture createSupportTicket : ticket/message initial/historique deja atomiques, creation encore repetee sur renvoi apres perte de reponse.
- supportRequestInput accepte UUID optionnel normalise. Migration support_creation_requests : reference primaire, ticket unique FK, empreinte auteur/sujet/message/type/priorite et date ; trigger interdit modification/suppression/truncate. Verrou UUID avant verification actuelle du compte actif.
- Rejeu identique retourne le ticket actuel sans reinitialiser son traitement, creer message/evenement ou modifier sa date. Empreinte normalise trim, priorite normale par defaut et message vide/absent. Reutilisation pour un autre auteur ou contenu refusee ; compte suspendu refuse meme au rejeu. Ledger atomique avec creation.
- Route retire le drapeau interne replayed et saute la notification sur reprise ; reponse publique conservee. Formulaire garde la reference pour le contenu inchange tant que la page reste ouverte, la renouvelle pour un contenu different et l'efface apres succes. Anciens appels sans UUID restent sans deduplication.
- Tests SQL : creations simultanees avec UUID casse differente, une demande/un message/un evenement, traitement PENDING conserve, changements de champs/auteur refuses, suspension, immutabilite. Route : une notification simulee, reponse identique sans drapeau et UUID invalide refuse. Rollback de message initial verifie aussi absence de ledger.
- Premier ciblage : 8 passes/1 echec car supportHistory comparait le resultat interne enrichi a la ligne SQL ; test adapte pour exclure replayed, comparaison exacte des champs du ticket conservee. Reprise : 9 tests ciblages passes. TypeScript/build puis 470 tests / 113 fichiers passent. Journaux /tmp/raero-lot275-{focused,focused-recheck,check,build,tests,docker,smoke}.log.
- Image/migration/smoke Docker avec sauvegarde/restauration valides. Apercu remplace avec volumes conserves, before275 arrete. HTTP Tailscale 200/index conforme, ancienne session admin/no-store verifies ; cookie temporaire supprime. Aucun ticket metier cree, aucun e-mail reel envoye.
- Limites : reference client non persistante apres rechargement/navigation ; notifications sans outbox, livraison non garantie. Aucun rapprochement retroactif des doublons historiques ni suppression. Pas de recette navigateur. Objectif global non acheve.


### Lot 276 - Selection explicite de l'inscription dans le lecteur

- Tour precedent : progression, deduplication creation support livree. Retour au parcours apprenant : Dashboard liait chaque inscription au seul slug, LearningPlayer prenait la premiere inscription de ce slug. Deux inscriptions au meme cours pouvaient donc ouvrir le meme parcours malgre une selection differente.
- Liens Dashboard avec parametre enrollment=id. Selecteur client valide entier SQL positif, refuse parametre duplique/malforme, id absent ou slug different sans repli vers une autre inscription. Ancien lien sans id accepte seulement si une seule inscription correspond ; sinon retour explicite vers Mes inscriptions, FR/EN/AR.
- Cle du composant lecteur inclut la recherche URL reactive (useSearch) en plus du compte/slug, pour ne pas reutiliser resultats et reponses locaux entre inscriptions. Les appels existants continuent de transmettre enrollment.id et la version epinglee fournie dans cette inscription. Controle serveur des droits inchange.
- Deux tests de selection : inscriptions meme slug avec versions distinctes, ordre de liste indifferent, ancien lien unique/ambigu, id et slug incoherents, id absent, bornes, fraction/exposant/zero prefixe et parametres doubles. Cinq tests cibles avec langues passent, TypeScript/build valides ; /tmp/raero-lot276-{focused,check,build,docker}.log.
- Bundle serveur identique au conteneur (3aeb8828f857aa86d3eafd52af63f3ebcc9051bb7fa90e3b281e624274d1bc8e). Image reconstruite, fichiers publics copies sans redemarrage. HTTP Tailscale 200/index conforme. Pas de migration ni mutation d'inscription/examen.
- Limites : tests purs de selection, pas de parcours navigateur avec deux inscriptions ni de nouveau test d'examen serveur ; suite serveur/smoke non repetes pour code client seul. La cle change sur toute modification de recherche URL, pas uniquement du parametre enrollment. Aucun examen ou certificat metier cree. Objectif global non acheve.


### Lot 277 - Deux inscriptions du meme apprenant, deux versions

- Tour precedent : progression, selection explicite enrollment dans le lecteur et liens Dashboard deployes. Inspection des appels learning : enrollmentId transmis pour chapitres/slides/questions/progression/tentatives. Le test de versions existant utilisait deux utilisateurs differents.
- Test PostgreSQL makerAccess enrichi : nouvelle inscription du meme utilisateur sur version suivante, lecture dashboard puis selecteur client reel avec les deux ids, langues/version/contenu des chapitres et slides distincts, questions sans correction exposee et ancien lien ambigu refuse.
- Apres reussite de l'ancienne inscription : nouvelle inscription sans tentative ni objectif valide, examen final refuse avant prerequis ; tentative de chapitre commence a 1, session soumise sous l'ancienne inscription refusee, soumission sous la bonne inscription reussit. Le chapitre ajoute dans la nouvelle version reste requis pour acceder au final.
- 13 tests cibles passes (11 makerAccess et 2 learningEnrollment), TypeScript passe ; /tmp/raero-lot277-{focused,check}.log. Aucun code applicatif ou migration modifie, aucun deploiement ou build necessaire. La suite complete historique du lot275 ne devient pas une preuve fraiche globale.
- Limites : scenario API/services PostgreSQL avec selecteur pur, pas de navigation navigateur ou controle du remontage React. Utilisation de fixtures isolees, aucune inscription/examen/certificat metier modifie. Objectif global non acheve.


### Lot 278 - Reprise des lectures avant examen

- Tour precedent : progression, verification PostgreSQL de deux inscriptions/versions pour le meme apprenant. Inspection du lecteur : actualisation de progression couverte par le bandeau global ; ChapterAssessment ne signalait pas toutes les erreurs de relecture si une ancienne copie existait, et ExamEntry ne bloquait le demarrage que pour les erreurs d'historique.
- Chapitre : bandeau de relecture en erreur meme avec donnees precedentes (y compris chapitre deja reussi ou sans questions), reprise questions et tentatives. Entree chapitre et final (deux modes lecteur) prend en compte erreur/chargement des deux requetes avant nouveau demarrage. Libelle FR/EN/AR mentionne questions ou tentatives.
- Le composant ExamEntry conserve son etat started et QuizView durant une erreur de rafraichissement avec cache present ; aucune nouvelle logique de minuterie, soumission ou correction. Le bandeau signale la lecture incertaine sans remplacer un examen actif par un ecran de chargement.
- TypeScript, trois tests de langues et build passent ; /tmp/raero-lot278-{check,locales,build,docker}.log. Bundle serveur identique (3aeb8828f857aa86d3eafd52af63f3ebcc9051bb7fa90e3b281e624274d1bc8e). Image reconstruite et fichiers publics copies sans redemarrage ; HTTP Tailscale 200, index conforme.
- Limites : preservation du composant deduite de sa structure React, pas de simulation navigateur de coupure reseau ni test visuel. Pas de changement serveur, suite complete et smoke non repetes. Aucun examen ou suivi metier modifie. Objectif global non acheve.


### Lot 279 - Pagination du support personnel

- Tour precedent : progression, reprise des lectures de QCM livree. Consultation support personnelle encore non bornee ; reprise du chantier de consultation apres pagination admin.
- getMyTickets valide supportListInput, relit/verrouille en partage le compte actif, filtre obligatoirement userId puis statut/recherche litterale sur sujet/curseur id, limite 51 pour 50 entries et nextBeforeId. Erreur explicite si base indisponible. API myList change du tableau vers la page, tous consommateurs connus adaptes.
- UI : recherche objet et statut, pages anciennes, actualisation depuis debut, ordre de creation indique FR/EN/AR. Changement de filtres/page ferme le fil ; succes creation remet filtres/page au debut pour retrouver la nouvelle demande. Verification apres creation incertaine remet aussi toute la liste a zero. Etat sans correspondance distingue du vide sans filtre.
- Nouveau test SQL via API : 55 tickets, autre utilisateur exclu, nouvelle arrivee non dupliquee sur page suivante, statut/casse/trim/symboles litteraux, absence de resultat, curseur invalide et tentative d'injection userId refuses, compte suspendu refuse malgre contexte ancien. Six tests cibles, TypeScript/build puis 473 tests / 115 fichiers passent.
- Journaux /tmp/raero-lot279-{focused,check,build,tests,docker,smoke}.log. Image/smoke/restauration valides. Apercu remplace, volumes conserves, before279 arrete. HTTP Tailscale 200/index conforme, ancienne session admin/no-store et contrat personnel pagine verifies sans afficher de demandes. Cookie temporaire retire.
- Limites : pagination vivante, changements de statut/sujet peuvent modifier les resultats filtres ; pas de recherche dans conversations ni de snapshot/export global. Pas de recette navigateur ni benchmark volumetrique. Aucun ticket metier modifie, aucun message envoye. Objectif global non acheve.


### Lot 280 - Droits transactionnels de creation des regles

- Tour precedent : progression, pagination support personnel testee et deployee. Relecture createRoleRequirement : cours verrouille et verifie, mais controle du responsable/compagnie uniquement en amont de la transaction.
- Identifiant acteur obligatoire au service. Relecture en partage du compte actif et correspondance exacte de la compagnie selectionnee ; compagnie active verrouillee, affiliation MANAGER ACTIVE verrouillee pour non-admin. Global seulement admin sans compagnie. Ces verrous et le controle cours couvrent la transaction d'insertion.
- Route transmet ctx.user.id ; controle amont conserve. Fixtures directes fournissent un acteur reel. Nouveau test : creation autorisee puis retrait affiliation, changement compagnie, suspension compte, compagnie suspendue meme pour admin, global non-admin refuses ; une seule regle persiste. Aucun changement aux periodes ou au calcul des suivis.
- Dix tests cibles passes, TypeScript/build puis 474 tests / 115 fichiers passent. Journaux /tmp/raero-lot280-{focused,check,build,tests,docker,smoke}.log. Image et smoke avec sauvegarde/restauration valides.
- Apercu remplace avec volumes conserves, before280 arrete. HTTP Tailscale 200/index conforme, session admin anterieure/no-store verifies, cookie temporaire supprime. Pas de migration, aucune regle ou echeance metier modifiee.
- Limites : test de changements de droits avant appel service, pas d'orchestration d'une revocation concurrente en attente du verrou ni benchmark de contention. Creation toujours sans auteur historise/identifiant de deduplication propre. Autres mutations non auditees globalement. Aucune recette navigateur. Objectif global non acheve.


### Lot 281 - Auteur des nouvelles regles de recurrence

- Tour precedent : progression, droits de creation transactionnels testes/deployes. Inspection role_requirements : createdAt present, auteur uniquement pour archivage.
- Migration 20260913_role_requirement_creator.sql ajoute createdBy nullable avec FK users, sans attribution retroactive. Creation applicative fixe createdBy a l'acteur revalide dans la transaction ; aucun auteur fourni par le client utilise. Trigger protect_role_requirement existant couvre ce champ dans la comparaison globale immuable.
- Liste active expose le champ via sa projection existante ; historique ajoute createdBy/createdAt. UI FR/EN/AR affiche compte et date de creation si connus, sinon auteur non enregistre. Archivage conserve son attribution distincte. Pas de nom historique invente.
- Nouveau test SQL : auteur createur distinct de l'archiveur, lecture active/historique, tentative de changement d'auteur en meme temps que l'archivage refusee, effacement apres archivage refuse, auteur null conserve pour une ligne sans attribution. Neuf tests cibles, TypeScript/build puis 475 tests / 115 fichiers passent.
- Journaux /tmp/raero-lot281-{focused,check,build,tests,docker,smoke}.log. Migration/image/smoke/restauration valides. Apercu remplace avec volumes conserves, before281 arrete. HTTP Tailscale 200/index conforme, session admin anterieure/no-store verifies, cookie temporaire supprime.
- Limites : attribution a un identifiant de compte, pas de signature ni de validation pedagogique ; insertion SQL directe peut encore omettre l'auteur pour compatibilite des archives. Pas de reconstitution historique, pas de deduplication creation de regle, aucune recette navigateur. Aucun changement de definition ou echeance metier, aucun message externe. Objectif global non acheve.


### Lot 282 - Confirmation d'archivage des regles

- Tour precedent : progression, auteur de creation trace/teste/deploye. Relecture UI compagnie : erreurs persistantes et refetch deja presents, mais archivage declenche directement au clic malgre absence de reactivation.
- Confirmation native precise reference/libelle/portee, arret des nouveaux suivis, conservation des echeances et remplacement par nouvelle regle si besoin. Verrou immediat contre clics multiples ; bouton desactive pendant mutation. Succes conserve la reference archivee dans un message status, refetch existant toujours attendu. Textes FR/EN/AR.
- Premier script d'edition refuse par Python pour encodage avant toute modification ; edition appliquee par patch puis JSON verifie. TypeScript, trois tests de langues et build passent ; /tmp/raero-lot282-{check,locales,build,docker}.log.
- Bundle serveur identique au conteneur (c9a5765ba534428e2cd5b8b48883fbf278e1d1d74679468562ee634a962d7987). Image reconstruite, fichiers publics copies sans redemarrage ; HTTP Tailscale 200/index conforme. Pas de migration ni modification de regle metier.
- Limites : confirmation native navigateur, aucune recette visuelle/interaction effectuee, aucun archivage reel declenche. Suite serveur et restauration non repetees pour modification client seule. Confirmation ne remplace pas les droits serveur. Objectif global non acheve.


### Lot 283 - Images pedagogiques completes et erreurs de chargement

- Tour precedent : progression, confirmation d'archivage des regles livree. Inspection SlideDeck : image avec object-cover et hauteur plafonnee pouvant recadrer les annotations d'un schema, aucun retour explicite en cas d'echec de chargement.
- Nouveau LearningImage utilise object-contain, conserve alt/titre et plafond de hauteur. Erreur native masque l'image cassee et affiche une explication FR/EN/AR avec reprise explicite ; reprise remonte l'element image a la meme URL, sans modifier le media ni ajouter un parametre URL. Etat isole par cle diapositive/source.
- SlideDeck utilise le composant dans les parcours qui rendent une image. Priorite video/image existante conservee. Aucun changement aux QCM, progression, fichiers ou droits serveur.
- TypeScript, trois tests de langues et build passent ; /tmp/raero-lot283-{check,locales,build,docker}.log. Bundle serveur identique (c9a5765ba534428e2cd5b8b48883fbf278e1d1d74679468562ee634a962d7987). Image reconstruite et fichiers publics copies sans redemarrage. HTTP Tailscale 200/index conforme.
- Limites : pas de recette visuelle sur schemas reels ni erreur reseau simulee dans navigateur ; tailles, lisibilite et textes alternatifs des contenus administrables non audites. Pas de zoom ou reparation du media distant ; autres images hors SlideDeck non modifiees. Suite serveur/smoke non repetes pour changement client seul. Objectif global non acheve.


### Lot 284 - Verification concurrente des droits de creation

- Tour precedent : progression, images pedagogiques non recadrees et reprise de chargement livrees. Retour sur limite explicite du lot280 : verrous de droits presents mais aucune revocation orchestree pendant insertion.
- Nouveau test PostgreSQL suspend la creation juste avant insertion par un verrou consultatif de fixture, puis observe effectivement son attente dans pg_locks. Quatre modifications concurrentes (compte, compagnie, affiliation et publication du cours) echouent avec lock_timeout 55P03 pendant cette attente.
- Apres liberation, creation reussie avec auteur attendu ; revocation de l'affiliation reussie, puis nouvelle creation refusee, une seule regle conservee. Trigger/fonction de fixture et connexion de controle nettoyes en finally. Aucune modification du code applicatif.
- Douze tests cibles (six archivage/creation, six TNA) et TypeScript passent ; /tmp/raero-lot284-{focused,check}.log. Pas de build/deploiement necessaire pour ce test seul ; apercu conserve au code du lot283.
- Limites : exercice determine d'une transaction sur base isolee, pas de preuve exhaustive de toutes interleavings ni benchmark de contention. Les operations sont ordonnees : une creation deja engagee termine avant la revocation, qui bloque les suivantes. Aucune affiliation/formation/regle metier modifiee. Objectif global non acheve.


### Lot 285 - Apercu des salaries correspondant a une regle

- Tour precedent : progression, verification concurrente des droits de creation. Inspection formulaire : criteres saisis sans visualisation des salaries correspondants, alors que les employes autorises sont deja charges.
- Predicate ruleMatchesEmployee extrait dans shared/roleMatching et reexporte depuis db pour ses consommateurs ; logique conservee (sous-chaine insensible a la casse, poste OU licence, aucun critere signifie tous). Meme fonction pour runTNA et apercu. Types de champs explicites remplaçant any.
- Formulaire valide normalise par le schema existant avant comptage, employes actifs uniquement comme runTNA. Nombre et liste repliable des 20 premiers noms/ids/postes, nombre restant. Pendant relecture employes, apercu remplace par chargement ; erreur principale existante masque la vue. Textes FR/EN/AR precisent donnees chargees, absence de validation de competence/inscription et distinction avec nouveaux suivis.
- Test partage : OR, casse, trim via schema, absence de criteres, champs absents, symboles litteraux. Dix tests cibles, TypeScript/build puis 477 tests / 116 fichiers passent. Journaux /tmp/raero-lot285-{focused,check,build,tests,docker,smoke}.log. Image/smoke/restauration valides.
- Apercu remplace avec volumes conserves, before285 arrete. HTTP Tailscale 200/index conforme, session admin anterieure/no-store verifies, cookie temporaire retire. Aucune regle ou echeance metier creee.
- Limites : apercu local des salaries charges, pas de simulation de tous conflits de regles ni calcul des suivis manquants ; modifications concurrentes peuvent changer le resultat d'execution serveur. La liste des employes reste non paginee. Aucun test navigateur. Objectif global non acheve.


### Lot 286 - Chevauchements de periodes dans l'apercu de regle

- Tour precedent : progression, apercu des salaries correspondants livre. Ajout d'une comparaison du brouillon avec les regles actives deja chargees et autorisees pour la compagnie.
- Helper rolePeriodOverlaps reprend le predicate partage, ne considere que salaries actifs, meme formation, periode differente et intersection non vide des criteres. Regles archivees, cours differents, periodes egales et groupes disjoints exclus. Retour limite aux ids/periodes/nombres, sans enrichissement de donnees privees.
- UI affiche jusqu'a 20 regles concernees et le nombre restant ; nombre de salaries en commun par regle. FR/EN/AR distingue chevauchement et echec d'execution : les suivis existants ne sont pas simules et aucun blocage automatique de creation n'est ajoute. Pendant actualisation employes ou regles, l'apercu affiche chargement.
- Test de comparaisons avec criteres distincts, intersection partielle, statut inactif/null, cours/periodes/archives et absence de salaries. Cinq tests cibles avec predicate/langues et TypeScript/build passent ; /tmp/raero-lot286-{focused,check,build,docker}.log.
- Bundle serveur identique au conteneur (2638fc1c35834571031158c8aa393fd3211712ff2cd303530b142729d2285b7b). Image reconstruite, fichiers publics copies sans redemarrage. HTTP Tailscale 200/index conforme. Pas de migration, aucune regle ou echeance metier modifiee.
- Limites : comparaison sur donnees chargees, pas de simulation exhaustive de runTNA, des suivis existants ou des changements concurrents ; cout proportionnel aux regles du cours et salaries correspondants, pas de benchmark volumetrique. Pas de recette navigateur. Suite serveur/smoke non repetes pour code client seul. Objectif global non acheve.


### Lot 287 - Verification du prerequis HTTPS Tailscale

- Tour precedent : controle HTTP 200 local et Tailscale, sans changement applicatif ; pas de nouvelle fonctionnalite livree. Revalidation puis tentative concrete de Serve HTTPS prive sur 443 vers 127.0.0.1:3174.
- CLI Tailscale : Serve non active sur le tailnet, page d'activation requise. Commande en attente interrompue proprement (session 80848 terminee, code 1). Aucun certificat HTTPS ni acces HTTPS confirme.
- Configuration Serve relue apres interruption : seuls les TCP 3092, 3093 et 3174 existants ; HTTP Tailscale toujours 200. Aucun Funnel, aucun changement d'origine applicative, d'environnement prive, de conteneur ou de donnees.
- Suite : activation Serve via administration Tailscale, puis verification certificat, origine/CSRF, cookies Secure et connexion avant de promouvoir une URL HTTPS. Reference officielle : https://tailscale.com/docs/features/tailscale-serve . JaaS reste a configurer et conference multi-participants non verifiee.
- Pas de tests applicatifs repetes : aucune modification de code. Objectif global non acheve ; ce prerequis externe ne bloque pas les autres travaux.


### Lot 288 - Indisponibilite des dossiers apprenants

- Tour precedent : progression par verification concrete du prerequis HTTPS ; Serve exige une activation administrative, commande terminee sans changement de routage. Poursuite independante sur le parcours apprenant.
- getUserEnrollments/getUserCertificates renvoyaient [] et getEnrollmentById null sans base disponible. Desormais INTERNAL_SERVER_ERROR : une indisponibilite ne constitue plus une absence de dossier. Erreurs SQL deja propagees ; cas reel sans inscription inchange. Dashboard et LearningPlayer possedent deja leurs etats erreur/reprise, verifies par lecture du code.
- Nouveau test sans DATABASE_URL verifie les trois lectures. Aucun compte ou dossier reel cree. Test cible, TypeScript, build et suite PostgreSQL isolee : 479 tests / 118 fichiers passent. Journaux /tmp/raero-lot288-{focused,check,build,tests,docker,smoke}.log.
- Image reconstruite ; smoke conteneur, panne/reprise DB, session persistante, sauvegarde/restauration sur volumes jetables passes. Apercu remplace avec volumes conserves ; rollback before288 arrete. HTTP Tailscale 200, index conforme, session admin anterieure et no-store verifies ; cookie temporaire supprime. Bundle serveur local/conteneur identique 93a18496989e63d6ef36c9c003752637f7288a9c2d59c06e37d3edb101ee54db.
- Limites : test de configuration DB absente, pas de panne visuelle injectee dans un navigateur. Aucun changement de schema, de progression, de certificat ou de droits. HTTPS/JaaS et autres integrations externes restent non valides. Objectif global non acheve.


### Lot 289 - Detail d'inscription et progression entre versions

- Tour precedent : progression, erreurs explicites de lecture apprenant deployees. Inspection des lectures de curriculum et du detail dashboard : couverture precedente sur listes et API learning, sans preuve directe equivalente pour dashboard.enrollment.
- Test PostgreSQL existant enrichi : meme compte avec inscription ancienne/ar et renouvellement/en, detail restitue le contenu de chaque publication ; deux lectures croisees avec un autre titulaire renvoient null. Apres reussite du chapitre ancien, progression du detail rattachee uniquement a l'ancienne inscription et detail du renouvellement encore vide.
- Apres retrait de publication et archivage d'une question, detail ancien conserve sa langue et son contenu. Les mutations ne touchent que les fixtures de base isolee. Aucun changement applicatif necessaire : comportement existant confirme.
- Quatorze tests cibles (studio, selection inscription, indisponibilite) et TypeScript passent ; /tmp/raero-lot289-{focused,check}.log. Pas de build ni de deploiement pour changement de test seul ; apercu conserve au lot288.
- Limites : appels tRPC et PostgreSQL, pas de navigation navigateur ; archives completes de formation, medias distants et tous scenarios de retention non couverts par ces assertions. Objectif global non acheve.


### Lot 290 - Erreurs de replay et de presence en classe virtuelle

- Tour precedent : progression, preuve PostgreSQL du detail d'inscription par version. Inspection LiveRoom : avertissement HTTPS deja present, mais erreur de heartbeat de presence non affichee et replay video natif sans reprise explicite.
- Replay utilise le composant LearningVideo existant : erreur de chargement visible et bouton rechargeant la source, controles natifs conserves, etat isole par URL. Aucune modification de media distant.
- Echec de join/heartbeat affiche une alerte FR/EN/AR : periode de presence non confirmee, nouvelle tentative automatique tant que la conference reste connectee, contact organisateur si persistance. Aucun credit de presence ajoute par le client, cadence et controle connected/disposed existants conserves. Une reussite ulterieure remplace l'etat erreur de mutation.
- Premier patch refuse pour contexte de langue incomplet, aucun changement partiel ; patch corrige applique. TypeScript, trois tests de langues et build passent ; /tmp/raero-lot290-{check,locales,build,docker}.log. Bundle serveur inchange 93a18496989e63d6ef36c9c003752637f7288a9c2d59c06e37d3edb101ee54db.
- Image reconstruite puis fichiers publics copies sans redemarrage. HTTP Tailscale 200 et index conforme. Aucune conference, presence ou notification reelle declenchee.
- Limites : pas de test navigateur avec panne media/heartbeat, pas de session JaaS multi-participants ; couverture linguistique et compilation uniquement pour ce changement client. HTTPS et configuration fournisseur restent requis. Suite serveur/restauration non repetees pour code client seul. Objectif global non acheve.


### Lot 291 - Confirmation de cloture et publication du replay

- Tour precedent : progression, erreurs de replay/presence affichees. Inspection ReplaySetter : mutation de cloture directement au clic, URL non etiquetee, saisie modifiable pendant envoi et erreur uniquement en toast.
- Formulaire natif URL HTTPS obligatoire/max1024, label accessible, confirmation avec URL et consequence exacte sur les nouveaux acces video (liveAdmission ferme les statuts completed). Aucun engagement de deconnexion immediate du fournisseur.
- Verrou ref immediat et champs/bouton desactives pendant mutation ; invalidate cible attendue apres succes. Erreur persistante conserve la saisie et demande de verifier l'etat avant reprise. Textes FR/EN/AR. Entete a hauteur minimale et retours de ligne pour accueillir le formulaire et son erreur.
- TypeScript, trois tests de langues et compilation passes ; /tmp/raero-lot291-{check,locales,build,docker}.log. Bundle serveur identique au conteneur 93a18496989e63d6ef36c9c003752637f7288a9c2d59c06e37d3edb101ee54db. Image reconstruite, assets copies sans redemarrage ; HTTP Tailscale 200/index conforme.
- Limites : confirmation native et mise en page non testes en navigateur. Aucun replay reel publie ni classe cloturee. Aucun changement du serveur ; la mutation setReplayUrl reste sans journal dedie/CAS et verifie ses droits avant ecriture hors transaction commune, limites relevees a traiter. Protection client contre double clic ne constitue pas une deduplication serveur. Objectif global non acheve.


### Lot 292 - Droits transactionnels de cloture/replay

- Tour precedent : progression, confirmation et erreur persistante de cloture livrees. setReplayUrl verifiait ses droits avant UPDATE hors transaction commune.
- Service valide type/id/acteur/URL HTTPS et refuse DB indisponible. Transaction : compte actif admin/instructor FOR SHARE, classe FOR UPDATE, classe annulee refusee ; instructeur affectation active FOR SHARE, cours non archive et compagnie ACTIVE FOR SHARE. UPDATE replay/statut completed dans la meme transaction. Politique admin preexistante conservee ; correction de replay termine encore autorisee.
- Deux tests PostgreSQL nouveaux session/webinar : acteur sans droit, absence/retrait d'affectation, compte suspendu, compagnie suspendue, URL invalide, absence de mutation apres refus, cloture autorisee, correction admin et refus classe annulee. Aucun appel fournisseur.
- Dix tests cibles, TypeScript/build passent. Premiere suite complete : 480/481, fixture du test de versions utilisait deux chapitres sortOrder=0 mais exigeait ordre precis. Nouveau chapitre de fixture fixe a sortOrder=1. Deuxieme suite parallele : versions passent, timeout5s rapport certificats. Suite complete un worker : 481/481,119 fichiers,78.24s ; aucun timeout augmente. Journaux /tmp/raero-lot292-{focused,check,build,tests,tests-recheck,tests-serial,docker,smoke}.log. Charge/volume de ce rapport a examiner separement.
- Image/smoke/restauration valides. Conteneur remplace, volumes conserves, before292 arrete. HTTP Tailscale 200/index conforme, session admin anterieure/no-store verifies, cookie temporaire supprime. Bundle local/conteneur c24a180d6110e315fbe186bb4673c8342f5e9d86dae7ddf2fd4d4de5efb8d643.
- Limites : pas encore de revocation orchestree pendant UPDATE en test, ni journal dedie/CAS de replay ; verrou de ligne serialise les ecritures sans proteger contre intention ancienne d'un autre moderateur. Aucune classe/replay metier modifie. Pas de recette navigateur/JaaS. Objectif global non acheve.


### Lot 293 - Index des certificats par inscription

- Tour precedent : progression, cloture replay transactionnelle deployee ; timeout du rapport observe sous charge parallele puis suite481 validee en serie. Investigation PostgreSQL isole :3870 certificats, plus de16000 inscriptions, aucun index enrollmentId des certificats.
- EXPLAIN ANALYZE du coeur de jointure page50 : avant index Seq Scan3870 certificats, execution0.532ms ; apres migration Index Scan certificates_enrollment_idx, execution0.154ms. Observations ponctuelles sur cache chaud et requete simplifiee, pas benchmark global ni attribution exclusive du timeout. Export complet continue a parcourir toutes les pages et journaliser chaque lecture.
- Migration additive20260913_certificate_enrollment_index.sql enregistree dans migrate.ts et index declare dans schema. Index NON UNIQUE : certificats multiples historiques conserves et toujours signales review. Aucune reecriture des preuves ni changement du rapport.
- 17 tests cibles (rapport, origine/revocation/statut/rattachement certificats), TypeScript et build passes ; /tmp/raero-lot293-{focused,check,build,docker,smoke}.log. Tests rapport1.909s et2.575s isoles. Suite complete non repetee pour index seul.
- Image, smoke/panne DB/reprise et restauration passes. Conteneur remplace, volumes conserves, before293 arrete. HTTP Tailscale200/index conforme, session admin anterieure/no-store verifies, cookie temporaire supprime. Index present dans PostgreSQL de l'apercu confirme par pg_indexes.
- Limites : pas de preuve de performance en production ou sur export volumineux simultane ; creation d'index non concurrente dans la transaction de migration, adaptee a cet apercu local, fenetre de maintenance a prevoir avant reprise sur grosse base. Aucun certificat metier cree. Objectif global non acheve.


### Lot 294 - Mesure et annulation des exports complets

- Tour precedent : progression, index certificat/inscription deploye. Mesure via scripts/report-performance.ts avec garde cible stricte127.0.0.1:55477/raero_test_isolated. Compte admin de fixture cree puis suspendu ; lectures tRPC et audits reels sur base isolee uniquement. Resultats sans donnees personnelles dans docs/report-performance-lot294.json.
-16319 inscriptions/3889 certificats :3 exports sequentiels1621/1824/1987ms ;4 concurrents1750-1771ms,327 pages/export, tous16319 IDs uniques, aucune omission. Mesure en processus sans HTTP, navigateur ni serialisation CSV : ne prouve pas performance de bout en bout ni cause exclusive du timeout precedent.
- collectComplianceReport accepte signal et progression optionnels, controle annulation avant/apres chaque page et avant retour ; aucune liste partielle retournee. Test annulation durant page en attente : resultat rejete, page ignoree, aucune nouvelle lecture, compteur conserve seulement pages terminees ; signal deja annule refuse avant premiere lecture.
- Admin : compteur de dossiers lus, bouton annuler, notices durables FR/EN/AR d'echec/annulation sans fichier partiel ; verrou ref immediat, annulation au demontage/changement de compte. Le CSV n'est construit qu'apres collecte complete. La requete deja en vol termine mais son resultat est ignore ; pas d'interruption de la transaction SQL.
- Six tests cibles et TypeScript/build passes ; /tmp/raero-lot294-{performance,focused,check,build,docker}.log. Bundle serveur inchange f6604b29d7bdb87b26055e8b5ad9de2a677a2acf9d081e52e674d72278c322c6. Image reconstruite/assets copies sans redemarrage, HTTP Tailscale200/index conforme.
- Limites : pas de recette navigateur, compteur sans total instantane, assemblage CSV synchrone apres collecte non interruptible ; pas de snapshot transactionnel global entre pages. Aucun export metier telecharge. Suite serveur/restauration non repetees pour code client/helper seul. Objectif global non acheve.


### Lot 295 - Journal immuable de cloture/replay

- Tour precedent : progression, mesure et annulation export livrees. Retour sur limite de setReplayUrl : aucun historique d'auteur/avant-apres malgre transaction de droits.
- Nouvelle table live_replay_events : classe/type, acteur FK, date, ancien/nouveau statut et URL, index classe/id. Trigger statement refuse UPDATE/DELETE/TRUNCATE. Migration enregistree/schema declare, aucun backfill invente.
- setReplayUrl insere l'evenement dans la transaction de cloture. Si statut completed et URL deja identique, droits toujours verifies mais aucun UPDATE/evenement supplementaire. Deux requetes simultanees identiques conservent un evenement ; une correction autorisee ajoute un nouvel avant/apres.
- Tests session/webinar renforces : historique exact, acteur conserve, absence de doublon ; panne injectee par trigger de fixture dans INSERT journal annule UPDATE classe et laisse historique vide ; triggers/fonctions temporaires retires en finally. UPDATE/DELETE/TRUNCATE historique refuses. Dix tests cibles, TypeScript/build puis482 tests/119 fichiers passent a quatre workers. /tmp/raero-lot295-{focused,check,build,tests,docker,smoke}.log.
- Image/smoke/sauvegarde/restauration passes. Apercu remplace avec volumes conserves, before295 arrete. HTTP Tailscale200/index conforme, session anterieure/no-store verifies, cookie temporaire supprime. Table/trigger presents et0 evenement reel confirmes. Bundle local/conteneur18e1f832fb0ba83afdd8c3e275f84670740d5b5291ae9a39171f22799610c19a.
- Limites : historique pour les modifications passant par setReplayUrl a compter de cette migration ; pas encore de consultation API/UI, de motif obligatoire ou de CAS entre intentions divergentes. Les ecritures SQL directes des classes ne creent pas automatiquement cet evenement. Aucune conference/replay metier modifie. Objectif global non acheve.


### Lot 296 - Consultation du journal des replays

- Tour precedent : progression, journal transactionnel immuable deploye. Lecture getReplayHistory et route moderatorProcedure live.replayHistory ajoutees : schema strict type/id/cursor,50 entrees par page+sentinelle, ordre id decroissant, filtre classe/type.
- Controle de moderateur extrait du service de cloture sans changement de politique : compte/affectation/cours/compagnie verrouilles FOR SHARE, classe verrouillee SHARE pour lecture/UPDATE pour cloture. Meme transaction entre droits et lecture ; classe completed autorisee, cancelled refusee comme acces existant.
- LiveReplayHistory disponible dans classe pour moderateur meme en replay : details a ouverture explicite, date locale/id auteur, statut avant/apres traduit, liens affiches en texte avec bdi, notice sur debut du journal et liens anciens potentiellement expires. Chargement/erreur/reprise, cache masque sur erreur, page plus ancienne et retour/actualisation recentes. Enregistrement de replay invalide aussi ce journal.
- Tests session/webinar renforces via API :55 evenements, page50+5, nouvel evenement entre pages exclu, autre classe/type exclu, retrait affectation/compte/compagnie refuse meme avec contexte API conserve, curseur invalide refuse. Fixture etrangere finale utilise une vraie autre classe.13 tests cibles puis482 tests/119 fichiers, TypeScript/build passes ; /tmp/raero-lot296-{focused,check,build,tests,docker,smoke}.log.
- Smoke/restauration passes ; dernier ajustement client d'invalidation suivi de TypeScript/build/image finale (docker-final.log), sans changement serveur. Apercu remplace, volumes conserves, before296 arrete. HTTP Tailscale200/index conforme, session anterieure/no-store verifies et cookie temporaire retire. Bundle local/conteneur9cc819bce9f6b2ca3b80e927f1dd3f458c97f3c116cb92b0b3c3eb8fef436757.
- Limites : aucun test navigateur ni consultation d'historique metier reel. Acces aux classes annulees toujours refuse ; pas de journal automatique pour SQL direct ni de CAS sur remplacement divergent. Les liens historiques peuvent contenir des adresses privees, exposes uniquement aux moderateurs actuellement autorises. Objectif global non acheve.


### Lot 297 - Revocation concurrente pendant cloture de replay

- Tour precedent : progression, consultation du journal livree. Verification manquante du lot292 : revocation effectivement orchestree pendant une cloture, au-dela de refus apres changement deja valide.
- Test PostgreSQL suspend la cloture de session juste avant INSERT journal via trigger de fixture/verrou consultatif ; attente observee dans pg_locks. Lecture concurrente voit encore l'ancien statut/lien (pas de cloture partiellement visible).
- Pendant attente, cinq UPDATE concurrents compte/compagnie/affectation/cours/classe sont refuses par lock_timeout55P03. Apres liberation, cloture et evenement uniques valides ; retrait d'affectation reussit, puis remplacement et consultation du journal sont refuses. Etat final et auteur/url du seul evenement verifies.
- Trigger/fonction de fixture et connexion de controle nettoyes en finally. Onze tests cibles et TypeScript passes ; /tmp/raero-lot297-{focused,check}.log. Aucun changement applicatif, build/deploiement inutiles ; apercu conserve au lot296.
- Limites : scenario determine sur session/base isolee, pas preuve exhaustive de tous ordres de concurrence ou de performance ; lecture d'historique apres revocation testee, pas suspension de cette lecture elle-meme. Aucun compte/classe/replay metier modifie. Objectif global non acheve.


### Lot 298 - Conflits de remplacement des replays

- Tour precedent : progression, revocation concurrente testee. Ajout replayRevision sur sessions/webinars, initial0 ; trigger DB incremente sur changement statut ou replayUrl, refuse modification directe du compteur. Les changements de statut hors service invalident donc aussi une intention anterieure.
- getLiveAccess restitue revision aux inscrits autorises. Service/route setReplay exigent expectedRevision : sous verrou classe, meme URL deja completed reste sans nouvelle ecriture apres verification des droits ; autre modification avec revision ancienne refuse CONFLICT. URL maximale alignee512 sur colonne DB (ancienne validation1024 pouvant echouer en SQL).
- Formulaire garde revision initiale en ref, ne la remplace pas silencieusement au polling. Envoi inclut cette revision ; message conflit FR/EN/AR invite a copier le lien et recharger/verifier l'etat avant nouvel envoi. Validation HTML max512. Pas de remplacement automatique ni de nouveau bouton de correction apres cloture.
- Tests session/webinar : deux URLs concurrentes sur meme revision donnent un seul succes/un conflit ; compteur+1, reprise identique sans evenement, alteration directe du compteur refusee, annulation statut incremente encore. URL trop longue BAD_REQUEST. Tests precedents de droits/journal/rollback et revocation conserves/adaptes.
- Quatorze tests cibles, TypeScript/build et483 tests/119 fichiers passes ; /tmp/raero-lot298-{focused,check,build,tests,docker,smoke}.log. Image/smoke/panne-reprise DB/sauvegarde-restauration valides.
- Apercu remplace, volumes conserves, before298 arrete. HTTP Tailscale200/index conforme, session anterieure/no-store verifies, cookie temporaire retire. Deux triggers presents. Bundle local/conteneur7343af9b9c629e3cd9828dcf61fa43557787eb63e0bc1282893e2e68b40ce11d.
- Limites : ancien client sans expectedRevision refuse avant mutation ; aucune recette navigateur, fusion de brouillon ou formulaire de correction apres replay encore absent. Trigger compteur ne remplace pas journal d'auteur pour SQL direct. Initial0 est une base de concurrence au deploiement, pas un historique reconstitue. Aucun replay/classe metier modifie. Objectif global non acheve.


### Lot 299 - Correction de replay apres cloture

- Tour precedent : progression, revision/CAS des replays deployes. UI ne proposait encore aucun remplacement lorsque le replay etait deja affiche.
- Nouveau ReplayCorrection pour moderateur en mode replay : ouverture explicite, copie de revision et lien actuellement observes ; ReplaySetter commun affiche lien precedent et demande confirmation avant/apres avec maintien de classe terminee. Aucun rebasage automatique de cette copie au polling ; le serveur peut refuser CONFLICT si obsolete.
- Bouton remplacer desactive pour lien vide/identique et pendant mutation. Annulation explicite de la saisie hors envoi ; succes ferme le formulaire et affiche confirmation persistante apres invalidation acces/journal. FR/EN/AR. Droits serveur/historique/revision reutilises sans modification.
- TypeScript, trois tests de langues et build passes ; /tmp/raero-lot299-{check,locales,build,docker}.log. Bundle serveur identique7343af9b9c629e3cd9828dcf61fa43557787eb63e0bc1282893e2e68b40ce11d. Image reconstruite puis assets copies sans redemarrage. HTTP Tailscale200/index conforme.
- Limites : pas de recette navigateur ni remplacement de replay metier. Annulation volontaire ou rechargement perdent la saisie locale ; aucun brouillon durable. Formulaire absent pour non-moderateur et classes auxquelles acces refuse. Suite serveur/restauration non repetees pour code client seul. Objectif global non acheve.


### Lot 300 - File persistante des notifications support

- Tour precedent : progression, correction de replay depuis interface livree. Inspection support : ticket/message valide puis email direct, configuration absente/erreur silencieuses et demande non conservee pour reprise.
- Nouvelle support_notification_outbox creee atomiquement avec ticket/message : cle stable ticket:id/message:id, references FK, audience admin/owner, etat pending/sending/accepted/unconfirmed, destinataire de tentative, dates. Identite immuable, suppression/truncate interdits et transitions DB limitees pending->sending->accepted/unconfirmed. Pas de copie du contenu du support dans la file.
- Routes support utilisent notifySupport apres enregistrement, y compris relecture UUID identique : aucun doublon de ticket/message/file. Dispatcher : configuration SMTP absente laisse pending ; verrou de ligne claim unique, adresse valide/backoffice ou titulaire actif actuel, claim commit avant transport. Acceptation SMTP enregistree, erreur/exception unconfirmed. Arret apres claim ou echec de persistance laisse sending a examiner, jamais de renvoi automatique d'un resultat ambigu.
- Email minimal avec reference ticket/invitation a se connecter, sans recopier contenu ni nom du titulaire. Notification interne de reponse admin existante conservee hors transaction ; erreurs de celle-ci peuvent laisser email pending. Les autres emails (devis, inscription, etc.) ne passent pas encore par cette file.
- Tests : absence config, concurrence un seul transport simule, relecture sans renvoi, etats/identite immuables, SMTP non confirme jamais renvoye automatiquement, titulaire suspendu/nonenvoye puis adresse actualisee, panne de queue annule creation ticket/message. Sept tests cibles/typecheck/build passes ; premiere suite484/485 avec adresse de fixture reutilisee, fixture corrigee UUID sans purge ; seconde485/485,120 fichiers. /tmp/raero-lot300-{focused,check,build,tests,tests-recheck,docker,smoke}.log.
- Image/smoke/restauration passes. Apercu remplace, volumes conserves, before300 arrete. HTTP Tailscale200/index conforme, session anterieure/no-store verifies, cookie temporaire retire. Table presente/0 notification reelle. Bundle local/conteneur2ff969d162a08000691497747dc2559033be93c3b61b283cb077e98472503e7b.
- Limites : consultation/reprise administrateur de file encore a ajouter ; pending est actuellement repris lors d'une nouvelle invocation de notification liee au meme ticket/message, pas de worker periodique. Aucun backfill des anciens emails, aucun SMTP reel valide ; accepted signifie acceptation du serveur, pas remise en boite. Destinataire controle au claim, pas verrouille pendant appel reseau. Objectif global non acheve.


### Lot 301 - Consultation et reprise administrative des emails support

- Tour precedent : progression, file support persistante deployee. Ajout listSupportNotifications/notificationQueue : admin actif relu sous verrou, filtres stricts etat/ticket/cursor,50 lignes+sentinelle, dates/destination et disponibilite de reprise sans contenu du ticket. Destinataire propose actuel distinct de celui effectivement utilise.
- sendNotification/sendPendingSupportNotification : admin actif verifie dans transaction de claim, adresse attendue obligatoire comparee a adresse actuelle, configuration et titulaire actif revalides. Pending seul peut etre revendique ; sending/unconfirmed refuses, accepted retourne son etat sans nouvel envoi. Nouveau claimedBy FK conserve l'administrateur au claim ; transitions finales ne peuvent reecrire cet auteur. Migration additive sans attribution inventee aux anciennes lignes.
- SupportNotificationQueue dans onglet support admin, ouverture explicite, filtre d'etat, pagination/actualisation, absence SMTP/erreur/liste vide distinctes. Confirmation avec adresse et ticket, verrou immediat, retour durable puis refetch ; seul pending valide propose Envoyer. Textes FR/EN/AR distinguent SMTP et remise en boite, sending en cours OU interrompu et besoin de verifier le fournisseur pour incertitude.
- Tests :55 notifications filtrees page50+5, nouvel arrivant exclu de suite, changement adresseCONFLICT, absence config/nonadmin/suspension admin refuses, claim attribue et immuable. Premiere assertion concurrente attendait deux acceptations alors que sending doit etre refusee ; test corrige pour suspendre effectivement le transport simule, verifier refus du concurrent puis acceptation unique et reprise sans nouvel envoi. Aucune modification du comportement pour contourner le test.
- Onze tests cibles, TypeScript/build puis486 tests/120 fichiers passes ; /tmp/raero-lot301-{focused,focused-recheck,check,build,tests,docker,smoke}.log. Image/smoke/sauvegarde-restauration valides.
- Apercu remplace, volumes conserves, before301 arrete. HTTP Tailscale200/index conforme, session anterieure/no-store verifies, cookie temporaire retire. Lecture HTTP authentifiee notificationQueue valide :0 pending, SMTP configured=false. Aucun envoi/ticket reel. Bundle local/conteneurd443f4af7d8216a4c10148d67f921d12746319be7d754317f96c9285bfe5195d.
- Limites : pas de recette navigateur, worker periodique ou reprise d'envoi ambigu ; consultation fournisseur/reconciliation reste externe. Adresses/noms de configuration ne sont pas copies dans les journaux de verification. Notifications internes et autres categories email restent hors file. Objectif global non acheve.


### Lot 302 - Notification interne atomique avec la reponse support

- Tour precedent : progression, reprise administrative des emails support livree. Reste identifie : notification interne encore creee dans route apres commit du message, une panne pouvait laisser reponse sans alerte ou retarder email en attente.
- Insertion notifications deplacee dans postTicketMessage, dans transaction message/ticket/ledger/email intent. Role actuel deja verrouille relu ; reponse admin a un autre titulaire seule cree cette alerte, comme politique anterieure. Corps issu du contenu normalise sauvegarde, cle support-message:id pour rattachement. Route ne recree plus l'alerte.
- Test de panne sur INSERT notifications : aucun message/ledger/alerte/file email de reponse persiste, updatedAt ticket conserve, seule intention email initiale du ticket reste. Apres retrait du trigger de fixture, deux reprises UUID identiques creent un message et une alerte, puis reponse du titulaire ne le notifie pas lui-meme. Nettoyage trigger/fonction en finally.
- Neuf tests cibles, TypeScript/build et487 tests/120 fichiers passent ; /tmp/raero-lot302-{focused,check,build,tests,docker,smoke}.log. Image/smoke/panne-reprise DB/sauvegarde-restauration valides.
- Apercu remplace, volumes conserves, before302 arrete. HTTP Tailscale200/index conforme, session anterieure/no-store verifies, cookie temporaire retire. Bundle local/conteneur1a129fc3f29f5078fa625a6aa62084198c5a7641a2e2ba9880bfc638f0c1515a. Aucune reponse/notification metier ni email reel produit.
- Limites : pas de backfill des anciennes alertes manquantes ni de preuve navigateur ; notification interne conserve son comportement existant de titre FR/extrait120 caracteres/lien support. Les autres categories de notifications ne sont pas modifiees. Objectif global non acheve.


### Lot 303 - Acceptation SMTP suivie d'une panne de persistance

- Tour precedent : progression, notification interne atomique deployee. Test du point de rupture entre transport SMTP et persistance de son resultat, essentiel pour eviter renvoi ambigu.
- Trigger de fixture refuse UPDATE accepted apres transport simule ayant retourne sent=true. Le service echoue, mais le claim deja commis conserve sending, destinataire, auteur administrateur et date ; finishedAt reste null.
- Apres retrait du trigger, nouvelle invocation automatique n'appelle pas le transport, reprise administrateur refuse PRECONDITION_FAILED. Lecture de file retrouve la ligne sending avec canSend=false ; exactement un appel SMTP simule au total. Trigger/fonction nettoyes en finally.
- Huit tests cibles et TypeScript passent ; /tmp/raero-lot303-{focused,check}.log. Aucun changement applicatif ni migration ; apercu conserve au lot302, pas de build/deploiement requis.
- Limites : panne de persistance injectee sur PostgreSQL isole, pas arret brutal de processus ni SMTP reel. sending ne prouve ni processus encore actif ni remise/absence de remise ; consultation fournisseur reste necessaire. Aucune notification metier ni email reel produit. Objectif global non acheve.


### Lot 304 - Chargement et comptage des notifications personnelles

- Tour precedent : progression, panne de persistance apres SMTP testee. Inspection NotificationBell : defauts[]/0 masquaient chargement/erreurs, marquage comme lu sans retour d'echec ; compteur SQL chargeait toutes les lignes non lues.
- Services liste/compteur/marquages refusent DB absente avec INTERNAL_SERVER_ERROR. Compteur par count(*) SQL au lieu de rapatrier toutes les lignes ; liste des50 dernieres a ordre stable createdAt DESC/id DESC.
- Cloche : chargement et erreur explicites, badge avertissement/label accessible sur panne, badge numerique non affiche comme certain si erreur, reprise des deux lectures, cache de liste masque si lecture en erreur. Echec de marquage affiche avec actualisation ; actions groupees desactivees pendant mutations/lecture, invalidations attendues. Alignement text-start pour RTL.
- Tests DB absente sur4 services et PostgreSQL61 alertes propres+etrangere : compteur60 au-dela page50, ordre deterministe, marquage idempotent et isolation du titulaire, tout-lu sans affecter autre compte. Cinq tests cibles/typecheck/build puis490 tests/122 fichiers passent. /tmp/raero-lot304-{focused,check,build,tests,docker,smoke}.log.
- Image/smoke/panne-reprise DB/sauvegarde-restauration valides. Apercu remplace avec volumes conserves, before304 arrete. HTTP Tailscale200/index conforme, session anterieure/no-store verifies, cookie temporaire retire. Bundle local/conteneur86fea1636b7001136d73dc6608ac675789cab9731b58cbd87219be14e2202407.
- Limites : pas de recette navigateur ni benchmark du compteur ;50 dernieres seulement, anciennes alertes non paginees dans cette cloche. Liens actuels conserves (support ouvre la liste, pas encore le ticket exact). Aucun dossier/notification metier modifie. Objectif global non acheve.


### Lot 305 - Ouvrir le ticket depuis une notification de support

- Tour precedent : verification de disponibilite HTTP et conteneur pour la demande explicite de lancement local ; la refonte globale reste active. Relecture gouvernance et code courant avant modification.
- Les nouvelles alertes de reponse administrative pointent vers /support/ticket/<id>, dans la meme transaction que message/notification/intention email. Anciennes alertes conservees sans reecriture.
- Nouvelle page dediee independante de la pagination personnelle : identifiant canonique entier positif borne SQL, chargement/erreur auth/connexion explicites, retour a la liste, TicketThread reutilise avec cle utilisateur/ticket pour reinitialiser le brouillon. Libelles FR/EN/AR ; les messages et l'historique restent proteges par les services serveur existants.
- Test transactionnel de notification adapte au lien exact ; test API de confidentialite etendu avec50 tickets plus recents : ticket absent de la premiere page, conversation accessible au titulaire/admin et interdite aux autres roles. Suite490 tests/122 fichiers reussie, puis5 tests cibles apres extension de fixture. TypeScript et build passent. Logs /tmp/raero-lot305-{check,build,tests,focused,docker,smoke}.log.
- Image reconstruite ; smoke avec panne/reprise DB, session/restart et sauvegarde-restauration valide. Conteneur remplace, volumes conserves et before305 arrete. HTTP Tailscale200, index local identique, route profonde servie, session admin anterieure et no-store verifies ; cookie temporaire supprime. Bundle serveur local/conteneur09df687079d00165c16363f1af197d2a8cecd7ec7fac41d102b5f4944df33b06.
- Limites : pas de recette navigateur/clic reel ; HTTP de route profonde prouve la livraison SPA seulement. La page affiche le numero du ticket, pas son sujet/statut ; les erreurs de lecture restent generiques. Connexion via parcours existant (pas de retour automatique au lien apres login). Aucun ticket/notification metier ni email reel cree sur l'apercu. HTTPS, fournisseurs externes et recette globale restent non valides ; objectif global non acheve.


### Lot 306 - Retour a la destination apres connexion

- Tour precedent : progression, liens directs support deployes. Inspection Login/SupportTicket/main : la connexion envoyait toujours vers dashboard/admin et perdait le ticket demande ; le gestionnaire401 perdait aussi la page courante.
- getLoginUrl accepte une destination facultative ; le ticket transmet son chemin. Le gestionnaire401 transmet chemin/recherche/ancre. Login utilise une destination valide apres le nettoyage du cache de session et la connexion, via finishLogin commun au mot de passe et a la verification2FA. Sans destination valide, destinations de role existantes conservees.
- shared/loginReturn valide un chemin relatif local borne2048, refuse destinations externes/protocole relatif, controles/antislash, encodages de chemin invalides ou ambigus, et routes API/connexion/inscription/reset. Une seule valeur returnTo autorisee. Aucun droit metier accorde par le lien ; controle serveur existant.
- Deux tests couvrent aller-retour ticket/selection enrollment/privacy, roles admin/user, liens hostiles, doublons, routes exclues et repli. Avec trois tests de langues :5 tests passes ; TypeScript/build passent. Logs /tmp/raero-lot306-{focused,check,build,docker}.log.
- Image reconstruite puis assets copies dans le conteneur actif sans redemarrage. Bundle serveur inchange09df687079d00165c16363f1af197d2a8cecd7ec7fac41d102b5f4944df33b06, donc pas de nouvelle suite SQL/smoke serveur. HTTP200/index identique pour accueil, login avec retour et lien ticket ; bundle frontal servi identique au build local.
- Limites : pas de connexion/2FA reelle en navigateur ni validation visuelle ; les tests de fonction ne prouvent pas le parcours interactif complet. Les autres liens explicites de connexion sans parametre gardent leur destination par defaut ; pas de persistance inter-appareil ni reprise du retour apres creation de compte/reset-password. Objectif global non acheve, fournisseurs externes/HTTPS/recette globale restent a valider.


### Lot 307 - Contexte du ticket sur la page directe

- Tour precedent : progression, destination de connexion preservee. Inspection page directe : seul numero affiche, sujet/etat/type manquants pour comprendre la conversation.
- support.detail protege et strict, identifiants entiers positifs bornes SQL. Service getSupportTicketDetail revalide acteur actif et titulaire/admin sous verrous partages acteur/ticket ; projection explicite id/sujet/statut/type/dates, aucun objet utilisateur ou champ interne supplementaire.
- Page directe : sujet, etat traduit FR/EN/AR et type de demande. Lecture toutes8s, chargement/erreur/reprise explicites, donnees detail cachees masquees sur erreur. Fil existant conserve monte pendant erreur de detail pour ne pas perdre le brouillon ; il applique ses propres controles et masquage d'erreurs.
- Test API etendu : projection exacte, acces hors premiere page pour titulaire/admin, autres roles refuses, etat apres traitement, ancienne session admin apres retrait du role et titulaire suspendu refuses, identifiants invalides refuses.
- TypeScript initial a signale le statut SQL string indexant une table de libelles : dictionnaire type Record avec repli au statut brut corrige. TypeScript/build finaux passent. Premiere suite491/492, un timeout5000ms du rapport de conformite pendant compilation concurrente. Rapport seul2/2 (1475/1919ms), puis suite complete sans build concurrent492/492 dans123 fichiers en22.83s. Aucun timeout augmente ni assertion retiree ; cause de charge plausible, non prouvee. Logs /tmp/raero-lot307-{check,build,tests,report,retest,docker,smoke}.log.
- Image/smoke/panne-reprise DB/sauvegarde-restauration valides. Conteneur remplace avec volumes conserves, before307 arrete. HTTP Tailscale200/index conforme, session admin anterieure/no-store verifies, nouvelle API anonyme401 ; cookie temporaire retire. Bundle serveur local/conteneur e6fa35758f34e97d159e29976b65cd6c9727f389d3ccdb034f4694acf9222f82.
- Limites : aucune recette navigateur ni dossier support metier cree/modifie sur apercu ; metadata et messages lus dans transactions distinctes, pas de snapshot commun. Fragilite temporelle du test de rapport sous charge reste a suivre. Fournisseurs externes/HTTPS/recette globale encore non valides ; objectif global non acheve.


### Lot 308 - Reduire les allers-retours de l'export de conformite

- Tour precedent : progression, detail support deploye ; timeout ponctuel du rapport constate et relance complete verte. Inspection rapport/tests/performance : export impose50 lignes et parcourt toutes les inscriptions, donc nombre croissant d'appels tRPC et d'audits avec les fixtures accumulees.
- Mesure initiale docs/report-performance-lot308.json :17712 inscriptions/4203 certificats,355 pages,1769-2072ms sequentiel,2196ms pour4 exports concurrents. Appels tRPC en processus incluant journal d'acces, pas HTTP ni navigateur.
- API/service acceptent pageSize entier1..250, defaut50 conserve ; curseur borne SQL, entree route stricte. Export admin demande250. Requete id/pageSize+1 puis jointures et regroupement existants : toutes les lignes, certificats ambigus, ordre/cursor conserves. Annulation et assemblage complet avant fichier conserves.
- Test PostgreSQL pagination etendu a255 fixtures : defaut50, taille250/cursor, limites invalides, nouvelle inscription exclue de la traversal commencee, aucune perte ni doublon jusqu'au bout. Tests etats certificat inchanges. Cinq tests cibles, TypeScript/build et492 tests/123 fichiers passent ; suite complete executee sans build concurrent. Logs /tmp/raero-lot308-{check,build,focused,tests,docker,smoke}.log.
- Script de mesure accepte chemin de sortie et taille, sans ecraser le lot294. Comparaison sur memes17974 inscriptions/4209 certificats : docs/report-performance-lot308-page50.json donne360 pages,2099/2996/3400ms,4 exports concurrents2553ms ; page250.json donne72 pages,1002/1088/1100ms,4 exports1151ms. Chaque export verifie17974 identifiants uniques et nombre total exact. Reduction80% des appels ; temps locaux variables, pas garantie de production.
- Image/smoke/panne-reprise DB/sauvegarde-restauration valides. Apercu remplace avec volumes conserves, before308 arrete. HTTP Tailscale200/index conforme/session anterieure/no-store ; appel HTTP admin rapport pageSize250 accepte (3 lignes reelles seulement, aucune donnee personnelle imprimee). Cookie temporaire retire. Bundle local/conteneur6f63088a8e079f9029151f563862db484e2d77f491aef4a60f919502eb54f610.
- Limites : tests et mesures sur PostgreSQL isole, sans latence reseau/HTTP/CSV/navigateur dans benchmark ; memoire maximale et charge production non mesurees, pas snapshot transactionnel entre pages. La cause du timeout307 n'est pas prouvee ; taille par defaut50 peut encore rencontrer des limites sur bases croissantes. Aucun dossier metier modifie ; lecture preview journalisee. Objectif global non acheve.
