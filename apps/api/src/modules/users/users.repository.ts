/**
 * @file Users Repository
 * @milestone M7 (Express Architecture), M10 (RBAC), M11 (Sessions)
 */
import { db } from "../../config/db.js";
import type { Role } from "@auth/shared";

export const usersRepository = {
  async findAll(options: { page?: number; limit?: number; role?: Role }) {
    const { page = 1, limit = 20, role } = options;
    const [users, total] = await Promise.all([
      db.user.findMany({
        where: role ? { role } : undefined,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { sessions: { where: { isRevoked: false } } } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.user.count({ where: role ? { role } : undefined }),
    ]);
    return { users, total, page, limit, pages: Math.ceil(total / limit) };
  },

  async findById(id: string) {
    return db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  async updateProfile(id: string, data: { name?: string }) {
    return db.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  async updateRole(id: string, role: Role) {
    return db.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  async updatePassword(id: string, passwordHash: string) {
    return db.user.update({
      where: { id },
      data: { passwordHash },
      select: { id: true },
    });
  },

  async findByIdWithPassword(id: string) {
    return db.user.findUnique({
      where: { id },
      select: { id: true, passwordHash: true },
    });
  },

  async deleteUser(id: string) {
    return db.user.delete({ where: { id } });
  },
};
