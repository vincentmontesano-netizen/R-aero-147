import { useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { apiClient } from "../src/api";
import { Action, Copy, Field, Heading, Notice, Screen } from "../src/ui";
export default function ResetPassword() {
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(typeof params.token === "string" ? params.token : "");
  const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState(false);
  const submit = async () => { setBusy(true); setError(""); try { await apiClient.auth.resetPassword.mutate({ token, password }); setDone(true); } catch(e) { setError(e instanceof Error ? e.message : "Modification impossible."); } finally { setBusy(false); } };
  return <Screen><Heading>Nouveau mot de passe</Heading>{done ? <Copy>Votre mot de passe a été modifié. Reconnectez-vous avec ce nouveau mot de passe.</Copy> : <><Field label="Code du lien de récupération" value={token} onChangeText={setToken} autoCapitalize="none" /><Field label="Nouveau mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />{!!error && <Notice>{error}</Notice>}<Action title="Modifier mon mot de passe" onPress={() => { void submit(); }} busy={busy} /></>}<Action secondary title="Retour" onPress={() => router.replace("/")} /></Screen>;
}
