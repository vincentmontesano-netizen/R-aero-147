import {z} from 'zod';
export const supportRequestKinds=['GENERAL','DATA_ACCESS','RECTIFICATION','ERASURE'] as const;
export const supportRequestInput=z.object({requestId:z.string().uuid().transform(value=>value.toLowerCase()).optional(),subject:z.string().trim().min(1).max(255),message:z.string().trim().max(10000).optional(),priority:z.enum(['low','normal','high']).optional(),requestKind:z.enum(supportRequestKinds).default('GENERAL')}).superRefine((value,ctx)=>{
 if(value.requestKind!=='GENERAL'&&(value.message?.length??0)<10)ctx.addIssue({code:'custom',path:['message'],message:'Décrivez les données concernées et votre demande (10 caractères minimum).'});
});
export const supportRequestLabels={
 fr:{GENERAL:'Assistance générale',DATA_ACCESS:'Accès à mes données',RECTIFICATION:'Rectification de mes données',ERASURE:'Effacement de mes données',type:'Type de demande',notice:'Votre demande sera examinée dans ce fil privé. Son dépôt ne déclenche pas de suppression ni de modification automatique.',link:'Faire une demande concernant mes données'},
 en:{GENERAL:'General support',DATA_ACCESS:'Access to my data',RECTIFICATION:'Correction of my data',ERASURE:'Erasure of my data',type:'Request type',notice:'Your request will be reviewed in this private conversation. Submitting it does not automatically delete or change data.',link:'Make a request about my data'},
 ar:{GENERAL:'دعم عام',DATA_ACCESS:'الوصول إلى بياناتي',RECTIFICATION:'تصحيح بياناتي',ERASURE:'محو بياناتي',type:'نوع الطلب',notice:'ستتم مراجعة طلبك في هذه المحادثة الخاصة. لا يؤدي تقديمه إلى حذف البيانات أو تعديلها تلقائياً.',link:'تقديم طلب بشأن بياناتي'},
};
