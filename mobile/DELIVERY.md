# R-AERO mobile — réalisation et preuves

Objectif : permettre aux apprenants de suivre leurs e-learning directement dans une application iOS et Android, avec leur compte et leur progression R-AERO existants.

Base choisie : React Native / Expo SDK 57 stable, écrans natifs partagés, API tRPC existante. Les contenus interactifs, médias, règles d’évaluation et accès achetés doivent rester cohérents avec le web. Le contenu livré dans l’application ne doit pas dépendre d’un serveur de développement.

## Critères de livraison

- Applications iOS et Android compilées, installées et exercées sur simulateur/émulateur ; builds de distribution préparés.
- Connexion existante, second facteur si activé, inscription, récupération de mot de passe et déconnexion ; session stockée de façon sécurisée, révocation serveur conservée.
- Liste des formations accessibles, reprise, chapitres, diapositives, images, audio et vidéo, interactions pédagogiques et progression synchronisée avec le web.
- Examens de chapitre et finaux : types de questions existants, limite de tentatives, échéance serveur, sauvegarde des réponses, reprise après fermeture, gestion du passage en arrière-plan et des coupures réseau.
- Résultats et certificats accessibles, téléchargement/partage autorisé sans fuite des identifiants vers des services externes.
- Navigation tactile, zones sûres, mode clair/sombre, textes français, messages d’erreur et nouvelle tentative ; contrôles sur les deux plateformes.
- Compte et accès aux informations de confidentialité/support ; fermeture de compte via les règles du serveur.
- Source versionnée, instructions de compilation et preuves de recette. Pour une publication publique, comptes de développeur, signature, métadonnées et examen des stores à vérifier ; distribution demandée au propriétaire.

## État au 24 septembre 2026

- Inventaire effectué : aucun projet mobile R-AERO préexistant ; API chapitres, diapositives, évaluations et certificats identifiée.
- Implémenté : transport natif, connexion/2FA, bibliothèque, chapitres, diapositives et activités, examens sauvegardés, certificats et compte.
- Vérifié localement : TypeScript web/serveur et mobile ; 40 tests ciblés passent avec PostgreSQL (sessions, révocation, examens, échéance et reprise exacte sans nouvelle tentative).
- Android : compilation Release autonome réussie, installation et recette sur l’émulateur dédié `emulator-5580` (Android 14 / Pixel 6).
- Parcours Android exercé : connexion, image privée, lecture/pause audio, quatre activités vidéo, quiz de diapositive, examen de chapitre, examen final avec les cinq types de questions, fermeture/réouverture pendant l’examen et reprise de la même tentative, réussite 5/5, certificat et feuille de partage PDF.
- Compte Android exercé : mode clair conservé après relance, déconnexion, inscription, bibliothèque/certificats vides du nouveau compte, fermeture et refus de reconnexion au compte fermé.
- Vérification HTTP : mêmes compte et progression pour navigateur/application, médias privés refusés anonymement et depuis un autre compte, lecture partielle audio/vidéo, réponses d’examen non divulguées, parcours terminé à 100 % et certificat PDF protégé.
- CI au commit `caafad984646aa16cff10e0453d8913dde487672` : [514 tests serveur et contrôles Docker réussis](https://github.com/vincentmontesano-netizen/R-aero-147/actions/runs/36056340476). Deux tests supplémentaires couvrent la présentation des erreurs de formulaire.
- iOS : compilation locale arrêtée par Xcode 26.3, inférieur au minimum 26.4 du SDK 57 ; workflow GitHub macOS 26 préparé pour fournir le binaire simulateur.
- À faire : recette iOS, contrôles de coupure réseau et sauvegardes concurrentes sur le binaire final, validation des derniers changements, distribution signée et déploiement de l’API mobile.

## Recette isolée

`scripts/mobile-fixtures.ts` refuse toute base autre que `raero_mobile_test` sur localhost. Il prépare des utilisateurs fictifs, des médias privés, une revue pédagogique distincte de l’auteur et une version publiée figée. Les comptes et identifiants sont enregistrés dans `tmp/mobile/fixture.json`, hors Git.

La recette Android utilise `EXPO_PUBLIC_API_URL=http://10.0.2.2:3189`, celle du simulateur iOS `http://127.0.0.1:3189`, avec `RAERO_MOBILE_VARIANT=qa`. La version de production utilise HTTPS et l’identifiant distinct `com.raero.academy`.

La compilation iOS GitHub produit un `.app` autonome pour simulateur ; elle ne constitue pas une distribution App Store. Les profils EAS sont préparés pour une distribution ultérieure selon le compte développeur et la signature du propriétaire.

Preuves locales : `tmp/mobile/contract-android.json`, captures et rapports Maestro sous `tmp/mobile/maestro/`, capture de la feuille de partage `tmp/mobile/android-certificate-share.png`. Ces artefacts contiennent uniquement les données du jeu de recette local.

## Compilation

À la racine : `pnpm install --frozen-lockfile`. Dans `mobile` : `npm ci`, puis `npm run check` et `npx expo install --check`.

- iOS : macOS/Xcode 26.4 minimum, CocoaPods ; `npx expo prebuild --platform ios`, puis `npx expo run:ios --configuration Release`. Le workflow `mobile-ios.yml` compile un simulateur autonome sur GitHub avec le backend de recette local.
- Android : JDK 21 et SDK Android 36 ; `npx expo prebuild --platform android`, puis `npx expo run:android --variant release`. Les binaires QA générés localement servent aux tests ; la clé de débogage générée ne constitue pas une signature de distribution publique.
- Production : omettre `RAERO_MOBILE_VARIANT=qa` et conserver l’API HTTPS par défaut. Les profils de `eas.json` préparent les builds de distribution, qui nécessitent le compte et les clés de signature du propriétaire.

Les dossiers `ios/`, `android/`, `artifacts/` et les fichiers de signature sont générés ou privés et ne sont pas versionnés. Le logo et l’emblème existants sont repris sans modification ; Expo produit les tailles d’icône requises lors de la compilation.

## Règles conservées

Les achats, licences, affiliations, versions de formation et évaluations restent contrôlés par le serveur. Aucune réussite, attestation ni autorisation de contenu ne doit être inventée côté téléphone. Les examens continuent à expirer pendant une interruption. Les identifiants et clés de signature restent hors Git.

Références : [Expo — création](https://docs.expo.dev/get-started/create-a-project/), [compilation locale](https://docs.expo.dev/guides/local-app-overview/).
