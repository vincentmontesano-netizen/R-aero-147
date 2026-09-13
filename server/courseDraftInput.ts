import {z} from 'zod';
const draftSlide=z.object({
 title:z.string().max(255).optional(),body:z.string().max(20000).optional(),imageUrl:z.string().max(1024).optional(),imagePrompt:z.string().max(10000).optional(),videoUrl:z.string().max(1024).optional(),audioUrl:z.string().max(1024).optional(),
 quizQuestion:z.string().max(2000).optional(),quizOptions:z.array(z.string().trim().min(1).max(2000)).min(2).max(10).optional(),quizCorrect:z.array(z.number().int().min(0).max(9)).min(1).max(10).optional(),quizExplanation:z.string().max(5000).optional(),
}).strict().superRefine((s,ctx)=>{
 const hasQuiz=!!s.quizQuestion?.trim();
 if(hasQuiz&&(!s.quizOptions||!s.quizCorrect||s.quizCorrect.some(i=>i>=(s.quizOptions?.length??0))||new Set(s.quizCorrect).size!==s.quizCorrect.length||new Set(s.quizOptions.map(v=>v.toLowerCase())).size!==s.quizOptions.length))ctx.addIssue({code:'custom',message:'QCM incomplet ou réponses invalides.'});
 if(!hasQuiz&&(s.quizOptions||s.quizCorrect||s.quizExplanation))ctx.addIssue({code:'custom',message:'La question du QCM est requise.'});
});
export const courseDraftInput=z.object({orgId:z.number().int().positive().optional(),title:z.string().trim().min(1).max(255),slug:z.string().trim().min(1).max(255),description:z.string().max(10000).optional(),language:z.enum(['fr','en','ar']).optional(),categoryId:z.number().int().positive().optional(),durationHours:z.string().regex(/^\d{1,3}(\.\d{1,2})?$/).optional(),slides:z.array(draftSlide).max(200).default([])}).strict();
