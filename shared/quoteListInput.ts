import {z} from 'zod';
export const quoteListInput=z.object({beforeId:z.number().int().positive().max(2147483647).optional()}).strict();
