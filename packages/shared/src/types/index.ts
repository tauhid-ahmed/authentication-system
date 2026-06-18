/**
 * @file Shared TypeScript Types
 *
 * Types that don't belong to a specific schema but are used across
 * both the frontend and backend.
 */



// ============================================================
// API ERROR TYPES
// ============================================================
export interface ApiError {
  message: string;
  code?: string;
  field?: string; // For field-level validation errors
  statusCode?: number;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiError;
  errors?: ApiError[]; // For multiple validation errors
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================================
// JWT PAYLOAD TYPES
// ============================================================
/**
 * The payload embedded in JWT access tokens.
 *
 * WHY MINIMAL PAYLOAD?
 * Keep JWT payloads small! Every request sends this token.
 * Don't put sensitive data (email, phone) in JWTs — they're base64 encoded,
 * not encrypted. Anyone can decode them (they just can't forge them).
 */
export interface JwtAccessPayload {
  sub: string;   // User ID (standard JWT claim)
  role: string;  // Role for fast RBAC (avoids DB lookup per request)
  iat?: number;  // Issued at (auto-set by JWT library)
  exp?: number;  // Expiry (auto-set by JWT library)
}

/**
 * The payload embedded in JWT refresh tokens.
 * Minimal — just enough to identify the session.
 */
export interface JwtRefreshPayload {
  sub: string;     // User ID
  sessionId: string; // DB session ID — lets us invalidate specific sessions
  iat?: number;
  exp?: number;
}

// ============================================================
// AUTHENTICATED REQUEST TYPES
// ============================================================
/**
 * After JWT middleware validates a token, it attaches user info to req.user.
 * This type describes what's available after authentication.
 */
export interface AuthenticatedUser {
  id: string;
  role: string;
  sessionId?: string; // Only available when refresh token is also validated
}

// ============================================================
// AUDIT LOG TYPES
// ============================================================
export type AuditEvent =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "SIGNUP"
  | "TOKEN_REFRESH"
  | "TOKEN_REUSE_DETECTED"
  | "ROLE_CHANGED"
  | "SESSION_REVOKED"
  | "PASSWORD_CHANGED"
  | "OAUTH_LOGIN";

export interface AuditLogEntry {
  event: AuditEvent;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================
// OAUTH TYPES
// ============================================================
export interface OAuthProfile {
  id: string;         // Provider's user ID
  email: string;
  name?: string;
  picture?: string;   // Avatar URL
  provider: "google"; // Extensible for future providers
}

// ============================================================
// DEVICE INFO TYPES
// ============================================================
export interface DeviceInfo {
  browser?: string;
  os?: string;
  deviceType?: "mobile" | "tablet" | "desktop";
  raw: string; // Raw user-agent string
}
