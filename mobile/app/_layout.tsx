import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { api, queryClient, reactClient } from "../src/api";
import { AuthProvider, useAuth } from "../src/auth";
import { ThemeProvider, useTheme } from "../src/theme";
import { Action, Brand, Loading, Notice, Screen } from "../src/ui";

function Navigation() {
  const { user, restoring, restoreError, retry, signOut } = useAuth();
  const { colors, mode } = useTheme();
  return <><StatusBar style={mode === "dark" ? "light" : "dark"} />
    {restoring ? <Screen><Brand /><Loading message="Ouverture de votre espace…" /></Screen> : restoreError ? <Screen><Brand /><Notice>{restoreError}</Notice><Action title="Réessayer" onPress={() => { void retry(); }} /><Action secondary title="Utiliser un autre compte" onPress={() => { void signOut(); }} /></Screen> :
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Protected guard={!user}><Stack.Screen name="sign-in" /></Stack.Protected>
        <Stack.Protected guard={!!user}><Stack.Screen name="(tabs)" /><Stack.Screen name="course/[id]" /><Stack.Screen name="exam/[id]" /></Stack.Protected>
        <Stack.Screen name="reset-password" />
      </Stack>}
  </>;
}

export default function RootLayout() {
  return <SafeAreaProvider><ThemeProvider><api.Provider client={reactClient} queryClient={queryClient}><QueryClientProvider client={queryClient}><AuthProvider><Navigation /></AuthProvider></QueryClientProvider></api.Provider></ThemeProvider></SafeAreaProvider>;
}
