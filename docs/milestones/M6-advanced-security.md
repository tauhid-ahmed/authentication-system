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

## Practice Exercises

1. **Trigger the Limiter:** Try to submit the login form 6 times very quickly. Watch the Network tab. What status code is returned? What does the UI show?
2. **Inspect Headers:** Open the Network tab, click on any successful API request, and look at the `Response Headers`. Can you spot the `X-RateLimit-*` headers? Can you find `X-Frame-Options`?
3. **Change the Limit:** Go to the backend rate limiter middleware and change it to 1 request per 60 seconds. Restart the backend and verify the strictness.
