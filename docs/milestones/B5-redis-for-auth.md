# B5: Redis for Auth — Caching, Rate Limiting & Instant Revocation

**Track:** Backend Deep Dives  
**Prerequisites:** B4 (Sessions vs JWT), M6 (Advanced Security)  
**Time:** ~2.5 hours  

---

> **What you'll understand by the end:** Why Redis exists in an auth stack, what exact data you put in it, how it replaces Postgres for high-frequency operations, and how to implement the four most critical auth use-cases with Redis.

---

## Part 1: Why Redis at All? The Problem with Postgres for Auth

Your Postgres `Session` table works perfectly for most apps. But consider what happens under load:

```
1,000 concurrent users
Each user's access token expires every 15 minutes
= ~67 token refresh requests per second
= 67 writes per second to the Session table
```

Each refresh also involves:
1. `SELECT` by `refreshToken` (hashed lookup)
2. `DELETE` old session row  
3. `INSERT` new session row

That's **3 DB round-trips per refresh**. For rate limiting (M6), every single API request does an additional `SELECT + UPDATE` or `INSERT`. Postgres starts struggling around **5,000–10,000 ops/sec** on typical hardware.

**Redis solves this:**

| Operation | Postgres (avg) | Redis (avg) |
|---|---|---|
| Read by key | ~2–5ms (with index) | ~0.1ms |
| Write single key | ~3–8ms | ~0.1ms |
| Increment counter | ~3ms (+ locking) | ~0.1ms (atomic) |
| Set with TTL | Not native | Native (`SET key val EX 300`) |
| Delete by TTL | Requires cron job | Automatic |

Redis is an **in-memory data structure store**. It's not a replacement for Postgres — it's a **fast cache layer** that sits in front of it for operations that need to be both fast AND temporary.

---

## Part 2: The Four Auth Use-Cases for Redis

```
┌─────────────────────────────────────────────────┐
│                    Redis                         │
│                                                 │
│  1. Rate Limit Counters   (expires in ~1 min)   │
│  2. Token Blocklist       (expires with token)  │
│  3. Session Cache         (mirror of Postgres)  │
│  4. Email Verification    (expires in 10 min)   │
└─────────────────────────────────────────────────┘
```

---

## Part 3: Setting Up Redis in Your Project

### 3.1 Installation

```bash
# In your apps/api directory
pnpm add ioredis
pnpm add -D @types/ioredis
```

### 3.2 The Redis Client Singleton

```typescript
// packages/database/src/redis.ts
import Redis from "ioredis";

let redis: Redis;

function getRedisClient(): Redis {
  if (!redis) {
    redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      // Retry strategy: reconnect on connection loss
      retryStrategy: (times) => {
        if (times > 10) return null; // Stop retrying after 10 attempts
        return Math.min(times * 100, 3000); // Exponential backoff up to 3 seconds
      },
      // Automatically reconnect when idle
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
    });

    redis.on("connect", () => console.log("[Redis] Connected"));
    redis.on("error", (err) => console.error("[Redis] Error:", err));
  }
  return redis;
}

export const redisClient = getRedisClient();
```

### 3.3 Docker Setup for Local Development

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: auth_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --requirepass yourpassword
    volumes:
      - redis_data:/data  # Persist data across restarts

volumes:
  redis_data:
```

---

## Part 4: Use-Case 1 — Rate Limiting with Redis

### Why Redis Makes This Easy

In M6 (Advanced Security), we used Postgres to track failed login attempts. The problem: every failed attempt is a DB write, every check is a DB read. For brute-force attacks (thousands of attempts per second), this is a bottleneck and can itself become a DoS vector.

Redis has an atomic `INCR` command that increments a counter in **one operation** with no race conditions.

### 4.1 The Pattern: Sliding Window Rate Limiter

```
Key: "rate_limit:login:IP_ADDRESS"
Value: integer (number of attempts)
TTL: 15 minutes (automatically resets after window)
```

```typescript
// packages/database/src/rateLimiter.ts
import { redisClient } from "./redis";

