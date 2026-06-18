/**
 * @file Prisma Client Singleton
 * @milestone M1
 *
 * WHY A SINGLETON?
 * ----------------
 * Prisma Client creates a connection pool to your database.
 * If you create a new PrismaClient() in every file, you'll exhaust your
 * database connections rapidly.
 *
 * The singleton pattern ensures ONE client is shared across the entire app.
 *
 * PRODUCTION CONCERN: Neon's serverless tier has connection limits.
 * The singleton + connection pooling (via Neon's pool mode) handles this.
 *
 * DEVELOPMENT NOTE: In dev with hot reloading (tsx watch), the module can
 * be re-evaluated. We use globalThis to prevent creating multiple clients.
 */
import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

// Extend globalThis to hold our Prisma instance between hot reloads
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
    errorFormat: "pretty",
  });
}

// In dev: reuse the global instance to prevent connection pool exhaustion
// In prod: always create fresh (no globalThis tricks needed — no hot reload)
export const db: PrismaClient =
  env.NODE_ENV === "development"
    ? (globalThis.__prisma ??= createPrismaClient())
    : createPrismaClient();

if (env.NODE_ENV === "development") {
  globalThis.__prisma = db;
}

// Graceful shutdown — close DB connections when server stops
process.on("beforeExit", async () => {
  await db.$disconnect();
});
