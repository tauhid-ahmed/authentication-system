# A4: Production Auth System — Complete Architecture Map

**Track:** Architecture  
**Prerequisites:** All other modules recommended  
**Time:** ~1 hour (read-through) — this is a reference document, not a step-by-step guide  

---

> **Purpose of this document:** You've studied each piece of the auth system individually. This document shows you how every piece connects in a real production system. Read this after completing the other modules to see the whole picture.

---

## Part 1: The Full System at a Glance

```
╔════════════════════════════════════════════════════════════════════════╗
║                         PRODUCTION AUTH SYSTEM                         ║
╚════════════════════════════════════════════════════════════════════════╝

   CLIENTS                    NEXT.JS LAYER               EXPRESS API LAYER
┌──────────┐               ┌───────────────┐           ┌──────────────────────┐
│ Browser  │──(cookies)───▶│  middleware   │           │  authenticate()      │
│          │               │  (UX guard)   │           │  ├─ cookie strategy  │
│ Next.js  │──(SSR fetch)─▶│  Server       │──(HTTP)──▶│  ├─ bearer strategy  │
│ App      │               │  Components   │           │  └─ api-key strategy │
└──────────┘               │               │           │                      │
                           │  AuthProvider │           │  Rate Limiter        │
┌──────────┐               │  (client ctx) │           │  (Redis INCR)        │
│ Mobile   │──(Bearer)────────────────────────────────▶│                      │
│ iOS/RN   │               └───────────────┘           │  Business Logic      │
└──────────┘                                           │  Controllers         │
                                                       └──────────┬───────────┘
┌──────────┐                                                      │
│ Service  │──(X-API-Key)────────────────────────────────────────┘
│ Cron Job │
└──────────┘
                                         ┌─────────────────────────┐
                                         │      DATA LAYER          │
                                         │                         │
                                         │  PostgreSQL (Prisma)    │
                                         │  ├─ User               │
                                         │  ├─ Session            │
                                         │  ├─ ApiKey             │
                                         │  └─ AuditLog           │
                                         │                         │
                                         │  Redis                  │
                                         │  ├─ rate_limit:*       │
                                         │  ├─ blocklist:*        │
                                         │  ├─ session:*          │
                                         │  └─ email_verify:*     │
                                         └─────────────────────────┘
```

---

## Part 2: Authentication — The Complete Login Flow

Every line below maps to a specific module in this curriculum.

```
User submits login form
  │
  ├─ [Client] POST /api/auth/login { email, password }
  │    credentials: "include" ← sends cookies (F3, Part 7)
  │
  ├─ [Express] Rate limit check
  │    Redis: INCR rate_limit:login:ip:{IP}      ← B5, Part 4
  │    Redis: INCR rate_limit:login:email:{EMAIL} ← B5, Part 4
  │    If over limit → 429 Too Many Requests
  │
  ├─ [Express] Find user by email
  │    Postgres: SELECT * FROM "User" WHERE email = ?
  │    If not found → 401 (generic message — M1, Step 3)
  │
  ├─ [Express] Verify password
  │    bcrypt.compare(password, user.hashedPassword) ← M1, Step 2
  │    If mismatch → 401
  │
  ├─ [Express] Check MFA requirement
  │    If user.mfaEnabled → issue temp token, return { mfaRequired: true }
  │    Client redirects to MFA challenge page ← M9
  │
  ├─ [Express] Create Session
  │    rawToken = crypto.randomBytes(64)           ← B4, Part 4.1
  │    hashedToken = sha256(rawToken)
  │    Postgres: INSERT INTO "Session" (userId, refreshToken, ...)
  │    Redis:    SET session:{hashedToken} {data} EX 86400 ← B5, Part 6
  │
  ├─ [Express] Sign Access Token
  │    jwt.sign({ sub, role, jti }, JWT_SECRET, { expiresIn: "15m" }) ← B1
  │
  ├─ [Express] Set Cookies
  │    Set-Cookie: access_token={jwt}; HttpOnly; Secure; SameSite=Lax ← F2
  │    Set-Cookie: refresh_token={raw}; HttpOnly; Secure; Path=/api/auth/refresh
  │
  └─ [Browser] router.push("/dashboard"); router.refresh() ← F3, Part 7
```

