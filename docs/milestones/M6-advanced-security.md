# M6: Advanced Security (Implementation Guide)

**Track:** Core Curriculum  
**Prerequisites:** M1 (MVP Auth)  
**Time:** ~1.5 hours  

---

## The Goal
Authentication proves who someone is, but how do we prevent attackers from abusing our API endpoints? If an attacker tries to brute-force a password or spam the `/signup` route, they could take down our database or figure out user passwords.

In this module, we implement **Rate Limiting** and **Security Headers**.

---

## Step 1: Rate Limiting (Backend)

We cannot use an in-memory rate limiter (like a simple JavaScript object) because if we scale our API to multiple servers (or serverless functions), each server would have its own memory, rendering the rate limit useless.

We must use a centralized store: **Redis**. We use Upstash Redis for serverless-friendly, low-latency rate limiting.

### 1.1 The Redis Client
Open `apps/api/src/utils/redis.ts`.

```typescript
import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
```

### 1.2 The Rate Limiter Middleware
Open `apps/api/src/middlewares/rateLimiter.ts`. We use the `@upstash/ratelimit` library.

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "../utils/redis";

// Create a sliding window rate limiter: 5 requests per 10 seconds
const loginLimiter = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(5, "10 s"),
  analytics: true,
});

export async function rateLimitLogin(req, res, next) {
  // Use the IP address as the identifier. 
  // In production behind a proxy (like Nginx or Vercel), use req.headers["x-forwarded-for"]
  const ip = req.headers["x-forwarded-for"] || req.ip || "127.0.0.1";

  const { success, limit, remaining, reset } = await loginLimiter.limit(`login_ratelimit_${ip}`);

  // Set standard RateLimit headers for the frontend to read
  res.setHeader("X-RateLimit-Limit", limit);
  res.setHeader("X-RateLimit-Remaining", remaining);
  res.setHeader("X-RateLimit-Reset", reset);

  if (!success) {
    return res.status(429).json({ 
      error: "Too many login attempts. Please try again later." 
    });
  }

  next();
}
```

### 1.3 Applying the Rate Limiter
Open `apps/api/src/modules/auth/auth.routes.ts`.

```typescript
// We strictly rate limit the login and signup routes.
// We DO NOT strictly rate limit the /me or /refresh routes because 
// the frontend might naturally call them multiple times during navigation.

router.post("/login", rateLimitLogin, authController.login);
router.post("/signup", rateLimitLogin, authController.signup);
```

---

## Step 2: Security Headers (Helmet.js)

By default, Express exposes headers like `X-Powered-By: Express`, which tells attackers exactly what technology stack you are using. It also lacks headers that prevent Cross-Site Scripting (XSS) and Clickjacking.

Open `apps/api/src/server.ts`.

```typescript
import helmet from "helmet";

const app = express();

