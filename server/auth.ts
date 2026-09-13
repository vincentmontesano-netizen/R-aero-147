import { z } from "zod";
import { ENV } from "./_core/env";
import { createHash, createHmac, randomInt, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { nanoid } from "nanoid";
import { eq, and, gt, or, isNull, lte, sql } from "drizzle-orm";
import { getDb } from "./db";
import { users, companies, affiliations, type User } from "../drizzle/schema";

const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

/** Strip the password hash and all secret tokens before sending a user to the client. */
export function sanitizeUser<T extends Record<string, any>>(user: T): Omit<T, "passwordHash" | "resetToken" | "resetTokenExpiresAt" | "twoFactorCode" | "twoFactorExpiresAt"> {
  const { passwordHash, resetToken, resetTokenExpiresAt, twoFactorCode, twoFactorExpiresAt, ...rest } = user;
  return rest;
}

// ─── Password hashing (scrypt, no external dependency) ──────────────────────
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const hashBuf = Buffer.from(hash, "hex");
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  if (hashBuf.length !== derived.length) return false;
  return timingSafeEqual(hashBuf, derived);
}

// ─── Registration ───────────────────────────────────────────────────────────
export const registrationInput = z.object({
  email: z.string().trim().email("Email invalide.").max(320).transform(value => value.toLowerCase()),
  password: z.string().min(8, "Le mot de passe doit comporter au moins 8 caractères.").max(1024),
  name: z.string().trim().min(2, "Veuillez indiquer votre nom.").max(255),
  jobTitle: z.string().max(128).optional(),
  licenseNumber: z.string().max(64).optional(),
  licenseCategories: z.string().max(128).optional(),
  preferredLanguage: z.enum(["fr","en","ar"]).optional(),
  marketingOptIn: z.boolean().optional(),
  organization: z.object({
    name: z.string().trim().min(1).max(255),
    type: z.enum(["MRO","AIRLINE","CAMO","OTHER"]).optional(),
    agreementNumber: z.string().max(64).optional(),
  }).optional(),
});
export type RegisterInput = z.input<typeof registrationInput>;

export async function registerUser(input: RegisterInput): Promise<User> {
  const data = registrationInput.parse(input);
  const db = await getDb();
  if (!db) throw new Error("Base de données non disponible.");
  const passwordHash = await hashPassword(data.password);
  return db.transaction(async tx => {
    // Serialize normalized registrations; unique email also protects competing writers.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'registration-email:'} || ${data.email}))`);
    const existing = await tx.select({id:users.id}).from(users).where(sql`lower(${users.email}) = ${data.email}`).limit(1);
    if (existing.length) throw new Error("Un compte existe déjà avec cet email.");
    let companyId: number | null = null;
    if (data.organization) {
      const [company] = await tx.insert(companies).values({
        name:data.organization.name,type:data.organization.type ?? "OTHER",agreementNumber:data.organization.agreementNumber,
        contactEmail:data.email,status:"ACTIVE",country:"FR",
      }).returning();
      companyId = company.id;
    }
    const [user] = await tx.insert(users).values({
      openId:`local-${nanoid(21)}`,email:data.email,name:data.name,passwordHash,loginMethod:"email",
      role:companyId ? "company_manager" : "user",status:"active",companyId,
      jobTitle:data.jobTitle,licenseNumber:data.licenseNumber,licenseCategories:data.licenseCategories,
      preferredLanguage:data.preferredLanguage ?? "fr",marketingOptIn:data.marketingOptIn ?? false,lastSignedIn:new Date(),
    }).returning();
    if (companyId) await tx.insert(affiliations).values({personId:user.id,orgId:companyId,role:"MANAGER",status:"ACTIVE"});
    return user;
  });
}

// ─── Admin-created user (lets the admin set the role + initial password) ──────
export async function adminCreateUser(input: {
  email: string; password: string; name: string;
  role: "user" | "admin" | "instructor" | "company_manager";
  jobTitle?: string; licenseNumber?: string; licenseCategories?: string; companyId?: number | null;
}): Promise<User> {
  const db = await getDb();
  if (!db) throw new Error("Base de données non disponible.");
  const email = input.email.trim().toLowerCase();
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) throw new Error("Un compte existe déjà avec cet email.");
  const passwordHash = await hashPassword(input.password);
  const inserted = await db.insert(users).values({
    openId: `local-${nanoid(21)}`, email, name: input.name.trim(), passwordHash, loginMethod: "email",
    role: input.role, status: "active", jobTitle: input.jobTitle,
    licenseNumber: input.licenseNumber, licenseCategories: input.licenseCategories,
    companyId: input.companyId ?? null,
    preferredLanguage: "fr", lastSignedIn: new Date(),
  }).returning();
  return inserted[0];
}

