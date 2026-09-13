import { eq, desc } from "drizzle-orm";
import { getDb, type DatabaseTransaction } from "./db";
import { trainingVersions } from "../drizzle/schema";
import { TRPCError } from "@trpc/server";
/** Null means an explicitly unversioned legacy enrollment, never the newest publication. */
export async function readCurriculum(versionId: number | null | undefined, executor?:DatabaseTransaction) {
  if (versionId == null) return null;
  const db = executor??(await getDb())!;
  const [version] = await db.select().from(trainingVersions).where(eq(trainingVersions.id, versionId)).limit(1);
  if (!version) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Version du parcours indisponible. Contactez l’équipe pédagogique." });
  return version.snapshot;
}

export async function publishedVersions(trainingId: number) {
  const db = (await getDb())!;
  return db.select({ id: trainingVersions.id, version: trainingVersions.version, publishedBy: trainingVersions.publishedBy, createdAt: trainingVersions.createdAt })
    .from(trainingVersions).where(eq(trainingVersions.trainingId, trainingId)).orderBy(desc(trainingVersions.version));
}
