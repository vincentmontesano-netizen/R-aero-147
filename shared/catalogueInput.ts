import {z} from 'zod';
export const catalogueInput=z.object({
 type:z.string().trim().max(32).optional(),
 domain:z.string().trim().max(32).optional(),
 language:z.string().trim().max(8).optional(),
 categoryId:z.number().int().positive().max(2147483647).optional(),
 search:z.string().trim().max(255).optional(),
}).strict();
