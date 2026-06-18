/**
 * @file CORS Configuration
 * @milestone M1
 *
 * WHY CORS?
 * ---------
 * Browsers enforce the Same-Origin Policy: a webpage at localhost:3000
 * cannot fetch from localhost:5000 unless the server EXPLICITLY allows it.
 *
 * CORS (Cross-Origin Resource Sharing) is the mechanism to allow this.
 *
 * CRITICAL RULES:
 * 1. Never use `origin: '*'` with credentials (cookies).
 *    A wildcard origin CANNOT send cookies — browser blocks it.
 * 2. Always list exact origins, not wildcards, when using `credentials: true`.
 * 3. OPTIONS requests (preflight) must be handled before auth middleware.
 *
 * REAL-WORLD ANALOGY:
 * Think of CORS as a bouncer at a club. The club (API) has a guest list (allowedOrigins).
 * If you're not on the list, you don't get in — even if the door is open.
 */
import cors from "cors";
import { env } from "./env.js";

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, mobile apps, same-origin)
    if (!origin) {
      callback(null, true);
      return;
    }

    if (env.ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin '${origin}' not allowed`));
    }
  },

  // WHY credentials: true?
  // Our auth uses HTTP-only cookies. Cookies are credentials.
  // Without this, the browser will NOT send cookies cross-origin.
  credentials: true,

  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-CSRF-Token", // For CSRF protection (M13)
    "X-Requested-With",
  ],

  // How long the browser caches preflight results (seconds)
  // 86400 = 24 hours → fewer preflight requests in production
  maxAge: 86400,
};

export const configureCors = cors(corsOptions);
