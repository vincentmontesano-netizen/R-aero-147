# Proxy, cookies et choix de l’image de production

Le serveur ne fait confiance à aucun en-tête de proxy par défaut. `TRUST_PROXY` accepte une liste séparée par des virgules d’adresses IP ou de réseaux CIDR correspondant aux proxys réellement présents. Les valeurs true, nombres de sauts, noms d’hôtes et réseaux /0 sont refusées au démarrage. Une configuration invalide termine le processus avec un code d’échec ; l’entrée Docker arrête alors PostgreSQL proprement.

Le proxy doit remplacer les en-têtes de protocole et de client reçus de l’extérieur, et l’accès direct au serveur applicatif doit être limité par le réseau. Ne pas copier une plage privée entière sans vérifier quels services peuvent y joindre l’application. Express détermine ensuite l’adresse cliente à partir de la chaîne de proxys approuvés ; le journal d’accès utilise req.ip sans relire directement X-Forwarded-For. Référence : [Express derrière un proxy](https://expressjs.com/en/guide/behind-proxies/).

Les cookies de session sont HttpOnly, SameSite=Lax, sans domaine élargi et avec chemin /. En production ils sont toujours Secure, même si le proxy n’est pas configuré ; en développement ils le deviennent si Express reconnaît HTTPS. Aucun balayage manuel de X-Forwarded-Proto n’est effectué. Une instance de production doit être utilisée en HTTPS : un test HTTP avec un client Node qui retransmet lui-même les cookies ne prouve pas leur fonctionnement dans un navigateur en HTTP. Les retours de paiement par navigation GET restent compatibles avec SameSite=Lax ; une intégration tierce embarquée nécessitant des cookies intersites n’est pas prise en charge implicitement.

## Compose

`docker-compose.yml` construit l’image locale. `docker-compose.prod.yml` utilise RAERO_IMAGE, obligatoire et sans valeur latest implicite. Fournir la référence de registre avec digest de l’image effectivement validée (`registre/image@sha256:...`) ; Compose impose une valeur non vide mais ne valide pas lui-même la syntaxe du digest. Les paramètres applicatifs et les 30 secondes d’arrêt sont identiques entre les deux fichiers. L’image de production n’a pas été publiée ou déployée dans cette intervention.

Le fichier `.env.production.example` ne fournit plus de mot de passe administrateur utilisable ou de faux secrets fournisseur. Compléter les valeurs réellement nécessaires : premier ADMIN, origines HTTPS, proxys, prix Stripe et fournisseurs activés. PUBLIC_APP_URL sert aux retours de facturation ; APP_ORIGIN reste utilisé pour certains liens applicatifs. Le secret JWT vide continue d’être généré et conservé par le conteneur.

## Vérifications

156 tests réussis, dont cinq nouveaux tests HTTP : refus de la confiance générale, en-têtes falsifiés ignorés en accès direct, chaîne de proxy limitée à l’adresse non approuvée la plus proche, protocole transmis non recherché arbitrairement et cookies Secure en production. TypeScript et construction Docker réussis.

Configuration Compose comparée sans afficher les secrets ; image obligatoire vérifiée. Image exécutée sans réseau externe : TRUST_PROXY=true refusé avec code 1 et arrêt PostgreSQL propre, configuration vide démarrant normalement, session historique conservée, attributs du cookie de déconnexion vérifiés. Restent recette avec le véritable reverse proxy/TLS, navigateur, supervision et contrôle de la publication CI avant déploiement.
