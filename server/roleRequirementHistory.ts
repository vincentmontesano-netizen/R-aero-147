import {and,desc,eq,isNotNull,isNull,lt,or} from 'drizzle-orm';
import {TRPCError} from '@trpc/server';
import {getDb} from './db';
import {requireManagedCompany} from './companyTraining';
import {roleRequirements,users} from '../drizzle/schema';

export async function roleRequirementHistory(actorId:number,beforeId?:number){
 const db=(await getDb())!;
 const [actor]=await db.select().from(users).where(eq(users.id,actorId));
 if(actor?.status!=='active')throw new TRPCError({code:'FORBIDDEN'});
 if(actor.companyId || actor.role!=='admin')await requireManagedCompany(actor);
 const scope=actor.companyId ? or(isNull(roleRequirements.companyId),eq(roleRequirements.companyId,actor.companyId)) : isNull(roleRequirements.companyId);
 const rows=await db.select({id:roleRequirements.id,createdBy:roleRequirements.createdBy,createdAt:roleRequirements.createdAt,companyId:roleRequirements.companyId,label:roleRequirements.label,trainingId:roleRequirements.trainingId,periodMonths:roleRequirements.periodMonths,jobTitleContains:roleRequirements.jobTitleContains,licenseCategoryContains:roleRequirements.licenseCategoryContains,archivedAt:roleRequirements.archivedAt,archivedBy:roleRequirements.archivedBy})
  .from(roleRequirements).where(and(scope,isNotNull(roleRequirements.archivedAt),beforeId?lt(roleRequirements.id,beforeId):undefined)).orderBy(desc(roleRequirements.id)).limit(51);
 const entries=rows.slice(0,50);
 return {entries,nextBeforeId:rows.length>50?entries[49].id:null};
}
