/**
 * @file Auth Service
 * @milestone M1 (signup/login), M5 (refresh), M6 (rotation), M9 (OAuth)
 *
 * ============================================================
 * THE SERVICE LAYER — WHERE BUSINESS LOGIC LIVES
 * ============================================================
 *
 * Controller: Handles HTTP (parse request, call service, send response)
 * Service:    Handles business logic (validation, decisions, orchestration)
 * Repository: Handles database (queries only)
 *
 * WHY THIS SEPARATION?
 * If you put all logic in controllers, testing becomes impossible without HTTP.
 * Services can be tested in isolation with mock repositories.
 * Services can be reused by multiple controllers (e.g., OAuth also calls authService.login)
 *
 * ============================================================
 */
import { authRepository } from "./auth.repository.js";
import { hashPassword, verifyPassword } from "../../utils/hash.js";
import { signAccessToken } from "../../utils/jwt.js";
import {
  createSession,
  rotateRefreshToken,
  revokeSession,
  revokeAllUserSessions,
} from "../../utils/tokens.js";
import { auditService } from "../audit/audit.service.js";
import { authLogger } from "../../config/logger.js";
import type { SignupInput, LoginInput, DeviceInfo } from "@auth/shared";

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
};

export type AuthResult = {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  tokens: AuthTokens;
};

