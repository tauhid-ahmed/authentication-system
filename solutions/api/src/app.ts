/**
 * @file Express Application Setup
 * @milestone M1+
 *
 * ============================================================
 * ARCHITECTURE OVERVIEW
 * ============================================================
 *
 * Middleware execution order in Express is CRITICAL.
 * Order errors cause subtle, hard-to-debug issues.
 *
 * CORRECT ORDER:
 *
 *  1. Trust proxy (MUST be first for correct IP detection)
 *  2. Security headers (helmet)
 *  3. CORS (MUST be before any routes — handles OPTIONS preflight)
 *  4. Cookie parser (MUST be before any cookie-reading middleware)
 *  5. JSON body parser
 *  6. General rate limiter
 *  7. Routes
 *  8. 404 handler
 *  9. Global error handler (MUST be last — 4-param signature)
 *
 * ============================================================
 */
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { configureCors } from "./config/cors.js";
import { generalLimiter } from "./middlewares/rateLimiter.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";

// Import route modules
import authRoutes from "./modules/auth/auth.routes.js";
import usersRoutes from "./modules/users/users.routes.js";
import sessionsRoutes from "./modules/sessions/sessions.routes.js";
import oauthRoutes from "./modules/oauth/oauth.routes.js";
import auditRoutes from "./modules/audit/audit.routes.js";

export function createApp(): express.Application {
  const app = express();

  // ============================================================
  // 1. TRUST PROXY
  // ============================================================
  // WHY: When behind Nginx/Vercel/AWS ALB, req.ip is the proxy's IP.
  // trust proxy = 1 → trust the first proxy in the chain.
  // This makes req.ip return the real client IP from X-Forwarded-For.
  if (env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  // ============================================================
  // 2. SECURITY HEADERS (Helmet)
  // ============================================================
  // Helmet sets security-related HTTP headers automatically.
  // Key headers:
  //   X-Content-Type-Options: nosniff → prevent MIME sniffing
  //   X-Frame-Options: DENY → prevent clickjacking
  //   Strict-Transport-Security → force HTTPS
  //   X-XSS-Protection → legacy XSS filter
  app.use(
    helmet({
      // Disable CSP here — Next.js frontend handles its own CSP
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // ============================================================
  // 3. CORS
  // ============================================================
  // MUST be before routes — preflight OPTIONS requests need CORS headers.
  app.use(configureCors);

  // ============================================================
  // 4. COOKIE PARSER
  // ============================================================
  // Parses Cookie header into req.cookies object.
  // MUST be before any middleware that reads cookies (authenticate).
  app.use(cookieParser(env.COOKIE_SECRET));

  // ============================================================
  // 5. BODY PARSERS
  // ============================================================
  app.use(express.json({ limit: "10kb" })); // Limit body size → prevent DoS
  app.use(express.urlencoded({ extended: true, limit: "10kb" }));

  // ============================================================
  // 6. GENERAL RATE LIMITER
  // ============================================================
  app.use("/api", generalLimiter);

  // ============================================================
  // 7. HEALTH CHECK (before any auth middleware)
  // ============================================================
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      env: env.NODE_ENV,
    });
  });

  // ============================================================
  // 8. ROUTES
  // ============================================================
  app.use("/api/auth", authRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/sessions", sessionsRoutes);
  app.use("/api/oauth", oauthRoutes);
  app.use("/api/audit", auditRoutes);

  // API documentation redirect in development
  if (env.NODE_ENV === "development") {
    app.get("/", (_req, res) => {
      res.json({
        name: "Auth Learning System API",
        version: "1.0.0",
        docs: "See /docs folder for API documentation",
        routes: {
          auth: "/api/auth (signup, login, refresh, logout, me)",
          users: "/api/users (profile, password, list, roles)",
          sessions: "/api/sessions (list, revoke)",
          oauth: "/api/oauth (google/authorize, google/callback)",
          audit: "/api/audit (me, all logs)",
        },
        health: "/health",
      });
    });
  }

  // ============================================================
  // 9. ERROR HANDLERS (MUST BE LAST)
  // ============================================================
  app.use(notFoundHandler);
  app.use(errorHandler);

  logger.info(
    { routes: ["/api/auth", "/api/users", "/api/sessions", "/api/oauth", "/api/audit"] },
    "Express app configured"
  );

  return app;
}
