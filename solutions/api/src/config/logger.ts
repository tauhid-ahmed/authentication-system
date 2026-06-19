/**
 * @file Logger Configuration
 * @milestone M1 (basic) → M14 (structured audit logging)
 *
 * WHY PINO OVER console.log?
 * --------------------------
 * console.log: Unstructured, slow (synchronous), no log levels, no context.
 * pino:        JSON output, async I/O, log levels, structured context, 
 *              integrates with log aggregation (Datadog, CloudWatch, Loki).
 *
 * PRODUCTION PATTERN:
 * Every log line is a JSON object. Log aggregation tools parse JSON —
 * searching "all errors in the last hour" becomes a single query.
 *
 * BAD:  console.log("Login failed for user@example.com from 1.2.3.4")
 * GOOD: logger.warn({ event: "LOGIN_FAILED", email, ip }, "Login failed")
 *       → Searchable, structured, queryable
 */
import pino from "pino";
import { env } from "./env.js";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",

  // In development: pretty-print for human readability
  // In production: raw JSON for log aggregation tools
  transport:
    env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss",
            ignore: "pid,hostname",
          },
        }
      : undefined,

  // Base fields added to every log line
  base: {
    service: "auth-api",
    env: env.NODE_ENV,
  },

  // Redact sensitive fields from logs
  // WHY: If a password or token accidentally ends up in a log call, redact it.
  redact: {
    paths: ["password", "passwordHash", "refreshToken", "accessToken", "token"],
    censor: "[REDACTED]",
  },
});

// Create child loggers for specific modules
// WHY child loggers? They inherit config but add module context to every log.
export const authLogger = logger.child({ module: "auth" });
export const sessionLogger = logger.child({ module: "session" });
export const oauthLogger = logger.child({ module: "oauth" });
export const auditLogger = logger.child({ module: "audit" });
