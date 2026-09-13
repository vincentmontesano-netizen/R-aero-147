import {createHash} from 'node:crypto';
import {eq} from 'drizzle-orm';
import {getDb} from './db';
import {certificateArchives} from '../drizzle/schema';
export async function verifyCertificateBytes(key:string,bytes:Buffer){
  const db=(await getDb())!;
  const [archive]=await db.select().from(certificateArchives).where(eq(certificateArchives.storageKey,key));
  return !archive||(archive.byteSize===bytes.length&&archive.sha256===createHash('sha256').update(bytes).digest('hex'));
}
