import type { RequestHandler } from 'express';

/** Batches can mix public and account data: never allow HTTP caching of tRPC. */
export const preventApiCaching: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
};
