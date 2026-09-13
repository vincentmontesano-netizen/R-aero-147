import { expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
it("does not overwrite stored evidence when a generated key collides", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "raero-storage-test-"));
  vi.stubEnv("STORAGE_DIR", directory);
  vi.spyOn(crypto, "randomUUID").mockReturnValue("11111111-1111-4111-8111-111111111111");
  try {
    const { storagePut } = await import("./storage");
    const file = await storagePut("passport/fixture/evidence.pdf", Buffer.from("original"));
    await expect(storagePut("passport/fixture/evidence.pdf", Buffer.from("replacement"))).rejects.toMatchObject({ code: "EEXIST" });
    expect(await readFile(path.join(directory, file.key), "utf8")).toBe("original");
  } finally {
    vi.restoreAllMocks(); vi.unstubAllEnvs();
    await rm(directory, { recursive: true, force: true });
  }
});
