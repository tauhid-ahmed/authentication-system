/**
 * @file Sessions Repository
 * @milestone M11 (Session Management)
 */
import { db } from "../../config/db.js";

export const sessionsRepository = {
  /**
   * Get all active sessions for a user.
   * Used in the "Active Devices" UI.
   */
  async findActiveByUser(userId: string) {
    return db.session.findMany({
      where: { userId, isRevoked: false, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        deviceInfo: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        isRevoked: true,
      },
      orderBy: { lastUsedAt: "desc" },
    });
  },

  async findById(id: string) {
    return db.session.findUnique({
      where: { id },
      select: { id: true, userId: true, isRevoked: true, expiresAt: true },
    });
  },

  async revokeById(id: string) {
    return db.session.update({
      where: { id },
      data: { isRevoked: true },
    });
  },

  async revokeAllExcept(userId: string, currentSessionId: string) {
    return db.session.updateMany({
      where: {
        userId,
        isRevoked: false,
        id: { not: currentSessionId },
      },
      data: { isRevoked: true },
    });
  },

  async countActive(userId: string): Promise<number> {
    return db.session.count({
      where: { userId, isRevoked: false, expiresAt: { gt: new Date() } },
    });
  },
};
