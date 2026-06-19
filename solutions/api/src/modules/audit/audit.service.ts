/**
 * @file Audit Service
 * @milestone M14 (Observability)
 *
 * The Service layer: Business logic only. Calls repositories. No HTTP concerns.
 *
 * WHY A SEPARATE SERVICE FOR AUDIT?
 * ----------------------------------
 * The audit service is called from MANY places:
 *   - Auth service (login, signup, refresh)
 *   - OAuth service
 *   - Users service (role change)
 *   - Sessions service (revoke)
 *
 * If we put audit calls directly in each service, it's scattered and inconsistent.
 * A dedicated audit service = one place to maintain logging logic.
 *
 * PATTERN: Fire-and-forget logging
 * Audit logs should NEVER block the main request flow.
 * If audit logging fails, the user's action should still succeed.
 * We use non-awaited promises for logging (with error swallowing).
 */
import { auditRepository } from "./audit.repository.js";
import { auditLogger } from "../../config/logger.js";
import type { AuditLogEntry } from "@auth/shared";

export const auditService = {
  /**
   * Log an auth event — fire and forget.
   *
   * WHY NOT AWAIT?
   * The request shouldn't wait for audit logging to complete.
   * If the audit DB write takes 50ms extra, every auth request is 50ms slower.
   * Log asynchronously — if it fails, log the error but don't break the user flow.
   */
  log(entry: AuditLogEntry): void {
    auditRepository
      .create(entry)
      .then(() => {
        auditLogger.info({ event: entry.event, userId: entry.userId }, "Audit logged");
      })
      .catch((err: unknown) => {
        // Log the failure but NEVER throw — audit failure != request failure
        auditLogger.error({ err, entry }, "Failed to write audit log");
      });
  },

  /**
   * Log and check for anomalies simultaneously.
   *
   * ANOMALY DETECTION (basic heuristics):
   * - >5 failed logins from same IP in 10 minutes → alert
   * - Token reuse detected → already handled by rotation system
   *
   * Production upgrade: Send alert to Slack/PagerDuty/email.
   */
  async logAndCheckAnomaly(entry: AuditLogEntry): Promise<{ isAnomaly: boolean; reason?: string }> {
    // Log the event (non-blocking in prod, but we need to await for anomaly check)
    try {
      await auditRepository.create(entry);
    } catch (err) {
      auditLogger.error({ err }, "Failed to write audit log");
    }

    // Check for anomalies
    if (entry.event === "LOGIN_FAILED" && entry.ipAddress) {
      const failedCount = await auditRepository.countFailedLogins(
        entry.ipAddress,
        10 * 60 * 1000 // 10 minute window
      );

      if (failedCount >= 5) {
        auditLogger.warn(
          { ip: entry.ipAddress, failedCount },
          "🚨 ANOMALY: Brute force attack detected"
        );
        return {
          isAnomaly: true,
          reason: `${failedCount} failed login attempts from IP ${entry.ipAddress}`,
        };
      }
    }

    if (entry.event === "TOKEN_REUSE_DETECTED") {
      auditLogger.error(
        { userId: entry.userId, ip: entry.ipAddress },
        "🚨 CRITICAL SECURITY: Token reuse detected — all sessions revoked"
      );
      return {
        isAnomaly: true,
        reason: "Refresh token reuse detected — possible account compromise",
      };
    }

    return { isAnomaly: false };
  },

  async getUserActivity(userId: string, limit?: number) {
    return auditRepository.findByUser(userId, limit);
  },

  async getAllLogs(options: Parameters<typeof auditRepository.findAll>[0]) {
    return auditRepository.findAll(options);
  },
};
