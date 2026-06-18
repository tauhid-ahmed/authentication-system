# M6: Advanced Security & Observability

In modern web architecture, being functionally correct isn't enough. Your authentication system must be resilient to attacks and observable when things go wrong.

In this milestone, we cover the security middleware and the comprehensive audit logging system that transforms a "toy" project into an "Enterprise-Ready" system.

---

## 1. Security Middleware (Express Helmet)

HTTP headers provide significant protection against common web vulnerabilities. We use the `helmet` package to automatically set secure HTTP headers.

```typescript
// apps/api/src/app.ts
import helmet from "helmet";

app.use(helmet());
```

What does `helmet` actually do?
- **X-Powered-By**: Removes the header that tells attackers we are using Express.
- **X-Frame-Options**: Prevents Clickjacking by disallowing our site from being embedded in an iframe.
- **Strict-Transport-Security (HSTS)**: Tells browsers to *only* access our site over HTTPS.
- **X-Content-Type-Options**: Prevents MIME-sniffing, ensuring the browser respects our declared content types.

---

## 2. Cross-Origin Resource Sharing (CORS)

By default, web browsers prevent Javascript on `http://localhost:3000` (Next.js) from making HTTP requests to `http://localhost:5000` (Express) due to the Same-Origin Policy.

CORS headers tell the browser: "It is safe to let `localhost:3000` talk to me."

```typescript
// apps/api/src/app.ts
app.use(
  cors({
    origin: env.ALLOWED_ORIGINS.split(","),
    credentials: true, // CRITICAL: This allows the browser to send cookies!
  })
);
```

If `credentials: true` is missing, the browser will strip the `access_token` cookie from the `fetch` request, and the API will reject it with a 401 error.

---

## 3. Rate Limiting (Preventing Brute Force)

A login endpoint is the #1 target for brute force and credential stuffing attacks. We must limit how fast an attacker can guess passwords.

We use `express-rate-limit` to restrict requests based on the IP address.

```typescript
// apps/api/src/middlewares/rateLimiter.ts
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 failed requests per `window`
  message: "Too many login attempts from this IP, please try again after 15 minutes",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
});
```

We apply different limits to different endpoints:
- **Global API Limiter**: 100 requests per 15 mins (prevents general DDoS).
- **Login Limiter**: 5 requests per 15 mins (prevents brute forcing passwords).
- **Refresh Limiter**: 20 requests per 15 mins (prevents token flooding).

---

## 4. Comprehensive Audit Logging

"I didn't change that user's role to Super Admin!"
Without logs, it's their word against yours. With audit logs, you have proof.

Every significant authentication event in our system generates an `AuditLog` database entry.

```prisma
model AuditLog {
  id        String      @id @default(cuid())
  userId    String?     
  event     AuditEvent  // LOGIN_SUCCESS, ROLE_CHANGED, TOKEN_REUSE_DETECTED
  ipAddress String?
  userAgent String?
  metadata  Json?       
  createdAt DateTime    @default(now())
}
```

### Capturing the Context
When an event happens, we capture the IP Address and the User-Agent (device info).

```typescript
// apps/api/src/utils/device.ts
export function extractIpAddress(req: Request): string {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) {
    return Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(",")[0];
  }
  return req.ip || req.socket.remoteAddress || "0.0.0.0";
}
```

*Note: If your API is behind a reverse proxy like Nginx or AWS API Gateway, `req.ip` will be the proxy's IP. You MUST read the `X-Forwarded-For` header to get the actual user's IP.*

### The Audit Trail in Action
When a user logs in, we trigger the logging service in the background:

```typescript
// apps/api/src/modules/auth/auth.service.ts
await auditService.logEvent({
  userId: user.id,
  event: "LOGIN_SUCCESS",
  ipAddress,
  userAgent: deviceInfo,
});
```

These logs provide immense value for:
1. **Compliance**: GDPR, SOC2, HIPAA require tracking who accessed what.
2. **Security Incident Response**: If a token is stolen, we can trace exactly when and from which IP the attacker logged in.
3. **User History**: In the frontend, we can display a "Recent Activity" tab showing the user their own login history (e.g., "Logged in from Chrome on macOS in New York").

---

## 5. Summary

We have transformed our authentication system from a simple token generator into a secure, hardened, and observable architecture. 

We protect against clickjacking, brute-forcing, and replay attacks, all while logging every move into an immutable audit trail.

You have now completed the core backend architecture of a Production-Grade Authentication System. 
