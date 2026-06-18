/**
 * @file OAuth Routes
 * @milestone M9 (OAuth System)
 *
 * ============================================================
 * OAUTH DEEP DIVE: TWO IMPLEMENTATION STRATEGIES
 * ============================================================
 *
 * STRATEGY A: FRONTEND-FIRST (Firebase-style)
 * ─────────────────────────────────────────────
 * Frontend redirects to Google → Google returns token to frontend
 * → Frontend sends token to backend → Backend verifies with Google API
 *
 * FLOW:
 *   Browser → Google OAuth → id_token → POST /api/oauth/google/verify
 *
 * PROS: Simple frontend (uses Firebase SDK, Google Sign-In button)
 * CONS: Backend must trust frontend-provided token (verify with Google API)
 *       Token validation adds latency
 *       Harder to implement PKCE properly
 *
 * ─────────────────────────────────────────────
 *
 * STRATEGY B: BACKEND-FIRST (Auth Code + PKCE)
 * ─────────────────────────────────────────────
 * Backend generates authorization URL → Browser redirects to Google
 * → Google redirects to backend callback with `code`
 * → Backend exchanges code for tokens → Backend issues its own JWT cookies
 *
 * FLOW:
 *   GET /api/oauth/google/authorize → 302 to Google
 *   Google → GET /api/oauth/google/callback?code=...
 *   → Backend exchanges code → creates user → sets cookies → redirect to /dashboard
 *
 * PROS: Backend in full control, no token trust issues, PKCE adds security
 * CONS: More complex, requires session state for PKCE verifier
 *
 * ─────────────────────────────────────────────
 *
 * WE IMPLEMENT: STRATEGY B (Production recommended)
 * with PKCE (Proof Key for Code Exchange) to prevent code interception attacks.
 *
 * UNIFIED PIPELINE:
 * Both strategies ultimately call the same internal function:
 *   oauthService.findOrCreateUser(profile) → same as credential signup/login
 *
 * ============================================================
 */
import { Router } from "express";
import type { Request, Response } from "express";
import crypto from "crypto";
import { db } from "../../config/db.js";
import { authRepository } from "../auth/auth.repository.js";
import { signAccessToken } from "../../utils/jwt.js";
import { createSession } from "../../utils/tokens.js";
import {
  COOKIE_NAMES,
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
} from "../../utils/jwt.js";
import { auditService } from "../audit/audit.service.js";
import { oauthLogger } from "../../config/logger.js";
import { parseUserAgent, extractIpAddress } from "../../utils/device.js";
import { env } from "../../config/env.js";
import { sendError } from "../../utils/response.js";
import type { OAuthProfile } from "@auth/shared";

const isProduction = env.NODE_ENV === "production";

// ============================================================
// PKCE STORE (in-memory for dev; use Redis in production)
// ============================================================
// PKCE prevents authorization code interception:
// 1. We generate a random verifier
// 2. We send the hash (challenge) to Google with the auth request
// 3. On callback, we send the original verifier
// 4. Google verifies hash(verifier) === challenge → ensures same client
const pkceStore = new Map<string, { verifier: string; createdAt: number }>();

// Cleanup expired PKCE states every 5 minutes
setInterval(() => {
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  for (const [state, data] of pkceStore.entries()) {
    if (data.createdAt < tenMinutesAgo) pkceStore.delete(state);
  }
}, 5 * 60 * 1000);

function generatePKCE(): { verifier: string; challenge: string; state: string } {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const state = crypto.randomBytes(16).toString("hex");
  return { verifier, challenge, state };
}

