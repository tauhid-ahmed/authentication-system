/**
 * @file Auth Controller
 * @milestone M1, M5, M6
 *
 * ============================================================
 * THE CONTROLLER LAYER — HTTP CONCERNS ONLY
 * ============================================================
 *
 * Controllers are responsible for:
 *   1. Parsing the HTTP request (body, cookies, headers)
 *   2. Calling the appropriate service method
 *   3. Setting cookies (HTTP concerns)
 *   4. Sending the HTTP response
 *
 * Controllers do NOT contain business logic.
 * If you find yourself writing "if email exists..." in a controller, stop —
 * that logic belongs in the service.
 *
 * ============================================================
 */
import type { Request, Response } from "express";
import { authService } from "./auth.service.js";
import { SignupSchema, LoginSchema } from "@auth/shared";
import { sendSuccess, sendError } from "../../utils/response.js";
import { parseUserAgent, extractIpAddress } from "../../utils/device.js";
import {
  COOKIE_NAMES,
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
  getClearCookieOptions,
} from "../../utils/jwt.js";
import { env } from "../../config/env.js";
import { verifyRefreshToken } from "../../utils/jwt.js";

const isProduction = env.NODE_ENV === "production";

/**
 * POST /api/auth/signup
 */
export async function signup(req: Request, res: Response): Promise<void> {
  // 1. Validate request body with Zod
  const parsed = SignupSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors = parsed.error.errors.map((e) => ({
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

  // 2. Extract device + IP context
  const deviceInfo = parseUserAgent(req.headers["user-agent"]);
  const ipAddress = extractIpAddress(req);

  try {
    // 3. Call service
    const result = await authService.signup(parsed.data, deviceInfo, ipAddress);

    // 4. Set HTTP-only cookies
    res.cookie(
      COOKIE_NAMES.ACCESS_TOKEN,
      result.tokens.accessToken,
      getAccessTokenCookieOptions(isProduction)
    );
    res.cookie(
      COOKIE_NAMES.REFRESH_TOKEN,
      result.tokens.refreshToken,
      getRefreshTokenCookieOptions(isProduction)
    );

    // 5. Send response — note: NO tokens in response body
    sendSuccess(
      res,
      { user: result.user },
      "Account created successfully.",
      201
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "DUPLICATE_EMAIL") {
        sendError(res, "An account with this email already exists.", 409, "DUPLICATE_EMAIL");
        return;
      }
    }
    throw error; // Rethrow unexpected errors → global error handler
  }
}

/**
 * POST /api/auth/login
 */
export async function login(req: Request, res: Response): Promise<void> {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors = parsed.error.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));
    res.status(422).json({ success: false, error: { message: "Validation failed" }, errors });
    return;
  }

  const deviceInfo = parseUserAgent(req.headers["user-agent"]);
  const ipAddress = extractIpAddress(req);

  try {
    const result = await authService.login(parsed.data, deviceInfo, ipAddress);

    res.cookie(
      COOKIE_NAMES.ACCESS_TOKEN,
      result.tokens.accessToken,
      getAccessTokenCookieOptions(isProduction)
    );
    res.cookie(
      COOKIE_NAMES.REFRESH_TOKEN,
      result.tokens.refreshToken,
      getRefreshTokenCookieOptions(isProduction)
    );

    sendSuccess(res, { user: result.user }, "Login successful.");
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "INVALID_CREDENTIALS") {
        // WHY 401 not 400?
        // 401 = "I need credentials to let you through"
        // Same message for "wrong password" and "email not found" — prevent enumeration
        sendError(res, "Invalid email or password.", 401, "INVALID_CREDENTIALS");
        return;
      }
    }
    throw error;
  }
}

/**
 * POST /api/auth/refresh
 * @milestone M5, M6
 *
 * This is the most security-critical endpoint.
 * The refresh token comes from the HTTP-only cookie.
 */
export async function refreshToken(req: Request, res: Response): Promise<void> {
  // Read from HTTP-only cookie
  const token = req.cookies[COOKIE_NAMES.REFRESH_TOKEN] as string | undefined;

  if (!token) {
    sendError(res, "No refresh token. Please log in.", 401, "NO_REFRESH_TOKEN");
    return;
  }

  const deviceInfo = parseUserAgent(req.headers["user-agent"]);
  const ipAddress = extractIpAddress(req);

  try {
    const result = await authService.refresh(token, deviceInfo, ipAddress);

    // Set new cookies
    res.cookie(
      COOKIE_NAMES.ACCESS_TOKEN,
      result.accessToken,
      getAccessTokenCookieOptions(isProduction)
    );
    res.cookie(
      COOKIE_NAMES.REFRESH_TOKEN,
      result.refreshToken,
      getRefreshTokenCookieOptions(isProduction)
    );

    sendSuccess(res, { message: "Tokens refreshed." }, "Tokens refreshed.");
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "INVALID_REFRESH_TOKEN") {
        // Clear cookies on invalid token
        res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, getClearCookieOptions(isProduction));
        res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, { path: "/api/auth/refresh" });
        sendError(res, "Invalid refresh token. Please log in again.", 401, "INVALID_REFRESH_TOKEN");
        return;
      }
      if (error.message === "REFRESH_TOKEN_REUSE") {
        // Clear cookies — all sessions were revoked
        res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, getClearCookieOptions(isProduction));
        res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, { path: "/api/auth/refresh" });
        sendError(
          res,
          "Security alert: All sessions have been revoked. Please log in again.",
          401,
          "TOKEN_REUSE_DETECTED"
        );
        return;
      }
    }
    throw error;
  }
}

/**
 * POST /api/auth/logout
 */
export async function logout(req: Request, res: Response): Promise<void> {
  const token = req.cookies[COOKIE_NAMES.REFRESH_TOKEN] as string | undefined;

  // Clear cookies regardless of token validity
  res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, getClearCookieOptions(isProduction));
  res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, { path: "/api/auth/refresh" });

  // If we have a valid refresh token, revoke the session in DB
  if (token && req.user) {
    try {
      const payload = verifyRefreshToken(token);
      await authService.logout(payload.sessionId, req.user.id);
    } catch {
      // Ignore verification errors on logout — user is logged out regardless
    }
  }

  sendSuccess(res, null, "Logged out successfully.");
}

/**
 * POST /api/auth/logout-all
 * Revoke all sessions for the authenticated user.
 */
export async function logoutAll(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    sendError(res, "Authentication required.", 401);
    return;
  }

  res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, getClearCookieOptions(isProduction));
  res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, { path: "/api/auth/refresh" });

  const count = await authService.logoutEverywhere(req.user.id);
  sendSuccess(res, { revokedSessions: count }, `Logged out from ${count} device(s).`);
}

/**
 * GET /api/auth/me
 * Returns the currently authenticated user's info.
 * The frontend can call this on page load to restore auth state.
 */
export async function getMe(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    sendError(res, "Authentication required.", 401);
    return;
  }

  const { authRepository } = await import("./auth.repository.js");
  const user = await authRepository.findById(req.user.id);

  if (!user) {
    // Edge case: user deleted their account but still has a valid token
    res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, getClearCookieOptions(isProduction));
    sendError(res, "User not found.", 404, "USER_NOT_FOUND");
    return;
  }

  sendSuccess(res, { user });
}
