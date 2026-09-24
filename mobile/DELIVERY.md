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

## État au 25 septembre 2026

- Inventaire effectué : aucun projet mobile R-AERO préexistant ; API chapitres, diapositives, évaluations et certificats identifiée.
- Implémenté : transport natif, connexion/2FA, bibliothèque, chapitres, diapositives et activités, examens sauvegardés, certificats et compte.
- Vérifié localement : TypeScript web/serveur et mobile ; 40 tests ciblés passent avec PostgreSQL (sessions, révocation, examens, échéance et reprise exacte sans nouvelle tentative).
- Android : compilation Release autonome réussie, installation et recette sur l’émulateur dédié `emulator-5580` (Android 14 / Pixel 6).
- Parcours Android exercé : connexion, image privée, lecture/pause audio, quatre activités vidéo, quiz de diapositive, examen de chapitre, examen final avec les cinq types de questions, fermeture/réouverture pendant l’examen et reprise de la même tentative, réussite 5/5, certificat et feuille de partage PDF.
- Compte Android exercé : mode clair conservé après relance, déconnexion, inscription, bibliothèque/certificats vides du nouveau compte, fermeture et refus de reconnexion au compte fermé.
- Vérification HTTP : mêmes compte et progression pour navigateur/application, médias privés refusés anonymement et depuis un autre compte, lecture partielle audio/vidéo, réponses d’examen non divulguées, parcours terminé à 100 % et certificat PDF protégé.
- CI au commit `4c32e70ab0bf74326aee5aebc2e5f9b19339b8fe` : [130 fichiers de tests et contrôles Docker réussis](https://github.com/vincentmontesano-netizen/R-aero-147/actions/runs/36059724476) ; [contrôle du code mobile réussi](https://github.com/vincentmontesano-netizen/R-aero-147/actions/runs/36059725016).
- iOS : droits du trousseau corrigés par la signature ad hoc Xcode ; connexion et restauration de session validées sur le simulateur dédié iOS 26.3. Le parcours complet passe : médias privés, activités vidéo, quiz, examen de chapitre, examen final avec cinq types de questions, fermeture/réouverture avec reprise de la même tentative, réussite 5/5 et partage du certificat PDF. Le tableau de bord web retrouve la même progression et le même certificat. Dernière compilation autonome [36063807347](https://github.com/vincentmontesano-netizen/R-aero-147/actions/runs/36063807347) réussie au commit `6705d31ce5c179410493cd84273db3c98a525dd6`. Xcode local 26.3 ne peut pas compiler le SDK 57 (minimum 26.4).
- Android : reprise après coupure réseau vérifiée ; une réponse modifiée pendant une sauvegarde retardée de huit secondes est bien enregistrée avant de quitter (révision serveur 2). Le tableau de bord web affiche la formation terminée sur Android et le même certificat.
- Sécurité Android : code 2FA incorrect refusé, code valide accepté, session conservée après relance. Demande de récupération et modification du mot de passe exercées avec un récepteur SMTP local ; ancien mot de passe refusé, second facteur toujours requis. Retour vers la connexion corrigé et vérifié sur le binaire QA build 9 ; la session locale est effacée après le changement de mot de passe.
- API mobile déployée sur Hostinger : fusion main `67e190464f4ea0b4677e0d0317b9fd4e89466209`, image `sha256:9efa8f665c30a2b7257ba4b68e87b1d991525bfaffaf9c3abdc5fdbcbb6ce1b9`. Image testée dans des volumes isolés (démarrage, redémarrage, sauvegarde/restauration) ; production saine, connexions navigateur et native vérifiées en HTTPS avec isolation des transports.
- Android signé : APK et AAB 1.0.0 compilés avec les quatre architectures (`armeabi-v7a`, `arm64-v8a`, `x86`, `x86_64`). Signature APK v2, alignement 16 Ko et signature de toutes les entrées utiles de l’AAB vérifiés. APK installé : connexion au compte existant via HTTPS en production, identité, relance avec session conservée et déconnexion réussies. Livrables locaux dans `../R-AERO-Mobile-1.0.0/` (à côté du dossier de travail), clés privées dans le dossier protégé distinct `../R-AERO-Mobile-Signing/`, hors Git.
- Compte et sécurité iOS : modes clair/sombre et choix conservé après relance ; inscription, états vides, fermeture et refus de reconnexion au compte fermé. Sur le binaire final `6705d31`, mauvais code 2FA refusé, bon code accepté, session conservée après relance ; demande et changement de mot de passe par lien natif, retour vers la connexion, ancien mot de passe refusé et second facteur conservé. Dialogues système Mots de passe traités pendant la recette ; la proposition de mot de passe fort n’était pas accessible à XCTest (limite d’automatisation documentée).
- Réseau iOS sur le binaire final : arrêt contrôlé de l’API locale, erreur de restauration et bouton « Réessayer » affichés ; API remise en service, même session restaurée et formation validée retrouvée. Serveur de recette sain après le test.
- iOS pour appareil réel : [archive de production compilée et contrôlée](https://github.com/vincentmontesano-netizen/R-aero-147/actions/runs/36067114394) au commit `a4c9b63456f0e5ffe4be970a86e034daa734c09d`, avec le SDK `iphoneos`, l’identifiant `com.raero.academy` et l’API HTTPS publique. Archive récupérée et contrôlée localement : plateforme Mach-O `IOS`, iOS minimum 16.4, JavaScript embarqué, aucune URL de recette, application effectivement non signée. SHA-256 : `20d0f1725569d8bd439232aea633ca5c03c3746a5cff704f3f6089338b571c9f`. Elle ne constitue pas un IPA installable. Le guide `IOS-DISTRIBUTION.md` décrit la suite avec l’équipe Apple du propriétaire.
- À faire : signature et distribution sur iPhone physique (TestFlight ou App Store). Aucun certificat Apple valide sur ce Mac ; disponibilité du compte Apple Developer demandée au propriétaire.

## Recette isolée

`scripts/mobile-fixtures.ts` refuse toute base autre que `raero_mobile_test` sur localhost. Il prépare des utilisateurs fictifs, des médias privés, une revue pédagogique distincte de l’auteur et une version publiée figée. Les comptes et identifiants sont enregistrés dans `tmp/mobile/fixture.json`, hors Git.

La recette Android utilise `EXPO_PUBLIC_API_URL=http://10.0.2.2:3189`, celle du simulateur iOS `http://127.0.0.1:3189`, avec `RAERO_MOBILE_VARIANT=qa`. La version de production utilise HTTPS et l’identifiant distinct `com.raero.academy`.

Le code applicatif des binaires correspond à `6705d31` ; les ajustements ultérieurs concernent les scénarios de recette, leur documentation et le workflow de compilation pour appareil iOS. Les écrans et règles de l’application n’ont pas changé. Le parcours pédagogique complet iOS a été validé sur `dc3f9de` ; la seule modification d’écran entre ces versions est le retour après réinitialisation, validé sur `6705d31`.

La compilation iOS GitHub produit un `.app` autonome pour simulateur ; elle ne constitue pas une distribution App Store. Les profils EAS sont préparés pour une distribution ultérieure selon le compte développeur et la signature du propriétaire.

Preuves locales : `tmp/mobile/contract-android.json`, `tmp/mobile/web-parity.json`, `tmp/mobile/contract-ios.json`, `tmp/mobile/web-parity-ios.json`, `tmp/mobile/delayed-save-proof.json`, `tmp/mobile/auth-security-proof.json`, `tmp/mobile/auth-security-proof-ios.json`, `tmp/mobile/ios-account-proof.json`, `tmp/mobile/ios-connection-proof.json`, `tmp/mobile/ios-device-archive-proof.json`, `tmp/mobile/android-production-ui.json`, captures et rapports Maestro sous `tmp/mobile/maestro/`, `tmp/mobile/maestro-android/` et `tmp/mobile/maestro-ios/`, capture de la feuille de partage `tmp/mobile/android-certificate-share.png`. Les rapports de recette isolée contiennent des comptes fictifs ; la preuve de connexion du binaire Android à la production confirme seulement les assertions, sans identifiants. Les journaux bruts de cette vérification restent privés et hors Git.

## Compilation

À la racine : `pnpm install --frozen-lockfile`. Dans `mobile` : `npm ci`, puis `npm run check` et `npx expo install --check`.

- iOS : macOS/Xcode 26.4 minimum, CocoaPods ; `npx expo prebuild --platform ios`, puis `npx expo run:ios --configuration Release`. Le workflow `mobile-ios.yml` compile un simulateur autonome sur GitHub avec le backend de recette local.
- Android : JDK 21 et SDK Android 36 ; `npx expo prebuild --platform android`, puis `npx expo run:android --variant release`. Les binaires QA générés localement servent aux tests ; la clé de débogage générée ne constitue pas une signature de distribution publique.
- Android signé localement : `bash scripts/build-android-distribution.sh` depuis `mobile`, avec `ANDROID_HOME`, `JAVA_HOME`, `RAERO_ANDROID_KEYSTORE` et `RAERO_ANDROID_PASSWORD_FILE`. Le script compile APK et AAB avec l’API HTTPS publique et une clé externe (alias `raero-upload`), puis vérifie signature et alignement. Les clés et mots de passe ne sont jamais versionnés.
- Production : omettre `RAERO_MOBILE_VARIANT=qa` et conserver l’API HTTPS par défaut. Les profils de `eas.json` préparent les builds de distribution, qui nécessitent le compte et les clés de signature du propriétaire.

Les dossiers `ios/`, `android/`, `artifacts/` et les fichiers de signature sont générés ou privés et ne sont pas versionnés. Le logo et l’emblème existants sont repris sans modification ; Expo produit les tailles d’icône requises lors de la compilation.

## Règles conservées

Les achats, licences, affiliations, versions de formation et évaluations restent contrôlés par le serveur. Aucune réussite, attestation ni autorisation de contenu ne doit être inventée côté téléphone. Les examens continuent à expirer pendant une interruption. Les identifiants et clés de signature restent hors Git.

Références : [Expo — création](https://docs.expo.dev/get-started/create-a-project/), [compilation locale](https://docs.expo.dev/guides/local-app-overview/).
