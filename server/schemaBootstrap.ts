import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { TransactionSql } from "postgres";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
/** Baseline is used only for an entirely empty public schema; existing databases retain their migration history. */
export async function bootstrapSchema(tx: TransactionSql) {
  const root = new URL("../drizzle/baseline/", import.meta.url);
  const schema = await readFile(new URL("20260913.sql", root), "utf8");
  const rawManifest = await readFile(new URL("20260913.json", root), "utf8");
  const manifest = JSON.parse(rawManifest) as Record<string, string>;
  const [state] = await tx`select to_regclass('public.users') as users, to_regclass('public.raero_migrations') as journal`;
  if (!state.users) {
    const [count] = await tx`select count(*)::int as n from pg_tables where schemaname = 'public'`;
    if (count.n !== 0) throw new Error("Schéma partiel détecté : rapprochement requis avant initialisation.");
    // Verify the baseline's covered migration files before recording them as applied.
    for (const [name, checksum] of Object.entries(manifest)) {
      const contents = await readFile(new URL(`../drizzle/migrations/${name}`, import.meta.url), "utf8");
      if (digest(contents) !== checksum) throw new Error(`Baseline migration changed: ${name}`);
    }
    await tx.unsafe(schema);
    for (const [name, checksum] of Object.entries(manifest)) await tx`insert into public.raero_migrations(name, checksum) values (${name}, ${checksum})`;
    await tx`insert into public.raero_migrations(name, checksum) values ('baseline/20260913.sql', ${digest(schema)}), ('baseline/20260913.json', ${digest(rawManifest)})`;
    console.log("Initialized versioned schema baseline.");
  } else if (state.journal) {
    const rows = await tx`select name, checksum from public.raero_migrations where name in ('baseline/20260913.sql', 'baseline/20260913.json')`;
    for (const row of rows) if (row.checksum !== digest(row.name.endsWith(".sql") ? schema : rawManifest)) throw new Error(`Applied baseline changed: ${row.name}`);
  }
}
