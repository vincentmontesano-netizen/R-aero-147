import {z} from 'zod';
export const quoteStatusInput=z.object({
 id:z.number().int().positive().max(2147483647),
 status:z.enum(['received','in_progress','quote_sent','accepted','refused']),
 expectedRevision:z.number().int().min(0).max(2147483647),
}).strict();
