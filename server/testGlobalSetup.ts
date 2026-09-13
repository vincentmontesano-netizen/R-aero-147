import { execFile } from "node:child_process";
import { promisify } from "node:util";
/** Schema changes run once before workers; never race DDL against application transactions. */
export default async function setup() {
  const testUrl = process.env.RAERO_TEST_DATABASE_URL;
  if (!testUrl) return;
  await promisify(execFile)(process.execPath, ["--import", "tsx", "server/migrate.ts"], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: testUrl }, timeout: 60000,
  });
}
