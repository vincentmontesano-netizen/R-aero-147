import { randomUUID } from 'node:crypto';
import { and, eq, isNull, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { getDb } from './db';
import { mediaUrls } from './courseMedia';
import { users, companies, affiliations, trainings, trainingModules, learningObjectives, slides, quizQuestions, courseCopies, copiedCourseMedia, courseMedia, legacyCourseMediaLinks } from '../drizzle/schema';

export const copyCourseInput=z.object({trainingId:z.number().int().positive(),title:z.string().trim().min(1).max(255),orgId:z.number().int().positive().nullable()});
export async function copyCourse(actorId:number,raw:z.infer<typeof copyCourseInput>){
  const input=copyCourseInput.parse(raw);
  const db=(await getDb())!;
  return db.transaction(async tx=>{
    const [actor]=await tx.select().from(users).where(eq(users.id,actorId)).for('share');
    if(actor?.status!=='active') throw new TRPCError({code:'FORBIDDEN'});
    const [source]=await tx.select().from(trainings).where(and(eq(trainings.id,input.trainingId),isNull(trainings.archivedAt))).for('share');
    if(!source) throw new TRPCError({code:'NOT_FOUND'});
    async function organizationAccess(orgId:number){
      const [org]=await tx.select().from(companies).where(eq(companies.id,orgId)).for('share');
      const [member]=await tx.select().from(affiliations).where(and(eq(affiliations.orgId,orgId),eq(affiliations.personId,actor.id),eq(affiliations.role,'MANAGER'),eq(affiliations.status,'ACTIVE'))).for('share');
      if(org?.status!=='ACTIVE' || (actor.role!=='admin' && !member)) throw new TRPCError({code:'FORBIDDEN'});
    }
    if(source.ownerOrgId!=null) await organizationAccess(source.ownerOrgId);
    else if(actor.role!=='admin' && (actor.role!=='instructor' || source.ownerUserId!==actor.id)) throw new TRPCError({code:'FORBIDDEN'});
    if(input.orgId!=null) await organizationAccess(input.orgId);
    else if(actor.role!=='admin' && actor.role!=='instructor') throw new TRPCError({code:'FORBIDDEN'});
    const modules=await tx.select().from(trainingModules).where(and(eq(trainingModules.trainingId,source.id),isNull(trainingModules.archivedAt)));
    const objectives=await tx.select().from(learningObjectives).where(and(eq(learningObjectives.trainingId,source.id),isNull(learningObjectives.archivedAt)));
    const deck=await tx.select().from(slides).where(and(eq(slides.trainingId,source.id),isNull(slides.archivedAt)));
    const questions=await tx.select().from(quizQuestions).where(and(eq(quizQuestions.trainingId,source.id),isNull(quizQuestions.archivedAt)));
    const snapshot={source,modules,objectives,slides:deck,questions};
    const keys=Array.from(new Set(mediaUrls(snapshot).map(url=>url.slice('/storage/'.length))));
    if(keys.length){
      const originals=await tx.select({key:courseMedia.storageKey}).from(courseMedia).where(and(eq(courseMedia.trainingId,source.id),inArray(courseMedia.storageKey,keys)));
      const legacy=await tx.select({key:legacyCourseMediaLinks.storageKey}).from(legacyCourseMediaLinks).where(and(eq(legacyCourseMediaLinks.trainingId,source.id),inArray(legacyCourseMediaLinks.storageKey,keys)));
      const copied=await tx.select({key:copiedCourseMedia.storageKey}).from(copiedCourseMedia).where(and(eq(copiedCourseMedia.trainingId,source.id),inArray(copiedCourseMedia.storageKey,keys)));
      if(new Set([...originals,...legacy,...copied].map(r=>r.key)).size!==keys.length) throw new TRPCError({code:'PRECONDITION_FAILED',message:'Un média privé de la source est introuvable ou non autorisé.'});
    }
    const {id:oldId,createdAt,updatedAt,archivedAt,publishedVersionId,isPublished,isFeatured,reviewStatus,version,translationGroupId,...metadata}=source;
    const [course]=await tx.insert(trainings).values({...metadata,title:input.title,slug:`copy-${randomUUID()}`,ownerUserId:actor.id,ownerOrgId:input.orgId,isPublished:false,isFeatured:false,reviewStatus:'draft',version:1}).returning();
    const moduleIds=new Map<number,number>(),objectiveIds=new Map<number,number>();
    function remap(id:number|null,map:Map<number,number>){
      if(id==null)return null;
      const value=map.get(id);
      if(value==null)throw new TRPCError({code:'PRECONDITION_FAILED',message:'La source contient un rattachement à un élément archivé ou étranger. Corrigez-le avant duplication.'});
      return value;
    }
    for(const row of modules){const {id,trainingId,archivedAt,objectiveId,...data}=row;const [created]=await tx.insert(trainingModules).values({...data,trainingId:course.id}).returning();moduleIds.set(id,created.id);}
    for(const row of objectives){const {id,trainingId,archivedAt,createdAt,updatedAt,moduleId,...data}=row;const [created]=await tx.insert(learningObjectives).values({...data,trainingId:course.id,moduleId:remap(moduleId,moduleIds)}).returning();objectiveIds.set(id,created.id);}
    for(const row of modules)if(row.objectiveId!=null)await tx.update(trainingModules).set({objectiveId:remap(row.objectiveId,objectiveIds)}).where(eq(trainingModules.id,moduleIds.get(row.id)!));
    for(const row of deck){const {id,trainingId,archivedAt,createdAt,updatedAt,moduleId,objectiveId,...data}=row;await tx.insert(slides).values({...data,trainingId:course.id,moduleId:remap(moduleId,moduleIds),objectiveId:remap(objectiveId,objectiveIds)});}
    for(const row of questions){const {id,trainingId,archivedAt,moduleId,objectiveId,...data}=row;await tx.insert(quizQuestions).values({...data,trainingId:course.id,moduleId:remap(moduleId,moduleIds),objectiveId:remap(objectiveId,objectiveIds)});}
    await tx.insert(courseCopies).values({trainingId:course.id,sourceTrainingId:source.id,createdBy:actor.id,snapshot});
    if(keys.length)await tx.insert(copiedCourseMedia).values(keys.map(storageKey=>({trainingId:course.id,storageKey})));
    return {trainingId:course.id};
  },{isolationLevel:'repeatable read'});
}
