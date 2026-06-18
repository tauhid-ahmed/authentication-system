/**
 * @file Auth Routes
 * @milestone M1+
 *
 * Route definitions — wires URLs to controllers + middleware.
 *
 * ROUTE DESIGN:
 * All auth routes are prefixed with /api/auth in app.ts.
 * Here we only define the sub-paths.
 *
 * MIDDLEWARE ORDER MATTERS:
 * rateLimiter → authenticate (if needed) → controller
 *
 * ┌─────────────────────────┬────────┬──────────────────────────────────┐
 * │ Route                   │ Method │ Description                      │
 * ├─────────────────────────┼────────┼──────────────────────────────────┤
 * │ /api/auth/signup        │ POST   │ Register new user                │
 * │ /api/auth/login         │ POST   │ Authenticate user                │
 * │ /api/auth/refresh       │ POST   │ Rotate refresh token             │
 * │ /api/auth/logout        │ POST   │ Revoke current session           │
 * │ /api/auth/logout-all    │ POST   │ Revoke all sessions              │
 * │ /api/auth/me            │ GET    │ Get current user                 │
 * └─────────────────────────┴────────┴──────────────────────────────────┘
 */
import { Router } from "express";
import { loginLimiter, signupLimiter, refreshLimiter } from "../../middlewares/rateLimiter.js";
import { authenticate } from "../../middlewares/authenticate.js";
import * as authController from "./auth.controller.js";

const router: Router = Router();

// Public routes (no auth required)
router.post("/signup", signupLimiter, authController.signup);
router.post("/login", loginLimiter, authController.login);
router.post("/refresh", refreshLimiter, authController.refreshToken);

// Semi-public (works with or without valid session)
router.post("/logout", authenticateOptionalForLogout, authController.logout);

// Protected routes
router.post("/logout-all", authenticate, authController.logoutAll);
router.get("/me", authenticate, authController.getMe);

// WHY a special "optional" wrapper for logout?
// Logout should work even if the access token is expired.
// We still want req.user if possible (for audit logging).
// But we don't want to block logout for expired tokens.
function authenticateOptionalForLogout(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction
): void {
  const cookieName = "access_token";
  const token = req.cookies[cookieName] as string | undefined;
  if (token) {
    try {
      const { verifyAccessToken } = require("../../utils/jwt.js");
      const payload = verifyAccessToken(token);
      req.user = { id: payload.sub, role: payload.role };
    } catch {
      // Ignore — logout works regardless
    }
  }
  next();
}

export default router;
