import {z} from 'zod';
export const embeddedQuizSchema=z.object({
 quizQuestion:z.string().trim().max(2000).nullish(),
 quizOptions:z.array(z.string().trim().min(1).max(2000)).min(2).max(10).nullish(),
 quizCorrect:z.array(z.number().int().min(0).max(9)).min(1).max(10).nullish(),
 quizExplanation:z.string().max(5000).nullish(),
}).superRefine((quiz,ctx)=>{
 if(quiz.quizQuestion){
  const options=quiz.quizOptions,correct=quiz.quizCorrect;
  if(!options||!correct||new Set(options.map(v=>v.toLowerCase())).size!==options.length||new Set(correct).size!==correct.length||correct.some(i=>i>=options.length))ctx.addIssue({code:'custom',message:'QCM incomplet ou réponses invalides.'});
 }else if(quiz.quizOptions||quiz.quizCorrect||quiz.quizExplanation)ctx.addIssue({code:'custom',message:'La question du QCM est requise.'});
});
export const embeddedQuizFields=['quizQuestion','quizOptions','quizCorrect','quizExplanation'] as const;