---

## Part 3: Authorization — Every Protected Request

```
User navigates to /dashboard
  │
  ├─ [Edge] Next.js middleware.ts runs
  │    Checks: request.cookies.has("access_token") ← M4, Step 3 / F3, Part 4
  │    If no cookie → redirect /login?next=/dashboard
  │    (This is UX ONLY — not a security check)
  │
  ├─ [Server] ProtectedLayout Server Component
  │    getCurrentUser() → authFetchServer("/api/auth/me") ← F3, Part 3
  │    Forwards all cookies via Cookie: header to Express
  │
  ├─ [Express] authenticate() middleware
  │    jwt.verify(token, JWT_SECRET)               ← B1, Part 3
  │    Check JTI not in Redis blocklist            ← B5, Part 5
  │    If invalid → 401 { error: "Invalid token" }
  │    If expired → 401 { code: "TOKEN_EXPIRED" }
  │
  ├─ [Express] /api/auth/me controller
  │    SELECT * FROM "User" WHERE id = req.user.id
  │    Returns { user: { id, email, role, emailVerified } }
  │
  ├─ [Server] ProtectedLayout
  │    If null → redirect("/login")
  │    If !user.emailVerified → redirect("/verify-email") ← M10
  │    If admin route + role < ADMIN → redirect("/dashboard?error=forbidden") ← M3
  │    Renders: <AuthProvider initialUser={user}>...</AuthProvider>
  │
  └─ [Browser] Page renders with real user data (zero loading flash) ← F3, Part 3.3
```

---

## Part 4: Token Refresh — The Silent Background Flow

```
Any client component fires authFetchClient("/api/something")
  │
  ├─ Access token is VALID → request succeeds normally
  │
  └─ Access token is EXPIRED → Express returns 401 { code: "TOKEN_EXPIRED" }
       │
       ├─ [Browser] authFetchClient sees 401 + TOKEN_EXPIRED ← F3, Part 2.2 / F1
       │
       ├─ [Concurrency Check] Is another refresh already running? ← F1, F3
       │    YES → join the queue, wait for it to finish, then retry
       │    NO  → acquire lock, start refresh
       │
       ├─ [Browser] POST /api/auth/refresh
       │    credentials: "include" (sends refresh_token cookie)
       │
       ├─ [Express] refreshToken controller
       │    rawToken = req.cookies.refresh_token
       │    hashedToken = sha256(rawToken)
       │
       ├─ [Express] Session validation
       │    Redis GET session:{hashedToken}                      ← B5, Part 6
       │    If miss: Postgres SELECT WHERE refreshToken = hash   ← B4, Part 4.2
       │    If not found → 401 (token never existed)
       │    If isRevoked = true → REPLAY ATTACK DETECTED:
       │      Postgres: UPDATE Session SET isRevoked=true WHERE userId=?
       │      (revoke ALL sessions for this user)               ← M2, B4
       │      Return 401
       │    If expiresAt < now → 401 (session expired)
       │
       ├─ [Express] Token Rotation
       │    Postgres: DELETE old session row                     ← B2
       │    Create new session (new raw token, new hash)
       │    Redis: SET new session cache, DEL old session cache
       │
       ├─ [Express] Issue new tokens, set new cookies
       │
       ├─ [Browser] Lock released, queued requests retry ← F3, Part 2.2
       │
       └─ All requests succeed transparently — user sees nothing
```

---

## Part 5: Logout — Complete Teardown

