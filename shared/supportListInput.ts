import { z } from 'zod';
export const supportListInput = z.object({
  beforeId: z.number().int().positive().max(2147483647).optional(),
  status: z.enum(['OPEN', 'PENDING', 'CLOSED']).optional(),
  search: z.string().trim().max(255).optional(),
}).strict();
