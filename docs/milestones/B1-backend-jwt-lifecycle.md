# B1: The JWT Lifecycle — A Complete Backend Reference

**Track:** Backend Deep Dive  
**Prerequisites:** M0 (Foundations), M1 (MVP Auth)  
**Time:** ~3 hours  

---

> **Multi-client note:** Cookie examples are the browser transport. The live API
> also accepts `Authorization: Bearer <accessToken>` for mobile, desktop, CLI,
> and SDK clients. See [`docs/multi-client-api.md`](../multi-client-api.md).

## What You Will Learn

By the end of this document you will be able to:
- Explain exactly what a JWT is at the byte level
- Describe what happens inside the server when a token is signed and when it is verified
- Compare the three common access/refresh token architectures
- Identify every attack vector against JWTs and explain how we prevent each one
- Explain the difference between symmetric (HS256) and asymmetric (RS256) signing and when to use each

---

## 1. What Is a JWT, Really?

Most tutorials say "a JWT is a signed JSON object." That is technically correct but leaves you with no mental model for how it actually works. Let's fix that.

A JWT is a string in three parts, separated by dots:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9  ← Header
.eyJ1c2VySWQiOiJjbGFiY2QxMjMiLCJyb2xlIjoiVVNFUiIsImlhdCI6MTcxNjIzOTAyMiwiZXhwIjoxNzE2MjM5MzIyfQ  ← Payload
.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c  ← Signature
```

Each part is Base64Url encoded (NOT encrypted — Base64 is reversible by anyone).

### The Header

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

This tells the recipient: "I was signed using HMAC-SHA256."

### The Payload (Claims)

```json
{
  "userId": "clabc1234",
  "role": "USER",
  "iat": 1716239022,
  "exp": 1716239322
}
```

Standard claim names:
| Claim | Meaning |
|-------|---------|
| `iat` | Issued At — Unix timestamp when the token was created |
| `exp` | Expiration — Unix timestamp when the token becomes invalid |
| `sub` | Subject — typically the user's ID |
| `iss` | Issuer — who created the token (your API URL) |
| `aud` | Audience — who should accept the token |

> **Critical insight:** The payload is NOT secret. Anyone who has the token can base64-decode it and read it. **Do not put passwords, credit card numbers, or sensitive PII in a JWT payload.**

### The Signature

```
HMAC-SHA256(
  base64url(header) + "." + base64url(payload),
  ACCESS_TOKEN_SECRET
)
```

The signature is a cryptographic hash. To verify it, the server runs the same function with the same secret. If the output matches the signature in the token, the token is valid. If any byte of the header or payload was changed, the signature will not match.

This is the magic of JWTs: **the server does not need to look up the database to validate a token.** It just does math.

---

## 2. Signing a Token in Our Codebase

```typescript
// apps/api/src/utils/jwt.ts

import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function signAccessToken(userId: string, role: string): string {
  return jwt.sign(
    // Payload — what we want to encode
    { userId, role },
    // Secret — must be kept private, minimum 32 chars
    env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: "5m",   // Token expires in 5 minutes
      // Optional but recommended for production:
      // issuer: "https://api.yourdomain.com",
      // audience: "https://yourdomain.com",
    }
  );
}
```

**What `jwt.sign` does internally:**
1. Creates the header: `{ alg: "HS256", typ: "JWT" }`
2. Creates the payload with your data + `iat` (current time) + `exp` (current time + 5 minutes)
3. Base64Url encodes header and payload
4. Computes `HMAC-SHA256(header.payload, secret)`
5. Base64Url encodes the signature
6. Concatenates as `header.payload.signature`
7. Returns the string

---

## 3. Verifying a Token in Our Codebase

```typescript
// apps/api/src/middlewares/authenticate.ts

