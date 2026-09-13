# Suspension des organisations et décisions d’affiliation

Le statut opérationnel de la compagnie est désormais indépendant du statut de chaque affiliation. Suspendre une compagnie ne modifie ni les affiliations ni leurs dates de fin. Réactiver la compagnie ne change pas ces décisions individuelles : seuls les liens toujours ACTIVE redeviennent utilisables. Un lien retiré avant ou pendant la suspension reste INACTIVE.

Les résolutions d’affiliation effective exigent maintenant une compagnie ACTIVE. Les contextes de session et vues personnelles utilisent ces affiliations effectives. Les lectures KYC/KYB de compagnie sont également filtrées. L’indépendance d’un réviseur reste fondée sur son lien réel à la compagnie, même suspendue : une suspension ne le rend pas artificiellement indépendant.

La garde manager relit les affiliations actives en base et n’accorde plus de droits sur le seul rôle global company_manager ou users.companyId. Les anciennes routes d’affiliations, échéances, synthèse, besoins de formation et règles sont contrôlées ; dossier technicien, sign-off et historique de sign-offs vérifient la compagnie réelle de l’employé. Le dossier personnel partagé d’un technicien nécessite encore une affiliation individuelle active. Le coffre reste lisible par son propriétaire.

`adminSetOrganizationStatus` exige un administrateur actif, verrouille la compagnie et journalise l’ancien/nouveau statut et l’acteur dans `organization_status_events`, créé par la migration `20260913_organization_status.sql`. Le journal est immuable. Répéter un statut déjà appliqué ne crée pas d’événement ; deux demandes concurrentes identiques sont sérialisées.

## Vérifications

180 tests réussis, dont 131 PostgreSQL. Les quatre nouveaux tests couvrent suspension sans modification d’affiliation, perte des accès effectifs et documents partagés, conservation du coffre personnel et d’une autre compagnie, retrait pendant suspension, réactivation sans élargissement, journal immuable, acteur non autorisé, concurrence et anciennes routes transversales. Le mock unitaire d’affiliation a été adapté à la jointure ; des promesses de refus dans les tests ont été correctement attendues simultanément pour éviter des rejets non gérés.

TypeScript, construction Docker et recette complète installation/panne/reprise/sauvegarde/restauration réussis. Aucun fournisseur ni déploiement.

## Limites et données historiques

L’ancien code pouvait déjà avoir réactivé des affiliations retirées, ou avoir désactivé toutes celles d’une compagnie sans conserver leur état préalable. Cette modification ne fabrique pas cet historique manquant : les valeurs actuelles sont conservées et nécessitent une revue administrative si elles sont douteuses. Une ancienne affiliation inactive ne sera pas automatiquement rétablie.

Les écrans hérités sélectionnent encore parfois la compagnie du compte ou la première affiliation manager ; leur sélection multi-organisation complète reste à harmoniser. La notification des personnes et la recette navigateur restent à compléter ; la consultation administrative du journal est décrite ci-dessous. Des parcours historiques d’archivage/suppression et d’accès restent à auditer ; ce lot ne constitue pas un audit exhaustif des autorisations de toute la plateforme.

## Consultation administrative (lot 56)

Le bouton Historique de chaque compagnie ouvre un journal FR/EN/AR : date, identifiant et nom actuel de l’administrateur, ancien/nouveau statut. Un texte rappelle l’effet de la suspension et précise la portée des noms actuels. Un journal vide n’est pas présenté comme une absence historique de changements : l’écran indique seulement qu’aucune entrée n’a été enregistrée depuis la mise en place du journal.

La route statusHistory et son service exigent un administrateur actif. Ils projettent seulement les champs nécessaires et permettent également la lecture d’une compagnie suspendue. La pagination utilise l’identifiant d’événement comme curseur (50 entrées), sans conversion en nombre JavaScript ; les insertions récentes ne déplacent pas les pages plus anciennes. Le statut et son journal sont rafraîchis après une modification depuis l’administration. Les horodatages suivent la convention UTC de la base applicative et sont affichés dans le fuseau du navigateur.

182 tests réussis, dont 133 PostgreSQL. Les deux nouveaux tests couvrent droits/refus, projection sans secrets, administrateur suspendu, curseur hors limites et pagination de 55 événements avec nouvelle insertion et autre compagnie intercalées. TypeScript/build réussis après correction du contexte de langue dans le composant et du littéral BigInt incompatible avec la cible TypeScript. Aucune nouvelle migration ni modification du journal ; recette visuelle navigateur toujours à effectuer.


## Conservation des compagnies (lot 57)

Le bouton de suppression définitive est retiré. L’ancienne route reste disponible uniquement pour répondre par PRECONDITION_FAILED aux clients non rafraîchis ; elle ne modifie aucune affiliation ni règle. L’ancien service supprimait ces dépendances avant de tenter la suppression de la compagnie et pouvait donc échouer après des pertes partielles.

La migration `20260913_preserve_organizations.sql` refuse DELETE et TRUNCATE sur companies, y compris pour une compagnie sans dépendances. La suspension auditée reste réversible et conserve les décisions individuelles. Il ne s’agit pas encore d’un archivage verrouillé distinct du statut opérationnel ; un propriétaire SQL capable de modifier le schéma peut supprimer les protections.

184 tests réussis (135 PostgreSQL) : appel historique sans effet sur affiliations/règles/journal, réactivation ultérieure, refus SQL même sans dépendances et déclencheurs actifs. L’assertion initiale a été corrigée pour lire la cause PostgreSQL encapsulée par Drizzle. Un TRUNCATE CASCADE séparé, après les tests parallèles, a également été refusé par le déclencheur ; sa transaction a été annulée. TypeScript et build réussis. Recette navigateur toujours à effectuer.

Construction Docker et recette complète installation, panne PostgreSQL, reprise, redémarrage, sauvegarde et restauration réussies ; ressources jetables nettoyées. Aucun fournisseur appelé ni déploiement.