// ─── Login ──────────────────────────────────────────────────────────────────
export async function loginUser(email: string, password: string): Promise<User> {
  const db = await getDb();
  if (!db) throw new Error("Base de données non disponible.");

  const normalized = email.trim().toLowerCase();
  const found = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  const user = found[0];

  if (!user || !user.passwordHash) throw new Error("Email ou mot de passe incorrect.");
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw new Error("Email ou mot de passe incorrect.");
  if (user.status === "suspended") throw new Error("Ce compte a été suspendu. Contactez l'administrateur.");

  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
  return user;
}

// ─── Password reset ───────────────────────────────────────────────────────────
/** Create a reset token for the account (1h validity). Returns the token + user when
 *  the email matches an account, else null — callers must NOT reveal which. */
export async function createPasswordReset(email: string): Promise<{ token: string; name: string | null } | null> {
  const db = await getDb();
  if (!db) return null;
  const normalized = email.trim().toLowerCase();
  const user = (await db.select().from(users).where(eq(users.email, normalized)).limit(1))[0];
  if (!user) return null;
  const token = `${nanoid(32)}`;
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await db.update(users).set({ resetToken: createHash("sha256").update(token).digest("hex"), resetTokenExpiresAt: expires }).where(eq(users.id, user.id));
  return { token, name: user.name ?? null };
}

// ─── Email two-factor (opt-in per user) ──────────────────────────────────────
function twoFactorDigest(userId: number, version: number, code: string, purpose = "login"): string {
  if (ENV.cookieSecret.length < 32) throw new Error("Configuration de sécurité indisponible.");
  const domain = purpose === "login" ? "raero:email-2fa:v1" : `raero:email-2fa:${purpose}:v1`;
  return createHmac("sha256", ENV.cookieSecret).update(`${domain}:${userId}:${version}:${code}`).digest("hex");
}
/** Generate + store a 6-digit login code (10 min validity). Returns the code to email. */
export async function startTwoFactor(userId: number, sessionVersion: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Base de données non disponible.");
  const code = String(randomInt(100000, 1000000));
  const expires = new Date(Date.now() + 10 * 60 * 1000);
  const changed = await db.update(users).set({ twoFactorCode: twoFactorDigest(userId, sessionVersion, code), twoFactorExpiresAt: expires, twoFactorAttempts: 0, twoFactorSentAt: new Date(), twoFactorPurpose: "login" }).where(and(eq(users.id, userId), eq(users.sessionVersion, sessionVersion), eq(users.status, "active"), eq(users.twoFactorEnabled, true), or(isNull(users.twoFactorSentAt), lte(users.twoFactorSentAt, new Date(Date.now() - 60000))))).returning({id: users.id});
  if (!changed.length) throw new Error("Attendez une minute puis recommencez avec votre mot de passe.");
  return code;
}

/** Verify a 2FA code for an account; clears it and returns the user. Throws on failure. */
export async function verifyTwoFactorCode(email: string, code: string): Promise<User> {
  const db = await getDb();
  if (!db) throw new Error("Base de données non disponible.");
  if (!/^\d{6}$/.test(code.trim())) throw new Error("Code invalide ou expiré.");
  const user = await db.transaction(async tx => {
    const [current] = await tx.select().from(users).where(eq(users.email, email.trim().toLowerCase())).for("update");
    if (!current || current.status !== "active" || !current.twoFactorEnabled || current.twoFactorPurpose !== "login" || !current.twoFactorCode ||
        !current.twoFactorExpiresAt || current.twoFactorExpiresAt.getTime() <= Date.now() || current.twoFactorAttempts >= 8 ||
        !/^[a-f0-9]{64}$/.test(current.twoFactorCode)) return null;
    const actual = Buffer.from(current.twoFactorCode, "hex");
    const expected = Buffer.from(twoFactorDigest(current.id, current.sessionVersion, code.trim()), "hex");
    if (!timingSafeEqual(actual, expected)) {
      const attempts = current.twoFactorAttempts + 1;
      await tx.update(users).set({twoFactorAttempts: attempts, ...(attempts === 8 ? {twoFactorCode:null,twoFactorExpiresAt:null} : {})}).where(eq(users.id,current.id));
      return null; // Commit the failure count before throwing outside the transaction.
    }
    const [authenticated] = await tx.update(users).set({twoFactorCode:null,twoFactorExpiresAt:null,lastSignedIn:new Date()}).where(eq(users.id,current.id)).returning();
    return authenticated;
  });
  if (!user) throw new Error("Code invalide ou expiré.");
  return user;
}

