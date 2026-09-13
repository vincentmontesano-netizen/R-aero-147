# Inscription personnelle et création de compagnie

L’entrée d’inscription est validée par un schéma commun au routeur et au service : email normalisé, nom et champs bornés, langue/type d’organisation contrôlés. L’inscription personnelle crée un compte user sans affiliation. L’inscription avec organisation crée dans une même transaction la compagnie, le compte company_manager et son affiliation MANAGER active.

Le verrou de transaction porte sur l’email normalisé, puis la présence d’un compte est vérifiée sans distinction de casse. La contrainte unique reste une protection supplémentaire contre d’autres chemins d’écriture. Deux inscriptions concurrentes ne peuvent pas laisser une seconde compagnie sans responsable. Toute erreur d’insertion annule les trois créations. Le hachage du mot de passe est réalisé avant la transaction pour éviter de prolonger inutilement ses verrous.

La route ne reçoit aucun identifiant de compagnie existante ni privilège choisi : ces propriétés supplémentaires sont ignorées par le schéma. La déclaration d’une organisation n’accorde pas de vérification KYC/KYB, de paiement ou d’abonnement. Le numéro d’agrément saisi reste déclaratif. Les notifications et la création du cookie interviennent après validation de la transaction ; une erreur SQL ne renvoie pas sa requête ni ses paramètres au navigateur.

## Vérifications

176 tests réussis, dont 127 PostgreSQL. Les quatre nouveaux tests couvrent les créations liées, concurrence sur email normalisé, compte historique en majuscules, entrée invalide, impossibilité de rejoindre une compagnie par un ID fourni et rollback après création de la compagnie face à une vraie contrainte unique sur le compte. La route a également été testée sur cette erreur : pas de cookie ni détails SQL retournés. Le simulateur initial de collision a été corrigé pour utiliser le mécanisme de mock ESM de Vitest.

TypeScript et build réussis, avertissement de taille du bundle persistant. Pas de nouvelle migration. Aucun email réel envoyé pendant les tests. La preuve de possession de l’email à l’inscription, l’invitation à rejoindre une organisation existante, la réconciliation des doublons juridiques, la limitation globale des inscriptions et la recette navigateur restent à compléter.