interface RateLimitConfig {
  maxAttempts: number;
  windowSeconds: number;
}

export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const { maxAttempts, windowSeconds } = config;

  // INCR is atomic — no race conditions
  const current = await redisClient.incr(key);

  if (current === 1) {
    // First attempt: set the TTL window
    await redisClient.expire(key, windowSeconds);
  }

  const ttl = await redisClient.ttl(key);

  return {
    allowed: current <= maxAttempts,
    remaining: Math.max(0, maxAttempts - current),
    resetIn: ttl,
  };
}

export async function clearRateLimit(key: string): Promise<void> {
  await redisClient.del(key);
}
```

### 4.2 Using It in the Login Endpoint

```typescript
// apps/api/src/modules/auth/auth.controller.ts
import { checkRateLimit, clearRateLimit } from "@repo/database/rateLimiter";

export async function login(req: Request, res: Response) {
  const ip = req.ip || "unknown";
  const email = req.body.email?.toLowerCase();

  // Rate limit by IP (protects against distributed attacks)
  const ipLimit = await checkRateLimit(`rate_limit:login:ip:${ip}`, {
    maxAttempts: 20,
    windowSeconds: 900, // 15 minutes
  });

  if (!ipLimit.allowed) {
    return res.status(429).json({
      error: "Too many requests from this IP",
      retryAfter: ipLimit.resetIn,
    });
  }

  // Rate limit by email (protects against targeted account attacks)
  const emailLimit = await checkRateLimit(`rate_limit:login:email:${email}`, {
    maxAttempts: 5,
    windowSeconds: 900, // 15 minutes
  });

  if (!emailLimit.allowed) {
    return res.status(429).json({
      error: "Too many attempts on this account. Try again later.",
      retryAfter: emailLimit.resetIn,
    });
  }

  // Attempt login...
  const result = await authService.login(email, req.body.password);

  if (!result.success) {
    // Don't clear the rate limit on failure — let it accumulate
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // SUCCESS: Clear the email rate limit (reset on successful login)
  await clearRateLimit(`rate_limit:login:email:${email}`);

  // ... set cookies, return user
}
```

### 4.3 Rate Limit Response Headers

Add these to every response so clients can self-throttle:

```typescript
// middleware
res.setHeader("X-RateLimit-Limit", limit.maxAttempts);
res.setHeader("X-RateLimit-Remaining", limit.remaining);
res.setHeader("X-RateLimit-Reset", Date.now() + limit.resetIn * 1000);
```

---

## Part 5: Use-Case 2 — Token Blocklist (Instant Access Token Revocation)

### The Problem

As explained in B4, when you revoke a session (refresh token), the Access Token still works for up to 15 minutes. For sensitive accounts (security breach, employee termination), 15 minutes is too long.

### The Solution: JTI Blocklist

Every JWT should have a `jti` (JWT ID) — a unique identifier for that specific token. When you revoke a session, you add the `jti` to a Redis set. On every API request, you check that set.

### 5.1 Generating JWTs with JTI

```typescript
// apps/api/src/utils/jwt.ts
import { v4 as uuidv4 } from "uuid";

export function signAccessToken(userId: string, role: string): string {
  return jwt.sign(
    {
      sub: userId,
      role,
      jti: uuidv4(), // ← Unique ID for this specific token
    },
    process.env.JWT_SECRET!,
    { expiresIn: "15m" }
  );
}
```

### 5.2 The Blocklist Operations

```typescript
// packages/database/src/tokenBlocklist.ts
import { redisClient } from "./redis";

export async function blockToken(jti: string, expiresInSeconds: number): Promise<void> {
  // Store the JTI with a TTL matching the token's remaining lifetime
  // After it naturally expires, the blocklist entry auto-deletes (no cleanup needed)
  await redisClient.set(
    `blocklist:${jti}`,
    "1",
    "EX",
    expiresInSeconds
  );
}

export async function isTokenBlocked(jti: string): Promise<boolean> {
  const exists = await redisClient.exists(`blocklist:${jti}`);
  return exists === 1;
}
```

### 5.3 Middleware to Check the Blocklist

```typescript
// apps/api/src/middleware/authenticate.ts
import { isTokenBlocked } from "@repo/database/tokenBlocklist";

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  let payload: JWTPayload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  // ← New: Check if this specific token has been blocklisted
  if (payload.jti && await isTokenBlocked(payload.jti)) {
    return res.status(401).json({ error: "Token has been revoked" });
  }

  req.user = { id: payload.sub, role: payload.role };
  next();
}
```

### 5.4 Adding Tokens to the Blocklist on Session Revocation

```typescript
// When admin force-revokes a session:
async function revokeSessionAndBlockToken(sessionId: string, currentAccessToken: string) {
  // 1. Revoke the refresh token (session)
  await db.session.update({ where: { id: sessionId }, data: { isRevoked: true } });

  // 2. Also block the current access token immediately
  const payload = jwt.decode(currentAccessToken) as any;
  if (payload?.jti && payload?.exp) {
    const remainingSeconds = payload.exp - Math.floor(Date.now() / 1000);
    if (remainingSeconds > 0) {
      await blockToken(payload.jti, remainingSeconds);
    }
  }
}
```

> **Overhead:** Each API request now does one Redis `EXISTS` check (~0.1ms). This is the cost of instant revocation. For most apps, this is completely acceptable.

---

## Part 6: Use-Case 3 — Session Cache (Speed Up Token Refresh)

Instead of hitting Postgres on every token refresh, we can cache session data in Redis.

### 6.1 Write-Through Cache Pattern

```
On Login:  Write to Postgres AND to Redis
On Refresh: Read from Redis first → fallback to Postgres
On Revoke:  Write to Postgres AND invalidate Redis key
```

```typescript
// packages/database/src/sessionCache.ts
import { redisClient } from "./redis";
import { db } from "./prisma";