import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function authenticate(req, res, next) {
  // 1. Extract the token from the HttpOnly cookie
  const token = req.cookies.access_token;
  
  if (!token) {
    return res.status(401).json({ error: { code: "NO_TOKEN" } });
  }

  try {
    // 2. Verify the signature AND check expiration
    const payload = jwt.verify(token, env.ACCESS_TOKEN_SECRET) as JwtPayload;
    
    // 3. Attach user data to the request object
    req.user = { id: payload.userId, role: payload.role };
    
    // 4. Continue to the actual route handler
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: { code: "TOKEN_EXPIRED" } });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: { code: "INVALID_TOKEN" } });
    }
    next(error);
  }
}
```

**What `jwt.verify` does internally:**
1. Splits the token into header, payload, signature
2. Recomputes `HMAC-SHA256(header.payload, secret)`
3. Compares computed signature to the signature in the token
4. If they match: decodes and returns the payload
5. Checks `exp` — if the current time is past `exp`, throws `TokenExpiredError`
6. If signatures don't match: throws `JsonWebTokenError`

The key insight: **no database query**. This is why JWTs scale.

---

## 4. Why 5 Minutes? The Security-UX Tradeoff

Access tokens cannot be revoked (unlike database sessions). If someone steals an access token:
- **30-day token:** attacker has 30 days of access. Catastrophic.
- **1-hour token:** attacker has 1 hour. Bad.
- **5-minute token:** attacker has 5 minutes. Manageable.
- **1-minute token:** too short — causes performance problems and poor UX.

**5 minutes is the industry standard** for access tokens in a refresh-token architecture.

---

## 5. Three Access/Refresh Token Approaches

When tutorials say "JWT auth", they often hide the most important design
decision: what exactly is the refresh token, and can the backend revoke it?

There are three common approaches.

### Approach 1: Tutorial JWT Pair

This is the simple version you see in many tutorials.

| Token | Shape | Backend state |
| --- | --- | --- |
| Access token | JWT | None |
| Refresh token | JWT | None |

Flow:

```text
Login -> issue access JWT + refresh JWT
Request -> verify access JWT signature
Refresh -> verify refresh JWT signature -> issue new access JWT
Logout -> client deletes tokens
```

Why tutorials use it:
- It is easy to explain.
- It needs no database table.
- It feels fully "stateless".

The problem:
- You cannot revoke a refresh token before it expires.
- Logout is mostly client-side.
- If a refresh JWT is stolen, the attacker can keep refreshing until expiry.
- Reuse detection is not possible because the server stores no token state.

Use this only for learning or low-risk prototypes.

### Approach 2: JWT Pair With JTI Stored In DB

This keeps refresh tokens as JWTs but adds a database record for each refresh
token's `jti`.

`jti` means JWT ID. It is a unique identifier inside the token payload.

| Token | Shape | Backend state |
| --- | --- | --- |
| Access token | JWT | None |
| Refresh token | JWT with `jti` | Store `jti` in DB |

Example refresh JWT payload:

```json
{
  "sub": "user_123",
  "jti": "rt_abc_456",
  "sessionId": "session_789",
  "iat": 1716239022,
  "exp": 1718831022
}
```

Refresh flow:

```text
1. Verify refresh JWT signature and expiry.
2. Read `jti` from the payload.
3. Check DB: is this `jti` active, revoked, or already used?
4. Rotate: revoke old `jti`, create new `jti`, issue new refresh JWT.
```

What this improves:
- Logout can revoke the stored `jti`.
- Rotation can mark old refresh tokens as used.
- Reuse detection becomes possible.

Tradeoffs:
- You still expose session metadata inside the refresh JWT payload.
- You must check the DB anyway, so the refresh token is no longer truly stateless.
- If you store raw `jti` values, DB leaks may expose useful token identifiers.

This is a valid production pattern when implemented carefully.

### Approach 3: Opaque Refresh Token With DB Session

This is the approach used by this codebase.

| Token | Shape | Backend state |
| --- | --- | --- |
| Access token | JWT | None |
| Refresh token | Opaque/random token or minimal refresh token | Store hashed token/session in DB |

Flow:

```text
Login -> issue access JWT + refresh token
Refresh -> verify/find refresh token in DB -> rotate session -> issue new pair
Logout -> revoke DB session
```

Why this codebase uses it:
- The access token stays fast and stateless.
- The refresh token is fully revocable.
- The database is the source of truth for sessions and devices.
- Refresh token reuse can trigger "logout everywhere" security behavior.
- Raw refresh tokens are not stored in the database.

This is the strongest mental model for production auth:

```text
Access token = short-lived proof for normal API requests
Refresh token = long-lived session credential controlled by the database
```

> In this curriculum, Approach 1 explains the tutorial baseline, Approach 2
> explains the `jti` bridge pattern, and Approach 3 is the implementation you
> should study in B2.

---

## 6. HS256 vs RS256: Symmetric vs Asymmetric

### HS256 (What we use)
- Uses a **single shared secret** to both sign AND verify
- **Use when:** The same service that signs tokens also verifies them (monolith or single API)
- **Risk:** If the secret leaks, anyone can forge tokens
- **Our codebase:** `ACCESS_TOKEN_SECRET` in `.env`

### RS256 (What large companies use)
- Uses a **private key** to sign and a **public key** to verify
- **Use when:** Multiple microservices need to verify tokens (they only need the public key)
- **Advantage:** A microservice can verify tokens without ever having access to the signing key
- **Example:** Google's OAuth tokens use RS256. You can verify them using Google's public keys at `https://www.googleapis.com/oauth2/v3/certs`

