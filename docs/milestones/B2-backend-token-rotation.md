# B2: Refresh Token Rotation — The Complete Backend Implementation

**Track:** Backend Deep Dive  
**Prerequisites:** B1 (JWT Lifecycle), M1 (MVP Auth)  
**Time:** ~4 hours  

---

## Why Refresh Tokens Exist

Access tokens are stateless and cannot be revoked. If we make them long-lived (hours or days), a stolen token is catastrophic — the attacker has unrestricted access until the token naturally expires, and there is nothing you can do to stop it.

The solution is to make access tokens **very short-lived (5 minutes)** and introduce a second token — the **refresh token** — whose only job is to issue new access tokens.

| Property | Access Token | Refresh Token |
|----------|-------------|---------------|
| Lifespan | 5 minutes | 30 days |
| Storage (server) | None (stateless JWT) | Database row |
| Browser transport | HttpOnly cookie | HttpOnly cookie |
| Native transport | `Authorization: Bearer` | JSON body or `X-Refresh-Token` |
| Purpose | Authenticate every API request | Get a new access token |
| Can be revoked? | No (expires naturally) | Yes (delete the DB row) |
| Sent to | Every API endpoint | Only `/api/auth/refresh` |

---

## 1. The Refresh Token Database Schema

```prisma
// prisma/schema.prisma

model Session {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // The refresh token is stored HASHED (like a password).
  // Why? If your database is breached, raw tokens cannot be used by the attacker.
  refreshToken String   @unique

  // Device metadata — useful for "active sessions" UI
  deviceInfo   String?  // "Chrome on macOS"
  ipAddress    String?
  userAgent    String?

  isRevoked    Boolean  @default(false)
  expiresAt    DateTime // 30 days from creation
  createdAt    DateTime @default(now())
  lastUsedAt   DateTime @default(now())
}
```

The `refreshToken` field stores a **hashed** value. The actual raw token only leaves the backend through a secure client transport: an `HttpOnly` cookie for browsers, or the response body for native clients that explicitly request it. This follows the same principle as password storage: we store a hash, never the plaintext.

---

## 2. Creating a Session at Login

```typescript
// apps/api/src/modules/auth/auth.service.ts (login flow)

async function login(email: string, password: string, req: Request) {
  // 1. Find the user
  const user = await userRepository.findByEmail(email);
  if (!user || !user.passwordHash) {
    throw new AppError("INVALID_CREDENTIALS", 401);
  }

  // 2. Verify password
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    // SECURITY: Same error for wrong email AND wrong password.
    // This prevents "user enumeration" attacks where an attacker
    // can determine if an email is registered by the error message.
    throw new AppError("INVALID_CREDENTIALS", 401);
  }

  // 3. Generate token pair
  const accessToken = signAccessToken(user.id, user.role);
  
  // Generate a cryptographically random refresh token (not a JWT)
  // Why not a JWT? Because we need to store and revoke it. A random
  // string is simpler and the database IS the state.
  const rawRefreshToken = crypto.randomBytes(64).toString("hex");
  
  // 4. Hash the refresh token before storing
  const hashedRefreshToken = await bcrypt.hash(rawRefreshToken, 10);

  // 5. Create a session in the database
  await sessionsRepository.create({
    userId: user.id,
    refreshToken: hashedRefreshToken,
    deviceInfo: parseDeviceInfo(req.headers["user-agent"]),
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  });

  return { accessToken, refreshToken: rawRefreshToken, user };
}
```

**Why random bytes instead of a JWT for the refresh token?**

A JWT refresh token is stateless — you cannot revoke it before it expires. A random string requires a database lookup, but that's exactly what we want: the database IS the revocation mechanism. If we delete the row, the token is immediately invalid.

---

## 3. The Token Rotation Algorithm

**Token rotation** means: every time you use a refresh token, you invalidate the old one and issue a brand new one. This creates a crucial security property: **a refresh token can only be used once.**

