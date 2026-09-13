import { z } from 'zod';

// Product input limit, not a prescribed regulatory recurrence interval.
export const roleRequirementInput = z.object({
  label: z.string().trim().max(255).optional(),
  jobTitleContains: z.string().trim().max(128).optional(),
  licenseCategoryContains: z.string().trim().max(64).optional(),
  trainingId: z.number().int().positive().max(2147483647),
  periodMonths: z.number().int().min(1).max(120),
}).strict();
