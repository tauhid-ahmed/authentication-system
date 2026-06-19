/**
 * @file API Response Helpers
 * @milestone M1 (used everywhere)
 *
 * WHY STANDARDIZE RESPONSES?
 * --------------------------
 * Inconsistent API responses are a maintenance nightmare.
 * Frontend developers have to guess: "Is it { data: ... } or { user: ... } or just { ... }?"
 *
 * Stripe, GitHub, and every production API use consistent response envelopes.
 *
 * PATTERN: Always return { success, data?, error? }
 *
 * SUCCESS: { success: true, data: { user: {...} }, message: "Login successful" }
 * ERROR:   { success: false, error: { message: "...", code: "..." } }
 *
 * This lets frontend code do a simple:
 *   if (!response.success) handleError(response.error)
 */
import type { Response } from "express";
import type { ApiSuccessResponse, ApiErrorResponse } from "@auth/shared";

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
): Response {
  const body: ApiSuccessResponse<T> = {
    success: true,
    data,
    ...(message && { message }),
  };
  return res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  message: string,
  statusCode: number = 400,
  code?: string
): Response {
  const body: ApiErrorResponse = {
    success: false,
    error: {
      message,
      statusCode,
      ...(code && { code }),
    },
  };
  return res.status(statusCode).json(body);
}

export function sendValidationError(
  res: Response,
  errors: Array<{ field: string; message: string }>
): Response {
  const body: ApiErrorResponse = {
    success: false,
    error: { message: "Validation failed" },
    errors: errors.map((e) => ({ message: e.message, field: e.field })),
  };
  return res.status(422).json(body);
}
