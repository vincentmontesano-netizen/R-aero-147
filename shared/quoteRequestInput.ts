import {z} from 'zod';

export const quoteRequestInput = z.object({
 requestId:z.string().uuid().transform(value=>value.toLowerCase()).optional(),
 companyName:z.string().trim().min(1).max(255),
 siret:z.string().trim().max(20).optional(),
 contactName:z.string().trim().min(1).max(128),
 contactEmail:z.string().trim().email().max(320),
 contactPhone:z.string().trim().max(32).optional(),
 employeeCount:z.number().int().min(1).max(2147483647).optional(),
 trainingTypes:z.string().trim().max(512).optional(),
 message:z.string().trim().max(10000).optional(),
}).strict();
