vi.mock("./certificateArchive",()=>({verifyCertificateBytes:async(_key:string,bytes:Buffer)=>bytes.toString()!=="tampered-certificate"}));
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

vi.mock("./_core/context", () => ({ createContext: async ({ req }: any) => ({ user: req.headers.authorization === "owner" ? { id: 1, role: "user" } : null }) }));
vi.mock("./courseMedia", () => ({ verifyCourseMediaBytes: async (_key: string, bytes: Buffer) => bytes.toString() === "verified-media" }));
vi.mock("./storageAccess", () => ({ canReadPrivateFile: async (_key: string, user: any) => !!user }));
vi.mock("./access", () => ({ logAccess: vi.fn(), ipFromReq: () => null }));

let root: string;
let server: Server;
let base: string;
beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "raero-storage-test-"));
  process.env.STORAGE_DIR = path.join(root, "storage");
  await mkdir(path.join(root, "storage/passport/1"), { recursive: true });
  await writeFile(path.join(root, "storage/passport/1/id.pdf"), "private-document");
  await mkdir(path.join(root, "storage/certificates"));
  await writeFile(path.join(root, "storage/certificates/test.pdf"), "private-certificate");
  await writeFile(path.join(root, "storage/certificates/tampered.pdf"), "tampered-certificate");
  await mkdir(path.join(root, "storage/catalogue"));
  await mkdir(path.join(root, "storage/course-media/1"), { recursive: true });
  await writeFile(path.join(root, "storage/course-media/1/media.mp3"), "verified-media");
  await writeFile(path.join(root, "storage/course-media/1/changed.mp3"), "altered-media");
  await mkdir(path.join(root, "storage/courses/images"), { recursive: true });
  await writeFile(path.join(root, "storage/courses/images/legacy.png"), "legacy-image");
  await writeFile(path.join(root, "storage/.jwt_secret"), "test-secret");
  await writeFile(path.join(root, "outside.txt"), "outside-secret");
  await symlink(path.join(root, "outside.txt"), path.join(root, "storage/catalogue/escape.txt"));
  await symlink(path.join(root, "storage/passport/1/id.pdf"), path.join(root, "storage/catalogue/public-alias.pdf"));
  const { registerStorageProxy } = await import("./_core/storageProxy");
  const app = express();
  registerStorageProxy(app);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await rm(root, { recursive: true, force: true });
});
describe("private storage HTTP boundary", () => {
  it("denies unauthenticated downloads and prevents shared caching", async () => {
    const response = await fetch(`${base}/storage/passport/1/id.pdf`);
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).not.toContain("private-document");
  });
  it("serves authorized documents as private attachments", async () => {
    const response = await fetch(`${base}/storage/passport/1/id.pdf`, { headers: { authorization: "owner" } });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.text()).toBe("private-document");
  });
  it("allows an explicit generated PDF preview without weakening access or uploaded-document isolation", async () => {
    const preview = await fetch(`${base}/storage/certificates/test.pdf?preview=1`, { headers: { authorization: "owner" } });
    expect(preview.status).toBe(200);
    expect(preview.headers.get("content-disposition")).toContain("inline");
    expect(preview.headers.get("cache-control")).toBe("private, no-store");
    expect(preview.headers.get("content-security-policy")).toBe("sandbox");
    expect((await fetch(`${base}/storage/certificates/test.pdf?preview=1`)).status).toBe(404);
    const download = await fetch(`${base}/storage/certificates/test.pdf`, { headers: { authorization: "owner" } });
    expect(download.headers.get("content-disposition")).toContain("attachment");
    const uploaded = await fetch(`${base}/storage/passport/1/id.pdf?preview=1`, { headers: { authorization: "owner" } });
    expect(uploaded.headers.get("content-disposition")).toContain("attachment");
    expect((await fetch(`${base}/storage/certificates/tampered.pdf?preview=1`, { headers: { authorization: "owner" } })).status).toBe(404);
  });
  it("never serves operational files from the storage root", async () => {
    const response = await fetch(`${base}/storage/.jwt_secret`);
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("test-secret");
  });
  it("blocks public aliases to private documents", async () => {
    expect((await fetch(`${base}/storage/catalogue/public-alias.pdf`)).status).toBe(404);
  });
  it("blocks symlinks outside the storage directory", async () => {
    expect((await fetch(`${base}/storage/catalogue/escape.txt`)).status).toBe(404);
  });
  it("serves authorized course media inline without caching and refuses altered files", async () => {
    expect((await fetch(`${base}/storage/course-media/1/media.mp3`)).status).toBe(404);
    const response = await fetch(`${base}/storage/course-media/1/media.mp3`, { headers: { authorization: "owner" } });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("inline");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).toBe("verified-media");
    expect((await fetch(`${base}/storage/course-media/1/changed.mp3`, { headers: { authorization: "owner" } })).status).toBe(404);
  });

  it("supports authenticated media seeking and still checks integrity for partial requests", async () => {
    const headers = { authorization: "owner", range: "bytes=2-5" };
    const response = await fetch(`${base}/storage/course-media/1/media.mp3`, { headers });
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 2-5/14");
    expect(await response.text()).toBe("rifi");
    const suffix = await fetch(`${base}/storage/course-media/1/media.mp3`, { headers: { ...headers, range: "bytes=-5" } });
    expect(await suffix.text()).toBe("media");
    expect((await fetch(`${base}/storage/course-media/1/media.mp3`, { headers: { ...headers, range: "bytes=99-" } })).status).toBe(416);
    expect((await fetch(`${base}/storage/course-media/1/media.mp3`, { headers: { range: "bytes=0-1" } })).status).toBe(404);
    expect((await fetch(`${base}/storage/course-media/1/changed.mp3`, { headers })).status).toBe(404);
  });

  it("does not expose the legacy courses namespace anonymously or through shared caching", async () => {
    expect((await fetch(`${base}/storage/courses/images/legacy.png`)).status).toBe(404);
    const authorized = await fetch(`${base}/storage/courses/images/legacy.png`, { headers: { authorization: "owner" } });
    expect(authorized.status).toBe(200);
    expect(authorized.headers.get("cache-control")).toBe("private, no-store");
    expect(authorized.headers.get("content-disposition")).toContain("inline");
    expect(await authorized.text()).toBe("legacy-image");
  });

  it("protects certificate bytes and never permits shared caching",async()=>{
    const denied=await fetch(`${base}/storage/certificates/test.pdf`);
    expect(denied.status).toBe(404);expect(await denied.text()).not.toContain('private-certificate');
    const accepted=await fetch(`${base}/storage/certificates/test.pdf`,{headers:{authorization:'owner'}});
    expect(accepted.status).toBe(200);expect(await accepted.text()).toBe('private-certificate');
    expect(accepted.headers.get('cache-control')).toBe('private, no-store');
    expect(accepted.headers.get('vary')).toContain('Cookie');
    expect(accepted.headers.get('content-disposition')).toContain('attachment');
    expect((await fetch(`${base}/storage/certificates/tampered.pdf`,{headers:{authorization:'owner'}})).status).toBe(404);
  });

});
