# B7: Complete Auth Database Schema Reference

**Track:** Backend Deep Dives  
**Prerequisites:** All other backend modules  
**Time:** ~1 hour (reference + annotations)  

---

> **Purpose:** Every auth model from every module consolidated into a single, production-ready Prisma schema. Annotations explain every field, every relation, and every index. Use this as your definitive reference when building.

---

## The Complete Schema

```prisma
// packages/database/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ══════════════════════════════════════════════════════════════════════
// ENUMS
// ══════════════════════════════════════════════════════════════════════

enum Role {
  USER        // Default. Can access their own data.
  ADMIN       // Can manage users and content.
  SUPER_ADMIN // Can manage admins and system settings.
  // WHY ENUM: Typo-safe. Prisma generates type-safe accessors.
  // WHY HIERARCHY: Numeric comparison in middleware (USER < ADMIN < SUPER_ADMIN).
  // See: M3-authorization.md
}

enum ClientType {
  BROWSER   // HttpOnly cookie-based auth
  MOBILE    // Bearer token, stored in Keychain
  DESKTOP   // Bearer token, stored in platform secure storage
  // WHY: Lets the "Active Devices" UI show the right icon and label.
  // WHY NOT SERVICE: Service accounts use ApiKey model, not Session.
  // See: B6-multi-client-api.md, A3-native-client-token-transport.md
}

enum OAuthProvider {
  GOOGLE
  GITHUB
  APPLE
  // WHY ENUM: Prevents storing arbitrary strings. Each provider has
  // a defined callback URL and token verification logic.
  // See: M5-oauth.md
}

enum AuditAction {
  LOGIN_SUCCESS
  LOGIN_FAILURE
  LOGOUT
  TOKEN_REFRESH
  PASSWORD_CHANGED
  PASSWORD_RESET_REQUESTED
  PASSWORD_RESET_COMPLETED
  EMAIL_VERIFIED
  MFA_ENABLED
  MFA_DISABLED
  MFA_CHALLENGE_PASSED
  MFA_CHALLENGE_FAILED
  SESSION_REVOKED
  ACCOUNT_LOCKED
  ACCOUNT_UNLOCKED
  ROLE_CHANGED
  // WHY ENUM: Audit log entries are queryable by action type.
  // See: M6-advanced-security.md
}

// ══════════════════════════════════════════════════════════════════════
// USER — The central entity
// ══════════════════════════════════════════════════════════════════════

model User {
  id            String   @id @default(cuid())
  // WHY cuid(): Collision-resistant, URL-safe, not sequential (unlike auto-increment).
  // Sequential IDs leak user count. cuid() prevents enumeration attacks.

  email         String   @unique
  // WHY UNIQUE: Emails are the login identifier.
  // Always store lowercase (enforce at application layer).

  hashedPassword String?
  // WHY NULLABLE: OAuth users may not have a password. A Google-only user
  // has no password — hashedPassword is null.
  // WHY HASHED: bcrypt(password, 12) — never store plaintext.
  // See: M1-mvp-auth.md

  name          String?
  avatar        String?  // URL to profile picture (from OAuth or upload)

  role          Role     @default(USER)
  // WHY DEFAULT(USER): Principle of least privilege. New accounts get minimum access.
  // SUPER_ADMIN must be manually assigned by another SUPER_ADMIN.
  // See: M3-authorization.md

  // ── Email Verification ──────────────────────────────────────────────
  emailVerified Boolean  @default(false)
  // WHY: Unverified emails can lock out the real owner. We gate dashboard
  // access on emailVerified = true. See: M10-email-verification.md

  // ── Account Security ────────────────────────────────────────────────
  failedLoginAttempts Int      @default(0)
  // WHY: Count consecutive failed logins for account lockout.
  // Reset to 0 on successful login. See: M6-advanced-security.md

  lockedUntil   DateTime?
  // WHY NULLABLE: null = not locked. Set to future timestamp on lockout.
  // Automatic unlock at that time (no admin action needed).
  // See: M6-advanced-security.md

  // ── Multi-Factor Authentication ─────────────────────────────────────
  mfaEnabled    Boolean  @default(false)
  mfaSecret     String?
  // WHY NULLABLE: null = MFA not set up. The TOTP secret (Base32) is stored
  // encrypted at rest in production (use pgcrypto or app-level AES).
  // See: M9-mfa.md

  // ── Timestamps ──────────────────────────────────────────────────────
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  lastLoginAt   DateTime?
  // WHY lastLoginAt: Security dashboard. "Last active: 3 days ago."

  // ── Relations ───────────────────────────────────────────────────────
  sessions      Session[]
  oauthAccounts OAuthAccount[]
  mfaBackupCodes MfaBackupCode[]
  auditLogs     AuditLog[]

  @@index([email])
  // WHY: Login is SELECT WHERE email = ?. Without index = full table scan.
}

// ══════════════════════════════════════════════════════════════════════
// SESSION — The Refresh Token Store
// ══════════════════════════════════════════════════════════════════════

model Session {
  id           String     @id @default(cuid())

  userId       String
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  // WHY Cascade: Deleting a user deletes all their sessions. No orphaned rows.

  refreshToken String     @unique
  // WHY UNIQUE: Enables O(1) lookup by token hash.
  // WHY HASHED: We store SHA-256(rawToken). The raw token lives only in the cookie.
  // If the database is breached, the attacker cannot use the hashes.
  // See: B4-sessions-vs-jwt.md

  isRevoked    Boolean    @default(false)
  // WHY: The primary kill switch for remote session revocation (M7).
  // We don't DELETE rows immediately — we keep them for audit trail.
  // The cron cleanup job deletes revoked rows after 7 days.

  expiresAt    DateTime
  // WHY: Belt-and-suspenders. Even if isRevoked is false, past expiresAt = dead.

  clientType   ClientType @default(BROWSER)
  // See: B6-multi-client-api.md, A3-native-client-token-transport.md

  // ── Device Fingerprinting ────────────────────────────────────────────
  ipAddress    String?
  userAgent    String?
  // WHY OPTIONAL: IP can change (mobile data). We use this for the
  // "Active Devices" UI, not for security validation.

  deviceName   String?
  // WHY: Mobile apps can send "John's iPhone 15" via X-Device-Name header.
  // Makes the Active Devices page more readable than a raw User-Agent string.

  // ── Timestamps ──────────────────────────────────────────────────────
  createdAt    DateTime   @default(now())
  lastUsedAt   DateTime   @default(now())
  // WHY lastUsedAt: Enables cleanup of sessions inactive for 90+ days.

  @@index([userId])
  // WHY: Most common query: find all sessions for a user. Index is essential.
  // See: M7-session-management.md, B4-sessions-vs-jwt.md
}

// ══════════════════════════════════════════════════════════════════════
// OAUTH ACCOUNT — Linking social logins to users
// ══════════════════════════════════════════════════════════════════════

model OAuthAccount {
  id           String        @id @default(cuid())

  userId       String
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  provider     OAuthProvider
  // WHY ENUM: GOOGLE | GITHUB | APPLE. Each has its own verification logic.

  providerUserId String
  // WHY: The ID that the provider gives us. e.g., Google's sub claim.
  // Stable across sessions. We use this to match returning OAuth users.

  accessToken  String?
  // WHY NULLABLE: The OAuth access token from the provider.
  // Used if we need to call the provider's API (e.g., get Google contacts).
  // We DON'T need this for basic auth — just for provider API calls.

  refreshToken String?
  // WHY NULLABLE: Provider's refresh token (different from our own refresh token!).
  // Used to re-fetch provider access tokens when they expire.

  expiresAt    DateTime?
  // WHY: Provider access tokens expire. We need to know when to refresh them.

  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  @@unique([provider, providerUserId])
  // WHY UNIQUE: Each (provider, providerUserId) pair must be unique.
  // Google user "12345" can only be linked to one account.

  @@index([userId])
  // See: M5-oauth.md
}

// ══════════════════════════════════════════════════════════════════════
// MFA BACKUP CODE — One-time emergency codes
// ══════════════════════════════════════════════════════════════════════

model MfaBackupCode {
  id        String   @id @default(cuid())

  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  codeHash  String
  // WHY HASH: Same principle as passwords. We store SHA-256(code).
  // If the DB is breached, the codes are unusable.

  usedAt    DateTime?
  // WHY NULLABLE: null = not yet used. Set to now() when consumed.
  // We keep used codes as a record — single-use enforcement via usedAt != null.
  // WHY NOT DELETE: Deleting used codes loses audit trail.

  createdAt DateTime @default(now())

  @@index([userId])
  // See: M9-mfa.md
}

// ══════════════════════════════════════════════════════════════════════
// API KEY — Service account authentication
// ══════════════════════════════════════════════════════════════════════

model ApiKey {
  id          String    @id @default(cuid())

  key         String    @unique
  // WHY PLAINTEXT (unlike passwords/tokens): API keys are long (64+ chars),
  // randomly generated, and you need to be able to show them to the admin
  // on creation. Unlike passwords, they're not user-chosen.
  // Format: sk_prod_xxxxxxxx or sk_test_xxxxxxxx
  // If you require extra security, you can hash these too and require
  // admins to rotate when lost.

  name        String
  // "Email Worker Service", "Cron Job", "Analytics Dashboard"

  serviceId   String
  // Which service/application this key belongs to.

  role        String    @default("SERVICE")
  // SERVICE: Can call internal APIs with limited scope
  // ADMIN: Can perform admin operations (use sparingly)

  scopes      String[]
  // PostgreSQL array. e.g., ["read:users", "write:notifications"]
  // Principle of least privilege: grant only what's needed.
  // See: B6-multi-client-api.md

  isActive    Boolean   @default(true)
  // WHY: Disable without deleting. Preserves audit trail.

  expiresAt   DateTime?
  // WHY OPTIONAL: Permanent keys for internal services.
  // Time-limited keys for partner integrations.

  lastUsedAt  DateTime?
  // WHY: Monitor for keys that haven't been used in 90+ days → rotate.

  createdAt   DateTime  @default(now())

  @@index([key])
  // WHY: Every API request looks up by key. Index is critical.
}

// ══════════════════════════════════════════════════════════════════════
// AUDIT LOG — Immutable security event record
// ══════════════════════════════════════════════════════════════════════

model AuditLog {
  id        String      @id @default(cuid())

  userId    String?
  user      User?       @relation(fields: [userId], references: [id], onDelete: SetNull)
  // WHY NULLABLE + SetNull: We want audit logs to survive user deletion.
  // If a user is deleted, userId becomes null but the log row stays.
  // This is legally required in many jurisdictions.

  action    AuditAction
  // ENUM: LOGIN_SUCCESS, LOGIN_FAILURE, SESSION_REVOKED, etc.

  ipAddress String?
  userAgent String?
  // WHY: Security forensics. "This action came from IP x.x.x.x at time T."

  metadata  Json?
  // WHY JSON: Flexible extra data per action type.
  // LOGIN_FAILURE: { reason: "wrong_password", attemptCount: 3 }
  // ROLE_CHANGED:  { from: "USER", to: "ADMIN", changedBy: "admin-id" }
  // SESSION_REVOKED: { sessionId: "...", revokedBy: "user" | "admin" }

  createdAt DateTime    @default(now())

  // ── CRITICAL: Audit logs are NEVER updated or deleted ──────────────
  // No updatedAt field. No cascade deletes (beyond the SetNull on userId).
  // These are immutable records. For GDPR: anonymize (set userId=null,
  // clear ipAddress) rather than delete.

  @@index([userId])
  @@index([action])
  @@index([createdAt])
  // WHY THREE INDEXES: Common queries:
  // 1. "Show me all events for user X" → userId index
  // 2. "Show me all failed logins today" → action + createdAt index
  // 3. "Security dashboard last 24h" → createdAt index
  // See: M6-advanced-security.md
}
```

