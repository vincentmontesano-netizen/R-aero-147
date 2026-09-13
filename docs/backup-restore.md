# Sauvegarde et restauration du conteneur intégré

Le script `python3 scripts/backup-container.py` sauvegarde à froid les deux volumes nommés standard : PostgreSQL (`/var/lib/postgresql/data`) et stockage (`/app/storage`). Il nécessite Python 3, Docker et l’image exacte du conteneur en local. Il ne convient pas à un PostgreSQL externe, à des bind mounts personnalisés ou à des tablespaces/liens externes.

Une copie physique PostgreSQL exige un arrêt du serveur ou un mécanisme de snapshot cohérent adapté ; voir la [documentation PostgreSQL 15](https://www.postgresql.org/docs/15/backup-file.html). Ici, l’application et la base doivent rester arrêtées pendant les deux copies. Prévoir une fenêtre de maintenance et empêcher tout autre administrateur/orchestrateur de redémarrer les services pendant l’opération.

## Sauvegarder

```sh
docker stop -t 30 r-aero-academy
python3 scripts/backup-container.py backup r-aero-academy /chemin-protege/sauvegarde-20260913
docker start r-aero-academy
```

Le dossier cible doit être nouveau. Le script refuse une source active, un autre conteneur actif pouvant écrire les volumes ou un PostgreSQL non arrêté proprement. Il vérifie de nouveau l’état des conteneurs entre les copies. Cette vérification ne constitue pas un verrou contre une intervention concurrente de l’administrateur Docker : réserver la fenêtre de maintenance.

Le résultat contient `database.tar.gz`, `storage.tar.gz` et `manifest.json` écrit en dernier, avec empreintes SHA-256, date UTC, version PostgreSQL et identifiant immuable de l’image. Un échec laisse éventuellement un dossier incomplet, sans manifeste final : ne pas le considérer comme une sauvegarde réussie. Aucun dossier existant n’est écrasé.

Le dossier est créé en 0700 et les fichiers en 0600. Les archives contiennent les données personnelles, les fichiers du coffre et les secrets persistants. Elles **ne sont pas chiffrées** par ce script : choisir un support chiffré avec accès restreint et une conservation hors du serveur. Une empreinte détecte une altération accidentelle ; elle n’authentifie pas une archive fournie par un tiers. Les paramètres et secrets fournis par environnement ne sont pas exportés, notamment un JWT_SECRET explicitement configuré : conserver séparément la configuration nécessaire dans le gestionnaire de secrets.

Conserver aussi l’image correspondant au champ `image` du manifeste, par exemple avec `docker image save -o image.tar IDENTIFIANT_IMAGE`, puis la recharger avec `docker image load -i image.tar` sur l’hôte de récupération. L’archive des données n’embarque pas l’image ; un tag latest ne garantit pas la compatibilité d’une sauvegarde physique. Utiliser une machine d’architecture compatible et l’image exacte pour la première restauration, avant toute migration de version.

## Restaurer sans écraser la source

```sh
python3 scripts/backup-container.py restore /chemin-protege/sauvegarde-20260913 raero-recovery-db raero-recovery-storage
```

Les deux noms doivent être distincts et ne pas exister, même comme volumes vides. Réserver ces noms pendant l’opération : Docker ne fournit pas de création nommée atomique « seulement si absent ». Le script valide le manifeste, les empreintes et les chemins/types des archives avant de créer des volumes. Les liens, périphériques, chemins absolus et traversées de répertoire sont refusés. Une interruption peut laisser des volumes partiellement restaurés ; ils ne doivent pas être utilisés ni être confondus avec une restauration complète.

Démarrer ensuite une instance isolée avec l’identifiant d’image indiqué et les deux nouveaux volumes, en rétablissant la configuration externe requise. Pour la recette, préférer `--network none` et ne publier aucun port, afin de ne pas contacter les fournisseurs ou accepter du trafic réel. Vérifier santé, connexion, historique réglementaire et présence/intégrité des fichiers avant toute bascule. Le script ne modifie jamais le routage de production et ne supprime pas les volumes sources.

## Recette effectuée

Sur les volumes Docker synthétiques de développement : sauvegarde à froid réussie ; refus d’une source active ; restauration dans deux nouveaux volumes ; démarrage avec l’image enregistrée ; donnée témoin SQL et fichier binaire récupérés à l’identique ; connexion administrateur déjà ouverte conservée grâce au secret de session restauré ; un utilisateur, zéro formation et reçus de migration conservés. Contrôles des droits PostgreSQL réussis également.

Une archive volontairement altérée a été refusée avant création des volumes. Une destination existante a été refusée. Les trois tests `python3 scripts/test_backup_container.py` couvrent les fichiers normaux et le refus des chemins dangereux, liens et fichiers spéciaux. Les conteneurs de recette ont été arrêtés après vérification.

Il reste à mettre en place la fréquence effective, les alertes d’échec, le chiffrement et stockage hors serveur, la rétention, une restauration sur un autre hôte et la mesure des objectifs de perte de données et de reprise. Cette procédure à froid impose une interruption ; elle ne remplace pas des sauvegardes continues/PITR pour une exploitation sans interruption quotidienne.
