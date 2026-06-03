import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { users, type User } from "../drizzle/schema";

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
export type RegisterInput = {
  email: string;
  password: string;
  name: string;
  jobTitle?: string;
  licenseNumber?: string;
  licenseCategories?: string;
  preferredLanguage?: string;
  marketingOptIn?: boolean;
  companyId?: number | null;   // when self-registering with an organisation
  asManager?: boolean;         // become company_manager of that organisation
};

export async function registerUser(input: RegisterInput): Promise<User> {
  const db = await getDb();
  if (!db) throw new Error("Base de données non disponible.");

  const email = input.email.trim().toLowerCase();
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) throw new Error("Un compte existe déjà avec cet email.");

  const passwordHash = await hashPassword(input.password);
  const openId = `local-${nanoid(21)}`;

  const inserted = await db
    .insert(users)
    .values({
      openId,
      email,
      name: input.name.trim(),
      passwordHash,
      loginMethod: "email",
      role: input.asManager ? "company_manager" : "user",
      status: "active",
      jobTitle: input.jobTitle,
      licenseNumber: input.licenseNumber,
      licenseCategories: input.licenseCategories,
      companyId: input.companyId ?? null,
      preferredLanguage: input.preferredLanguage ?? "fr",
      marketingOptIn: input.marketingOptIn ?? false,
      lastSignedIn: new Date(),
    })
    .returning();

  return inserted[0];
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
  await db.update(users).set({ resetToken: token, resetTokenExpiresAt: expires }).where(eq(users.id, user.id));
  return { token, name: user.name ?? null };
}

// ─── Email two-factor (opt-in per user) ──────────────────────────────────────
/** Generate + store a 6-digit login code (10 min validity). Returns the code to email. */
export async function startTwoFactor(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Base de données non disponible.");
  const code = String(Math.floor(100000 + (randomBytes(4).readUInt32BE(0) % 900000)));
  const expires = new Date(Date.now() + 10 * 60 * 1000);
  await db.update(users).set({ twoFactorCode: code, twoFactorExpiresAt: expires }).where(eq(users.id, userId));
  return code;
}

/** Verify a 2FA code for an account; clears it and returns the user. Throws on failure. */
export async function verifyTwoFactorCode(email: string, code: string): Promise<User> {
  const db = await getDb();
  if (!db) throw new Error("Base de données non disponible.");
  const user = (await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1))[0];
  if (!user || !user.twoFactorCode || !user.twoFactorExpiresAt || new Date(user.twoFactorExpiresAt).getTime() < Date.now())
    throw new Error("Code invalide ou expiré.");
  if (user.twoFactorCode !== code.trim()) throw new Error("Code invalide ou expiré.");
  await db.update(users).set({ twoFactorCode: null, twoFactorExpiresAt: null, lastSignedIn: new Date() }).where(eq(users.id, user.id));
  return user;
}

/** Enable/disable email 2FA for a user. */
export async function setTwoFactor(userId: number, enabled: boolean): Promise<{ ok: boolean }> {
  const db = await getDb();
  if (!db) return { ok: false };
  await db.update(users).set({ twoFactorEnabled: enabled, twoFactorCode: null, twoFactorExpiresAt: null }).where(eq(users.id, userId));
  return { ok: true };
}

/** Consume a reset token and set a new password. Throws on invalid/expired token. */
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<{ ok: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Base de données non disponible.");
  const user = (await db.select().from(users).where(eq(users.resetToken, token)).limit(1))[0];
  if (!user || !user.resetTokenExpiresAt || new Date(user.resetTokenExpiresAt).getTime() < Date.now())
    throw new Error("Lien de réinitialisation invalide ou expiré.");
  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash, resetToken: null, resetTokenExpiresAt: null }).where(eq(users.id, user.id));
  return { ok: true };
}
