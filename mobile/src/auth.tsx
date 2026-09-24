import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { API_ORIGIN, apiClient, queryClient, sessionToken, setSessionToken, type Learner } from "./api";
import { clearTemporaryExports } from "./files";

const KEY = `raero.session.v1.${API_ORIGIN.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
const options: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
type Auth = {
  user: Learner | null; restoring: boolean; restoreError: string | null;
  retry: () => Promise<void>; signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  verify: (email: string, code: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
};
const Context = createContext<Auth | null>(null);
export const useAuth = () => { const value = useContext(Context); if (!value) throw new Error("AuthProvider manquant"); return value; };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Learner | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const generation = useRef(0);

  const signOut = useCallback(async () => {
    generation.current++;
    setSessionToken(null); setUser(null); setRestoreError(null);
    await queryClient.cancelQueries(); queryClient.clear();
    await SecureStore.deleteItemAsync(KEY, options);
    await clearTemporaryExports().catch(() => {});
  }, []);

  const accept = async (result: Learner & { nativeSession?: { token: string; expiresAt: string } }) => {
    if (!result.nativeSession?.token) throw new Error("La connexion mobile n’est pas disponible sur ce serveur.");
    const { nativeSession, ...profile } = result;
    await queryClient.cancelQueries(); queryClient.clear();
    await clearTemporaryExports().catch(() => {});
    await SecureStore.setItemAsync(KEY, nativeSession.token, options);
    generation.current++; setSessionToken(nativeSession.token); setUser(profile as Learner); setRestoreError(null);
  };

  const retry = useCallback(async () => {
    const active = ++generation.current;
    setRestoring(true); setRestoreError(null);
    try {
      const saved = await SecureStore.getItemAsync(KEY, options);
      if (active !== generation.current) return;
      if (!saved) { setSessionToken(null); setUser(null); return; }
      setSessionToken(saved);
      const profile = await apiClient.auth.me.query();
      if (active !== generation.current) return;
      if (!profile) await signOut(); else setUser(profile);
    } catch {
      if (active === generation.current) setRestoreError("Impossible de retrouver votre session. Vérifiez votre connexion puis réessayez.");
    } finally { setRestoring(false); }
  }, [signOut]);

  useEffect(() => { void retry(); }, [retry]);
  useEffect(() => queryClient.getQueryCache().subscribe(event => {
    if (event.type === "updated" && event.action.type === "error" && (event.query.state.error as any)?.data?.code === "UNAUTHORIZED" && sessionToken()) void signOut();
  }), [signOut]);
  useEffect(() => queryClient.getMutationCache().subscribe(event => {
    if (event.type === "updated" && event.action.type === "error" && (event.mutation.state.error as any)?.data?.code === "UNAUTHORIZED" && sessionToken()) void signOut();
  }), [signOut]);

  const signIn = async (email: string, password: string) => {
    const result = await apiClient.auth.login.mutate({ email: email.trim().toLowerCase(), password });
    if ("twoFactorRequired" in result) return true;
    await accept(result); return false;
  };
  const verify = async (email: string, code: string) => accept(await apiClient.auth.verifyTwoFactor.mutate({ email: email.trim().toLowerCase(), code }));
  const register = async (name: string, email: string, password: string) => accept(await apiClient.auth.register.mutate({ name, email, password, preferredLanguage: "fr", marketingOptIn: false }));

  return <Context.Provider value={{ user, restoring, restoreError, retry, signOut, signIn, verify, register }}>{children}</Context.Provider>;
}