---

## Model Relationship Map

```
User
 │
 ├──< Session          (one user → many sessions, one per device/login)
 │         └── clientType: BROWSER | MOBILE | DESKTOP
 │
 ├──< OAuthAccount     (one user → many OAuth providers)
 │         └── provider: GOOGLE | GITHUB | APPLE
 │
 ├──< MfaBackupCode    (one user → 10 one-time codes)
 │
 └──< AuditLog         (one user → many log entries, survives user deletion)

ApiKey                 (standalone — no User relation, belongs to a service)
```

---

## What Lives in Postgres vs Redis

| Data | Where | Why |
|---|---|---|
| `User` | Postgres | Permanent. Queryable. Relational. |
| `Session` (refresh tokens) | Postgres | Permanent until revoked. Needs FK to User. |
| `OAuthAccount` | Postgres | Permanent. Needs FK to User. |
| `MfaBackupCode` | Postgres | Single-use audit trail needed. |
| `ApiKey` | Postgres | Permanent. Queryable by scope. |
| `AuditLog` | Postgres | Permanent. Legally required. |
| Rate limit counters | **Redis** | Temporary (TTL). High write frequency. |
| Session cache | **Redis** | Temporary mirror for speed. |
| JWT blocklist | **Redis** | Expires with the token automatically. |
| Email verify tokens | **Redis** | 10-minute TTL. Single-use. Auto-expires. |
| Password reset tokens | **Redis** | 15-minute TTL. Single-use. Auto-expires. |
| MFA in-progress state | **Redis** | 5-minute TTL. Step-up auth state. |

