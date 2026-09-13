# Révocation des sessions et consommation des codes

Chaque compte possède une version de session. Les nouveaux JWT incluent cette version et l’identifiant d’application ; chaque requête authentifiée charge le compte actif et compare sa version à celle du cookie. Cette vérification est aussi utilisée par les téléchargements privés via le contexte commun. Les cookies signés historiques sans version représentent la version zéro : ils restent utilisables jusqu’au premier changement de sécurité, sans déconnexion générale imposée à la migration.

La migration `20260913_session_revocation.sql` incrémente la version en base à chaque changement de mot de passe ou de statut du compte et efface les codes de double authentification en attente. Le déclencheur s’applique à tous les chemins SQL existants, notamment une modification administrative. Une suspension suivie d’une réactivation ne restaure donc pas les anciens cookies. Les versions ne peuvent pas diminuer. Un événement immuable conserve le compte, les versions et la raison sans mot de passe, code ou jeton ; il ne prétend pas identifier l’auteur d’une opération administrative en l’absence de ce contexte.

La réinitialisation consomme son jeton par un UPDATE conditionné sur la valeur et l’expiration, après calcul du nouveau hash : deux requêtes concurrentes ne peuvent pas toutes deux réussir. Une première vérification évite le calcul scrypt pour un lien manifestement invalide, mais la condition finale reste celle qui tranche la concurrence. Les codes de double authentification sont également consommés atomiquement et nécessitent un compte actif, l’option activée et une expiration valide. La création du défi vérifie encore la version issue de l’étape mot de passe.

Une double authentification activée n’est plus ignorée lorsque SMTP est absent : la connexion échoue avec un message explicite et aucun cookie de session. Un échec d’envoi ne donne pas non plus de connexion directe. Les codes restent des codes email ; cela ne constitue pas une authentification résistante au phishing.

## Vérifications

160 tests réussis, dont 112 PostgreSQL réels. Les quatre nouveaux tests couvrent cookies anciens/nouveaux, réinitialisations concurrentes, événements immuables, suspension/réactivation, consommation concurrente et refus de codes invalides, création d’un défi depuis une ancienne version, identifiant d’application différent et absence de contournement sans SMTP. TypeScript et image Docker validés. La recette Docker complète passe sur installation neuve avec la nouvelle migration, y compris redémarrage, panne/reprise de base et restauration des volumes/session.

## Travail restant

La déconnexion simple retire encore le cookie du navigateur ; elle ne constitue pas une révocation individuelle d’un cookie copié. La réauthentification des autres changements sensibles, la limitation distribuée des tentatives et les défis email mieux protégés restent à compléter. Les jetons et l’origine des liens ont été durcis dans le lot 50 décrit ci-dessous. Les requêtes déjà autorisées au moment d’un changement ne sont pas annulées rétroactivement ; une réunion JaaS déjà admise dépend de sa propre politique de révocation.

## Récupération de compte : origine fixe et jetons hachés (lot 50)

Le lien est construit exclusivement à partir de PUBLIC_APP_URL, ou APP_ORIGIN en second choix. En production, une origine HTTPS sans identifiants, chemin, paramètres ou fragment est obligatoire. La valeur origin reçue du navigateur est conservée dans le contrat pour compatibilité mais n’est jamais utilisée. En développement sans configuration, l’origine locale fixe est http://localhost:3000.

Sans SMTP ou origine valide, la demande garde sa réponse neutre sans créer de nouveau jeton ni envoyer de message. Une configuration d’origine invalide produit un diagnostic serveur générique. Compte inexistant et compte existant conservent la même forme de réponse ; cela ne garantit pas à ce stade une durée de réponse identique.

Le jeton aléatoire n’est plus stocké en clair : resetToken contient son SHA-256 et les vérifications calculent la même empreinte avant comparaison. Le lien remis à la messagerie contient toujours le jeton original. La migration `20260913_reset_token_hash.sql` transforme les jetons historiques en empreintes, préservant leur validité jusqu’à leur expiration initiale. Elle ne doit jamais être réexécutée hors du journal de migrations. Une empreinte extraite de la base n’est pas acceptée comme jeton.

164 tests réussis, dont 115 PostgreSQL. Les nouveaux tests contrôlent origine malveillante ignorée, configurations invalides, réponses neutres, messagerie simulée sans envoi réel, empreinte non utilisable comme lien et conversion réelle d’un jeton historique. TypeScript/build et scénario Docker complet de démarrage, panne/reprise, sauvegarde/restauration réussis avec la nouvelle migration. Le stockage et le compteur des défis email 2FA ont été durcis dans le lot 52 ; la limitation globale des connexions et la réauthentification des autres opérations sensibles restent à compléter.

## Déconnexion de tous les appareils (lot 51)

Le profil propose une commande FR/EN/AR demandant le mot de passe actuel et annonçant la déconnexion de tous les appareils, y compris celui utilisé. Le serveur cible exclusivement ctx.user, limite les essais et relit le compte sous verrou transactionnel. Il vérifie compte actif, version de la session et mot de passe avant d’incrémenter la version, d’effacer le défi 2FA en attente et d’invalider les cookies précédents. L’événement immuable existant enregistre sessions_revoked.

