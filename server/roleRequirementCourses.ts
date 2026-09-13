import {and,asc,eq,isNull,or} from 'drizzle-orm';
import {TRPCError} from '@trpc/server';
import {getDb} from './db';
import {requireManagedCompany} from './companyTraining';
import {trainings,users} from '../drizzle/schema';

export async function roleRequirementCourses(actorId:number){
 const db=await getDb();
 if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
 const [actor]=await db.select().from(users).where(eq(users.id,actorId));
 if(actor?.status!=='active')throw new TRPCError({code:'FORBIDDEN'});
 const companyId=await requireManagedCompany(actor);
 return db.select({id:trainings.id,title:trainings.title,ownerOrgId:trainings.ownerOrgId})
  .from(trainings).where(and(eq(trainings.isPublished,true),isNull(trainings.archivedAt),or(isNull(trainings.ownerOrgId),eq(trainings.ownerOrgId,companyId))))
  .orderBy(asc(trainings.title),asc(trainings.id));
}
