import { z } from 'zod';
export const supportMessageInput = z.object({
  ticketId: z.number().int().positive().max(2147483647),
  content: z.string().trim().min(1).max(10000),
  requestId: z.string().uuid().transform(value => value.toLowerCase()).optional(),
}).strict();
