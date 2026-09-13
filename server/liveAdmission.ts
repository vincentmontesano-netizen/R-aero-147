import {TRPCError} from '@trpc/server';
export function liveAdmission(start:Date|null,end:Date|null,status:string|null,moderator:boolean,now=Date.now()) {
 const valid=start && end && Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && end.getTime()>start.getTime();
 const opensAt=valid ? new Date(start.getTime()-(moderator?30:15)*60_000) : null;
 const closesAt=valid ? new Date(end.getTime()+15*60_000) : null;
 const state=status==='completed'||status==='cancelled'?'closed':!opensAt||!closesAt?'unscheduled':now<opensAt.getTime()?'early':now>=closesAt.getTime()?'closed':'open';
 return {state,opensAt,closesAt};
}
export function requireLiveAdmission(admission:ReturnType<typeof liveAdmission>) {
 if(admission.state!=='open')throw new TRPCError({code:'PRECONDITION_FAILED',message:admission.state==='early'?'La visioconférence n’est pas encore ouverte.':admission.state==='unscheduled'?'L’organisateur doit renseigner des horaires de début et de fin valides.':'La fenêtre de visioconférence est terminée.'});
 return admission.closesAt!;
}
