import {z} from 'zod';
/** Strict on purpose, but tRPC 11 infinite queries always add `direction` next to `cursor`. */
export const complianceReportInput=z.object({cursor:z.number().int().positive().max(2147483647).optional(),pageSize:z.number().int().min(1).max(250).optional(),direction:z.enum(['forward','backward']).optional()}).strict().optional();
