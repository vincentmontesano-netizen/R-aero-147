import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { getDb } from './db';
import { users, companies } from '../drizzle/schema';
export const organizationHistoryInput = z.object({
  companyId:z.number().int().positive(),
  before:z.string().regex(/^[1-9]\d{0,18}$/).refine(value=>BigInt(value)<=BigInt("9223372036854775807")).optional(),
});
type StatusRow = {id:string;actorId:number;actorName:string|null;previousStatus:string|null;status:string;createdAt:string};
export async function organizationStatusHistory(actorId:number,input:z.input<typeof organizationHistoryInput>) {
  const {companyId,before}=organizationHistoryInput.parse(input);
  const db=await getDb();
  if(!db) throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
  const [actor]=await db.select({id:users.id}).from(users).where(and(eq(users.id,actorId),eq(users.role,'admin'),eq(users.status,'active')));
  if(!actor) throw new TRPCError({code:'FORBIDDEN'});
  const [company]=await db.select({id:companies.id,name:companies.name,status:companies.status}).from(companies).where(eq(companies.id,companyId));
  if(!company) throw new TRPCError({code:'NOT_FOUND'});
  const rows=await db.execute<StatusRow>(sql`
    select e.id::text as id,e."actorId",u.name as "actorName",e."previousStatus",e.status,
      to_char(e."createdAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "createdAt"
    from organization_status_events e left join users u on u.id=e."actorId"
    where e."companyId"=${companyId} ${before?sql`and e.id < ${before}::bigint`:sql``}
    order by e.id desc limit 51`);
  return {company,events:rows.slice(0,50),nextCursor:rows.length>50?rows[49]!.id:null};
}
