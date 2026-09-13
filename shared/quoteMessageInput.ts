import {z} from 'zod';
export const quoteThreadInput=z.object({quoteId:z.number().int().positive().max(2147483647)}).strict();
export const quoteMessageInput=quoteThreadInput.extend({requestId:z.string().uuid().transform(value=>value.toLowerCase()).optional(),content:z.string().trim().min(1).max(10000)}).strict();