const SESSION_CACHE_TTL = 60 * 60 * 24; // 1 day in seconds

export async function cacheSession(hashedToken: string, sessionData: object): Promise<void> {
  await redisClient.set(
    `session:${hashedToken}`,
    JSON.stringify(sessionData),
    "EX",
    SESSION_CACHE_TTL
  );
}

export async function getSessionFromCache(hashedToken: string): Promise<any | null> {
  const cached = await redisClient.get(`session:${hashedToken}`);
  if (cached) {
    return JSON.parse(cached); // Cache HIT — no Postgres query needed!
  }

  // Cache MISS — fall back to Postgres
  const session = await db.session.findUnique({
    where: { refreshToken: hashedToken },
    include: { user: { select: { id: true, role: true } } },
  });

  if (session) {
    await cacheSession(hashedToken, session); // Populate cache for next time
  }

  return session;
}

export async function invalidateCachedSession(hashedToken: string): Promise<void> {
  await redisClient.del(`session:${hashedToken}`);
}
```

---

## Part 7: Use-Case 4 — Email Verification & Password Reset Tokens

Short-lived, single-use tokens (email verification codes, password reset links) are a perfect Redis use-case:

- They need to expire automatically (no cron job)
- They need to be deleted on use (no stale data)
- They don't need to be queryable or joined

```typescript
// packages/database/src/emailTokens.ts
import { redisClient } from "./redis";
import crypto from "crypto";

const EMAIL_VERIFY_TTL = 60 * 10;  // 10 minutes
const PASSWORD_RESET_TTL = 60 * 15; // 15 minutes

