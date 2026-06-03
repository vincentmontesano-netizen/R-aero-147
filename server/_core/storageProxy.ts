import type { Express } from "express";
import { promises as fs } from "node:fs";
import path from "node:path";

const STORAGE_DIR = process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage");

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
};

/** Serves files saved by storagePut at /storage/{key}. */
export function registerStorageProxy(app: Express) {
  app.get("/storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    try {
      // Prevent path traversal.
      const safeKey = path.normalize(key).replace(/^(\.\.[/\\])+/, "");
      const filePath = path.join(STORAGE_DIR, safeKey);
      if (!filePath.startsWith(STORAGE_DIR)) {
        res.status(400).send("Invalid storage key");
        return;
      }
      const data = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      res.set("Content-Type", CONTENT_TYPES[ext] ?? "application/octet-stream");
      res.set("Cache-Control", "public, max-age=3600");
      res.send(data);
    } catch {
      res.status(404).send("Not found");
    }
  });
}
