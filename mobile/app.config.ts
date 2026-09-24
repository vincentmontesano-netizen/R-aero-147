import type { ExpoConfig } from "expo/config";

const testing = process.env.RAERO_MOBILE_VARIANT === "qa";
const config: ExpoConfig = {
  name: testing ? "R-AERO Test" : "R-AERO",
  slug: "raero-mobile",
  version: "1.0.0",
  scheme: testing ? "raero-test" : "raero",
  orientation: "default",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: testing ? "com.raero.academy.qa" : "com.raero.academy",
    supportsTablet: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      ...(testing ? { NSAppTransportSecurity: { NSAllowsLocalNetworking: true, NSAllowsArbitraryLoads: true } } : {}),
    },
  },
  android: {
    package: testing ? "com.raero.academy.qa" : "com.raero.academy",
    versionCode: 1,
    blockedPermissions: ["android.permission.RECORD_AUDIO", "android.permission.CAMERA", "android.permission.READ_MEDIA_IMAGES", "android.permission.READ_MEDIA_VIDEO"],
  },
  plugins: [
    "expo-router",
    "expo-splash-screen",
    "expo-sharing",
    "expo-secure-store",
    "expo-localization",
    "expo-video",
    ["expo-audio", { microphonePermission: false, recordAudioAndroid: false }],
    ["expo-build-properties", { android: { usesCleartextTraffic: testing } }],
  ],
  extra: { variant: testing ? "qa" : "production" },
};
export default config;
