# B3: CORS — Complete Configuration Guide

**Track:** Backend Deep Dive  
**Prerequisites:** M1 (MVP Auth), M4 (Next.js Integration)  
**Time:** ~1 hour  

---

> **Multi-client note:** CORS is only enforced by browsers. Mobile apps,
> desktop apps, Postman, curl, and backend SDKs still authenticate with the
> same API, but they are not protected or blocked by CORS. See
> [`docs/multi-client-api.md`](../multi-client-api.md).

## What is CORS and Why Does it Exist?

**CORS (Cross-Origin Resource Sharing)** is a browser security mechanism that blocks JavaScript from making HTTP requests to a different origin than the one the page was loaded from.

An **origin** is the combination of: `protocol + domain + port`
- `http://localhost:3000` ← your Next.js frontend
- `http://localhost:5000` ← your Express API

These are **two different origins**. By default, a browser will block JavaScript running on `localhost:3000` from making `fetch()` calls to `localhost:5000`. This is called the **Same-Origin Policy**.

CORS is the mechanism that allows your API to *selectively* tell the browser: "Yes, `localhost:3000` is allowed to talk to me."

> [!WARNING]
> **CORS is a BROWSER security feature.** It does NOT protect your API from server-to-server requests, Postman, or `curl`. An attacker can bypass CORS entirely by not using a browser. Your real security comes from authentication (JWTs, cookies) — CORS is only UX safety.

---

## The CORS Handshake: Preflight Requests

For requests that could have side effects (POST, PUT, DELETE, or requests with custom headers), the browser sends a **preflight** `OPTIONS` request first.

```http
OPTIONS /api/auth/login HTTP/1.1
Origin: http://localhost:3000
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Content-Type
```

Your API must respond:
```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: POST, GET, OPTIONS
Access-Control-Allow-Headers: Content-Type
Access-Control-Allow-Credentials: true
```

Only after a successful preflight will the browser make the actual request.

---

## Step 1: Configuring CORS in Express

Open `apps/api/src/server.ts`.

```typescript
import cors from "cors";

const ALLOWED_ORIGINS = [
  "http://localhost:3000",      // Local development
  "https://yourdomain.com",     // Production frontend
  "https://www.yourdomain.com", // Production with www
];

app.use(cors({
  // 1. Only allow these specific origins
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, mobile apps)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin ${origin} is not allowed`));
    }
  },

  // 2. CRITICAL for HttpOnly cookies!
  // Without this, the browser will NOT send cookies cross-origin.
  credentials: true,

  // 3. Allowed HTTP methods
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

  // 4. Allowed custom headers the client can send
  allowedHeaders: ["Content-Type", "Authorization"],

  // 5. Headers the browser is allowed to READ from the response
  exposedHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],

  // 6. Cache the preflight response for 10 minutes
  maxAge: 600,
}));
```

---

## Step 2: The `credentials: true` Rule (Absolutely Critical)

When you use `HttpOnly` cookies, **you must set `credentials: true` on BOTH sides**:

### Backend (Express CORS)
```typescript
app.use(cors({ credentials: true, origin: "http://localhost:3000" }));
```

### Frontend (fetch calls)
```typescript
fetch("http://localhost:5000/api/auth/me", {
  credentials: "include", // 👈 Without this, cookies are not sent!
});
```

If you forget `credentials: "include"` on even ONE fetch call, that specific request will fail with a `401` because the browser won't attach the cookie.

> [!CAUTION]
> You **cannot** combine `credentials: true` with `origin: "*"` (wildcard). The browser rejects this combination for security reasons. You must specify explicit allowed origins.

---

## Step 3: Why `origin: "*"` is Dangerous

```typescript
// ❌ NEVER DO THIS when using cookies or authorization headers
app.use(cors({ origin: "*" }));
```

If you use `*`, any website in the world can make authenticated requests to your API using your users' cookies. This enables **Cross-Site Request Forgery (CSRF)** attacks.

**The correct approach:** List every frontend origin explicitly.

---

## Step 4: Environment-Based Origin Configuration

In production, your origins change. Use environment variables.

```typescript
// apps/api/src/config/env.ts
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com,https://www.yourdomain.com

// apps/api/src/server.ts
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") ?? [];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));
```

---

## Step 5: CORS in Next.js (API Routes vs App Router)

Our architecture uses Next.js only for the frontend, with Express as the API. But if you were to add Next.js API routes (e.g., for webhooks), CORS applies there too.

```typescript
// apps/web/src/app/api/webhook/route.ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  return NextResponse.json({ received: true }, {
    headers: {
      "Access-Control-Allow-Origin": "https://stripe.com",
      "Access-Control-Allow-Methods": "POST",
    }
  });
}
```

---

## Practice Exercises

1. **Break it intentionally:** In your Express server, change the CORS `origin` to `"http://localhost:9999"` (wrong port). Open the browser console and try to make an API call from `localhost:3000`. Read the CORS error message carefully.
2. **Preflight inspection:** Open the Network tab in DevTools, filter by `OPTIONS`. Make any API call that uses `POST`. Can you find the preflight request? What response headers does your API return?
3. **Add a new origin:** You've been asked to add `https://staging.yourdomain.com` as an allowed origin. Where in the code do you make this change?
