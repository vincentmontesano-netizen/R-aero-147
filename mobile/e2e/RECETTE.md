# Recette native R-AERO

Ces scénarios Maestro ciblent exclusivement `com.raero.academy.qa`, avec une API et des comptes fictifs isolés. Ne pas les exécuter sur la production. Préparer les données avec `scripts/mobile-fixtures.ts` sur la base locale `raero_mobile_test`, puis fournir `EMAIL`, `PASSWORD` et `ENROLLMENT_ID` issus du manifeste privé `tmp/mobile/fixture.json`.

Le parcours pédagogique suit `login.yaml`, `media-intro.yaml`, `video-activities.yaml`, `chapter-exam.yaml` et `final-exam-resume.yaml`. Démarrer réellement le lecteur vidéo natif avant les activités. Le dernier scénario ferme et relance l’application pendant la tentative avant de terminer les cinq types de questions et de partager le certificat.

Les scénarios de compte sont séparés : `account.yaml` pour les thèmes et `register-close.yaml` pour une adresse fictive neuve passée en `REGISTER_EMAIL`. Le scénario historique `account.yaml` inclut également inscription et fermeture ; ne pas réutiliser la même adresse pour les deux.

Sur iOS, les onglets ajoutent « tab, … of 3 » au libellé d’accessibilité : les sélecteurs acceptent les deux plateformes. Les défilements centrent les contrôles pour éviter la zone de l’indicateur d’accueil. La proposition système d’enregistrement du mot de passe est fermée par « Plus tard ». Sur le simulateur iOS 26.3 utilisé pour la recette, la proposition de mot de passe fort n’expose pas ses contrôles à XCTest : la fermer avant de saisir le mot de passe fictif, puis reprendre la suite du scénario (inscription ou réinitialisation). Pendant la recette, ce contrôle a été fermé depuis sa position visible sur la capture du simulateur. Ne pas désactiver l’autocomplétion dans le code de l’application pour contourner cette limite de l’outil.

Pour le second facteur, préparer un compte fictif avec 2FA actif et un récepteur SMTP local sans relais externe. Exécuter `two-factor-request.yaml`, récupérer le code du message local et fournir `CODE` et `WRONG_CODE` à `two-factor-confirm.yaml`. Le scénario vérifie le refus du mauvais code, l’acceptation du bon et la restauration de session. Le clavier numérique iOS est fermé en touchant le titre du formulaire.

`password-reset-request.yaml` demande le message depuis l’application. Ouvrir le lien de recette `raero-test://reset-password?token=…` à partir du jeton reçu localement, puis exécuter `password-reset-confirm.yaml` avec `NEW_PASSWORD`. Vérifier ensuite côté API le refus de l’ancien mot de passe et le maintien du second facteur. Garder les messages et jetons hors Git.

`offline-restore.yaml` attend une API volontairement indisponible avec une session déjà enregistrée ; `recover-connection.yaml` s’exécute après remise en service. Ne couper que le serveur ou l’émulateur réservé à la recette. `save-before-leaving.yaml` requiert une tentative active et une sauvegarde artificiellement ralentie sur ce serveur isolé ; vérifier aussi la dernière révision enregistrée côté API.

Les captures, comptes, messages SMTP, jetons et rapports bruts vont dans `tmp/`, hors Git. Les résultats et limites de la livraison sont consignés dans `mobile/DELIVERY.md`.
