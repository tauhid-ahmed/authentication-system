# B6: Multi-Client API Design — One API for Browser, Mobile & Server

**Track:** Backend Deep Dives  
**Prerequisites:** A2 (BFF Pattern), B4 (Sessions vs JWT), B5 (Redis)  
**Time:** ~2.5 hours  

---

> **The core challenge:** Your browser wants `HttpOnly` cookies. Your mobile app can't set cookies — it needs `Authorization: Bearer`. Your microservices need to call each other with service accounts. All three clients will hit the **same API**. How do you support all three without duplicating your security logic?

---

## Part 1: The Three Client Types and Their Constraints

```
┌──────────────────────────────────────────────────────────────────┐
│                         YOUR EXPRESS API                          │
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────────┐   │
│  │   Browser    │   │ Mobile App   │   │  Server-to-Server  │   │
│  │  (Next.js)   │   │  (iOS/Android│   │  (Microservices,   │   │
│  │              │   │   /RN)       │   │   Cron Jobs)       │   │
│  │              │   │              │   │                    │   │
│  │ Cookies ✅   │   │ Cookies ❌   │   │ Cookies ❌         │   │
│  │ localStorage │   │ Bearer ✅    │   │ API Key ✅         │   │
│  │ is banned ✅ │   │ Secure store │   │ Service JWT ✅     │   │
│  └──────────────┘   └──────────────┘   └────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

| Client Type | Token Storage | How Token is Sent | Refresh Strategy |
|---|---|---|---|
| Browser (SSR/SPA) | `HttpOnly` Cookie | Automatic via Cookie header | Silent background refresh |
| Mobile (iOS/Android/RN) | Secure Enclave / Keychain | `Authorization: Bearer {token}` | Explicit call to `/refresh` endpoint |
| Server-to-Server | Environment variable | `Authorization: Bearer {token}` OR `X-API-Key` | Long-lived (no refresh) |

---

## Part 2: The Universal `authenticate` Middleware

The goal is a **single middleware** that understands all three client types. It checks for a token in this order of priority:

1. Cookie (browser)
2. Authorization Bearer header (mobile / server)
3. X-API-Key header (service accounts)

```typescript
// apps/api/src/middleware/authenticate.ts
import jwt from "jsonwebtoken";
import { db } from "@repo/database";
import { isTokenBlocked } from "@repo/database/tokenBlocklist";

export interface AuthUser {
  id: string;
  role: string;
  clientType: "browser" | "mobile" | "service";
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // ─── Strategy 1: Cookie (Browser) ────────────────────────────────
  const cookieToken = req.cookies?.access_token;

  // ─── Strategy 2: Bearer Token (Mobile / External Server) ─────────
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  // ─── Strategy 3: API Key (Service Accounts) ───────────────────────
  const apiKey = req.headers["x-api-key"] as string | undefined;

  // ─── Resolution ───────────────────────────────────────────────────
  if (cookieToken) {
    return verifyJWT(cookieToken, "browser", req, res, next);
  }

  if (bearerToken) {
    return verifyJWT(bearerToken, "mobile", req, res, next);
  }

  if (apiKey) {
    return verifyApiKey(apiKey, req, res, next);
  }

  return res.status(401).json({ error: "Authentication required" });
}

// ── JWT Verification (shared for both browser and mobile) ─────────
async function verifyJWT(
  token: string,
  clientType: "browser" | "mobile",
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;

    // Check token blocklist (only if using Redis — see B5)
    if (payload.jti && await isTokenBlocked(payload.jti)) {
      return res.status(401).json({ error: "Token has been revoked" });
    }

    (req as any).user = {
      id: payload.sub,
      role: payload.role,
      clientType,
    } satisfies AuthUser;

    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired", code: "TOKEN_EXPIRED" });
    }
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ── API Key Verification (service accounts) ───────────────────────
async function verifyApiKey(
  apiKey: string,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Lookup the API key in the database
  const serviceAccount = await db.apiKey.findUnique({
    where: { key: apiKey, isActive: true },
  });

  if (!serviceAccount) {
    return res.status(401).json({ error: "Invalid API key" });
  }

  // Update last-used timestamp (async, don't await)
  db.apiKey.update({
    where: { id: serviceAccount.id },
    data: { lastUsedAt: new Date() },
  }).catch(console.error);

  (req as any).user = {
    id: serviceAccount.serviceId,
    role: serviceAccount.role, // e.g., "SERVICE" or "ADMIN"
    clientType: "service",
  } satisfies AuthUser;

  next();
}
```

---

## Part 3: The Prisma Schema for Multi-Client Support

```prisma
model Session {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  refreshToken String   @unique
  isRevoked    Boolean  @default(false)
  expiresAt    DateTime
  
  // Which type of client created this session?
  clientType   ClientType @default(BROWSER)
  
  // Device info (browser & mobile)
  ipAddress    String?
  userAgent    String?
  deviceName   String?   // e.g., "John's iPhone 15" (set by mobile app)
  
  createdAt    DateTime @default(now())
  lastUsedAt   DateTime @default(now())

  @@index([userId])
}

