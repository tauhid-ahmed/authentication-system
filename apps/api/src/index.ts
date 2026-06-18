/**
 * @file API Entry Point
 * @milestone M1
 *
 * Minimal entry point — just starts the server.
 * All app config is in app.ts (separation of concerns).
 * This makes it easy to test the app without starting the server.
 */
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { db } from "./config/db.js";

async function main() {
  // Verify DB connection before starting server
  try {
    await db.$connect();
    logger.info("✅ Database connected");
  } catch (error) {
    logger.error({ error }, "❌ Database connection failed");
    process.exit(1);
  }

  const app = createApp();

  const server = app.listen(env.API_PORT, () => {
    logger.info(
      { port: env.API_PORT, env: env.NODE_ENV },
      `🚀 Auth API running at http://localhost:${env.API_PORT}`
    );
    logger.info(`📚 Docs: http://localhost:${env.API_PORT}/`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down...");
    server.close(async () => {
      await db.$disconnect();
      logger.info("Server shut down cleanly");
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  logger.error({ error }, "Fatal error during startup");
  process.exit(1);
});