---

## Essential Database Indexes (Summary)

| Model | Index | Query It Serves |
|---|---|---|
| `User` | `email` | Login lookup |
| `Session` | `userId` | "Find all sessions for user" |
| `Session` | `refreshToken` (UNIQUE) | Token rotation lookup |
| `OAuthAccount` | `userId` | "Find all OAuth providers for user" |
| `OAuthAccount` | `(provider, providerUserId)` (UNIQUE) | OAuth login matching |
| `MfaBackupCode` | `userId` | "Find all backup codes for user" |
| `ApiKey` | `key` (UNIQUE) | Service auth lookup |
| `AuditLog` | `userId` | "User's event history" |
| `AuditLog` | `action` | "All failed logins" |
| `AuditLog` | `createdAt` | "Events in time range" |

---

## The Migrations You'll Run (In Order)

```bash
# 1. Initial schema (User + Session)
npx prisma migrate dev --name "init-auth"

# 2. Add OAuth support
npx prisma migrate dev --name "add-oauth-accounts"

# 3. Add MFA
npx prisma migrate dev --name "add-mfa"

# 4. Add audit logging
npx prisma migrate dev --name "add-audit-logs"

# 5. Add API keys for service accounts
npx prisma migrate dev --name "add-api-keys"

# 6. Add account lockout fields
npx prisma migrate dev --name "add-account-lockout"

# 7. Add device info to sessions
npx prisma migrate dev --name "add-session-device-info"
```

> **Production migrations:** Always run `prisma migrate deploy` (not `dev`) in production. Use `prisma migrate status` to check pending migrations before deploying.

---

## Common Schema Mistakes to Avoid

| Mistake | Problem | Fix |
|---|---|---|
| Storing raw refresh token | DB breach exposes usable tokens | Store SHA-256 hash only |
| Storing raw password | Catastrophic | bcrypt only, never stored |
| No `onDelete: Cascade` on Session | Orphaned session rows after user delete | Add Cascade |
| Using `@default(autoincrement())` for User IDs | Sequential IDs enable user enumeration | Use `@default(cuid())` |
| No index on `Session.userId` | Full table scan on every session list | Add `@@index([userId])` |
| Deleting AuditLog rows | Loses compliance trail | Never delete — anonymize instead |
| No `expiresAt` on Session | Sessions live forever | Always set 30-day expiry |
| Missing `@updatedAt` on User | Can't track when profile changed | Add `updatedAt DateTime @updatedAt` |
