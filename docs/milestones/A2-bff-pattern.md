# A2: The Backend For Frontend (BFF) Pattern — Deep Dive

**Track:** Architecture Deep Dive  
**Prerequisites:** M4 (Next.js Integration), M5 (OAuth), A1 (OAuth Patterns)  
**Time:** ~2.5 hours  

---

## The Problem BFF Solves

Imagine you have a growing product. You started with a single Next.js frontend and a single Express API. As the product grows, the backend is split into **microservices**:

```ascii
[Next.js Web App]
      │
      ├── GET /api/users/me     → User Service
      ├── GET /api/orders       → Order Service
      ├── GET /api/notifications → Notification Service
      └── POST /api/payments    → Payment Service
```

Now every microservice needs to:
- Parse `HttpOnly` cookies
- Validate JWTs
- Handle CORS for the web origin
- Understand the refresh token rotation protocol
- Return data in the exact format the Next.js frontend expects

This is **wrong**. Microservices should be dumb data engines. They should not care about web sessions, browsers, or cookie formats. This complexity belongs in one place.

**The BFF pattern puts a single Node.js server between the browser and all microservices.** The browser only ever talks to the BFF. The BFF translates the browser's session-based requests into stateless Bearer token calls to each microservice.

---

## The Full Architecture

```ascii
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                 │
│                    HttpOnly Cookie vault                        │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS + Cookie
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BFF (API Gateway / Node.js)                   │
│                                                                 │
│  1. Receives cookie from browser                                │
│  2. Verifies JWT (or refreshes it if expired)                   │
│  3. Extracts userId and role from JWT payload                   │
│  4. Forwards request → Microservice with Authorization header   │
│  5. Returns response to browser                                 │
└──────┬──────────────────────────┬──────────────────────────────┘
       │                          │
       │ Bearer <jwt>             │ Bearer <jwt>
       ▼                          ▼
┌─────────────┐          ┌──────────────────┐
│ User Service│          │  Order Service   │  ...more services
│  :4001      │          │  :4002           │
│             │          │                  │
│ Validates   │          │ Validates        │
│ Bearer JWT  │          │ Bearer JWT       │
│ No cookies! │          │ No cookies!      │
└─────────────┘          └──────────────────┘
```

---

## Responsibilities Split

| Responsibility | BFF | Microservices |
|---|---|---|
| Cookie parsing | ✅ Yes | ❌ Never |
| JWT verification | ✅ Yes (for auth) | ✅ Yes (simple verify) |
| Token refresh | ✅ Yes | ❌ Never |
| CORS for browser | ✅ Yes | ❌ Never |
| Session management | ✅ Yes | ❌ Never |
| Business logic | ❌ No | ✅ Yes |
| Database access | ❌ Rarely (auth only) | ✅ Yes |

---

## Step 1: Building the BFF in Node.js/Express

The BFF is a thin proxy layer. It receives a request with a cookie, verifies the JWT, and forwards to the correct microservice.

Open `apps/bff/src/middleware/forwardAuth.ts`.

```typescript
import jwt from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import { refreshAccessToken } from "../utils/refresh";

export async function forwardAuth(req: Request, res: Response, next: NextFunction) {
  const accessToken = req.cookies.access_token;
  
  // If no access token, check if we can refresh
  if (!accessToken) {
    const refreshToken = req.cookies.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }

    // Try to silently refresh
    const newTokens = await refreshAccessToken(refreshToken);
    if (!newTokens) {
      return res.status(401).json({ error: "SESSION_EXPIRED" });
    }

    // Set new cookies
    res.cookie("access_token", newTokens.accessToken, getAccessTokenCookieOptions());
    res.cookie("refresh_token", newTokens.refreshToken, getRefreshTokenCookieOptions());
    
    // Attach the decoded payload for downstream use
    req.user = jwt.decode(newTokens.accessToken) as JwtPayload;
    return next();
  }

  try {
    // Verify the JWT
    const payload = jwt.verify(accessToken, process.env.JWT_SECRET!) as JwtPayload;
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "INVALID_TOKEN" });
  }
}
```

---

## Step 2: The Proxy Middleware (Forwarding to Microservices)

Now we create a proxy route that forwards the request to the correct microservice with a `Bearer` token instead of a cookie.

