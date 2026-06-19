/**
 * @file Environment Configuration
 * @milestone M1 (first thing built — no code works without this)
 *
 * WHY VALIDATE ENV VARS?
 * ----------------------
 * Without validation: App starts, first request fails with cryptic error.
 * With validation: App fails IMMEDIATELY at startup with a clear message.
 *
 * This follows the "Fail Fast" principle — catch errors as early as possible.
 *
 * PRODUCTION PATTERN: Every production Node.js service validates its config at startup.
 * Missing DATABASE_URL? Don't start. Missing JWT_SECRET? Don't start.
 */
import { z } from "zod";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // JWT Secrets
  // WHY 10+ chars minimum? Weak secrets = crackable tokens.
  // In production, these should be 64+ random bytes.
  ACCESS_TOKEN_SECRET: z
    .string()
    .min(32, "ACCESS_TOKEN_SECRET must be at least 32 characters"),
  REFRESH_TOKEN_SECRET: z
    .string()
    .min(32, "REFRESH_TOKEN_SECRET must be at least 32 characters"),

  // Token Expiry
  ACCESS_TOKEN_EXPIRY: z.string().default("5m"),
  REFRESH_TOKEN_EXPIRY: z.string().default("30d"),

  // Server
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  API_PORT: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(65535))
    .default("5000"),
  API_URL: z.string().url().default("http://localhost:5000"),
  WEB_URL: z.string().url().default("http://localhost:3000"),

  // CORS
  ALLOWED_ORIGINS: z
    .string()
    .transform((val) => val.split(",").map((s) => s.trim())),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z
    .string()
    .url()
    .default("http://localhost:5000/api/oauth/google/callback"),

  // Cookie
  COOKIE_SECRET: z
    .string()
    .min(32, "COOKIE_SECRET must be at least 32 characters"),
  COOKIE_DOMAIN: z.string().default("localhost"),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .transform(Number)
    .pipe(z.number())
    .default("900000"), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z
    .string()
    .transform(Number)
    .pipe(z.number())
    .default("100"),
  LOGIN_RATE_LIMIT_MAX: z
    .string()
    .transform(Number)
    .pipe(z.number())
    .default("5"),
  REFRESH_RATE_LIMIT_MAX: z
    .string()
    .transform(Number)
    .pipe(z.number())
    .default("20"),
});

// Parse and validate
const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parseResult.error.flatten().fieldErrors);
  console.error("\n📋 Check .env.example for the required variables");
  process.exit(1); // Fail fast — don't start with bad config
}

export const env = parseResult.data;

// Type the config for consumers
export type Env = typeof env;