// Generate and store a verification token
export async function createEmailVerificationToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  
  // Store mapping: token → userId, with auto-expiry
  await redisClient.set(
    `email_verify:${token}`,
    userId,
    "EX",
    EMAIL_VERIFY_TTL
  );

  return token; // Send this in the email link
}

// Verify and consume the token (single-use)
export async function verifyEmailToken(token: string): Promise<string | null> {
  const key = `email_verify:${token}`;
  
  // GET + DEL in one atomic pipeline (prevents race conditions)
  const [userId] = await redisClient.pipeline()
    .get(key)
    .del(key)
    .exec() as any[];

  return userId?.[1] ?? null; // null = token not found or expired
}
```

> **vs. Prisma approach (M10):** M10 stores email tokens in Postgres with `expiresAt`. For simple apps, either works. Redis is preferred when: tokens are high-volume, you want automatic cleanup, or you don't need to query tokens by userId.

---

## Part 8: Redis Key Design — Naming Conventions

Good Redis key design prevents collisions and makes debugging easy:

```
rate_limit:login:ip:{IP_ADDRESS}           → Rate limit counter
rate_limit:login:email:{EMAIL}             → Rate limit counter
rate_limit:signup:ip:{IP_ADDRESS}          → Rate limit counter

blocklist:{JTI}                            → Revoked access token
session:{HASHED_REFRESH_TOKEN}             → Cached session data

email_verify:{TOKEN}                       → Email verification
password_reset:{TOKEN}                     → Password reset link
mfa_attempt:{USER_ID}                      → MFA in-progress state

user_permissions:{USER_ID}                 → Cached RBAC permissions
```

**Rules:**
1. Use `:` as separator (Redis Convention)
2. Include the data type in the key name
3. Include the identifier last (makes prefix scanning possible)
4. Always set a TTL — never store permanent data in Redis

---

## Part 9: Monitoring Redis in Production

```typescript
// apps/api/src/routes/health.ts
router.get("/health", async (req, res) => {
  const redisInfo = await redisClient.info("stats");
  const dbSize = await redisClient.dbsize();
  
  res.json({
    status: "ok",
    redis: {
      connected: redisClient.status === "ready",
      keyCount: dbSize,
      // Parse memory from INFO string
    }
  });
});
```

**Key metrics to watch:**
- `used_memory`: Should stay well below available RAM
- `keyspace_hits` vs `keyspace_misses`: Cache hit ratio (aim for >90%)
- `connected_clients`: Number of app connections
- `evicted_keys`: If > 0, your Redis is running out of memory

---

## Part 10: When NOT to Use Redis

| Situation | Decision |
|---|---|
| < 10,000 users | Postgres is fine, skip Redis |
| Need ACID transactions | Use Postgres |
| Need to query by multiple fields | Use Postgres |
| Storing user profile data | Use Postgres |
| Rate limiting | ✅ Use Redis |
| Session caching | ✅ Use Redis (at scale) |
| Short-lived tokens | ✅ Use Redis |
| Token blocklist | ✅ Use Redis |

> **The iron rule:** Redis is a cache, not a database of record. If you can't afford to lose the data (Redis restarts, memory is full), it should be in Postgres too.

---

## Practice Exercises

1. **Monitor keys live:** Run `redis-cli monitor` in a terminal. Log in to your app and watch the Redis commands fire in real time. You'll see `SET`, `EXPIRE`, and `INCR` commands as they happen.

2. **Trigger a rate limit:** Use a script to fire 6 login requests in rapid succession. Observe the 429 response. Then check `redis-cli GET rate_limit:login:email:test@test.com` to see the counter.

3. **Verify blocklist:** Log in, copy your access token, logout (which should also blocklist it). Try to send the copied token to `GET /api/auth/me`. Verify you get `401 Token has been revoked` instead of the usual `401 Unauthorized`.

4. **TTL inspection:** After creating an email verification token, run `redis-cli TTL email_verify:{your-token}`. Run it again after 30 seconds. See the countdown.
