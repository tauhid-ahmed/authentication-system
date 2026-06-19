/**
 * @file JWT Utilities
 * @milestone M3 (JWT Auth), M4 (Access Tokens), M5 (Refresh Tokens)
 *
 * ============================================================
 * DEEP DIVE: HOW JWT WORKS
 * ============================================================
 *
 * A JWT has 3 parts, separated by dots:
 *   header.payload.signature
 *
 * HEADER (base64url encoded):
 *   { "alg": "HS256", "typ": "JWT" }
 *
 * PAYLOAD (base64url encoded):
 *   { "sub": "user_id", "role": "USER", "iat": 1234567890, "exp": 1234568190 }
 *
 * SIGNATURE:
 *   HMACSHA256(base64url(header) + "." + base64url(payload), secret)
 *
 * VERIFICATION:
 *   Server recomputes the signature and checks if it matches.
 *   If payload was tampered → signature won't match → rejected.
 *
 * CRITICAL UNDERSTANDING:
 *   JWT payload is NOT encrypted — it's just base64 encoded.
 *   Anyone can decode it. The signature only proves it wasn't tampered.
 *   → NEVER put passwords, PII, or secrets in JWT payload.
 *
 * WHY STATELESS?
 *   Access tokens don't need a DB lookup to validate.
 *   The secret is the only thing needed for verification.
 *   This scales horizontally — any server instance can validate any token.
 */
import jwt from "jsonwebtoken";
import type { JwtAccessPayload, JwtRefreshPayload } from "@auth/shared";
import { env } from "../config/env.js";

// ============================================================
// ACCESS TOKEN (5 minutes)
// ============================================================
/**
 * Sign an access token.
 *
 * WHY 5 MINUTES?
 * Short expiry = small attack window if token is stolen.
 * If attacker gets your access token, they have at most 5 minutes.
 * After that, it's worthless. Contrast with localStorage (no expiry until logout).
 */
export function signAccessToken(
  payload: Omit<JwtAccessPayload, "iat" | "exp">,
): string {
  return jwt.sign(payload, env.ACCESS_TOKEN_SECRET, {
    expiresIn: expiryToSeconds(env.ACCESS_TOKEN_EXPIRY),
    algorithm: "HS256",
  });
}

/**
 * Verify an access token.
 *
 * Returns the payload if valid.
 * Throws JsonWebTokenError if invalid or expired.
 */
export function verifyAccessToken(token: string): JwtAccessPayload {
  return jwt.verify(token, env.ACCESS_TOKEN_SECRET, {
    algorithms: ["HS256"],
  }) as JwtAccessPayload;
}

// ============================================================
// REFRESH TOKEN (30 days)
// ============================================================
/**
 * Sign a refresh token.
 *
 * WHY A SEPARATE SECRET FOR REFRESH TOKENS?
 * If one secret is compromised, not both token types are broken.
 * Defense in depth.
 *
 * WHY 30 DAYS?
 * Balance between UX (not forcing frequent re-logins) and security.
 * Real-world systems: Google = 6 months, GitHub = 3 months.
 */
export function signRefreshToken(
  payload: Omit<JwtRefreshPayload, "iat" | "exp">,
): string {
  return jwt.sign(payload, env.REFRESH_TOKEN_SECRET, {
    expiresIn: expiryToSeconds(env.REFRESH_TOKEN_EXPIRY),
    algorithm: "HS256",
  });
}

/**
 * Verify a refresh token.
 *
 * WHY VALIDATE REFRESH TOKENS DIFFERENTLY?
 * Even a valid JWT refresh token must ALSO exist in the DB.
 * JWT signature alone isn't enough — we need to check it hasn't been rotated/revoked.
 */
export function verifyRefreshToken(token: string): JwtRefreshPayload {
  return jwt.verify(token, env.REFRESH_TOKEN_SECRET, {
    algorithms: ["HS256"],
  }) as JwtRefreshPayload;
}

// ============================================================
// TOKEN EXPIRY HELPERS
// ============================================================
/**
 * Convert JWT expiry string to milliseconds.
 * Used to set cookie maxAge.
 *
 * @example
 * expiryToMs("5m") → 300000
 * expiryToMs("30d") → 2592000000
 */
export function expiryToMs(expiry: string): number {
  const unit = expiry.slice(-1);
  const value = parseInt(expiry.slice(0, -1), 10);

  switch (unit) {
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown expiry unit: ${unit}`);
  }
}

/**
 * Convert JWT expiry string to seconds.
 * Used for cookie maxAge (seconds) and DB expiresAt calculation.
 */
export function expiryToSeconds(expiry: string): number {
  return expiryToMs(expiry) / 1000;
}

/**
 * Get the Date when a token expires.
 */
export function getExpiryDate(expiry: string): Date {
  return new Date(Date.now() + expiryToMs(expiry));
}

// ============================================================
// COOKIE HELPERS
// ============================================================
/**
 * Cookie names — centralized to prevent typos.
 *
 * WHY CONSTANTS?
 * Typos in cookie names cause mysterious auth failures.
 * "accessToken" vs "access_token" vs "access-token" — pick one.
 */
export const COOKIE_NAMES = {
  ACCESS_TOKEN: "access_token",
  REFRESH_TOKEN: "refresh_token",
} as const;

/**
 * Standard cookie options for access token.
 *
 * WHY HTTP-ONLY?
 * httpOnly: true → JavaScript cannot read this cookie.
 * XSS attack: attacker injects JS → tries document.cookie → EMPTY.
 * Without httpOnly: attacker reads token → game over.
 *
 * WHY SECURE?
 * secure: true → Cookie only sent over HTTPS.
 * In dev we override to false (no HTTPS on localhost).
 *
 * WHY SAMESITE 'lax'?
 * 'strict' → Cookie not sent on cross-origin navigation (breaks OAuth redirects).
 * 'lax'    → Cookie sent on same-site requests and top-level navigations.
 * 'none'   → Requires Secure, sent on all cross-origin (risky).
 */
import type { CookieOptions } from "express";

export function getAccessTokenCookieOptions(
  isProduction: boolean,
): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: expiryToMs(env.ACCESS_TOKEN_EXPIRY),
    path: "/",
    ...(isProduction && { domain: env.COOKIE_DOMAIN }),
  };
}

export function getRefreshTokenCookieOptions(
  isProduction: boolean,
): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: expiryToMs(env.REFRESH_TOKEN_EXPIRY),
    path: "/api/auth/refresh",
    ...(isProduction && { domain: env.COOKIE_DOMAIN }),
  };
}

export function getClearCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    ...(isProduction && { domain: env.COOKIE_DOMAIN }),
  };
}