```typescript
// apps/bff/src/routes/users.routes.ts

import { createProxyMiddleware } from "http-proxy-middleware";
import { forwardAuth } from "../middleware/forwardAuth";

// All routes under /api/users/* require authentication
// and are proxied to the User microservice at :4001

router.use(
  "/api/users",
  forwardAuth, // 1. Validate the cookie
  (req, res, next) => {
    // 2. Extract the JWT from the cookie and convert to Bearer
    const accessToken = req.cookies.access_token;
    req.headers.authorization = `Bearer ${accessToken}`;
    
    // 3. Remove the cookie header (microservices don't need it)
    delete req.headers.cookie;
    
    next();
  },
  createProxyMiddleware({
    target: process.env.USER_SERVICE_URL, // "http://user-service:4001"
    changeOrigin: true,
    // Strip /api prefix if microservice doesn't expect it
    pathRewrite: { "^/api/users": "/users" },
  })
);
```

---

## Step 3: The Auth Microservice

Authentication (login, signup, refresh) is itself a microservice. The BFF proxies auth calls too, but the auth service is special: it's the one that **creates** the cookies.

```ascii
Browser → POST /api/auth/login → BFF → Auth Service :4000
                                            │
                                            └── Sets HttpOnly cookies via BFF response
                                            └── Returns {user}
```

The key trick: the BFF forwards the `Set-Cookie` headers from the Auth Service response directly to the browser.

```typescript
// BFF: apps/bff/src/routes/auth.routes.ts

router.use(
  "/api/auth",
  createProxyMiddleware({
    target: process.env.AUTH_SERVICE_URL, // "http://auth-service:4000"
    changeOrigin: true,
    
    // When the Auth Service responds, the BFF relays the Set-Cookie headers
    // directly to the browser. The BFF never stores the token.
    on: {
      proxyRes: (proxyRes, req, res) => {
        // Allow Set-Cookie headers to pass through
        const setCookieHeaders = proxyRes.headers["set-cookie"];
        if (setCookieHeaders) {
          res.setHeader("Set-Cookie", setCookieHeaders);
        }
      },
    },
  })
);
```

---

## Step 4: The Microservices (Stateless JWT Verification)

Each microservice only needs to verify the Bearer token. It has **zero knowledge** of cookies, sessions, or refresh tokens.

```typescript
// apps/user-service/src/middleware/authenticate.ts

import jwt from "jsonwebtoken";

export function authenticate(req, res, next) {
  // Microservices expect ONLY the Authorization: Bearer header
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }

  const token = authHeader.split(" ")[1];
  
  // Verify using the shared public key or shared secret
  // In a real setup, use RS256 with public keys distributed to each service
  const payload = jwt.verify(token, process.env.JWT_SECRET!);
  req.user = payload;
  next();
}
```

> [!TIP]
> In a real enterprise setup, use **RS256 asymmetric signing**. The Auth Service holds the **private key** to sign tokens. Every microservice only gets the **public key** to verify them. This means if a microservice is compromised, the attacker cannot forge new tokens — they only have the public key.

---

## Step 5: The BFF and Next.js Together

Our learning system uses Next.js for the frontend and the Express API acts as a BFF hybrid. As the system scales, you can extract:

```
Current: [Browser] → [Next.js] → [Express API - acts as BFF + business logic]

Future:  [Browser] → [Next.js] → [BFF] → [Auth Service]
                                        → [User Service]
                                        → [Order Service]
```

The beauty: **the frontend code barely changes**. The Next.js `authFetchServer` and `authFetchClient` utilities still point to the same BFF URL. Only the BFF's internal routing changes.

---

## When NOT to Use a BFF

The BFF pattern adds operational complexity:
- You now deploy and maintain an extra service
- You need to handle partial failures (User Service is down, but Order Service is up)
- You need distributed tracing to debug requests across services

**Use a BFF when:**
- You have 3+ independent microservices
- You have multiple frontend clients (web, mobile, tablet) each needing different data shapes
- You want to centralize auth, rate limiting, and logging in one place

**Don't use a BFF when:**
- You have a simple monolith
- You have a single frontend
- You're a startup moving fast (monolith first, BFF later)

---

## Practice Exercises

1. **Trace a Request:** Draw on paper how a `GET /api/orders` request flows from the browser through the BFF to the Order Service and back. Include: cookies, Bearer tokens, and response data.
2. **Identify the Seam:** Look at `apps/api/src/server.ts`. Where would you draw the line between "BFF responsibilities" and "Business Logic responsibilities" if you were splitting the monolith?
3. **RS256 Setup:** Research how to generate an RSA key pair using Node.js `crypto.generateKeyPairSync("rsa", { modulusLength: 2048 })`. How would the Auth Service use the private key and the User Service use the public key for JWT verification?
4. **Multi-Client BFF:** A mobile app needs a different response format than the web app for the `/users/me` endpoint. How would you handle this in a BFF? (Hint: look up "Client-specific BFF")
