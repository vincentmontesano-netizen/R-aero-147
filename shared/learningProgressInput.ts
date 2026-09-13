import {z} from 'zod';
export const learningProgressInput=z.object({
 enrollmentId:z.number().int().positive().max(2147483647),
 progressPercent:z.number().int().min(0).max(100),
 status:z.enum(['not_started','in_progress']).optional(),
}).strict();
