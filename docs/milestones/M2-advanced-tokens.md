# M2: Advanced Tokens (Implementation Guide)

**Track:** Core Curriculum  
**Prerequisites:** M1 (MVP Auth)  
**Time:** ~3 hours  

---

## The Goal
In M1, we built the MVP where an Access Token lasts 5 minutes. If we stopped there, users would be logged out every 5 minutes. In this module, we implement **Refresh Token Rotation**, which allows users to stay logged in securely for 30 days without exposing long-lived access tokens.

This is arguably the most complex and critical part of a secure authentication system.

---

## Step 1: The Refresh Endpoint (Backend)

When the frontend gets a `401 Unauthorized` because the 5-minute Access Token expired, it silently calls `POST /api/auth/refresh`. The browser automatically attaches the `refresh_token` cookie.

### 1.1 The Controller (`auth.controller.ts`)
```typescript
export async function refresh(req, res) {
  // 1. Extract the raw token from the HttpOnly cookie
  const rawRefreshToken = req.cookies.refresh_token;
  if (!rawRefreshToken) throw new AppError("NO_REFRESH_TOKEN", 401);

  // 2. Delegate to the Service layer to rotate the token
  const result = await authService.refreshTokens(rawRefreshToken, req.ip, req.headers["user-agent"]);

  // 3. Issue the new cookies to the browser
  res.cookie("access_token", result.accessToken, getAccessTokenCookieOptions());
  res.cookie("refresh_token", result.refreshToken, getRefreshTokenCookieOptions());

  return res.json({ success: true });
}
```

### 1.2 The Service Logic & Replay Attack Detection
Now open `auth.service.ts` and trace the `refreshTokens` function.

```typescript
// STEP A: Find the active session using the hash
// We loop through sessions and use bcrypt.compare(rawToken, session.refreshToken)
const matchedSession = await findSessionByToken(rawRefreshToken);

if (!matchedSession) throw new AppError("INVALID_REFRESH_TOKEN", 401);

// STEP B: REPLAY ATTACK DETECTION (Critical Security)
// If the token matches a session, but that session is already marked "isRevoked",
// it means someone is trying to use an old token that has ALREADY been rotated.
if (matchedSession.isRevoked) {
  // 💥 SECURITY EVENT 💥
  // An attacker might have stolen the old token. We must immediately log the user
  // out of EVERY device to protect their account.
  await db.session.updateMany({
    where: { userId: matchedSession.userId },
    data: { isRevoked: true }
  });
  throw new AppError("TOKEN_REUSE_DETECTED", 401);
}

// STEP C: Rotate the Token
// Mark the current session as revoked.
await db.session.update({ where: { id: matchedSession.id }, data: { isRevoked: true } });

// Generate new tokens
const newAccessToken = signAccessToken(matchedSession.user.id, matchedSession.user.role);
const newRawRefreshToken = crypto.randomBytes(64).toString("hex");

// Create a brand new session row in the database
await createSessionInDatabase(matchedSession.user.id, newRawRefreshToken);

return { accessToken: newAccessToken, refreshToken: newRawRefreshToken };
```

---

## Step 2: The Fetch Interceptor (Frontend)

The backend is ready, but the frontend needs to handle `401` errors and call the refresh endpoint silently. We never want the user to see "Session Expired" unless the refresh token itself is expired or revoked.

Open `apps/web/src/lib/fetch-client.ts`.

### 2.1 The Race Condition
Imagine the dashboard makes 3 simultaneous API calls:
- `GET /profile`
- `GET /stats`
- `GET /notifications`

If the Access Token expired 1 second ago, ALL THREE requests will fail with a `401`. If the frontend blindly calls `/refresh` for each failure, three `/refresh` requests will hit the backend simultaneously. 
The backend will process the first one, rotate the token, and then immediately detect the second one as a **Replay Attack**, logging the user out!

### 2.2 The Concurrency Lock Implementation
We solve this using a Promise Lock outside the fetch function.

```typescript
let isRefreshing = false;
let pendingRefreshPromise: Promise<boolean> | null = null;

function refreshAccessToken(): Promise<boolean> {
  // If no refresh is happening, start one
  if (!isRefreshing) {
    isRefreshing = true;
    
    // Save the promise so concurrent calls can await it
    pendingRefreshPromise = fetch('/api/auth/refresh', { method: 'POST' })
      .then(res => res.ok)
      .finally(() => {
        isRefreshing = false;
        pendingRefreshPromise = null;
      });
  }
  
  // Return the active promise to ALL concurrent callers
  return pendingRefreshPromise!;
}
```

### 2.3 The Interceptor Wrapper
```typescript
export async function authFetchClient(url, options) {
  // 1. Make the original request
  let response = await fetch(url, options);

  // 2. If it fails with 401...
  if (response.status === 401) {
    const errorData = await response.clone().json();
    
    // Check if it's specifically an expired token
    if (errorData.error.code === "TOKEN_EXPIRED") {
      
      // 3. Await the refresh lock (whether it just started or was already running)
      const refreshed = await refreshAccessToken();
      
      // 4. If refresh succeeded, RETRY the original request!
      if (refreshed) {
        response = await fetch(url, options);
      } else {
        // Refresh failed (refresh token is dead) -> kick to login
        window.location.href = "/login?reason=session_expired";
      }
    } 
    // 5. Check if the backend detected a replay attack!
    else if (errorData.error.code === "TOKEN_REUSE_DETECTED") {
      window.location.href = "/login?reason=security_event";
    }
  }

  return response;
}
```

---

## Practice Exercises

1. **Test the Interceptor:** Change the `ACCESS_TOKEN_EXPIRY` in your `.env` to `10s`. Log in, wait 15 seconds, and navigate around the dashboard. Watch the Network tab. You should see a `401`, followed silently by a `POST /refresh`, followed by a successful retry.
2. **Break the Lock:** Temporarily remove the `if (!isRefreshing)` check in `fetch-client.ts`. Add a button to your dashboard that triggers 3 `authFetchClient` requests simultaneously. Click it after the token expires. Watch the backend logs detect a Replay Attack and log you out.
3. **Database Inspection:** Look at your database (using Prisma Studio). Observe how a new row is created and the old row is marked `isRevoked: true` every time a refresh occurs.
