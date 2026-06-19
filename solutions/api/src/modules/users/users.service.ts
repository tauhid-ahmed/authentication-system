/**
 * @file Users Service
 * @milestone M7, M10 (RBAC)
 */
import { usersRepository } from "./users.repository.js";
import { hashPassword, verifyPassword } from "../../utils/hash.js";
import { revokeAllUserSessions } from "../../utils/tokens.js";
import { auditService } from "../audit/audit.service.js";
import type { Role, UpdateProfileInput, UpdateRoleInput, ChangePasswordInput } from "@auth/shared";
import { hasMinimumRole } from "@auth/shared";

export const usersService = {
  async getProfile(userId: string) {
    const user = await usersRepository.findById(userId);
    if (!user) throw new Error("USER_NOT_FOUND");
    return user;
  },

  async updateProfile(userId: string, data: UpdateProfileInput) {
    return usersRepository.updateProfile(userId, data);
  },

  async changePassword(
    userId: string,
    data: ChangePasswordInput,
    ipAddress?: string
  ) {
    const user = await usersRepository.findByIdWithPassword(userId);
    if (!user || !user.passwordHash) throw new Error("USER_NOT_FOUND");

    const valid = await verifyPassword(data.currentPassword, user.passwordHash);
    if (!valid) throw new Error("INVALID_CURRENT_PASSWORD");

    const newHash = await hashPassword(data.newPassword);
    await usersRepository.updatePassword(userId, newHash);

    // Security best practice: invalidate all sessions after password change
    // WHY? If attacker had a session, changing password should kick them out.
    await revokeAllUserSessions(userId);

    auditService.log({
      event: "PASSWORD_CHANGED",
      userId,
      ipAddress,
      metadata: { allSessionsRevoked: true },
    });
  },

  /**
   * Update user role — SUPER_ADMIN only
   * @milestone M10 (RBAC)
   *
   * Only SUPER_ADMIN can promote other users.
   * An ADMIN cannot promote someone to SUPER_ADMIN or even to ADMIN.
   *
   * Prevents privilege escalation attacks:
   * Attacker compromises ADMIN account → tries to give themselves SUPER_ADMIN → BLOCKED.
   */
  async updateRole(
    actorId: string,
    actorRole: Role,
    data: UpdateRoleInput,
    ipAddress?: string
  ) {
    // Guard: only SUPER_ADMIN can change roles
    if (!hasMinimumRole(actorRole, "SUPER_ADMIN")) {
      throw new Error("INSUFFICIENT_ROLE");
    }

    // Guard: cannot change your own role (prevents lockout accidents)
    if (actorId === data.userId) {
      throw new Error("CANNOT_CHANGE_OWN_ROLE");
    }

    const targetUser = await usersRepository.findById(data.userId);
    if (!targetUser) throw new Error("USER_NOT_FOUND");

    const updatedUser = await usersRepository.updateRole(data.userId, data.role as Role);

    auditService.log({
      event: "ROLE_CHANGED",
      userId: actorId,
      ipAddress,
      metadata: {
        targetUserId: data.userId,
        targetEmail: targetUser.email,
        previousRole: targetUser.role,
        newRole: data.role,
      },
    });

    return updatedUser;
  },

  async listUsers(
    actorRole: Role,
    options: { page?: number; limit?: number; role?: Role }
  ) {
    // Only admins can list users
    if (!hasMinimumRole(actorRole, "ADMIN")) {
      throw new Error("INSUFFICIENT_ROLE");
    }
    return usersRepository.findAll(options);
  },
};
