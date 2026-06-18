/**
 * @file Sessions Service + Controller + Routes
 * @milestone M11 (Session Management)
 *
 * Combined for brevity — in a larger app these would be separate files.
 */
import { Router } from "express";
import type { Request, Response } from "express";
import { sessionsRepository } from "./sessions.repository.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { auditService } from "../audit/audit.service.js";
import { sendSuccess, sendError } from "../../utils/response.js";
import { verifyRefreshToken } from "../../utils/jwt.js";
import { getRefreshTokenFromRequest } from "../../utils/authTransport.js";

// ============================================================
// SERVICE
// ============================================================
export const sessionsService = {
  /**
   * Get all active sessions, flagging the current one.
   * This powers the "Active devices" security page.
   */
  async listSessions(userId: string, currentRefreshToken?: string) {
    const sessions = await sessionsRepository.findActiveByUser(userId);

    // Identify which session is "current" (the one making this request)
    let currentSessionId: string | undefined;
    if (currentRefreshToken) {
      try {
        const payload = verifyRefreshToken(currentRefreshToken);
        currentSessionId = payload.sessionId;
      } catch {
        // Ignore
      }
    }

    return sessions.map((s) => ({
      ...s,
      isCurrent: s.id === currentSessionId,
    }));
  },

  async revokeSession(userId: string, sessionId: string) {
    const session = await sessionsRepository.findById(sessionId);

    if (!session) throw new Error("SESSION_NOT_FOUND");
    if (session.userId !== userId) throw new Error("FORBIDDEN"); // Can't revoke other's sessions
    if (session.isRevoked) throw new Error("ALREADY_REVOKED");

    await sessionsRepository.revokeById(sessionId);

    auditService.log({
      event: "SESSION_REVOKED",
      userId,
      metadata: { sessionId },
    });
  },

  async revokeOtherSessions(userId: string, currentRefreshToken?: string) {
    let currentSessionId = "none"; // revoke all if no current
    if (currentRefreshToken) {
      try {
        const payload = verifyRefreshToken(currentRefreshToken);
        currentSessionId = payload.sessionId;
      } catch {
        // Ignore
      }
    }
    const result = await sessionsRepository.revokeAllExcept(userId, currentSessionId);
    return result.count;
  },
};

// ============================================================
// CONTROLLER
// ============================================================
async function listSessions(req: Request, res: Response): Promise<void> {
  if (!req.user) { sendError(res, "Authentication required.", 401); return; }
  const refreshToken = getRefreshTokenFromRequest(req);
  const sessions = await sessionsService.listSessions(req.user.id, refreshToken);
  sendSuccess(res, { sessions, count: sessions.length });
}

async function revokeSession(req: Request, res: Response): Promise<void> {
  if (!req.user) { sendError(res, "Authentication required.", 401); return; }
  const { sessionId } = req.params;
  try {
    await sessionsService.revokeSession(req.user.id, sessionId);
    sendSuccess(res, null, "Session revoked.");
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "SESSION_NOT_FOUND") { sendError(res, "Session not found.", 404); return; }
      if (error.message === "FORBIDDEN") { sendError(res, "You can only revoke your own sessions.", 403); return; }
      if (error.message === "ALREADY_REVOKED") { sendError(res, "Session already revoked.", 400); return; }
    }
    throw error;
  }
}

async function revokeOtherSessions(req: Request, res: Response): Promise<void> {
  if (!req.user) { sendError(res, "Authentication required.", 401); return; }
  const refreshToken = getRefreshTokenFromRequest(req);
  const count = await sessionsService.revokeOtherSessions(req.user.id, refreshToken);
  sendSuccess(res, { revokedCount: count }, `${count} other session(s) revoked.`);
}

// ============================================================
// ROUTES
// ============================================================
const router: Router = Router();
router.use(authenticate);

router.get("/", listSessions);
router.delete("/others", revokeOtherSessions);
router.delete("/:sessionId", revokeSession);

export default router;
