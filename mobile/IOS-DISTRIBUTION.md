# R-AERO — signature et distribution iOS

Le projet natif est prêt pour les deux plateformes. La recette iOS détaillée figure dans `DELIVERY.md`. Une archive de production non signée ne peut pas être installée sur un iPhone ni être envoyée telle quelle à TestFlight.

## Archive de production

Le workflow manuel `.github/workflows/mobile-ios-device.yml` utilise Xcode 26.4.1, le SDK appareil `iphoneos`, l’identifiant `com.raero.academy` et l’API `https://r-aero-academy.com`. Il compile les sources pour un appareil réel et embarque le JavaScript ; aucun serveur de développement n’est nécessaire. La signature est volontairement laissée à la prochaine étape, avec le compte du propriétaire.

Depuis le dépôt Git :

```sh
gh workflow run mobile-ios-device.yml --ref dev
```

L’artefact `raero-ios-unsigned-device-<commit>` contient l’archive Xcode, son empreinte SHA-256 et le manifeste des contrôles exécutés. Il sert à vérifier la compilation pour appareil et à préparer la signature ; les essais sur simulateur ne prouvent pas à eux seuls le fonctionnement sur un iPhone physique.

Archive vérifiée pour cette livraison : [run 36067114394](https://github.com/vincentmontesano-netizen/R-aero-147/actions/runs/36067114394), commit `a4c9b63456f0e5ffe4be970a86e034daa734c09d`, version 1.0.0 / build 1, iOS 16.4 minimum. Empreinte SHA-256 : `20d0f1725569d8bd439232aea633ca5c03c3746a5cff704f3f6089338b571c9f`. Contrôles locaux : binaire pour appareil `IOS`, contenu autonome et absence de signature Apple.

## Avec le compte Apple du propriétaire

Un accès à l’équipe Apple Developer, une identité de signature et le profil correspondant au mode de distribution choisi sont encore nécessaires. Vérification du Mac : aucun compte Apple configuré dans Xcode, aucune identité de signature valide ; le CLI Expo n’est pas connecté.

Avec Xcode 26.4 ou ultérieur, ajouter le compte dans les réglages de Xcode et vérifier que l’équipe peut utiliser `com.raero.academy`. Préparer le profil de distribution, puis signer et exporter l’application depuis l’archive ou recompiler avec cette équipe. Les profils Expo EAS de `eas.json` constituent une autre voie de compilation signée après configuration du compte Expo et de l’équipe Apple.

Pour une distribution TestFlight, il faut également la fiche App Store Connect et les droits d’accès correspondants. Pour une distribution directe de test, il faut les appareils enregistrés et le profil adapté. La disponibilité de l’identifiant d’application dans l’équipe du propriétaire reste à vérifier.

Après signature, vérifier les droits du trousseau et installer le binaire signé sur un iPhone : connexion au compte existant, relance, lecture des médias, examen et certificat. Les comptes de recette doivent alors être provisionnés dans l’environnement autorisé pour cet essai. Ne pas présenter l’archive non signée comme un IPA installable.

Références Apple : [distribution pour les tests et les versions publiques](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases), [distribution sur les appareils enregistrés](https://developer.apple.com/documentation/xcode/distributing-your-app-to-registered-devices), [profil App Store](https://developer.apple.com/help/account/provisioning-profiles/create-an-app-store-provisioning-profile).
