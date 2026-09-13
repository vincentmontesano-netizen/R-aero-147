# Export personnel structuré — version 3

Le lot 108 ajoute aux catégories déjà exportées les décisions de signature concernant le titulaire, son historique de partage, les instantanés et empreintes de ses certificats et factures, les motifs de révocation de ses certificats et l’éventuel événement de fermeture de son compte.

Le format JSON porte désormais `formatVersion: 3`. Les sections nouvelles sont :

- `evidenceHistory.decisions` : décisions dont la personne est le sujet, instantané éventuel, note et date ; pas l’ensemble des décisions qu’elle aurait prises sur d’autres personnes en tant que responsable.
- `evidenceHistory.sharing` : événements de partage et de retrait.
- `evidenceHistory.certificateArchives` : instantanés, empreintes, tailles et dates des certificats du titulaire.
- `evidenceHistory.revocations` : motif et date de révocation de ces certificats ; cet accès personnel n’est pas ajouté à la vérification publique.
- `billingDocuments.invoiceArchives` : données figées, numéro, empreinte, taille et date des factures du titulaire.
- `accountClosure` : événement de fermeture, lorsqu’il existe.

Les filtres de personne sont appliqués dans SQL. Les archives et révocations de certificat sont jointes à leur titulaire. Les clés internes de stockage des nouvelles archives, identifiants/empreintes de reprise des signatures, secrets d’authentification et corrigés d’examen ne font pas partie de ces ajouts. Le JSON conserve `filesIncluded:false` : il n’embarque pas les octets PDF ou documents.

L’accès utilisateur actuel reste le bouton du dossier personnel avec une session active. Un compte fermé ne peut pas se reconnecter pour exporter ses données ; une procédure administrative de demande et de délivrance reste à construire. Le service sait représenter ses données conservées, ce qui ne signifie pas que cette procédure existe déjà.

Cet export couvre les catégories implémentées, sans revendiquer l’exhaustivité de toutes les données de la plateforme ou le traitement complet d’une demande de confidentialité. Les contenus d’auteur/IA et les autres historiques spécialisés doivent encore être examinés. Les lectures de plusieurs sections ne constituent pas un instantané transactionnel global.

Validation : 289 tests réussis (211 PostgreSQL), TypeScript/build réussis. Nouveau scénario SQL avec deux titulaires, archives, révocations, signatures et partages distincts, puis fermeture synthétique de l’un : uniquement son historique, sans données étrangères ni clés internes. Le test existant de secrets et réponses d’examen est conservé et adapté à la version 3. Pas de migration/UI/nouvelle recette Docker ; dernière recette complète au lot 107.