```typescript
// apps/api/src/modules/auth/auth.service.ts (refresh flow)

async function refreshTokens(rawRefreshToken: string, req: Request) {
  // ============================================================
  // STEP 1: Find ALL sessions for this token (search by hash)
  // ============================================================
  // We can't query by hash directly (different salt each time with bcrypt).
  // So we find candidate sessions and compare individually.
  // In production, consider using a faster hash like SHA-256 for lookup
  // and bcrypt only for the stored value.
  
  const activeSessions = await db.session.findMany({
    where: { isRevoked: false, expiresAt: { gt: new Date() } },
    include: { user: true },
  });

  let matchedSession = null;
  for (const session of activeSessions) {
    const matches = await bcrypt.compare(rawRefreshToken, session.refreshToken);
    if (matches) {
      matchedSession = session;
      break;
    }
  }

  // ============================================================
  // STEP 2: Token not found — could be expired, revoked, or fake
  // ============================================================
  if (!matchedSession) {
    throw new AppError("INVALID_REFRESH_TOKEN", 401);
  }

  // ============================================================
  // STEP 3: REPLAY ATTACK DETECTION
  //
  // If the token we received is ALREADY REVOKED, it means:
  //   - Option A: The user had an old cookie (browser bug, unlikely)
  //   - Option B: An attacker stole the old token and is trying to use it
  //               after the legitimate user already rotated it
  //
  // The correct response to a revoked token being replayed is to
  // REVOKE THE ENTIRE SESSION FAMILY — log the user out everywhere.
  // This is the nuclear option, but it's the only safe response.
  // ============================================================
  if (matchedSession.isRevoked) {
    // Revoke ALL sessions for this user (log out all devices)
    await db.session.updateMany({
      where: { userId: matchedSession.userId },
      data: { isRevoked: true },
    });
    
    // Log this as a security event
    await auditService.log({
      event: "TOKEN_REUSE_DETECTED",
      userId: matchedSession.userId,
      metadata: { sessionId: matchedSession.id, ipAddress: req.ip },
    });

    throw new AppError("TOKEN_REUSE_DETECTED", 401);
  }

  // ============================================================
  // STEP 4: Rotate — invalidate old, issue new
  // ============================================================
  
  // Mark the OLD token as revoked
  await db.session.update({
    where: { id: matchedSession.id },
    data: { isRevoked: true },
  });

  // Generate new token pair
  const newAccessToken = signAccessToken(matchedSession.user.id, matchedSession.user.role);
  const newRawRefreshToken = crypto.randomBytes(64).toString("hex");
  const newHashedRefreshToken = await bcrypt.hash(newRawRefreshToken, 10);

  // Create a NEW session (with a new ID)
  await db.session.create({
    data: {
      userId: matchedSession.user.id,
      refreshToken: newHashedRefreshToken,
      deviceInfo: matchedSession.deviceInfo, // Carry over device info
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRawRefreshToken,
    user: matchedSession.user,
  };
}
```

---

## 4. Visualizing the Attack This Prevents

### Normal Flow (No Attack)

```
Time 0:  User logs in → gets AT1 (5m), RT1 (30d)
Time 5:  AT1 expires. Frontend sends RT1 → gets AT2, RT2. RT1 is now REVOKED.
Time 10: AT2 expires. Frontend sends RT2 → gets AT3, RT3. RT2 is now REVOKED.
```

### Attacker Steals RT1

```
Time 0:  User logs in → gets AT1, RT1
Time 3:  Attacker intercepts RT1 (e.g., via network sniff on HTTP)
Time 5:  Legitimate user rotates: sends RT1 → gets AT2, RT2. RT1 is REVOKED.
Time 6:  Attacker tries to use RT1:
         → Server finds RT1 in DB: isRevoked = true
         → SERVER DETECTS REPLAY ATTACK
         → ALL sessions for this user are revoked
         → Legitimate user is also logged out (security takes priority)
         → Security event is logged
```

The legitimate user gets logged out, but the attacker cannot continue. The user will notice they were logged out and can investigate. **This is the correct tradeoff: security over convenience.**

---

## 5. The Refresh Endpoint