enum ClientType {
  BROWSER
  MOBILE
  DESKTOP
}

// Service accounts for server-to-server calls
model ApiKey {
  id          String   @id @default(cuid())
  key         String   @unique  // The actual key (stored in env var of the caller)
  name        String            // "Cron Job Service", "Email Worker", etc.
  serviceId   String            // Which service this belongs to
  role        String   @default("SERVICE")
  isActive    Boolean  @default(true)
  scopes      String[] // e.g., ["read:users", "write:notifications"]
  expiresAt   DateTime?         // Optional: API keys can expire
  lastUsedAt  DateTime?
  createdAt   DateTime @default(now())
  
  @@index([key])
}
```

---

## Part 4: Client-Specific Token Refresh Flows

The refresh flow is different for each client type.

### 4.1 Browser Refresh (Silent, Cookie-Based)

The browser sends cookies automatically. The refresh endpoint reads from the cookie and writes back to a cookie. No client-side token handling needed.

```typescript
// apps/api/src/modules/auth/auth.controller.ts

export async function refreshToken(req: Request, res: Response) {
  // Read from cookie (browser client)
  const rawRefreshToken = req.cookies?.refresh_token;
  
  // Read from body (mobile client — see 4.2)
  const mobileRefreshToken = req.body?.refresh_token;
  
  const token = rawRefreshToken || mobileRefreshToken;
  
  if (!token) {
    return res.status(401).json({ error: "No refresh token provided" });
  }

  const { newAccessToken, newRefreshToken, isMobileClient } = 
    await authService.rotateSession(token, !!mobileRefreshToken);

  if (isMobileClient) {
    // Mobile: return tokens in JSON body
    return res.json({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_in: 900, // 15 minutes in seconds
    });
  }

  // Browser: set cookies
  res.cookie("access_token", newAccessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  res.cookie("refresh_token", newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/refresh", // Only sent to this specific path!
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });

  return res.json({ success: true });
}
```

### 4.2 Mobile Refresh (Explicit, JSON Body)

Mobile apps (iOS, Android, React Native) must explicitly send the refresh token in the request body and store the returned tokens securely.

**iOS/React Native example:**
```typescript
// Mobile app (React Native) — apps/mobile/src/services/authService.ts

import * as SecureStore from "expo-secure-store"; // iOS Keychain / Android Keystore

async function refreshTokens(): Promise<boolean> {
  const refreshToken = await SecureStore.getItemAsync("refresh_token");
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      // Refresh token is invalid/expired — force logout
      await SecureStore.deleteItemAsync("refresh_token");
      await SecureStore.deleteItemAsync("access_token");
      return false;
    }

    const { access_token, refresh_token: newRefreshToken } = await response.json();
    
    // Store new tokens securely (iOS Keychain / Android Keystore)
    await SecureStore.setItemAsync("access_token", access_token);
    await SecureStore.setItemAsync("refresh_token", newRefreshToken);

    return true;
  } catch {
    return false;
  }
}

// Interceptor: auto-refresh on 401
async function apiFetch(url: string, options: RequestInit = {}) {
  const accessToken = await SecureStore.getItemAsync("access_token");

  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (response.status === 401) {
    // Try to refresh
    const refreshed = await refreshTokens();
    if (!refreshed) {
      // Emit logout event for the app to handle
      throw new Error("SESSION_EXPIRED");
    }
    // Retry the original request with the new token
    return apiFetch(url, options);
  }

  return response;
}
```

---

## Part 5: Scoped API Keys for Service Accounts

Not all services should have equal access. A cron job that sends welcome emails should NOT be able to delete users.

### 5.1 The Scope System

```typescript
// apps/api/src/types/scopes.ts

export const API_SCOPES = {
  // Read scopes
  "read:users": "Read user profiles",
  "read:sessions": "Read session data",
  
  // Write scopes
  "write:notifications": "Send notifications to users",
  "write:emails": "Trigger email sends",
  
  // Admin scopes
  "admin:users": "Create, update, delete users",
  "admin:sessions": "Revoke any session",
} as const;

export type ApiScope = keyof typeof API_SCOPES;
```

### 5.2 Scope-Checking Middleware

```typescript
// apps/api/src/middleware/requireScope.ts

export function requireScope(...requiredScopes: ApiScope[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as AuthUser;

    // Only service accounts have scopes — human users use roles
    if (user.clientType !== "service") {
      return next(); // Let the role-based middleware handle it
    }

    const serviceScopes: ApiScope[] = (req as any).serviceScopes || [];
    const hasAllScopes = requiredScopes.every((s) => serviceScopes.includes(s));

    if (!hasAllScopes) {
      return res.status(403).json({
        error: "Insufficient scope",
        required: requiredScopes,
      });
    }

    next();
  };
}
```

### 5.3 Using Scopes in Routes

```typescript
// apps/api/src/routes/users.ts

