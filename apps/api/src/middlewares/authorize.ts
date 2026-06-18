/**
 * @file Authorization Middleware (RBAC)
 * @milestone M10 (Role-Based Access Control)
 *
 * ============================================================
 * RBAC — ROLE-BASED ACCESS CONTROL
 * ============================================================
 *
 * Authentication answers: WHO are you?
 * Authorization answers:  WHAT are you allowed to do?
 *
 * ROLE HIERARCHY:
 *
 *   SUPER_ADMIN
 *        │
 *        ▼ (can do everything ADMIN can + more)
 *      ADMIN
 *        │
 *        ▼ (can do everything USER can + more)
 *       USER
 *
 * IMPLEMENTATION PATTERN:
 *   authorize("ADMIN") → allows ADMIN and SUPER_ADMIN (hierarchy)
 *   authorize("SUPER_ADMIN") → allows SUPER_ADMIN only
 *
 * WHY BACKEND RBAC?
 * -----------------
 * The frontend should hide admin buttons for non-admins (UX).
 * But the backend MUST enforce RBAC regardless.
 * A user could:
 *   1. Open DevTools → manually call DELETE /api/users/123
 *   2. If backend doesn't check → ANYONE can delete users
 *
 * NEVER rely on frontend to enforce security.
 * Frontend RBAC = UX. Backend RBAC = Security.
 *
 * ============================================================
 */
import type { Request, Response, NextFunction } from "express";
import { hasMinimumRole } from "@auth/shared";
import type { Role } from "@auth/shared";
import { sendError } from "../utils/response.js";

/**
 * Middleware factory: authorize by minimum role.
 *
 * MUST be used AFTER authenticate() — requires req.user to be set.
 *
 * @example
 * router.delete("/users/:id", authenticate, authorize("ADMIN"), deleteUser)
 * router.patch("/roles", authenticate, authorize("SUPER_ADMIN"), updateRole)
 *
 * @param minimumRole - The minimum role required to access the route
 */
export function authorize(minimumRole: Role) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      // This is a developer error — authorize() used without authenticate()
      sendError(
        res,
        "Authentication required before authorization.",
        401,
        "UNAUTHENTICATED"
      );
      return;
    }

    const userRole = req.user.role as Role;

    if (!hasMinimumRole(userRole, minimumRole)) {
      // 403 Forbidden — we know WHO they are, they just don't have permission
      sendError(
        res,
        `Access denied. Requires ${minimumRole} role or higher.`,
        403,
        "INSUFFICIENT_ROLE"
      );
      return;
    }

    next();
  };
}

/**
 * Middleware: Self or Admin
 *
 * Allows access if:
 *   - The user is accessing their OWN resource (userId matches), OR
 *   - The user is an ADMIN or higher
 *
 * @example
 * router.get("/users/:id", authenticate, authorizeOwnerOrAdmin("id"), getUser)
 *
 * @param paramName - The route parameter containing the resource owner's ID
 */
export function authorizeOwnerOrAdmin(paramName: string = "id") {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, "Authentication required.", 401, "UNAUTHENTICATED");
      return;
    }

    const resourceOwnerId = req.params[paramName];
    const isOwner = req.user.id === resourceOwnerId;
    const isAdmin = hasMinimumRole(req.user.role as Role, "ADMIN");

    if (!isOwner && !isAdmin) {
      sendError(
        res,
        "You can only access your own resources.",
        403,
        "FORBIDDEN"
      );
      return;
    }

    next();
  };
}
