import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { mediaSource, sessionToken } from "./api";

const directory = `${FileSystem.cacheDirectory}raero-exports/`;
export async function clearTemporaryExports() { await FileSystem.deleteAsync(directory, { idempotent: true }); }

export async function sharePdf(url: string, title: string) {
  if (!FileSystem.cacheDirectory) throw new Error("Le stockage temporaire est indisponible.");
  if (!await Sharing.isAvailableAsync()) throw new Error("Le partage de documents est indisponible sur cet appareil.");
  const source = mediaSource(url);
  const credential = sessionToken();
  const name = title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 90) || "document";
  const target = `${directory}${Date.now()}-${name}.pdf`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  try {
    const result = await FileSystem.downloadAsync(source.uri, target, { headers: source.headers });
    if (result.status !== 200) throw new Error("Le document n’a pas pu être téléchargé. Vérifiez votre accès et réessayez.");
    const prefix = await FileSystem.readAsStringAsync(result.uri, { encoding: FileSystem.EncodingType.Base64, position: 0, length: 5 });
    if (prefix !== "JVBERi0=") throw new Error("Le serveur n’a pas fourni un document PDF valide.");
    if (credential !== sessionToken()) throw new Error("Votre session a changé. Rouvrez le document depuis votre compte.");
    await Sharing.shareAsync(result.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: title });
  } finally { await FileSystem.deleteAsync(target, { idempotent: true }); }
}