```typescript
// RS256 example (for reference — not in this codebase)
const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 4096 });

// API Gateway signs with private key
const token = jwt.sign(payload, privateKey, { algorithm: "RS256" });

// Microservice verifies with public key (doesn't need private key)
const decoded = jwt.verify(token, publicKey, { algorithms: ["RS256"] });
```

---

## 7. Common JWT Attacks and Our Defenses

### 7.1 The "alg: none" Attack
An attacker crafts a token with `"alg": "none"` in the header. Vulnerable servers would skip signature verification.

**Our defense:** `jsonwebtoken` library always requires a valid algorithm. We never accept unsigned tokens.

### 7.2 XSS (Cross-Site Scripting) Token Theft
An attacker injects malicious JavaScript into your site. The script reads the token from `localStorage` and sends it to the attacker.

**Our defense:** We store tokens in `HttpOnly` cookies. JavaScript cannot read `HttpOnly` cookies. The browser sends them automatically on every request.

### 7.3 CSRF (Cross-Site Request Forgery)
An attacker tricks the browser into making a request to your API. Since the browser automatically sends cookies, the API might process the forged request.

**Our defense:** We set `sameSite: "lax"` on cookies. This prevents the browser from sending cookies on cross-origin requests initiated by third-party sites (e.g., clicking a malicious link). For POST/PUT/DELETE requests, `sameSite: "strict"` or CSRF tokens provide additional protection.

### 7.4 Weak Secrets
If your `ACCESS_TOKEN_SECRET` is short or guessable, an attacker can brute-force it.

**Our defense:** We validate minimum length (32 chars) at startup. In production, use 64+ random bytes generated by `crypto.randomBytes(64).toString('hex')`.

---

## 8. The Cookie Configuration — Every Field Explained

