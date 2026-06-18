/**
 * @file Auth Schemas
 * @milestone M1+ (used across all milestones)
 *
 * WHY ZOD?
 * --------
 * Zod gives us runtime type validation + TypeScript types from a SINGLE source.
 * Without Zod: You'd manually write `if (!email || typeof email !== 'string')` for every field.
 * With Zod:    Define the schema once → get TS types + runtime validation for free.
 *
 * REAL-WORLD ANALOGY:
 * Think of Zod schemas as a contract between your API and clients.
 * Just like a bank won't accept a check without the right fields,
 * your API won't accept a request without valid data.
 */
import { z } from "zod";

// ============================================================
// PASSWORD RULES
// ============================================================
// These rules are INTENTIONALLY strict for production readiness.
// Weak password rules = security vulnerability.
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be less than 128 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(
    /[^A-Za-z0-9]/,
    "Password must contain at least one special character"
  );

// ============================================================
// SIGNUP SCHEMA
// ============================================================
export const SignupSchema = z
  .object({
    email: z
      .string()
      .email("Invalid email address")
      .toLowerCase()
      .trim()
      .max(255, "Email must be less than 255 characters"),
    password: passwordSchema,
    confirmPassword: z.string(),
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name must be less than 100 characters")
      .optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignupInput = z.infer<typeof SignupSchema>;

// ============================================================
// LOGIN SCHEMA
// ============================================================
export const LoginSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .toLowerCase()
    .trim()
    .max(255),
  password: z.string().min(1, "Password is required"),
  // rememberMe: not used for token duration (tokens always 5m/30d)
  // but could be used for UI state
});

export type LoginInput = z.infer<typeof LoginSchema>;

// ============================================================
// REFRESH TOKEN SCHEMA
// ============================================================
// Browser refresh uses an HTTP-only cookie.
// Native clients can send refreshToken in the body and request body tokens.
export const RefreshTokenSchema = z.object({
  refreshToken: z.string().optional(), // optional because browser cookies are also supported
  tokenTransport: z.enum(["cookie", "body"]).optional(),
  clientType: z.enum(["web", "mobile", "desktop", "native"]).optional(),
});

export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;

// ============================================================
// CHANGE PASSWORD SCHEMA
// ============================================================
export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

// ============================================================
// FORGOT PASSWORD SCHEMA (Future - M-future)
// ============================================================
// Scaffolded for future extensibility — NOT implemented yet
export const ForgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
});

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

// ============================================================
// RESET PASSWORD SCHEMA (Future - M-future)
// ============================================================
export const ResetPasswordSchema = z
  .object({
    token: z.string().min(1, "Reset token is required"),
    newPassword: passwordSchema,
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

// ============================================================
// OTP SCHEMA (Future - M-future)
// ============================================================
export const OtpSchema = z.object({
  code: z
    .string()
    .length(6, "OTP must be exactly 6 digits")
    .regex(/^\d+$/, "OTP must contain only digits"),
});

export type OtpInput = z.infer<typeof OtpSchema>;
