// Local filesystem storage. Generated files (certificates, invoices, catalogue,
// AI media) are written under STORAGE_DIR and served at /storage/{key} by
// registerStorageProxy.

import { promises as fs } from "node:fs";
import path from "node:path";

export const STORAGE_DIR =
  process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage");

export function normalizeStorageKey(relKey: string): string {
  if (!relKey || relKey.includes("\\") || relKey.includes("\0") || relKey.startsWith("/") ||
      relKey.split("/").some(segment => !segment || segment === "." || segment === "..")) {
    throw new Error("Invalid storage key");
  }
  return relKey;
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  _contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeStorageKey(relKey));
  const filePath = path.join(STORAGE_DIR, key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const buf = typeof data === "string" ? Buffer.from(data) : Buffer.from(data as Uint8Array);
  await fs.writeFile(filePath, buf, { flag: "wx" });
  return { key, url: `/storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeStorageKey(relKey);
  return { key, url: `/storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  return `/storage/${normalizeStorageKey(relKey)}`;
}