La réponse efface le cookie courant ; le profil recharge ensuite la page de connexion. Formations, résultats, documents et mot de passe ne sont pas modifiés. Une demande concurrente issue de la même ancienne version échoue : elle ne peut pas révoquer une nouvelle session après la première opération. La limitation des essais reste locale au processus, à distribuer avant un déploiement multi-instance.

166 tests réussis, dont 117 PostgreSQL. Les deux nouveaux tests couvrent mot de passe erroné sans effet, cookie effacé, anciennes sessions refusées, autre compte inchangé, défi effacé, événement enregistré et concurrence. TypeScript et build réussis ; avertissement de taille du bundle toujours présent. La présentation et la navigation n’ont pas encore fait l’objet d’une recette navigateur.

## Défis email protégés et essais persistants (lot 52)

Les nouveaux codes sont tirés avec crypto.randomInt et stockés sous forme de HMAC-SHA-256. Le calcul emploie le secret serveur de session, un préfixe propre aux défis email, l’identifiant du compte, sa version de session et le code. Une copie de la colonne seule ne permet donc pas de vérifier hors ligne les six chiffres sans le secret serveur. Une configuration de secret insuffisante empêche la création/vérification du défi.

Le nombre d’erreurs est conservé en PostgreSQL. La vérification verrouille le compte, compare les empreintes en temps constant et valide la transaction de compteur avant de retourner l’échec. Après huit erreurs le défi est effacé ; les tentatives concurrentes ne dépassent pas ce plafond. Un code correct reste utilisable après sept erreurs, une seule fois. Un nouveau défi nécessite une nouvelle étape mot de passe et au moins une minute depuis la précédente émission. Ce délai est lui aussi contrôlé dans l’UPDATE en base ; il ne dépend pas de l’adresse IP ni d’un cache mémoire.

La migration `20260913_two_factor_challenges.sql` ajoute les champs de suivi, élargit la colonne d’empreinte et efface les anciens codes en clair encore en attente. Ces défis de dix minutes doivent être redemandés après mise à jour ; les sessions déjà ouvertes ne sont pas déconnectées par cette migration.

168 tests réussis, dont 119 PostgreSQL. Les nouveaux contrôles couvrent empreinte liée au compte, seize erreurs concurrentes donnant huit erreurs persistées, code correct refusé après blocage, délai avant réémission et reprise avec un nouveau défi, ainsi que réussite après sept erreurs et refus de réutilisation. TypeScript, build Docker et recette complète sur base neuve/restauration réussis. Aucun email réel envoyé.

L’activation/désactivation avec preuve a été ajoutée dans le lot 53. Restent notamment les facteurs résistants au phishing, la limitation globale distribuée des connexions/récupérations, les alertes et les autres chantiers. Une rotation du secret serveur invalide les défis en cours, comme les sessions signées avec ce secret.

## Configuration 2FA avec mot de passe et preuve email (lot 53)

Le profil utilise désormais un parcours FR/EN/AR en deux étapes : mot de passe actuel puis code email de confirmation, pour activer comme pour désactiver. Le commutateur immédiat et sa route setTwoFactor ont été supprimés. Un ancien client doit être rechargé ; il ne dispose plus du chemin de modification directe.

Le défi de configuration est lié au compte, à sa version de session et à une finalité enable ou disable distincte de login. Il utilise les mêmes limites persistantes et le délai de réémission. La demande n’altère pas le réglage. Sans messagerie configurée ou si l’envoi échoue, aucune activation/désactivation ni nouvelle session n’est accordée. Les emails indiquent la finalité du code ; le code a aussi été retiré de leur sujet, qui était journalisé par sendEmail. Le nom affiché dans ce modèle est échappé.

La confirmation relit et verrouille le compte, contrôle la version et la finalité, puis consomme le code. La migration `20260913_two_factor_settings.sql` ajoute la finalité et étend le déclencheur de sécurité aux changements de twoFactorEnabled. Le journal immuable enregistre two_factor_changed. Les anciens cookies sont invalidés et seul l’appareil ayant fourni les deux preuves reçoit un nouveau cookie. Une confirmation concurrente ou rejouée échoue.

172 tests réussis, dont 123 PostgreSQL. Les quatre nouveaux scénarios couvrent activation différée, mauvais mot de passe, codes non utilisables pour se connecter, concurrence/rejeu, désactivation bloquée après huit erreurs, réémission, absence/échec de messagerie et renouvellement de la seule session confirmée. Aucun email réel envoyé. TypeScript, build Docker et scénario complet démarrage/panne/reprise/sauvegarde/restauration réussis. L’interface n’a pas encore fait l’objet d’une recette navigateur.

Restent récupération encadrée d’un compte ayant perdu l’accès à sa boîte, facteurs avancés, limitations globales et alertes de sécurité. Cette étape ne crée pas de contournement automatique de la 2FA en cas de panne de messagerie.