export const authService = {
  /**
   * SIGNUP
   *
   * Business logic:
   * 1. Check email uniqueness
   * 2. Hash password
   * 3. Create user
   * 4. Create session (issue refresh token)
   * 5. Sign access token
   * 6. Audit log
   */
  async signup(
    input: SignupInput,
    deviceInfo?: DeviceInfo,
    ipAddress?: string
  ): Promise<AuthResult> {
    // 1. Check if email is already taken
    const emailTaken = await authRepository.emailExists(input.email);
    if (emailTaken) {
      // WHY vague error? "Email already in use" enables email enumeration.
      // Attacker can probe: "Does alice@gmail.com have an account?"
      // Best practice: return the same message for taken and available emails.
      // For this learning system, we'll use the clear message for teachability.
      // Production decision: use vague message + email confirmation flow.
      throw new Error("DUPLICATE_EMAIL");
    }

    // 2. Hash password
    const passwordHash = await hashPassword(input.password);

    // 3. Create user in DB
    const user = await authRepository.createUser({
      email: input.email,
      passwordHash,
      name: input.name,
    });

    // 4. Create session + refresh token
    const session = await createSession(user.id, deviceInfo, ipAddress);

    // 5. Sign access token (JWT — stateless, no DB write)
    const accessToken = signAccessToken({ sub: user.id, role: user.role });

    // 6. Audit log (fire and forget)
    auditService.log({
      event: "SIGNUP",
      userId: user.id,
      ipAddress,
      userAgent: deviceInfo?.raw,
      metadata: { email: user.email },
    });

    authLogger.info({ userId: user.id, email: user.email }, "New user signed up");

    return {
      user,
      tokens: {
        accessToken,
        refreshToken: session.refreshToken,
        sessionId: session.sessionId,
      },
    };
  },

  /**
   * LOGIN
   *
   * Business logic:
   * 1. Find user by email
   * 2. Verify password (constant-time comparison)
   * 3. Create new session
   * 4. Sign access token
   * 5. Audit log (success or failure)
   *
   * SECURITY: We reveal as little as possible on failure.
   * Don't say "User not found" — that tells attacker this email isn't registered.
   * Always say "Invalid credentials."
   */
  async login(
    input: LoginInput,
    deviceInfo?: DeviceInfo,
    ipAddress?: string
  ): Promise<AuthResult> {
    // 1. Find user (includes passwordHash)
    const user = await authRepository.findByEmailWithPassword(input.email);

    // 2. Verify password — ALWAYS run bcrypt even if user not found
    //    WHY? Timing attack prevention.
    //    If we return immediately on "user not found", attacker can measure response time.
    //    User exists: ~300ms (bcrypt)
    //    User not exists: ~0ms (immediate return)
    //    → Attacker can enumerate valid emails by measuring response time.
    //    Solution: always run bcrypt, even against a dummy hash.
    const dummyHash = "$2a$12$dummyhashdummyhashdummyhashdummyhashdummyhashdummyhash";
    const passwordValid = await verifyPassword(
      input.password,
      user?.passwordHash ?? dummyHash
    );

    if (!user || !passwordValid || !user.passwordHash) {
      // Audit the failed attempt
      await auditService.logAndCheckAnomaly({
        event: "LOGIN_FAILED",
        userId: user?.id,
        ipAddress,
        userAgent: deviceInfo?.raw,
        metadata: { email: input.email },
      });

      throw new Error("INVALID_CREDENTIALS");
    }

    // 3. Create session + refresh token
    const session = await createSession(user.id, deviceInfo, ipAddress);

    // 4. Sign access token
    const accessToken = signAccessToken({ sub: user.id, role: user.role });

    // 5. Audit success
    auditService.log({
      event: "LOGIN_SUCCESS",
      userId: user.id,
      ipAddress,
      userAgent: deviceInfo?.raw,
    });

    authLogger.info({ userId: user.id }, "User logged in");

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      tokens: {
        accessToken,
        refreshToken: session.refreshToken,
        sessionId: session.sessionId,
      },
    };
  },

  /**
   * REFRESH TOKEN
   * @milestone M6 (Rotation + Replay Attack Detection)
   *
   * The most complex auth operation:
   * 1. Verify refresh token JWT (signature + expiry)
   * 2. Look up session in DB
   * 3. Detect reuse (replay attack)
   * 4. Rotate: invalidate old, create new
   * 5. Issue new access + refresh tokens
   */
  async refresh(
    refreshToken: string,
    deviceInfo?: DeviceInfo,
    ipAddress?: string
  ): Promise<AuthTokens & { userId: string; role: string }> {
    // Lazy import to avoid circular deps
    const { verifyRefreshToken } = await import("../../utils/jwt.js");

    // 1. Verify JWT signature and expiry
    let payload: { sub: string; sessionId: string };
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new Error("INVALID_REFRESH_TOKEN");
    }

    // 2. Get user for role (needed for new access token)
    const user = await authRepository.findById(payload.sub);
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    // 3. Rotate refresh token (handles reuse detection internally)
    const newSession = await rotateRefreshToken(
      payload.sessionId,
      refreshToken,
      payload.sub,
      deviceInfo,
      ipAddress
    );

    if (!newSession) {
      // This means either:
      // a) Token was already rotated (normal — previous rotation deleted session)
      // b) Token reuse detected (attack) — all sessions revoked
      await auditService.logAndCheckAnomaly({
        event: "TOKEN_REUSE_DETECTED",
        userId: payload.sub,
        ipAddress,
        userAgent: deviceInfo?.raw,
      });
      throw new Error("REFRESH_TOKEN_REUSE");
    }

    // 4. Sign new access token
    const newAccessToken = signAccessToken({ sub: user.id, role: user.role });

    // 5. Audit
    auditService.log({
      event: "TOKEN_REFRESH",
      userId: user.id,
      ipAddress,
      userAgent: deviceInfo?.raw,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newSession.refreshToken,
      sessionId: newSession.sessionId,
      userId: user.id,
      role: user.role,
    };
  },

  /**
   * LOGOUT
   *
   * Revokes the specific session associated with the refresh token.
   * Access token becomes "orphaned" but expires in 5 minutes anyway.
   *
   * "Logout everywhere" uses revokeAllUserSessions().
   */
  async logout(sessionId: string, userId: string): Promise<void> {
    await revokeSession(sessionId);

    auditService.log({
      event: "LOGOUT",
      userId,
    });

    authLogger.info({ userId, sessionId }, "User logged out");
  },

  /**
   * LOGOUT EVERYWHERE
   * Revokes all sessions for a user — used for security incidents or "logout all devices".
   */
  async logoutEverywhere(userId: string): Promise<number> {
    const count = await revokeAllUserSessions(userId);
    authLogger.info({ userId, revokedCount: count }, "User logged out from all devices");
    return count;
  },
};