```typescript
// apps/api/src/utils/jwt.ts

export function getAccessTokenCookieOptions(isProduction: boolean): CookieOptions {
  return {
    // HttpOnly: JavaScript cannot read this cookie.
    // This is the #1 most important security setting.
    httpOnly: true,
    
    // Secure: Cookie is ONLY sent over HTTPS.
    // In development we use HTTP, so we disable this.
    secure: isProduction,
    
    // SameSite: Controls when the browser sends the cookie.
    // "lax" = sends on same-site requests + top-level navigation
    // "strict" = never sends on cross-site requests (breaks OAuth)
    // "none" = always sends (requires Secure: true)
    sameSite: "lax",
    
    // MaxAge: How long the cookie lives in the browser (in milliseconds).
    // For access tokens: 5 minutes. Browser auto-deletes after this.
    maxAge: 5 * 60 * 1000,
    
    // Path: Which URL paths can access this cookie.
    // "/" means all paths on your domain.
    path: "/",
  };
}
```

---

## 9. JWT Secret Rotation (Production Must-Know)

Over time, you must rotate your `ACCESS_TOKEN_SECRET` to limit the blast radius of a compromised secret. But naively changing the secret immediately invalidates all active access tokens and logs out every user at once.

### The Problem
```
Old Secret: "abc123"
New Secret: "xyz789"

If you swap instantly:
→ All tokens signed with "abc123" are now invalid
→ Every user gets a 401 on their next request
→ They hit the /refresh endpoint
→ Their refresh token is valid → new access token is issued with new secret ✅
→ But there is a 5-minute window where every request fails!
```

For a 5-minute access token window, this is acceptable. But for longer tokens or zero-downtime requirements, we need **dual-secret verification**.

### Dual-Secret Rotation
During the rotation window, we accept tokens signed with EITHER the old or new secret:

```typescript
// apps/api/src/utils/jwt.ts

export function verifyAccessToken(token: string) {
  const secrets = [
    process.env.ACCESS_TOKEN_SECRET,       // Current secret
    process.env.ACCESS_TOKEN_SECRET_OLD,   // Previous secret (set during rotation)
  ].filter(Boolean); // Remove undefined/empty

  for (const secret of secrets) {
    try {
      return jwt.verify(token, secret!) as JwtPayload;
    } catch (err) {
      // If this secret fails, try the next one
      if (!(err instanceof jwt.JsonWebTokenError)) throw err;
    }
  }

  throw new jwt.JsonWebTokenError("Invalid token");
}
```

### The Rotation Procedure (Zero Downtime)
```
Step 1: Move ACCESS_TOKEN_SECRET → ACCESS_TOKEN_SECRET_OLD
Step 2: Generate new secret → ACCESS_TOKEN_SECRET
Step 3: Deploy the new config (your app now accepts BOTH)
Step 4: Wait 5 minutes (all old tokens expire naturally)
Step 5: Remove ACCESS_TOKEN_SECRET_OLD from config
Step 6: Deploy again (only new secret is accepted)
```

> [!IMPORTANT]
> The Refresh Token is NOT a JWT — it is a random string stored in your database. Rotating the JWT secret has no impact on refresh tokens. Users will only need to re-login once their current 5-minute access token expires and the refresh flow issues a new one.

---

## Practice Exercises

1. **Decode a JWT manually.** After logging in, find the `access_token` cookie value in DevTools → Application → Cookies. Copy the payload section (middle part) and paste it at [jwt.io](https://jwt.io). What user data do you see?

2. **Find where tokens are signed** in `apps/api/src/utils/jwt.ts`. Trace the call chain from the login endpoint to `jwt.sign`. How many files does a login request touch?

3. **Experiment with expiry.** Change `ACCESS_TOKEN_EXPIRY` in `.env` to `"10s"`. Log in, wait 15 seconds, then try hitting a protected endpoint. What error code do you get back?

4. **Understand the cookie flags.** In DevTools → Application → Cookies, look at the flags on your `access_token` cookie. Confirm `HttpOnly` and `SameSite` are set. Try running `document.cookie` in the console — is the access token visible?

5. **Implement dual-secret rotation.** Update your `verifyAccessToken` function to accept both `ACCESS_TOKEN_SECRET` and `ACCESS_TOKEN_SECRET_OLD`. Verify it works by setting both env vars to different values and testing with tokens signed by each.
