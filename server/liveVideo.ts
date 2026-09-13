import { requireLiveAdmission } from "./liveAdmission";
import { createPrivateKey, randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import { TRPCError } from "@trpc/server";
import { requireLiveRoom } from "./live";
import { getDb } from "./db";
import { liveVideoTickets } from "../drizzle/schema";

/** Issued only on join; never use a public-room fallback when provider credentials are absent. */
export async function issueLiveVideoTicket(roomType: "session" | "webinar", roomId: number, userId: number) {
  const access = await requireLiveRoom(roomType, roomId, userId);
  const closesAt = requireLiveAdmission(access.videoAdmission);
  const appId = process.env.JAAS_APP_ID?.trim();
  const keyId = process.env.JAAS_API_KEY_ID?.trim();
  const privateKey = process.env.JAAS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!appId || !/^vpaas-magic-cookie-[a-zA-Z0-9]+$/.test(appId) || !keyId || !keyId.startsWith(`${appId}/`) || !privateKey) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "La visioconférence privée n’est pas encore configurée. Contactez l’organisateur." });
  }
  const room = `raero-${roomType}-${roomId}`;
  const now = Math.floor(Date.now() / 1000), expires = Math.min(now + 600, Math.floor(closesAt.getTime()/1000)), id = randomUUID();
  let jwt: string;
  try {
    const key = createPrivateKey(privateKey);
    if (key.asymmetricKeyType !== "rsa" || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) throw new Error("Invalid key");
    jwt = await new SignJWT({ room, context: {
      user: { id: String(userId), name: access.displayName, moderator: access.isModerator ? "true" : "false" },
      room: { regex: false },
      features: { recording: false, livestreaming: false, transcription: false, "outbound-call": false, "sip-outbound-call": false, "file-upload": false },
    } }).setProtectedHeader({ alg: "RS256", typ: "JWT", kid: keyId }).setIssuer("chat").setAudience("jitsi").setSubject(appId)
      .setIssuedAt(now).setNotBefore(now - 30).setExpirationTime(expires).setJti(id).sign(key);
  } catch {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "La configuration de visioconférence privée doit être vérifiée par l’administrateur." });
  }
  const db = (await getDb())!;
  await db.insert(liveVideoTickets).values({ id, userId, roomType, roomId, moderator: access.isModerator, expiresAt: new Date(expires * 1000) });
  return { roomType, roomId, moderator: access.isModerator, domain: "8x8.vc", scriptUrl: `https://8x8.vc/${appId}/external_api.js`, roomName: `${appId}/${room}`, jwt, expiresAt: new Date(expires * 1000) };
}
