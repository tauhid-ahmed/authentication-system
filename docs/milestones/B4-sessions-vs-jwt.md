# B4: Sessions vs JWT — Why Your Prisma Schema Has a `Session` Model

**Track:** Backend Deep Dives  
**Prerequisites:** M2 (Advanced Tokens), B1 (JWT Lifecycle)  
**Time:** ~2 hours  

---

> **The burning question:** If JWTs are *stateless* (the server doesn't store anything), why does our Prisma schema have a `Session` table? Isn't the whole point of JWT to avoid the database?

This module answers that question completely, walks through every reason sessions are necessary in production, and shows you exactly what goes in the `Session` model and why.

---

## Part 1: The Pure JWT Fantasy

When most developers first learn JWTs, they hear:

> *"JWTs are self-contained. You never have to hit the database to verify them. That's the whole point!"*

This is **true for Access Tokens**. A short-lived (5–15 min) JWT that a user sends on every API request does not need a database lookup. The server only needs to verify the signature and check the `exp` claim.

```
Browser ──[POST /api/dashboard]──▶  Express Server
                                     │
                                     ├── jwt.verify(token, secret)  ✅ No DB!
                                     ├── Check exp claim            ✅ No DB!
                                     └── Return data                ✅ Fast!
```

**So where does the myth break down?**

It breaks down the moment you add **Refresh Tokens**.

---

## Part 2: Why Refresh Tokens Force You to the Database

A Refresh Token is a long-lived credential (7–30 days). It is used to get new Access Tokens without requiring the user to log in again.

Here is the critical problem: **If a Refresh Token is stolen, the attacker can silently mint new Access Tokens for 30 days.**

There are only two ways to stop this:
1. Make Refresh Tokens short-lived (defeats the purpose)
2. **Store them in the database so you can revoke them** ← This is what we do

The moment you store a Refresh Token in the database, you have created a **session record**. That record IS the session.

```
User logs in
    │
    ├── Generate Access Token  (stateless, 15 min, no DB)
    └── Generate Refresh Token (stateful, 30 days, STORED IN DB ← this is the Session)
```

**The `Session` table in Prisma IS the Refresh Token store.** The naming makes it clear that a refresh token family (a chain of rotated tokens) represents one continuous session (one login event on one device).

---

## Part 3: The Full Prisma `Session` Model Explained

Open `packages/database/prisma/schema.prisma`. Here is the production-ready `Session` model with every field justified:

```prisma
model Session {
  id           String   @id @default(cuid())
  
  // --- OWNERSHIP ---
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  // WHY: Every session belongs to exactly one user. If the user is deleted,
  // all their sessions are automatically cascade-deleted. No orphaned rows.

  // --- THE TOKEN ITSELF ---
  refreshToken String   @unique
  // WHY UNIQUE: Only one row may contain any given token hash.
  // This is the core of replay attack detection (M2). If you see the same
  // token twice, you know it was stolen. UNIQUE enforces this at the DB level.
  
  // WHY STORE HASH, NOT THE TOKEN?
  // We store SHA-256(refreshToken), not the raw token. If the database is
  // breached, the attacker gets hashes, not the usable tokens.
  // (The raw token lives only in the cookie)

  // --- LIFECYCLE ---
  isRevoked    Boolean  @default(false)
  // WHY: The primary kill switch. When a user clicks "Log out this device",
  // we set isRevoked = true. On the NEXT refresh attempt from that device,
  // the backend finds isRevoked = true and returns 401. The device is locked out.
  
  expiresAt    DateTime
  // WHY: A hard expiry. Even if isRevoked is false, a session past its
  // expiresAt is dead. This is a safety net: if your revocation logic has
  // a bug, the session will die on its own after 30 days.

  // --- DEVICE FINGERPRINTING ---
  ipAddress    String?
  // WHY OPTIONAL: IP addresses can change (mobile networks, VPNs).
  // It's metadata for the user's "Active Devices" page, not a security check.
  
  userAgent    String?
  // WHY: Raw User-Agent string from the browser/app. We parse this with
  // ua-parser-js to show "macOS · Chrome 124" in the UI.

  // --- TIMESTAMPS ---
  createdAt    DateTime @default(now())
  lastUsedAt   DateTime @default(now())
  // WHY lastUsedAt: Enables "inactive session" cleanup. A cronjob can delete
  // sessions not used in 90 days even if expiresAt hasn't passed.

  @@index([userId])
  // WHY INDEX: The most common query is "find all sessions for this userId".
  // Without an index on userId, this is a full table scan. With millions of
  // sessions, this is catastrophic.
}
```

---

## Part 4: The Complete Lifecycle of a Session

### 4.1 Creation (Login)

```typescript
// apps/api/src/modules/auth/auth.service.ts

import { sha256 } from "../utils/crypto";

async function createSession(userId: string, req: Request): Promise<string> {
  // 1. Generate a cryptographically secure random token
  const rawRefreshToken = crypto.randomBytes(64).toString("hex");
  
  // 2. Hash it before storing (so DB breach doesn't expose usable tokens)
  const hashedToken = sha256(rawRefreshToken);

  // 3. Set expiry to 30 days from now
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // 4. Store the HASHED token in the database
  await db.session.create({
    data: {
      userId,
      refreshToken: hashedToken, // ← The hash goes to DB
      expiresAt,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    },
  });

  // 5. Return the RAW token — this is what goes into the cookie
  return rawRefreshToken;
}
```

### 4.2 Validation (Token Refresh)

```typescript
async function refreshSession(rawRefreshToken: string): Promise<string> {
  // 1. Hash the incoming token to look up in the database
  const hashedToken = sha256(rawRefreshToken);

  // 2. Find the session
  const session = await db.session.findUnique({
    where: { refreshToken: hashedToken },
    include: { user: true },
  });

  // 3. Validate all conditions
  if (!session) {
    throw new Error("Session not found"); // Token was never issued or already rotated away
  }
  if (session.isRevoked) {
    // REPLAY ATTACK: A revoked token was used.
    // The attacker has an old token. Nuke ALL sessions for this user.
    await db.session.updateMany({
      where: { userId: session.userId },
      data: { isRevoked: true },
    });
    throw new Error("Refresh token reuse detected — all sessions revoked");
  }
  if (session.expiresAt < new Date()) {
    throw new Error("Session expired");
  }

  // 4. Token Rotation: delete old session, create new one
  await db.session.delete({ where: { id: session.id } });
  const newRawToken = await createSession(session.userId, /* req */ {} as any);

  // 5. Update lastUsedAt (optional, but good for audit)
  // Already handled by the new session's createdAt

  return newRawToken;
}
```

### 4.3 Revocation (Logout / Remote Kill)

```typescript
// Logout from current device
async function logout(rawRefreshToken: string) {
  const hashedToken = sha256(rawRefreshToken);
  await db.session.deleteMany({ where: { refreshToken: hashedToken } });
  // Note: The access token will continue to work until it expires (up to 15 min).
  // This is the tradeoff of stateless access tokens.
}

// Remote logout (admin kills a specific session)
async function revokeSessionById(sessionId: string, requestingUserId: string) {
  const session = await db.session.findUnique({ where: { id: sessionId } });
  
  if (!session || session.userId !== requestingUserId) {
    throw new Error("Forbidden"); // Can only revoke your own sessions
  }

  await db.session.update({
    where: { id: sessionId },
    data: { isRevoked: true },
  });
  // Don't delete — keep the row for audit trail. The isRevoked flag is the kill switch.
}
```

---

## Part 5: "Can I Bypass the Database? What Are the Options?"

Yes, there are options. Here is the honest tradeoff table:

| Strategy | How It Works | Revocation Speed | Complexity |
|---|---|---|---|
| **Stateless Access Token** | Short-lived JWT. No DB check ever. | ❌ Can't revoke until expiry | ⭐ Simple |
| **Session Table (what we use)** | Refresh tokens stored in Postgres. Checked on each refresh. | ✅ Instant on next refresh | ⭐⭐ Moderate |
| **Token Blocklist in Redis** | Revoked JWTs added to Redis set. Checked on EVERY request. | ✅ Instant on every request | ⭐⭐⭐ Complex |
| **Short-lived + Sliding Expiry** | Access token lives 1 minute. Auto-refreshes on every request. | ✅ Near-instant | ⭐⭐⭐ Complex |

### Why We Don't Check the DB on Every Request

```
Browser ──[POST /api/dashboard]──▶  Express Server
                                     │
                                     ├── jwt.verify(token, secret)
                                     ├── Check exp claim
                         NO DB HIT ──┤
                                     └── Return data (fast! ~2ms)
```

Our Access Token is valid for only **15 minutes**. Even if someone steals it, they get at most 15 minutes of access. This is an acceptable tradeoff for eliminating a DB round-trip on every single API call.

The `Session` table is only checked when a Refresh Token is presented (every 15 minutes). This gives us revocation capability without per-request DB overhead.

---

## Part 6: When to Use Redis Instead of Postgres for Sessions

> See **B5: Redis for Auth** for the full deep-dive. Here's the summary:

- **Use Postgres (`Session` table)** when: You need audit trails, session metadata (device info), and foreign key constraints to `User`. 99% of apps.
- **Use Redis** when: You have millions of concurrent users and the Postgres `Session` table has become a write bottleneck on every token refresh.

Most apps with <100,000 users will never need Redis for session storage. The Postgres approach is correct for now.

---

## Part 7: The Access Token "Gap" Problem

One limitation of our approach: **When you call `revokeSession`, the revocation only takes effect on the next refresh attempt. The current access token remains valid until it expires.**

```
User A has stolen User B's access token (expires in 14 min)
Admin revokes User B's session in the DB

Wait 1 minute...

User A sends: GET /api/dashboard (with stolen 14-minute access token)
  ├── jwt.verify() → ✅ valid
  ├── Check exp → ✅ not expired
  └── Returns data ← Attacker still gets data for 13 more minutes!
```

**Solutions:**
1. **Shorten access token lifetime** (e.g., 5 min or even 1 min). Reduces the gap.
2. **Redis blocklist** — Add the JTI (JWT ID) to a Redis set on revocation. Check it on every request. Fully immediate revocation but adds ~1ms latency per request.
3. **Accept the tradeoff** — For most apps, 15 minutes is acceptable. Banking apps might use 5 minutes.

---

## Part 8: Housekeeping — Cleaning Up Expired Sessions

Sessions accumulate in your database. You need a cleanup job:

```typescript
// apps/api/src/jobs/cleanupSessions.ts

export async function cleanupExpiredSessions() {
  const deleted = await db.session.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },  // Hard expiry passed
        { isRevoked: true, createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } // Revoked 7+ days ago
      ]
    },
  });
  console.log(`[Cleanup] Deleted ${deleted.count} expired sessions`);
}

// Run daily with node-cron:
import cron from "node-cron";
cron.schedule("0 3 * * *", cleanupExpiredSessions); // 3 AM every day
```

---

## Part 9: Stateful vs Stateless — The Honest Summary

| | Stateless JWT (access token) | Stateful Session (refresh token) |
|---|---|---|
| DB check per request? | ❌ Never | ✅ On each refresh (every 15 min) |
| Can be revoked instantly? | ❌ No (wait for expiry) | ✅ Yes (via `isRevoked`) |
| Survives server restart? | ✅ Yes (key is the secret) | ✅ Yes (data in DB) |
| Theft consequence | Attacker has access for ≤15 min | Revoke immediately |
| Scales horizontally? | ✅ Perfectly | ✅ Yes (all servers share one DB/Redis) |

**The correct production answer is BOTH:**
- Access Token: Stateless JWT, 15 min, verified in-memory
- Refresh Token: Stateful, 30 days, stored in `Session` table, rotated on use

---

## Practice Exercises

1. **Trace a session:** Log in, then run `SELECT * FROM "Session" ORDER BY "createdAt" DESC LIMIT 5;` in your database. Identify the `refreshToken` (SHA-256 hash), the `userAgent`, and `expiresAt`.

2. **Prove the hash:** In a Node.js REPL, run `crypto.createHash('sha256').update('test-token').digest('hex')`. Then search for that hash in the `Session` table. This proves you can never reverse the stored hash.

3. **The 15-minute gap:** Log in, note your access token's `exp` claim (decode it at jwt.io). Call `DELETE /api/sessions/:id` to revoke your session. Immediately try to call `GET /api/auth/me` with your access token. You will succeed until the access token expires.

4. **Cleanup simulation:** Insert a row into `Session` with `expiresAt` set to yesterday. Run `cleanupExpiredSessions()` manually. Verify the row is gone.
