import { useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, View } from "react-native";
import { useAuth } from "../src/auth";
import { apiClient, API_ORIGIN } from "../src/api";
import { Action, Brand, Card, Copy, Field, Heading, Notice, Screen } from "../src/ui";

export default function SignIn() {
  const auth = useAuth();
  const [mode, setMode] = useState<"login" | "register" | "reset" | "factor">("login");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [name, setName] = useState(""); const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const changeMode = (value: typeof mode) => { setMode(value); setError(""); setMessage(""); setPassword(""); setCode(""); };
  const submit = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      if (mode === "register") await auth.register(name, email, password);
      else if (mode === "factor") await auth.verify(email, code);
      else if (mode === "reset") { await apiClient.auth.requestPasswordReset.mutate({ email: email.trim().toLowerCase() }); setMessage("Si un compte correspond à cette adresse et que le service est disponible, vous recevrez les instructions par e-mail."); }
      else if (await auth.signIn(email, password)) { setMode("factor"); setPassword(""); }
    } catch (e) { setError(e instanceof Error ? e.message : "Connexion impossible. Réessayez."); }
    finally { setBusy(false); }
  };
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}><Screen>
    <Brand />
    <View style={{ gap: 12, marginTop: 14 }}><Heading>{mode === "register" ? "Votre prochain niveau commence ici." : mode === "factor" ? "Vérifiez votre connexion." : mode === "reset" ? "Retrouvez votre accès." : "Vos formations, à portée de main."}</Heading><Copy muted>{mode === "factor" ? "Saisissez le code à six chiffres envoyé à votre adresse e-mail." : "Retrouvez vos cours et votre progression avec votre compte R-AERO."}</Copy></View>
    <Card>
      {mode === "register" && <Field label="Nom complet" value={name} onChangeText={setName} autoComplete="name" textContentType="name" editable={!busy} />}
      {mode !== "factor" && <Field label="Adresse e-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" editable={!busy} />}
      {(mode === "login" || mode === "register") && <Field label={mode === "register" ? "Mot de passe · 8 caractères minimum" : "Mot de passe"} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete={mode === "register" ? "new-password" : "current-password"} textContentType={mode === "register" ? "newPassword" : "password"} editable={!busy} onSubmitEditing={() => { void submit(); }} />}
      {mode === "factor" && <Field label="Code de vérification" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} textContentType="oneTimeCode" autoComplete="one-time-code" editable={!busy} />}
      {!!error && <Notice>{error}</Notice>}{!!message && <Notice>{message}</Notice>}
      <Action title={mode === "register" ? "Créer mon compte" : mode === "factor" ? "Vérifier le code" : mode === "reset" ? "Recevoir les instructions" : "Me connecter"} onPress={() => { void submit(); }} busy={busy} testID="auth-submit" />
      {mode === "login" && <Action secondary title="Mot de passe oublié" onPress={() => changeMode("reset")} disabled={busy} />}
    </Card>
    <Action secondary title={mode === "login" ? "Créer un compte R-AERO" : "Retour à la connexion"} onPress={() => changeMode(mode === "login" ? "register" : "login")} disabled={busy} />
    <Action secondary title="Confidentialité et informations légales" onPress={() => { void Linking.openURL(`${API_ORIGIN}/legal`); }} />
  </Screen></KeyboardAvoidingView>;
}
