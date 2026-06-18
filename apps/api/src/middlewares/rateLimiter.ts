/**
 * @file Rate Limiting Middleware
 * @milestone M13 (Security Hardening)
 *
 * ============================================================
 * WHY RATE LIMITING?
 * ============================================================
 *
 * Without rate limiting:
 *   - Brute force attack: Try millions of passwords → eventually succeed
 *   - Credential stuffing: Try leaked password lists
 *   - Enumeration: Probe 10,000 emails to find valid accounts
 *   - DoS: Spam refresh endpoint to exhaust DB connections
 *
 * With rate limiting:
 *   - Login: Max 5 attempts per 15 min per IP
 *     → An attacker can try 5 passwords. Then they wait 15 minutes.
 *     → To try 1 million passwords = 3 million minutes = 5.7 years
 *
 * RATE LIMIT STRATEGY:
 *
 * ┌─────────────────────────┬──────────────────┬─────────────────┐
 * │ Endpoint                │ Limit            │ Window          │
 * ├─────────────────────────┼──────────────────┼─────────────────┤
 * │ POST /auth/login        │ 5 requests       │ 15 minutes      │
 * │ POST /auth/signup       │ 10 requests      │ 1 hour          │
 * │ POST /auth/refresh      │ 20 requests      │ 15 minutes      │
 * │ All other routes        │ 100 requests     │ 15 minutes      │
 * └─────────────────────────┴──────────────────┴─────────────────┘
 *
 * PRODUCTION UPGRADE: Use Redis for distributed rate limiting.
 * In-memory (current) resets if server restarts.
 * Redis persists across restarts and works across multiple server instances.
 */
import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

const rateLimitHandler = (
  req: import("express").Request,
  res: import("express").Response
) => {
  logger.warn(
    {
      ip: req.ip,
      path: req.path,
      method: req.method,
    },
    "Rate limit exceeded"
  );

  res.status(429).json({
    success: false,
    error: {
      message: "Too many requests. Please try again later.",
      code: "RATE_LIMIT_EXCEEDED",
      statusCode: 429,
    },
  });
};

/**
 * General API rate limiter — applies to all routes
 */
export const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS, // 15 minutes
  max: env.RATE_LIMIT_MAX_REQUESTS,   // 100 requests
  standardHeaders: "draft-7",         // Return rate limit info in headers
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: (req) => req.method === "OPTIONS", // Skip preflight requests
});

/**
 * Login rate limiter — strict
 *
 * WHY SO STRICT (5 per 15 min)?
 * Login is the most targeted endpoint for brute force.
 * Legitimate users rarely fail login 5 times in 15 minutes.
 * An attacker trying a wordlist needs thousands of attempts.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.LOGIN_RATE_LIMIT_MAX, // 5 attempts
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => {
    // Rate limit by IP + email combination.
    // WHY? Same IP trying different emails = credential stuffing.
    // Different IPs trying same email = distributed attack (harder to stop).
    const email = (req.body?.email ?? "").toLowerCase();
    return `${req.ip}:${email}`;
  },
});

/**
 * Signup rate limiter
 *
 * WHY LIMIT SIGNUP?
 * Attackers create fake accounts for spam, fraud, or to enumerate valid emails.
 */
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * Refresh token rate limiter
 *
 * WHY LIMIT REFRESH?
 * Each refresh = DB write (create new session, revoke old).
 * Spamming refresh = DB exhaustion.
 * Also prevents rapid token rotation attacks.
 */
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.REFRESH_RATE_LIMIT_MAX, // 20
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * Admin routes rate limiter
 *
 * Sensitive admin operations get their own strict limiter.
 */
export const adminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler,
});
