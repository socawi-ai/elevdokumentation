import type { NextFunction, Request, Response } from "express";

// Express 4 does not catch rejected promises returned from async route
// handlers — an unhandled rejection there becomes an uncaught exception at
// the process level (Node's default: crash). Wrapping every handler routes
// the rejection into Express's normal error-handling middleware instead.
export function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}