```
User clicks "Sign Out"
  │
  ├─ [Browser] POST /api/auth/logout  (from useAuth().logout()) ← F3, Part 3.2
  │    credentials: "include"
  │
  ├─ [Express] logout controller
  │    rawToken = req.cookies.refresh_token
  │    hashedToken = sha256(rawToken)
  │
  ├─ [Express] Session deletion
  │    Postgres: DELETE FROM "Session" WHERE refreshToken = hash  ← B4
  │    Redis:    DEL session:{hash}
  │
  ├─ [Express] JTI blocklist (optional, for instant access token kill)
  │    Redis: SET blocklist:{jti} "1" EX {remaining_seconds}     ← B5, Part 5
  │
  ├─ [Express] Clear cookies
  │    Set-Cookie: access_token=; Max-Age=0
  │    Set-Cookie: refresh_token=; Max-Age=0
  │
  └─ [Browser] window.location.href = "/login"
       Next.js re-renders without cookies → middleware redirects ← F3
```

---

## Part 6: Remote Session Revocation (From Another Device)

```
User goes to Settings → Active Devices → "Log Out iPhone"
  │
  ├─ [Browser] DELETE /api/sessions/{sessionId}  ← M7
  │
  ├─ [Express] Authorize: session.userId must === req.user.id
  │    (Can't revoke someone else's session)
  │
  ├─ [Express] Postgres: UPDATE Session SET isRevoked=true WHERE id=?
  │    Redis:    DEL session:{hashedToken}  (invalidate cache)
  │
  └─ [iPhone — next refresh attempt]
       POST /api/auth/refresh with its refresh token
       Express finds: isRevoked = true
       Returns 401
       iPhone's interceptor fails to refresh → forces logout screen ← B6, Part 4.2
```

---

## Part 7: Email Verification Flow

```
User signs up
  │
  ├─ [Express] Create user with emailVerified: false                 ← M10
  ├─ [Express] Redis: SET email_verify:{token} {userId} EX 600      ← B5, Part 7
  ├─ [Express] Send email with link: /verify-email?token={rawToken}
  │
  └─ User clicks link
       │
       ├─ [Express] GET /api/auth/verify-email?token={rawToken}
       ├─ [Express] Redis: GET email_verify:{token} → userId
       ├─ [Express] Redis: DEL email_verify:{token}  (single-use!)
       ├─ [Express] Postgres: UPDATE User SET emailVerified=true WHERE id=userId
       └─ [Browser] Redirect to /dashboard
```

---

## Part 8: The Complete Technology Decision Map

| Decision | Choice | Why |
|---|---|---|
| Password storage | `bcrypt` (cost 12) | Adaptive hashing, resistant to GPU cracking |
| Access token format | Signed JWT (HS256) | Self-contained, fast, no DB lookup |
| Refresh token format | Random 64-byte hex | Opaque, no information leakage |
| Refresh token storage | SHA-256 hash in Postgres | DB breach-resistant, queryable |
| Session fast-lookup | Redis cache | Avoids Postgres on every refresh |
| Rate limiting | Redis `INCR` with TTL | Atomic, auto-expiring, no locks needed |
| Token revocation | `isRevoked` flag + Redis blocklist | Instant revocation without per-request DB hit |
| Browser token transport | `HttpOnly` cookie | XSS-resistant, CSRF-mitigated with SameSite |
| Mobile token transport | `Authorization: Bearer` | No cookie jar on mobile |
| CORS | Explicit origin allowlist + credentials | Prevents cross-origin cookie theft |
| Email tokens | Redis with 10-min TTL | Auto-expires, single-use via atomic GET+DEL |
| MFA algorithm | TOTP (RFC 6238) | Standardized, works with any authenticator app |
| Role hierarchy | `USER → ADMIN → SUPER_ADMIN` | Numeric comparison, easy to extend |

---

## Part 9: Where Each Module Fits

