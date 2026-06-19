/**
 * @file Refresh Token Management Utilities
 * @milestone M5 (Refresh Tokens), M6 (Rotation)
 *
 * ============================================================
 * REFRESH TOKEN LIFECYCLE
 * ============================================================
 *
 *  User Login
 *       │
 *       ▼
 *  Create Session in DB
 *  ┌────────────────────────────────┐
 *  │ id: "clx..."                   │
 *  │ userId: "user_id"              │
 *  │ refreshToken: <hashed_token>   │
 *  │ expiresAt: +30 days            │
 *  └────────────────────────────────┘
 *       │
 *       ▼
 *  Issue tokens in HTTP-only cookies
 *  ┌─────────────────────┐  ┌──────────────────────┐
 *  │ access_token (5min) │  │ refresh_token (30d)   │
 *  │ httpOnly cookie     │  │ httpOnly cookie       │
 *  └─────────────────────┘  └──────────────────────┘
 *
 *  [5 minutes later — access token expired]
 *       │
 *       ▼
 *  POST /api/auth/refresh (with refresh_token cookie)
 *       │
 *       ▼
 *  Verify refresh token JWT
 *  Find session in DB by sessionId from token payload
 *  Compare token hash with stored hash
 *       │
 *  ┌────┴──────────────────┐
 *  │ MATCH?                │
 *  └────┬──────────────────┘
 *       │ YES
 *       ▼
 *  Generate new refresh token         ← ROTATION
 *  Invalidate old session             ← REUSE DETECTION SETUP
 *  Create new session with new token
 *  Issue both new tokens in cookies
 *       │
 *       │ NO (old/already-rotated token reused)
 *       ▼
 *  SECURITY ALERT: Token reuse detected!
 *  Revoke ALL sessions for this user  ← NUCLEAR OPTION
 *  Log security event
 *  Return 401
 *
 * ============================================================
 */
import crypto from "crypto";
import { db } from "../config/db.js";
import { env } from "../config/env.js";
import { signRefreshToken, getExpiryDate } from "./jwt.js";
import type { DeviceInfo } from "@auth/shared";

/**
 * Hash a refresh token for storage.
 *
 * WHY HASH THE REFRESH TOKEN IN DB?
 * If your DB is breached, attackers get hashed tokens — useless without reversal.
 * SHA-256 is fine here (fast hashing is OK for storage, NOT for passwords).
 * We don't need bcrypt's slowness — we're just preventing plaintext exposure.
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Create a new session + issue a refresh token.
 * Called on login and after successful rotation.
 */
export async function createSession(
  userId: string,
  deviceInfo?: DeviceInfo,
  ipAddress?: string
): Promise<{ refreshToken: string; sessionId: string }> {
  // Generate new refresh token JWT
  const sessionId = crypto.randomUUID(); // Temporary ID for token payload

  // Create the JWT first (needs sessionId in payload)
  const refreshToken = signRefreshToken({ sub: userId, sessionId });

  // Hash for storage
  const hashedToken = hashRefreshToken(refreshToken);

  // Store session in DB
  const session = await db.session.create({
    data: {
      userId,
      refreshToken: hashedToken,
      deviceInfo: deviceInfo
        ? `${deviceInfo.browser ?? "Unknown"} on ${deviceInfo.os ?? "Unknown"}`
        : null,
      ipAddress: ipAddress ?? null,
      userAgent: deviceInfo?.raw ?? null,
      expiresAt: getExpiryDate(env.REFRESH_TOKEN_EXPIRY),
    },
  });

  // Re-sign with the REAL session ID from DB
  const finalRefreshToken = signRefreshToken({
    sub: userId,
    sessionId: session.id,
  });
  const finalHashedToken = hashRefreshToken(finalRefreshToken);

  // Update session with the correct hash
  await db.session.update({
    where: { id: session.id },
    data: { refreshToken: finalHashedToken },
  });

  return { refreshToken: finalRefreshToken, sessionId: session.id };
}

/**
 * Rotate a refresh token.
 *
 * This is called on every /refresh request.
 *
 * WHY ROTATION?
 * Without rotation: Stolen refresh token = permanent unauthorized access.
 * With rotation: Each use invalidates the previous token.
 *   If attacker uses a stolen token that was already rotated → DETECTED.
 *   We then revoke ALL sessions for the user (assume breach).
 *
 * @param sessionId - The session ID from the refresh token payload
 * @param incomingToken - The raw refresh token from the cookie
 * @returns New refresh token or null if invalid
 */
export async function rotateRefreshToken(
  sessionId: string,
  incomingToken: string,
  userId: string,
  deviceInfo?: DeviceInfo,
  ipAddress?: string
): Promise<{ refreshToken: string; sessionId: string } | null> {
  const hashedIncoming = hashRefreshToken(incomingToken);

  // Find the session
  const session = await db.session.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    // Session not found — could be a replay after we deleted it
    return null;
  }

  // ============================================================
  // REPLAY ATTACK DETECTION (M6)
  // ============================================================
  if (session.isRevoked) {
    // This session was already revoked — someone is reusing an old token!
    // This is the CORE of refresh token rotation security.
    //
    // Scenario: Attacker stole refresh token T1.
    //   1. Legitimate user refreshes → T1 rotated to T2, session updated.
    //   2. Attacker uses T1 → finds session REVOKED → ATTACK DETECTED.
    //   3. We revoke ALL sessions for this user (their device will re-login).
    //
    // This is aggressive but correct. If T1 is being used after rotation,
    // either the user's client is buggy (rare) or there's an attacker.

    await db.session.updateMany({
      where: { userId: session.userId, isRevoked: false },
      data: { isRevoked: true },
    });

    return null; // Signal: security breach — revoked all sessions
  }

  // Verify the token hash matches stored hash
  if (session.refreshToken !== hashedIncoming) {
    return null; // Token hash mismatch — tampered token
  }

  // Check expiry
  if (session.expiresAt < new Date()) {
    await db.session.update({ where: { id: sessionId }, data: { isRevoked: true } });
    return null;
  }

  // ============================================================
  // ROTATION: Invalidate old, create new
  // ============================================================

  // Step 1: Revoke the old session
  await db.session.update({
    where: { id: sessionId },
    data: { isRevoked: true },
  });

  // Step 2: Create new session with new token
  const newSession = await createSession(userId, deviceInfo, ipAddress);

  // Step 3: Update the new session's lastUsedAt
  await db.session.update({
    where: { id: newSession.sessionId },
    data: { lastUsedAt: new Date() },
  });

  return newSession;
}

/**
 * Revoke a specific session by ID.
 * Used for: manual logout, admin revoke, security incidents.
 */
export async function revokeSession(sessionId: string): Promise<void> {
  await db.session.update({
    where: { id: sessionId },
    data: { isRevoked: true },
  });
}

/**
 * Revoke all sessions for a user.
 * Used for: "logout everywhere", security breach, password change.
 */
export async function revokeAllUserSessions(userId: string): Promise<number> {
  const result = await db.session.updateMany({
    where: { userId, isRevoked: false },
    data: { isRevoked: true },
  });
  return result.count;
}

/**
 * Clean up expired sessions.
 * Should be run as a cron job in production.
 *
 * WHY PERIODIC CLEANUP?
 * Expired sessions stay in DB after expiry. They're harmless but waste space.
 * A nightly cleanup keeps the sessions table lean.
 * In production: Use a Vercel Cron Job, AWS EventBridge, or cron on your server.
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db.session.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { isRevoked: true, lastUsedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      ],
    },
  });
  return result.count;
}
