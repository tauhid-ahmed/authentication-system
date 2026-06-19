/**
 * @file Error Handler Middleware
 * @milestone M1 (global, always needed)
 *
 * WHY A GLOBAL ERROR HANDLER?
 * ----------------------------
 * Without it: Unhandled errors expose stack traces to users (security risk).
 * With it: All errors go through ONE place → consistent format → no leaks.
 *
 * In Express, a middleware with 4 params = error handler.
 * It must be registered LAST, after all routes.
 */
import type { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";
import { ZodError } from "zod";

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log the full error for our observability
  logger.error(
    { err, path: req.path, method: req.method, ip: req.ip },
    "Unhandled error"
  );

  // Zod validation error (schema validation failed)
  if (err instanceof ZodError) {
    const errors = err.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));
    res.status(422).json({
      success: false,
      error: { message: "Validation failed" },
      errors,
    });
    return;
  }

  // Express CORS error
  if (err instanceof Error && err.message.startsWith("CORS:")) {
    res.status(403).json({
      success: false,
      error: { message: err.message, code: "CORS_ERROR" },
    });
    return;
  }

  // Generic error
  const message =
    env.NODE_ENV === "production"
      ? "An unexpected error occurred. Please try again."
      : err instanceof Error
      ? err.message
      : "Unknown error";

  res.status(500).json({
    success: false,
    error: {
      message,
      code: "INTERNAL_SERVER_ERROR",
      // Only include stack in development
      ...(env.NODE_ENV !== "production" &&
        err instanceof Error && { stack: err.stack }),
    },
  });
};

/**
 * 404 Not Found handler
 * Register this BEFORE errorHandler but AFTER all routes.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.method} ${req.path} not found.`,
      code: "NOT_FOUND",
    },
  });
}