// ============================================================
// OAUTH SERVICE — Unified pipeline
// ============================================================
async function findOrCreateOAuthUser(profile: OAuthProfile) {
  // Check if OAuth account exists
  const existingOAuth = await db.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: profile.provider,
        providerAccountId: profile.id,
      },
    },
    include: { user: true },
  });

  if (existingOAuth) {
    return existingOAuth.user;
  }

  // Check if user exists with this email (link accounts)
  const existingUser = await authRepository.findByEmail(profile.email);

  if (existingUser) {
    // Link OAuth account to existing user
    await db.oAuthAccount.create({
      data: {
        userId: existingUser.id,
        provider: profile.provider,
        providerAccountId: profile.id,
      },
    });
    return existingUser;
  }

  // Create new user + OAuth account
  const newUser = await db.user.create({
    data: {
      email: profile.email,
      name: profile.name ?? null,
      emailVerified: true, // OAuth emails are verified by the provider
      oauthAccounts: {
        create: {
          provider: profile.provider,
          providerAccountId: profile.id,
        },
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return newUser;
}

// ============================================================
// CONTROLLER HANDLERS
// ============================================================

/**
 * GET /api/oauth/google/authorize
 * Step 1: Generate PKCE, redirect to Google
 */
async function googleAuthorize(_req: Request, res: Response): Promise<void> {
  if (!env.GOOGLE_CLIENT_ID) {
    sendError(res, "Google OAuth not configured.", 501, "OAUTH_NOT_CONFIGURED");
    return;
  }

  const { verifier, challenge, state } = generatePKCE();
  pkceStore.set(state, { verifier, createdAt: Date.now() });

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_CALLBACK_URL,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

/**
 * GET /api/oauth/google/callback
 * Step 2: Exchange code for tokens, create user, set cookies
 */
async function googleCallback(req: Request, res: Response): Promise<void> {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    oauthLogger.warn({ error }, "Google OAuth error");
    res.redirect(`${env.WEB_URL}/login?error=oauth_denied`);
    return;
  }

  if (!code || !state) {
    res.redirect(`${env.WEB_URL}/login?error=oauth_invalid`);
    return;
  }

  const pkceData = pkceStore.get(state);
  if (!pkceData) {
    res.redirect(`${env.WEB_URL}/login?error=oauth_state_invalid`);
    return;
  }

  // Delete used PKCE state (one-time use)
  pkceStore.delete(state);

  try {
    // Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID!,
        client_secret: env.GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: env.GOOGLE_CALLBACK_URL,
        code_verifier: pkceData.verifier,
      }),
    });

    if (!tokenRes.ok) {
      throw new Error("Failed to exchange code for tokens");
    }

    const tokenData = (await tokenRes.json()) as { id_token: string; access_token: string };

    // Get user info from Google
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userInfoRes.ok) {
      throw new Error("Failed to fetch user info from Google");
    }

    const googleUser = (await userInfoRes.json()) as {
      id: string;
      email: string;
      name?: string;
      picture?: string;
    };

    const profile: OAuthProfile = {
      id: googleUser.id,
      email: googleUser.email,
      name: googleUser.name,
      picture: googleUser.picture,
      provider: "google",
    };

    // Find or create user in our system
    const user = await findOrCreateOAuthUser(profile);

    // Create session + tokens
    const deviceInfo = parseUserAgent(req.headers["user-agent"]);
    const ipAddress = extractIpAddress(req);
    const session = await createSession(user.id, deviceInfo, ipAddress);
    const accessToken = signAccessToken({ sub: user.id, role: user.role });

    // Set auth cookies
    res.cookie(
      COOKIE_NAMES.ACCESS_TOKEN,
      accessToken,
      getAccessTokenCookieOptions(isProduction)
    );
    res.cookie(
      COOKIE_NAMES.REFRESH_TOKEN,
      session.refreshToken,
      getRefreshTokenCookieOptions(isProduction)
    );

    auditService.log({
      event: "OAUTH_LOGIN",
      userId: user.id,
      ipAddress,
      userAgent: deviceInfo.raw,
      metadata: { provider: "google", email: user.email },
    });

    oauthLogger.info({ userId: user.id, provider: "google" }, "OAuth login successful");

    // Redirect to dashboard
    res.redirect(`${env.WEB_URL}/dashboard`);
  } catch (err) {
    oauthLogger.error({ err }, "OAuth callback error");
    res.redirect(`${env.WEB_URL}/login?error=oauth_failed`);
  }
}

// ============================================================
// ROUTES
// ============================================================
const router: Router = Router();

router.get("/google/authorize", googleAuthorize);
router.get("/google/callback", googleCallback);

export default router;
