/**
 * @file Audit Repository
 * @milestone M14 (Observability)
 *
 * The Repository pattern: Database operations only. No business logic.
 *
 * WHY REPOSITORIES?
 * -----------------
 * If you put DB queries directly in controllers:
 *   - Testing requires a real DB (slow, brittle)
 *   - Switching from Prisma to another ORM = rewrite everything
 *   - Business logic and DB logic are tangled together
 *
 * Repository = a "translator" between your domain and your DB.
 * Service uses repositories. Controllers use services.
 * This creates clean, testable layers.
 *
 * ANALOGY: A library (DB) has a librarian (Repository).
 * You (Service) ask the librarian for a book.
 * The librarian knows the filing system. You don't need to.
 */
import { db } from "../../config/db.js";
import type { AuditEvent, AuditLogEntry } from "@auth/shared";

export const auditRepository = {
  /**
   * Create an audit log entry.
   * Called after every significant auth event.
   */
  async create(entry: AuditLogEntry): Promise<void> {
    await db.auditLog.create({
      data: {
        event: entry.event as AuditEvent,
        userId: entry.userId ?? null,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : undefined,
      },
    });
  },

  /**
   * Get recent audit logs for a user.
   * Used in M14 dashboard for security activity timeline.
   */
  async findByUser(
    userId: string,
    limit: number = 50
  ) {
    return db.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        event: true,
        ipAddress: true,
        userAgent: true,
        metadata: true,
        createdAt: true,
      },
    });
  },

  /**
   * Get all audit logs (admin only).
   */
  async findAll(options: {
    page?: number;
    limit?: number;
    event?: AuditEvent;
    userId?: string;
  }) {
    const { page = 1, limit = 50, event, userId } = options;

    return db.auditLog.findMany({
      where: {
        ...(event && { event }),
        ...(userId && { userId }),
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });
  },

  /**
   * Count failed login attempts for an IP in a time window.
   * Used for anomaly detection in M14.
   */
  async countFailedLogins(ipAddress: string, windowMs: number): Promise<number> {
    const since = new Date(Date.now() - windowMs);
    return db.auditLog.count({
      where: {
        event: "LOGIN_FAILED",
        ipAddress,
        createdAt: { gte: since },
      },
    });
  },

  /**
   * Detect token reuse events in the last N minutes.
   * A spike = ongoing attack.
   */
  async countTokenReuseEvents(userId: string, windowMs: number): Promise<number> {
    const since = new Date(Date.now() - windowMs);
    return db.auditLog.count({
      where: {
        event: "TOKEN_REUSE_DETECTED",
        userId,
        createdAt: { gte: since },
      },
    });
  },
};
