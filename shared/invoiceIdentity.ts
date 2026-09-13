import {z} from 'zod';
export const invoiceBuyerSchema=z.object({name:z.string().trim().min(2).max(255),address:z.string().trim().min(5).max(1000),country:z.string().regex(/^[A-Z]{2}$/),registration:z.string().trim().max(128).default(''),taxId:z.string().trim().max(128).default('')}).strict();
export const invoiceIssuerSchema=invoiceBuyerSchema.extend({legalDetails:z.string().trim().min(5).max(1000),paymentTerms:z.string().trim().min(5).max(1000),taxStatement:z.string().trim().min(2).max(500),email:z.string().email().max(320)}).strict();