router.get(
  "/api/users",
  authenticate,          // Accepts cookies, Bearer, OR API key
  requireScope("read:users"),  // Service accounts need this scope
  requireRole("ADMIN"),        // Human users need ADMIN role
  usersController.list
);

router.post(
  "/api/notifications/send",
  authenticate,
  requireScope("write:notifications"),
  notificationsController.send
);
```

---

## Part 6: CORS Configuration for Multi-Client

Browser clients need CORS. Mobile and server clients do NOT (they call the API directly). Your CORS config must know which clients to allow.

```typescript
// apps/api/src/middleware/cors.ts
import cors from "cors";

const ALLOWED_ORIGINS = [
  "http://localhost:3000",                    // Next.js dev
  "https://yourdomain.com",                   // Production web app
  "https://www.yourdomain.com",               // Production web app (www)
  // Note: Mobile apps are NOT listed here — they don't need CORS
];

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, server-to-server)
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    }
  },
  credentials: true,     // Allow cookies to be sent
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-API-Key",         // ← Allow our service account header
    "X-Refresh-Token",   // ← Allow mobile refresh token header (alternative)
  ],
});
```

---

## Part 7: The Full Request Journey by Client Type

### Browser Request (Cookie Path)

```
Next.js Browser
  │
  ├── 1. User loads /dashboard
  ├── 2. Next.js middleware checks for cookie cookie — cookie exists ✅
  ├── 3. Next.js Server Component calls authFetchServer()
  ├── 4. authFetchServer forwards cookie header to Express
  ├── 5. Express `authenticate` reads cookie, verifies JWT
  ├── 6. Returns protected data
  └── 7. Server Component renders the page with real data
```

### Mobile Request (Bearer Path)

```
React Native App
  │
  ├── 1. App loads, reads access_token from SecureStore
  ├── 2. Calls apiFetch("/api/dashboard")
  ├── 3. apiFetch adds "Authorization: Bearer {token}" header
  ├── 4. Express `authenticate` reads Bearer header, verifies JWT
  ├── 5. Returns data as JSON
  ├── 6. IF 401: calls refreshTokens(), retries once
  └── 7. IF refresh fails: emits SESSION_EXPIRED event → logout screen
```

### Service Account Request (API Key Path)

```
Email Cron Job (Node.js server)
  │
  ├── 1. Has API_KEY in environment variable
  ├── 2. Calls fetch("/api/notifications/send", { headers: { "X-API-Key": API_KEY }})
  ├── 3. Express `authenticate` reads X-API-Key header
  ├── 4. Looks up ApiKey in Postgres, checks isActive + scopes
  ├── 5. Returns service account user object to req.user
  ├── 6. requireScope("write:notifications") passes ✅
  └── 7. Controller sends the notification
```

---

## Part 8: Generating and Managing API Keys

```typescript
// apps/api/src/modules/admin/apiKeys.controller.ts

export async function createApiKey(req: Request, res: Response) {
  const { name, serviceId, scopes, expiresAt } = req.body;

  // Generate a secure, unguessable API key
  const rawKey = `sk_${process.env.NODE_ENV === "production" ? "prod" : "test"}_${
    crypto.randomBytes(32).toString("hex")
  }`;

  // Store it — unlike refresh tokens, API keys are stored in PLAIN TEXT
  // (they're long enough to be unguessable, and you need to be able to display
  // them to the admin. Unlike passwords, they're not user-provided)
  const apiKey = await db.apiKey.create({
    data: {
      key: rawKey,
      name,
      serviceId,
      scopes,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  // IMPORTANT: Show the key ONCE. After this, it cannot be retrieved.
  return res.status(201).json({
    id: apiKey.id,
    key: rawKey, // ← ONLY returned on creation
    name: apiKey.name,
    scopes: apiKey.scopes,
    message: "Store this key securely. It will not be shown again.",
  });
}
```

---

## Practice Exercises

1. **Test all three clients with curl:**
   ```bash
   # Browser simulation (cookie)
   curl -X GET http://localhost:4000/api/auth/me \
     --cookie "access_token=YOUR_TOKEN"
   
   # Mobile simulation (Bearer)
   curl -X GET http://localhost:4000/api/auth/me \
     -H "Authorization: Bearer YOUR_TOKEN"
   
   # Service simulation (API Key)
   curl -X GET http://localhost:4000/api/auth/me \
     -H "X-API-Key: YOUR_API_KEY"
   ```

2. **Break CORS:** Open your browser console and try `fetch("http://localhost:4000/api/auth/me", { credentials: "include" })` from a page NOT in `ALLOWED_ORIGINS`. Watch the CORS error. Then add that origin to the list and try again.

3. **Scope Enforcement:** Create an API key with only `read:users` scope. Try to call a route that requires `write:notifications`. Verify you get `403 Insufficient scope`. Then add the scope and retry.

4. **Mobile Refresh Flow:** Simulate token expiry: set `expiresIn: "1s"` in `signAccessToken`. Watch `apiFetch` automatically retry after refreshing.