```typescript
// apps/api/src/modules/auth/auth.routes.ts

router.post(
  "/refresh",
  refreshRateLimiter, // Max 20 requests per 15 minutes
  async (req, res, next) => {
    try {
      const rawRefreshToken =
        req.cookies.refresh_token ??
        req.body.refreshToken ??
        req.header("X-Refresh-Token");
      
      if (!rawRefreshToken) {
        return res.status(401).json({ error: { code: "NO_REFRESH_TOKEN" } });
      }

      const result = await authService.refreshTokens(rawRefreshToken, req);

      // Set new cookies for browser clients (same options as login)
      const isProduction = env.NODE_ENV === "production";
      res.cookie("access_token", result.accessToken, getAccessTokenCookieOptions(isProduction));
      res.cookie("refresh_token", result.refreshToken, getRefreshTokenCookieOptions(isProduction));

      const wantsBodyTokens = req.header("X-Auth-Token-Transport") === "body";

      return res.json({
        success: true,
        data: wantsBodyTokens
          ? { tokens: result }
          : { message: "Tokens refreshed." },
      });
    } catch (error) {
      next(error);
    }
  }
);
```

**Why does this endpoint return `{ success: true }` instead of the tokens?**

The tokens are sent as `Set-Cookie` headers, not in the response body. This keeps them in HttpOnly cookies. The frontend does not need to handle the token values — the browser handles them automatically.

---

## 6. Logout — Proper Token Invalidation

```typescript
// apps/api/src/modules/auth/auth.routes.ts

router.post("/logout", authenticate, async (req, res, next) => {
  try {
    const rawRefreshToken =
      req.cookies.refresh_token ??
      req.body.refreshToken ??
      req.header("X-Refresh-Token");
    
    if (rawRefreshToken) {
      // Find and revoke the session in the database
      const sessions = await db.session.findMany({
        where: { userId: req.user.id, isRevoked: false }
      });
      
      for (const session of sessions) {
        const matches = await bcrypt.compare(rawRefreshToken, session.refreshToken);
        if (matches) {
          await db.session.update({
            where: { id: session.id },
            data: { isRevoked: true }
          });
          break;
        }
      }
    }

    // Clear cookies from browser clients
    res.clearCookie("access_token");
    res.clearCookie("refresh_token");

    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
```

**Two things happen on logout:**
1. The session row is marked `isRevoked: true` in the database (server-side)
2. Browser cookies are cleared when present (client-side)

Both are needed. Just clearing the cookie is not enough — the token is still valid in the database until it expires. Just revoking in the database is not enough — the browser would still send the cookie until it naturally expires.

---

## 7. Performance Considerations

The bcrypt comparison in the refresh flow is slow by design (it's a slow hash, that's the point). For high-traffic APIs:

### Option A: Faster hash for lookup
Use SHA-256 for the stored value (fast, not reversible, good enough for a random token that's only stored once):

```typescript
import { createHash } from "crypto";

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
```

Then you can do: `db.session.findUnique({ where: { refreshToken: hashRefreshToken(rawToken) } })`

### Option B: Add a "family ID" to each token
Store a `familyId` in the token itself (encrypted), so you can find the session family without iterating all sessions.

### Our codebase uses bcrypt for learning clarity.
In production, Option A (SHA-256) is preferred.

---

## Practice Exercises

1. **Find the replay attack code.** Open `apps/api/src/modules/sessions/sessions.service.ts`. Find where `isRevoked` is checked. Add a comment explaining what would happen without this check.

2. **Test token rotation.** Log in, then open the Network tab in DevTools. Navigate to a page that makes an API call. After the access token expires (set it to 10s in `.env`), observe the automatic `/api/auth/refresh` call in the network tab.

3. **Test replay detection.** This is advanced — but try: log in on two browser tabs, copy the `refresh_token` cookie value from tab 1, use tab 1 to navigate (this will rotate the token), then manually craft a request with the OLD refresh token using `curl` or Postman. What error do you get?

4. **Implement "logout from all devices".** Find the `logoutAll` endpoint and read how it differs from regular logout. When would a user want this?
