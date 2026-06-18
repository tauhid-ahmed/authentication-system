/**
 * @file User Schemas
 * @milestone M7+ (used in RBAC, session management)
 */
import { z } from "zod";

export const RoleSchema = z.enum(["USER", "ADMIN", "SUPER_ADMIN"]);
export type Role = z.infer<typeof RoleSchema>;

// Role hierarchy: higher number means more permissions.
export const ROLE_HIERARCHY: Record<Role, number> = {
  USER: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

/**
 * Check if a role has at least the required role level.
 *
 * WHY: Instead of writing `if (role === 'ADMIN' || role === 'SUPER_ADMIN')` everywhere,
 * we use hierarchy numbers. This scales cleanly as roles are added.
 *
 * @example
 * hasMinimumRole('ADMIN', 'USER')        -> true
 * hasMinimumRole('USER', 'ADMIN')        -> false
 * hasMinimumRole('SUPER_ADMIN', 'ADMIN') -> true
 */
export function hasMinimumRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export const UpdateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const UpdateRoleSchema = z.object({
  userId: z.string().cuid("Invalid user ID"),
  role: RoleSchema,
});

export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;

// ============================================================
// API RESPONSE TYPES
// ============================================================
// These are the shapes your API returns, shared between frontend and backend.
// This prevents frontend developers from guessing what the API returns.

export const UserResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  role: RoleSchema,
  emailVerified: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type UserResponse = z.infer<typeof UserResponseSchema>;

export const AuthTokensResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  sessionId: z.string().optional(),
});

export type AuthTokensResponse = z.infer<typeof AuthTokensResponseSchema>;

export const AuthResponseSchema = z.object({
  user: UserResponseSchema,
  // Browser clients use HTTP-only cookies. Native clients can opt into body tokens.
  tokens: AuthTokensResponseSchema.optional(),
  message: z.string(),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;