// Helmet automatically adds 11 secure HTTP headers.
// - Removes X-Powered-By
// - Adds X-Frame-Options: SAMEORIGIN (Prevents Clickjacking / IFrames)
// - Adds X-Content-Type-Options: nosniff
// - Adds Strict-Transport-Security (HSTS)
app.use(helmet());
```

---

## Step 3: Handling 429 in the Frontend

When the backend returns `429 Too Many Requests`, the frontend needs to handle it gracefully instead of just throwing a generic "Error".

Open `apps/web/src/app/(auth)/login/page.tsx` and look at the submit handler.

```tsx
try {
  const res = await fetch("http://localhost:5000/api/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });

  if (res.status === 429) {
    // 429 means Rate Limited
    const resetTime = res.headers.get("X-RateLimit-Reset");
    const secondsLeft = Math.ceil((Number(resetTime) - Date.now()) / 1000);
    setError(`Too many attempts. Try again in ${secondsLeft} seconds.`);
    return;
  }

  // Handle other errors...
}
```

---

## Step 4: Audit Logging (Backend)

Rate limiting stops automated abuse, but it doesn't tell you *what* happened. **Audit logging** creates a permanent, tamper-evident trail of every significant security event.

### What to log
Every security-relevant action should be recorded:

| Event | When it fires |
|-------|--------------|
| `LOGIN_SUCCESS` | User logs in |
| `LOGIN_FAILED` | Wrong password (note: do NOT log which field was wrong) |
| `LOGOUT` | User logs out |
| `TOKEN_REFRESH` | Access token silently refreshed |
| `TOKEN_REUSE_DETECTED` | A revoked refresh token was used (possible theft) |
| `PASSWORD_RESET_REQUESTED` | User clicked "Forgot Password" |
| `PASSWORD_CHANGED` | Password was successfully reset |
| `MFA_ENABLED` / `MFA_DISABLED` | User changed 2FA status |
| `ACCOUNT_LOCKED` | Too many failed attempts |
| `ROLE_CHANGED` | Admin promoted/demoted a user |

### The Audit Log Schema
```prisma
model AuditLog {
  id        String   @id @default(cuid())
  userId    String?  // Null for failed logins where user doesn't exist
  event     String   // e.g. "LOGIN_FAILED"
  ipAddress String?
  userAgent String?
  metadata  Json?    // Any extra data (e.g. { "attemptedEmail": "..." })
  createdAt DateTime @default(now())
}
```

### The Audit Service
Open `apps/api/src/utils/audit.ts`.

```typescript
export async function auditLog(params: {
  event: string;
  userId?: string;
  req: Request;
  metadata?: Record<string, unknown>;
}) {
  // Non-blocking: we don't await this. An audit log failure should
  // never crash or slow down the main authentication flow.
  db.auditLog.create({
    data: {
      event: params.event,
      userId: params.userId ?? null,
      ipAddress: params.req.headers["x-forwarded-for"] as string || params.req.ip,
      userAgent: params.req.headers["user-agent"],
      metadata: params.metadata ?? {},
    },
  }).catch(err => console.error("[AuditLog] Failed to write:", err));
}
```

### Wiring it into Login
```typescript
// auth.service.ts -> login()

const isValid = await bcrypt.compare(password, user.passwordHash);

if (!isValid) {
  // Log the failure (not which field was wrong!)
  auditLog({ event: "LOGIN_FAILED", userId: user.id, req });
  throw new AppError("INVALID_CREDENTIALS", 401);
}

// Log success
auditLog({ event: "LOGIN_SUCCESS", userId: user.id, req });
```

### Why Audit Logs Are Non-Blocking
Notice the `catch` instead of `await`. Audit logging is important, but it must never be a critical path. If your database or logging service has a temporary outage, your users should still be able to log in. The `.catch` prevents the promise rejection from crashing Node.js.

---

## Step 5: Account Lockout (Brute Force Protection)

Rate limiting by IP address is good, but a sophisticated attacker can rotate IPs. **Account lockout** provides a second layer: after a fixed number of failed attempts on a *specific account*, that account is temporarily frozen.

### The Database Schema
```prisma
model User {
  // ... existing fields
  failedLoginAttempts Int      @default(0)
  lockedUntil         DateTime? // Null means not locked
}
```

### Lockout Logic in the Login Service
```typescript
export async function login(email, password, req) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) throw new AppError("INVALID_CREDENTIALS", 401);

  // STEP 1: Check if the account is locked
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const secondsLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
    throw new AppError("ACCOUNT_LOCKED", 423, `Account is locked. Try again in ${secondsLeft} seconds.`);
  }

  // STEP 2: Verify password
  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    const MAX_ATTEMPTS = 5;
    const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

    const newAttempts = user.failedLoginAttempts + 1;
    const isNowLocked = newAttempts >= MAX_ATTEMPTS;

    // Increment failed attempts (and lock if threshold reached)
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: newAttempts,
        lockedUntil: isNowLocked ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
      },
    });

    if (isNowLocked) {
      auditLog({ event: "ACCOUNT_LOCKED", userId: user.id, req });
      throw new AppError("ACCOUNT_LOCKED", 423, "Too many failed attempts. Account locked for 15 minutes.");
    }

    throw new AppError("INVALID_CREDENTIALS", 401);
  }

  // STEP 3: Successful login — reset the counter
  await db.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });

  // Continue with token issuance...
}
```

> [!NOTE]
> HTTP status `423 Locked` is the correct code for a locked account. It is distinct from `401 Unauthorized` (wrong credentials) and `429 Too Many Requests` (rate limited by IP).

---

## Practice Exercises

1. **Trigger the Limiter:** Try to submit the login form 6 times very quickly. Watch the Network tab. What status code is returned? What does the UI show?
2. **Inspect Headers:** Open the Network tab, click on any successful API request, and look at the `Response Headers`. Can you spot the `X-RateLimit-*` headers? Can you find `X-Frame-Options`?
3. **Change the Limit:** Go to the backend rate limiter middleware and change it to 1 request per 60 seconds. Restart the backend and verify the strictness.
4. **Query Audit Logs:** Open Prisma Studio (`npx prisma studio`). Go to the `AuditLog` table. Log in with the wrong password a few times. Do you see the `LOGIN_FAILED` events appearing? What metadata is captured?
5. **Trigger Account Lockout:** Try logging in with the correct email but wrong password 5 times. Does the account get locked? Open Prisma Studio and verify `lockedUntil` is set on the User row. Try again after 15 minutes.

