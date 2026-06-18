/**
 * @file Session Schemas
 * @milestone M11 (Session Management)
 */
import { z } from "zod";

export const SessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  deviceInfo: z.string().nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  isRevoked: z.boolean(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime(),
  isCurrent: z.boolean().optional(), // flagged by backend if this is the caller's session
});

export type Session = z.infer<typeof SessionSchema>;

export const RevokeSessionSchema = z.object({
  sessionId: z.string().cuid("Invalid session ID"),
});

export type RevokeSessionInput = z.infer<typeof RevokeSessionSchema>;
