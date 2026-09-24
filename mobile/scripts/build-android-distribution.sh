#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

: "${ANDROID_HOME:?Set the Android SDK directory}"
: "${JAVA_HOME:?Set a JDK 21 directory}"
: "${RAERO_ANDROID_KEYSTORE:?Set the private R-AERO keystore path}"
: "${RAERO_ANDROID_PASSWORD_FILE:?Set the private keystore password file path}"
test -f "$RAERO_ANDROID_KEYSTORE"
test -f "$RAERO_ANDROID_PASSWORD_FILE"
export RAERO_MOBILE_VARIANT=production
export EXPO_PUBLIC_API_URL=https://r-aero-academy.com
npm run check
npx expo prebuild --platform android --no-install
(
  cd android
  ./gradlew --no-daemon --max-workers=2 \
    -I ../scripts/android-signing.gradle assembleRelease bundleRelease
)
mkdir -p artifacts/android-production
cp android/app/build/outputs/apk/release/app-release.apk artifacts/android-production/R-AERO-1.0.0.apk
cp android/app/build/outputs/bundle/release/app-release.aab artifacts/android-production/R-AERO-1.0.0.aab
"$ANDROID_HOME/build-tools/36.0.0/apksigner" verify --verbose --print-certs artifacts/android-production/R-AERO-1.0.0.apk
"$ANDROID_HOME/build-tools/36.0.0/zipalign" -c -P 16 4 artifacts/android-production/R-AERO-1.0.0.apk
"$JAVA_HOME/bin/jarsigner" -verify artifacts/android-production/R-AERO-1.0.0.aab
