/**
 * @file Audit Routes
 * @milestone M14 (Observability)
 */
import { Router } from "express";
import type { Request, Response } from "express";
import { auditService } from "../audit/audit.service.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { sendSuccess } from "../../utils/response.js";

const router: Router = Router();
router.use(authenticate);

// Get own activity
router.get("/me", async (req: Request, res: Response): Promise<void> => {
  const logs = await auditService.getUserActivity(req.user!.id, 50);
  sendSuccess(res, { logs });
});

// Admin: get all logs
router.get(
  "/",
  authorize("ADMIN"),
  async (req: Request, res: Response): Promise<void> => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const event = req.query.event as string | undefined;
    const userId = req.query.userId as string | undefined;

    const logs = await auditService.getAllLogs({
      page,
      limit,
      event: event as Parameters<typeof auditService.getAllLogs>[0]["event"],
      userId,
    });
    sendSuccess(res, { logs, page, limit });
  }
);

export default router;
