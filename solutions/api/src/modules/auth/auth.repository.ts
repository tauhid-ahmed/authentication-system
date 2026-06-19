/**
 * @file Auth Repository
 * @milestone M1, M5, M6
 *
 * Database operations for authentication.
 * Pure Prisma queries — no business logic here.
 */
import { db } from "../../config/db.js";

export const authRepository = {
  /**
   * Create a new user.
   */
  async createUser(data: {
    email: string;
    passwordHash?: string;
    name?: string;
  }) {
    return db.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash ?? null,
        name: data.name ?? null,
      },
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

  /**
   * Find user by email (includes passwordHash for login verification).
   * WHY separate from findById?
   * passwordHash should NEVER be returned in normal user queries.
   * We only need it during login. Isolating it reduces accidental exposure.
   */
  async findByEmailWithPassword(email: string) {
    return db.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        passwordHash: true, // Only included here
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  /**
   * Find user by email (no password hash).
   */
  async findByEmail(email: string) {
    return db.user.findUnique({
      where: { email },
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

  /**
   * Find user by ID.
   */
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

  /**
   * Check if email already exists.
   * Cheaper than findByEmail — only checks existence, no data fetch.
   */
  async emailExists(email: string): Promise<boolean> {
    const count = await db.user.count({ where: { email } });
    return count > 0;
  },
};