/** Start a purpose-bound configuration challenge after password reauthentication. */
export async function beginTwoFactorChange(userId: number, version: number, password: string, enabled: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Base de données non disponible.");
  return db.transaction(async tx => {
    const [user] = await tx.select().from(users).where(eq(users.id,userId)).for("update");
    if (!user || !user.email || user.status !== "active" || user.sessionVersion !== version || !!user.twoFactorEnabled === enabled ||
        !await verifyPassword(password,user.passwordHash)) throw new Error("Mot de passe incorrect ou session expirée.");
    if (user.twoFactorSentAt && user.twoFactorSentAt.getTime() > Date.now()-60000) throw new Error("Attendez une minute avant de demander un nouveau code.");
    const purpose = enabled ? "enable" : "disable";
    const code = String(randomInt(100000,1000000));
    await tx.update(users).set({twoFactorPurpose:purpose,twoFactorCode:twoFactorDigest(user.id,version,code,purpose),twoFactorAttempts:0,twoFactorSentAt:new Date(),twoFactorExpiresAt:new Date(Date.now()+600000)}).where(eq(users.id,user.id));
    return {code,email:user.email,name:user.name};
  });
}

export async function confirmTwoFactorChange(userId: number, version: number, enabled: boolean, code: string): Promise<User> {
  const db = await getDb();
  if (!db) throw new Error("Base de données non disponible.");
  const purpose = enabled ? "enable" : "disable";
  const user = await db.transaction(async tx => {
    const [current] = await tx.select().from(users).where(eq(users.id,userId)).for("update");
    if (!current || current.status !== "active" || current.sessionVersion !== version || !!current.twoFactorEnabled === enabled ||
        current.twoFactorPurpose !== purpose || !current.twoFactorExpiresAt || current.twoFactorExpiresAt.getTime() <= Date.now() ||
        current.twoFactorAttempts >= 8 || !/^[a-f0-9]{64}$/.test(current.twoFactorCode ?? "") || !/^\d{6}$/.test(code)) return null;
    if (!timingSafeEqual(Buffer.from(current.twoFactorCode!,"hex"),Buffer.from(twoFactorDigest(userId,version,code,purpose),"hex"))) {
      const attempts = current.twoFactorAttempts+1;
      await tx.update(users).set({twoFactorAttempts:attempts,...(attempts===8 ? {twoFactorCode:null,twoFactorExpiresAt:null} : {})}).where(eq(users.id,userId));
      return null;
    }
    // The security trigger advances the session version and records the change.
    const [updated] = await tx.update(users).set({twoFactorEnabled:enabled,twoFactorCode:null,twoFactorExpiresAt:null,twoFactorSentAt:null,twoFactorAttempts:0}).where(eq(users.id,userId)).returning();
    return updated;
  });
  if (!user) throw new Error("Code invalide ou expiré. Recommencez la vérification.");
  return user;
}

export class InvalidPasswordResetTokenError extends Error {
  constructor() {
    super("Lien de réinitialisation invalide ou expiré.");
    this.name = "InvalidPasswordResetTokenError";
  }
}

/** Consume a reset token and set a new password. Throws on invalid/expired token. */
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<{ ok: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Base de données non disponible.");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const valid = await db.select({id: users.id}).from(users).where(and(
    eq(users.resetToken, tokenHash), gt(users.resetTokenExpiresAt, new Date())
  )).limit(1);
  if (!valid.length) throw new InvalidPasswordResetTokenError();
  const passwordHash = await hashPassword(newPassword);
  const changed = await db.update(users).set({ passwordHash, resetToken: null, resetTokenExpiresAt: null }).where(and(
    eq(users.resetToken, tokenHash), gt(users.resetTokenExpiresAt, new Date())
  )).returning({id: users.id});
  if (!changed.length) throw new InvalidPasswordResetTokenError();
  return { ok: true };
}

/** Reauthenticate and revoke every browser session, including the caller's. */
export async function revokeAllSessions(userId: number, sessionVersion: number, password: string): Promise<{ok: true}> {
  const db = await getDb();
  if (!db) throw new Error('Base de données non disponible.');
  return db.transaction(async tx => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
    if (!user || user.status !== 'active' || user.sessionVersion !== sessionVersion || !await verifyPassword(password, user.passwordHash)) {
      throw new Error('Mot de passe incorrect ou session expirée.');
    }
    await tx.update(users).set({sessionVersion: user.sessionVersion + 1, twoFactorCode: null, twoFactorExpiresAt: null}).where(eq(users.id,user.id));
    return {ok: true as const};
  });
}
