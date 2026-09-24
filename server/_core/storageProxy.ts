import {verifyCertificateBytes} from "../certificateArchive";
import { verifyInvoiceBytes } from "../invoice";
import { verifyCourseMediaBytes } from "../courseMedia";
import type { Express } from "express";
import { promises as fs } from "node:fs";
import path from "node:path";
import { STORAGE_DIR, normalizeStorageKey } from "../storage";
import { canReadPrivateFile } from "../storageAccess";
import { createContext } from "./context";
import { logAccess, ipFromReq } from "../access";



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
    res.set("Cache-Control", "private, no-store");
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    try {
      const safeKey = normalizeStorageKey(key);
      // Only application document namespaces are served. Operational files (including
      // the persisted JWT secret) must never be downloadable from STORAGE_DIR.
      if (!["course-media", "approval", "passport", "invoices", "verification", "certificates", "catalogue", "courses"].includes(safeKey.split("/")[0]) || safeKey.split("/").some(segment => segment.startsWith("."))) {
        res.status(404).send("Not found");
        return;
      }
      const filePath = path.resolve(STORAGE_DIR, safeKey);
      const root = await fs.realpath(STORAGE_DIR);
      const realFile = await fs.realpath(filePath);
      if (!realFile.startsWith(root + path.sep) || realFile !== path.join(root, safeKey)) {
        res.status(404).send("Not found");
        return;
      }
      const isPrivate = safeKey.startsWith("certificates/") || safeKey.startsWith("courses/") || safeKey.startsWith("course-media/") || safeKey.startsWith("approval/") || safeKey.startsWith("verification/") || safeKey.startsWith("passport/") || safeKey.startsWith("invoices/");
      if (isPrivate) {
        res.set("Cache-Control", "private, no-store");
        res.set("Vary", "Cookie");
        const ctx = await createContext({ req, res, info: {} as never });
        if (!await canReadPrivateFile(safeKey, ctx.user)) {
          res.status(404).send("Not found");
          return;
        }
        await logAccess({ actorId: ctx.user!.id, actorRole: ctx.user!.role, action: "DOWNLOAD_PRIVATE_FILE",
          dataAccessed: { key: safeKey }, ip: ipFromReq(req) });
        const generatedPdfPreview = req.query.preview === "1" && path.extname(safeKey).toLowerCase() === ".pdf" &&
          (safeKey.startsWith("certificates/") || safeKey.startsWith("invoices/"));
        res.set("Content-Disposition", `${generatedPdfPreview || safeKey.startsWith("course-media/") || safeKey.startsWith("courses/") ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(path.basename(safeKey))}`);
      } else {
        res.set("Cache-Control", "public, max-age=3600");
      }
      res.set("X-Content-Type-Options", "nosniff");
      res.set("Content-Security-Policy", "sandbox");
      const data = await fs.readFile(filePath);
      if (safeKey.startsWith("invoices/") && !await verifyInvoiceBytes(safeKey,data)) { res.status(404).send("Not found"); return; }
      if (safeKey.startsWith("course-media/") && !await verifyCourseMediaBytes(safeKey, data)) { res.status(404).send("Not found"); return; }
      if(safeKey.startsWith("certificates/")&&!await verifyCertificateBytes(safeKey,data)){res.status(404).send("Not found");return;}
      const ext = path.extname(filePath).toLowerCase();
      res.set("Content-Type", CONTENT_TYPES[ext] ?? "application/octet-stream");
      if (ext === ".mp3" || ext === ".mp4") {
        res.set("Accept-Ranges", "bytes");
        const range = req.headers.range;
        if (range && !req.headers["if-range"] && !range.includes(",")) {
          const match = /^bytes=(\d{0,15})-(\d{0,15})$/.exec(range);
          let start = 0, end = data.length - 1;
          if (match?.[1]) { start = Number(match[1]); if (match[2]) end = Math.min(Number(match[2]), end); }
          else if (match?.[2]) start = Math.max(0, data.length - Number(match[2]));
          if (!match || (!match[1] && !match[2]) || start >= data.length || start > end || (!match[1] && Number(match[2]) === 0)) {
            res.status(416).set("Content-Range", `bytes */${data.length}`).end(); return;
          }
          res.status(206).set("Content-Range", `bytes ${start}-${end}/${data.length}`).send(data.subarray(start, end + 1)); return;
        }
      }
      res.send(data);
    } catch {
      res.status(404).send("Not found");
    }
  });
}
