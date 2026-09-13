import "dotenv/config";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { hashPassword } from "./auth";

export async function bootstrapAdmin(url: string, email?: string, password?: string) {
  const db = postgres(url, { max: 1 });
  try {
    return await db.begin(async tx => {
      await tx`select pg_advisory_xact_lock(hashtext('raero-first-admin'))`;
      const [existing] = await tx`select id from users where role = 'admin' and status = 'active' limit 1`;
      if (existing) return { created: false };
      const normalized = email?.trim().toLowerCase();
      if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || !password || password.length < 14) throw new Error("Première installation : renseignez ADMIN_EMAIL et ADMIN_PASSWORD (14 caractères minimum).");
      const [occupied] = await tx`select id from users where email = ${normalized}`;
      if (occupied) throw new Error("L’adresse du premier administrateur appartient déjà à un compte. Aucun rôle n’a été modifié.");
      const hash = await hashPassword(password);
      await tx`insert into users ("openId", email, name, "passwordHash", "loginMethod", role, status) values (${`local-${randomUUID()}`}, ${normalized}, 'Administrateur', ${hash}, 'email', 'admin', 'active')`;
      return { created: true };
    });
  } finally { await db.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.DATABASE_URL) { console.error("DATABASE_URL is required."); process.exitCode = 1; }
  else bootstrapAdmin(process.env.DATABASE_URL, process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD)
    .then(r => console.log(r.created ? "Premier administrateur créé." : "Administrateur existant conservé."))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