```
┌─────────────────────────────────────────────────────┐
│               LEARNING CURRICULUM MAP               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  CORE TRACK (the essential journey)                 │
│  M0 → M1 → M2 → M3 → M4 → M5 → M6 → M7 → M8 → M9 → M10
│                                                     │
│  Each milestone builds on the previous one.         │
│  M0-M2: Authentication foundation                   │
│  M3-M4: Authorization + Next.js integration         │
│  M5:    OAuth / Social login                        │
│  M6-M10: Production hardening                       │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  BACKEND TRACK (deep technical understanding)       │
│  B1: How JWTs actually work (math + signing)        │
│  B2: Token rotation algorithm details               │
│  B3: CORS from first principles                     │
│  B4: Why sessions exist in a "stateless" JWT world  │
│  B5: Redis — what to store, why, and how            │
│  B6: Supporting browsers + mobile + services        │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  FRONTEND TRACK (complete client-side mastery)      │
│  F1: The fetch interceptor + concurrency lock       │
│  F2: Why localStorage is banned, what to use        │
│  F3: Next.js end-to-end — server + client, complete │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ARCHITECTURE TRACK (system design)                 │
│  A1: OAuth patterns (which one to use and when)     │
│  A2: Building a BFF layer                           │
│  A3: Supporting native clients (iOS/Android)        │
│  A4: ← YOU ARE HERE (complete system map)          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Part 10: The Production Checklist

Before shipping an auth system to production, verify every item:

### Security
- [ ] Passwords hashed with bcrypt (cost ≥ 12)
- [ ] Access tokens short-lived (≤ 15 min)
- [ ] Refresh tokens stored as SHA-256 hash, not plaintext
- [ ] `HttpOnly` + `Secure` + `SameSite=Lax` on all auth cookies
- [ ] CORS allowlist contains only your domains
- [ ] Rate limiting on all auth endpoints (login, signup, refresh)
- [ ] Account lockout after N failed attempts
- [ ] Email verification required before dashboard access
- [ ] MFA available for sensitive accounts
- [ ] Token blocklist in Redis for instant revocation
- [ ] JWT JTI included (enables per-token revocation)
- [ ] Audit logging on all auth events

### Resilience
- [ ] Redis connection has retry strategy and fallback
- [ ] Cron job to clean up expired sessions
- [ ] Refresh token rotation with replay attack detection
- [ ] Session cleanup cron runs nightly

### Next.js Specific
- [ ] `authFetchServer` used in ALL Server Components (never client fetch)
- [ ] `authFetchClient` used in ALL Client Components (never bare fetch)
- [ ] `cache: "no-store"` on all `/me` calls
- [ ] `router.refresh()` called after login/logout
- [ ] Both server-side AND client-side role guards in place
- [ ] Middleware protects routes as UX only (not security)

### Operations
- [ ] `JWT_SECRET` is at least 256 bits, stored in secrets manager
- [ ] Redis password set and connection encrypted in production
- [ ] API keys scoped to minimum necessary permissions
- [ ] Session metadata (IP, User-Agent) captured for audit trail
- [ ] `/health` endpoint monitors Redis connectivity

---

## Quick Reference: Key Flows by Error Code

| Error | Cause | What Happens |
|---|---|---|
| `401 { code: "TOKEN_EXPIRED" }` | Access token expired | Client silently refreshes, retries |
| `401 { error: "Invalid token" }` | Tampered/wrong key | Client redirects to login |
| `401 { error: "Token has been revoked" }` | JTI blocklisted | Client redirects to login |
| `401 { error: "Session not found" }` | Refresh token gone/rotated | Client redirects to login |
| `401 { error: "Refresh token reuse detected" }` | Replay attack | ALL sessions revoked, forced logout |
| `403 { error: "Forbidden" }` | Authenticated but wrong role | Show access denied page |
| `429 { error: "Too many requests" }` | Rate limit hit | Show retry countdown |
| `423 { error: "Account locked" }` | Too many failed logins | Show unlock instructions |
