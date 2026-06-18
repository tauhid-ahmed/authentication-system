/**
 * @file Users Controller
 * @milestone M7, M10
 */
import type { Request, Response } from "express";
import { usersService } from "./users.service.js";
import { UpdateProfileSchema, UpdateRoleSchema, ChangePasswordSchema } from "@auth/shared";
import type { Role } from "@auth/shared";
import { sendSuccess, sendError } from "../../utils/response.js";
import { extractIpAddress } from "../../utils/device.js";

export async function getMe(req: Request, res: Response): Promise<void> {
  if (!req.user) { sendError(res, "Authentication required.", 401); return; }
  try {
    const user = await usersService.getProfile(req.user.id);
    sendSuccess(res, { user });
  } catch {
    sendError(res, "User not found.", 404, "USER_NOT_FOUND");
  }
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  if (!req.user) { sendError(res, "Authentication required.", 401); return; }

  const parsed = UpdateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ success: false, error: { message: "Validation failed" }, errors: parsed.error.errors });
    return;
  }

  const user = await usersService.updateProfile(req.user.id, parsed.data);
  sendSuccess(res, { user }, "Profile updated.");
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  if (!req.user) { sendError(res, "Authentication required.", 401); return; }

  const parsed = ChangePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ success: false, error: { message: "Validation failed" }, errors: parsed.error.errors });
    return;
  }

  try {
    await usersService.changePassword(req.user.id, parsed.data, extractIpAddress(req));
    sendSuccess(res, null, "Password changed. All sessions have been revoked. Please log in again.");
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CURRENT_PASSWORD") {
      sendError(res, "Current password is incorrect.", 401, "INVALID_CURRENT_PASSWORD");
      return;
    }
    throw error;
  }
}

export async function updateRole(req: Request, res: Response): Promise<void> {
  if (!req.user) { sendError(res, "Authentication required.", 401); return; }

  const parsed = UpdateRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ success: false, error: { message: "Validation failed" }, errors: parsed.error.errors });
    return;
  }

  try {
    const user = await usersService.updateRole(
      req.user.id,
      req.user.role as Role,
      parsed.data,
      extractIpAddress(req)
    );
    sendSuccess(res, { user }, "Role updated.");
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "INSUFFICIENT_ROLE") { sendError(res, "Only SUPER_ADMIN can change roles.", 403, "INSUFFICIENT_ROLE"); return; }
      if (error.message === "CANNOT_CHANGE_OWN_ROLE") { sendError(res, "You cannot change your own role.", 400, "CANNOT_CHANGE_OWN_ROLE"); return; }
      if (error.message === "USER_NOT_FOUND") { sendError(res, "User not found.", 404); return; }
    }
    throw error;
  }
}

export async function listUsers(req: Request, res: Response): Promise<void> {
  if (!req.user) { sendError(res, "Authentication required.", 401); return; }

  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const role = req.query.role as Role | undefined;

  try {
    const result = await usersService.listUsers(req.user.role as Role, { page, limit, role });
    sendSuccess(res, result);
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_ROLE") {
      sendError(res, "Admin access required.", 403); return;
    }
    throw error;
  }
}
