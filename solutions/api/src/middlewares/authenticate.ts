/**
 * @file Authentication Middleware
 * @milestone M4 (Access Token System)
 *
 * ============================================================
 * WHAT THIS MIDDLEWARE DOES
 * ============================================================
 *
 * Every protected route runs this middleware FIRST.
 * It reads the access token from the HTTP-only cookie,
 * verifies the JWT signature + expiry, and attaches the user
 * info to req.user for downstream handlers.
 *
 * FLOW:
 *   Request → authenticate → authorize (if needed) → Controller
 *
 * ASCII DIAGRAM:
 *
 *   Client                     API Server
 *     │                            │
 *     │  GET /api/users/me         │
 *     │  Cookie: access_token=...  │
 *     │ ─────────────────────────► │
 *     │                            │  authenticate()
 *     │                            │  ├─ Read cookie
 *     │                            │  ├─ Verify JWT
 *     │                            │  ├─ Extract payload
 *     │                            │  └─ req.user = { id, role }
 *     │                            │
 *     │                            │  usersController.getMe()
 *     │                            │  └─ Uses req.user.id
 *     │                            │
 *     │  200 { user: {...} }       │
 *     │ ◄───────────────────────── │
 *
 * IMPORTANT: This middleware does NOT check the database.
 * Access tokens are STATELESS — the signature is the proof of validity.
 * This is what makes JWT scalable: no DB round-trip per request.
 *
 * TRADEOFF: If you need to invalidate an access token before it expires,
 * you CAN'T with pure stateless JWT (unless you use a token blacklist).
 * Solution: Keep access tokens SHORT (5 min) + revoke via refresh tokens.
 *
 * ============================================================
 */
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
const { JsonWebTokenError, TokenExpiredError } = jwt;
import { verifyAccessToken } from "../utils/jwt.js";
import { sendError } from "../utils/response.js";
import type { AuthenticatedUser } from "@auth/shared";
import { getAccessTokenFromRequest } from "../utils/authTransport.js";

// ============================================================
// Extend Express Request type to include authenticated user
// ============================================================
// WHY AUGMENT? TypeScript doesn't know about our custom req.user property.
// This declaration tells TypeScript what req.user looks like.
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Middleware: Authenticate (required)
 *
 * Use this on routes that MUST have a logged-in user.
 * Returns 401 if no valid token.
 */
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = getAccessTokenFromRequest(req);

  if (!token) {
    // WHY 401 (not 403)?
    // 401 = "I don't know who you are" (unauthenticated)
    // 403 = "I know who you are but you're not allowed" (unauthorized)
    sendError(res, "Authentication required. Please log in.", 401, "UNAUTHENTICATED");
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
    };
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      // IMPORTANT: This 401 with code EXPIRED tells the frontend to trigger refresh.
      // The frontend fetch wrapper (lib/fetch.ts) catches this specific code.
      sendError(res, "Access token expired. Please refresh.", 401, "TOKEN_EXPIRED");
      return;
    }
    if (error instanceof JsonWebTokenError) {
      sendError(res, "Invalid token. Please log in again.", 401, "TOKEN_INVALID");
      return;
    }
    sendError(res, "Authentication error.", 500, "AUTH_ERROR");
  }
}

/**
 * Middleware: Authenticate (optional)
 *
 * Use this on routes that work both authenticated AND unauthenticated.
 * Attaches req.user if token is valid, but doesn't block if token is missing.
 *
 * @example Use case: Public profile page — show "Follow" button only if logged in.
 */
export function authenticateOptional(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const token = getAccessTokenFromRequest(req);

  if (token) {
    try {
      const payload = verifyAccessToken(token);
      req.user = { id: payload.sub, role: payload.role };
    } catch {
      // Silently ignore invalid tokens in optional mode
      req.user = undefined;
    }
  }

  next();
}
