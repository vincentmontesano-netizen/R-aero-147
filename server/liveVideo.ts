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
  const room = `raero-${roomType}-${roomId}`;
  const now = Math.floor(Date.now() / 1000), expires = Math.min(now + 600, Math.floor(closesAt.getTime()/1000)), id = randomUUID();
  let jwt: string;
  let domain: string, scriptUrl: string, roomName: string;
  try {
    const provider = process.env.LIVE_VIDEO_PROVIDER?.trim() || "jaas";
    let key: ReturnType<typeof createPrivateKey> | Uint8Array;
    let header: { alg: string; typ: string; kid?: string }, issuer: string, subject: string;
    if (provider === "jitsi") {
      domain = process.env.JITSI_DOMAIN?.trim().toLowerCase() || "";
      const appId = process.env.JITSI_APP_ID?.trim() || "";
      const secret = process.env.JITSI_APP_SECRET?.trim() || "";
      // Only a DNS host is accepted: never credentials, paths, ports or a script URL.
      if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(domain)
        || domain.length > 253 || !/^[a-zA-Z0-9._-]{3,128}$/.test(appId) || Buffer.byteLength(secret) < 32) throw new Error("Invalid Jitsi configuration");
      key = new TextEncoder().encode(secret);
      header = { alg: "HS256", typ: "JWT" };
      issuer = appId; subject = domain;
      scriptUrl = `https://${domain}/external_api.js`; roomName = room;
    } else if (provider === "jaas") {
      const appId = process.env.JAAS_APP_ID?.trim();
      const keyId = process.env.JAAS_API_KEY_ID?.trim();
      const privateKey = process.env.JAAS_PRIVATE_KEY?.replace(/\\n/g, "\n");
      if (!appId || !/^vpaas-magic-cookie-[a-zA-Z0-9]+$/.test(appId) || !keyId?.startsWith(`${appId}/`) || !privateKey) throw new Error("Invalid JaaS configuration");
      key = createPrivateKey(privateKey);
      if (key.asymmetricKeyType !== "rsa" || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) throw new Error("Invalid key");
      header = { alg: "RS256", typ: "JWT", kid: keyId };
      issuer = "chat"; subject = appId;
      domain = "8x8.vc"; scriptUrl = `https://8x8.vc/${appId}/external_api.js`; roomName = `${appId}/${room}`;
    } else {
      throw new Error("Unsupported video provider");
    }
    jwt = await new SignJWT({ room, context: {
      user: { id: String(userId), name: access.displayName, moderator: access.isModerator ? "true" : "false" },
      room: { regex: false },
      features: { recording: false, livestreaming: false, transcription: false, "outbound-call": false, "sip-outbound-call": false, "file-upload": false },
    } }).setProtectedHeader(header).setIssuer(issuer).setAudience("jitsi").setSubject(subject)
      .setIssuedAt(now).setNotBefore(now - 30).setExpirationTime(expires).setJti(id).sign(key);
  } catch {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "La configuration de visioconférence privée doit être vérifiée par l’administrateur." });
  }
  const db = (await getDb())!;
  await db.insert(liveVideoTickets).values({ id, userId, roomType, roomId, moderator: access.isModerator, expiresAt: new Date(expires * 1000) });
  return { roomType, roomId, moderator: access.isModerator, domain, scriptUrl, roomName, jwt, expiresAt: new Date(expires * 1000) };
}
