# M2: Advanced Tokens & Security (Refresh Token Rotation)

In M1, we built a working login system. But access tokens expire in 5 minutes. If a user stays on our dashboard for 6 minutes, any API request they make will return `401 Unauthorized`. 

We need a way to silently get a new access token without asking the user for their password again. This is where **Refresh Tokens** come in.

---

## 1. The Core Refresh Flow

When the frontend gets a `401 Token Expired` error, it silently makes a request to `POST /api/auth/refresh`. The browser automatically includes the `refresh_token` HTTP-only cookie.

### The Backend Logic (`auth.controller.ts` -> `auth.service.ts`)
1. Extract the refresh token from the cookie.
2. Verify its cryptographic signature (is it a valid JWT?).
3. **Database Check**: Look up the `sessionId` from the token in the `Session` table.
4. **Security Checks**:
   - Does the session exist?
   - Is `session.isRevoked` true?
   - Has the token expired in the database (`expiresAt < now`)?
   - **Crucial**: Does `session.refreshToken` match the token sent by the user? (Replay Attack Prevention)
5. Generate a NEW access token.
6. Generate a NEW refresh token.
7. Update the `Session` row in the database with the new refresh token.
8. Send both new tokens back as cookies.

---

## 2. Refresh Token Rotation (RTR)

Notice Step 6 & 7 above. We don't just issue a new access token; we issue a **new refresh token** every single time they refresh.

**Why?** If a refresh token is stolen, the attacker can use it to get access tokens forever. By rotating the refresh token on every use, we ensure a token can only be used *once*.

### Detecting Replay Attacks (The "Reuse" Scenario)
Imagine an attacker steals Alice's refresh token (Token A).
- Alice is browsing normally. Her frontend refreshes her session. She sends Token A to the server.
- The server accepts Token A, issues Token B to Alice, and saves Token B in the database.
- Now, the attacker tries to use their stolen Token A.
- The server looks at the database. The database says the current valid token is Token B. The attacker sent Token A.
- **ALERT! REUSE DETECTED!**

When the server detects that an old, already-used refresh token is being sent, it knows a token has been stolen. 

### The Nuclear Option
How do we respond to a reuse detection?
We cannot know who is the attacker and who is the legitimate user. Therefore, we drop the nuclear bomb: **We revoke ALL sessions for that user.**

```typescript
// See: apps/api/src/modules/auth/auth.service.ts -> refreshToken()
if (session.refreshToken !== oldRefreshToken) {
  // REPLAY ATTACK DETECTED!
  // Someone is trying to use an old refresh token.
  // We must assume the token was compromised.
  // NUCLEAR OPTION: Revoke ALL sessions for this user.
  await revokeAllUserSessions(session.userId);
  throw new Error("TOKEN_REUSE_DETECTED");
}
```

Both the attacker and Alice will be logged out. Alice will have to log in again with her password, but the attacker is locked out permanently.

---

## 3. Dealing with Concurrency

Refresh Token Rotation introduces a massive frontend headache: **Concurrency**.

Imagine a dashboard that makes 3 simultaneous API calls on load:
1. `GET /api/users/me`
2. `GET /api/dashboard/stats`
3. `GET /api/dashboard/notifications`

If the access token is expired, all 3 requests will fail simultaneously.
If all 3 requests independently trigger the `/api/auth/refresh` endpoint:
- Request 1 sends Token A, gets Token B.
- Request 2 sends Token A, but the DB already expects Token B!
- **FALSE ALARM REPLAY ATTACK!** Alice gets logged out just for loading her dashboard.

### The Concurrency Lock (`apps/web/src/lib/fetch.ts`)
To fix this, the frontend must intercept the 401 errors and use a **singleton lock**.

1. Request 1 gets 401. It sets `isRefreshing = true` and starts the refresh call.
2. Request 2 gets 401. It sees `isRefreshing = true`, so it waits for Request 1's refresh promise to resolve.
3. Request 3 gets 401. It also waits.
4. Request 1's refresh succeeds! It sets `isRefreshing = false`.
5. Requests 1, 2, and 3 all retry their original API calls with the new access token.

```typescript
// See: apps/web/src/lib/fetch.ts -> authFetchClient()
if (!isRefreshing) {
  isRefreshing = true;
  refreshPromise = fetch("/api/auth/refresh", ...)
}
const refreshSuccess = await refreshPromise;
if (refreshSuccess) {
  // Retry original request
}
```

---

## 4. What's Next?

We now have a bulletproof authentication engine. It handles initial logins, keeps the user logged in silently, and detects token theft via rotation.

But an Auth System isn't just about logging in. It's about knowing *what* the logged-in user is allowed to do.

Proceed to **M3: Authorization & RBAC** (Role-Based Access Control).
