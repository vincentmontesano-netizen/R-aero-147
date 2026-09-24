import { useState } from "react";
import { Alert, Linking } from "react-native";
import { useAuth } from "../../src/auth";
import { useTheme } from "../../src/theme";
import { API_ORIGIN, apiClient } from "../../src/api";
import { Action, Brand, Card, Copy, Field, Heading, Notice, Screen } from "../../src/ui";

export default function Account() {
  const { user, signOut } = useAuth(); const { mode, setMode } = useTheme();
  const [closing, setClosing] = useState(false);const [password, setPassword] = useState("");const [busy, setBusy] = useState(false);const [error, setError] = useState("");
  const close = async () => { setBusy(true); setError("");try { await apiClient.me.eraseAccount.mutate({ password }); await signOut(); }catch(e){setError(e instanceof Error ? e.message : "Fermeture impossible.");}finally{setBusy(false);} };
  return <Screen><Brand /><Heading>Mon compte</Heading><Card><Heading small>{user?.name}</Heading><Copy muted>{user?.email}</Copy><Copy>Votre compte et vos formations sont partagés avec le site R-AERO.</Copy></Card>
    <Action secondary title={mode === "dark" ? "Passer en mode clair" : "Passer en mode sombre"} onPress={() => setMode(mode === "dark" ? "light" : "dark")} />
    <Action secondary title="Contacter R-AERO" onPress={() => { void Linking.openURL(`${API_ORIGIN}/contact`); }} />
    <Action secondary title="Confidentialité et mentions légales" onPress={() => { void Linking.openURL(`${API_ORIGIN}/legal`); }} />
    <Action title="Me déconnecter" onPress={() => { void signOut(); }} />
    {!closing ? <Action secondary title="Fermer mon compte" onPress={() => setClosing(true)} /> : <Card><Heading small>Fermeture du compte</Heading><Copy>La fermeture retire votre accès. Certains justificatifs réglementaires et financiers sont conservés selon les obligations applicables. Elle ne résilie pas l’abonnement distinct de votre entreprise.</Copy><Field label="Votre mot de passe" value={password} onChangeText={setPassword} secureTextEntry editable={!busy} />{!!error && <Notice>{error}</Notice>}<Action title="Confirmer la fermeture" busy={busy} onPress={() => Alert.alert("Fermer mon compte", "Cette action met fin à votre accès R-AERO. Souhaitez-vous continuer ?", [{ text: "Annuler", style: "cancel" }, { text: "Fermer le compte", style: "destructive", onPress: () => { void close(); } }])} /><Action secondary title="Conserver mon compte" onPress={() => { setClosing(false);setPassword(""); }} disabled={busy} /></Card>}
  </Screen>;
}
