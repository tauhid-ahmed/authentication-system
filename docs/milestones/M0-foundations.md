# M0: Authentication Foundations

Before writing a single line of code, you must understand *why* the code exists. Authentication is not just "logging in" — it is a series of state management problems solved over HTTP.

---

## 1. Authentication vs Authorization

The most common mistake junior developers make is confusing these two.

- **Authentication (AuthN)**: Proving *who* you are.
  - "I am Tauhid. Here is my password to prove it."
- **Authorization (AuthZ)**: Checking *what* you are allowed to do.
  - "Tauhid is logged in, but does he have the `ADMIN` role to delete this user?"

*Analogy: Authentication is getting your passport checked at the border. Authorization is whether your visa allows you to work or just visit.*

---

## 2. The HTTP Stateless Problem

HTTP is a stateless protocol.
When you log in successfully, the server sends a response: `200 OK`.
If you immediately make another request to `/dashboard`, the server has no memory of the previous request. It says: `401 Unauthorized`.

**The Solution:** You must send proof of your identity with *every single request*.

There are two primary ways to carry this proof:
1. **Sessions (Stateful)**
2. **Tokens (Stateless - JWT)**

---

## 3. Stateful Sessions vs Stateless Tokens

### Stateful Sessions (The Old Way)
1. User logs in.
2. Server creates a session record in the Database (or Redis) with ID `xyz123`.
3. Server gives the browser a cookie containing `xyz123`.
4. On every request, browser sends cookie `xyz123`.
5. Server looks up `xyz123` in the Database to find the user.

*Pros:* Easy to revoke (just delete the DB row).
*Cons:* Server must query the DB on *every single request*. Hard to scale across many servers.

### Stateless Tokens (The Modern SaaS Way — JWT)
1. User logs in.
2. Server generates a JSON Web Token (JWT) containing the user's ID, signed with a secret key.
3. Server gives the browser the JWT.
4. On every request, browser sends the JWT.
5. Server verifies the signature mathematically. **No DB lookup required.**

*Pros:* Extremely fast, highly scalable.
*Cons:* Cannot be revoked before they expire. If a hacker steals the token, they have access until the token's expiration time.

---

## 4. The Token Pair Architecture (What we are building)

To solve the "cannot be revoked" problem of JWTs, modern systems (Stripe, GitHub, our system) use a Token Pair:

### 1. Access Token (JWT)
- **Lifespan**: Very short (5 minutes).
- **Storage**: Memory or HTTP-only Cookie.
- **Purpose**: Sent with every API request to access protected data.
- **Why short?** If stolen, the hacker only has 5 minutes.

### 2. Refresh Token (Opaque String or JWT)
- **Lifespan**: Long (30 days).
- **Storage**: Database (and HTTP-only Cookie).
- **Purpose**: Used ONLY to get a new Access Token when the old one expires.
- **Why in the DB?** Because it lasts 30 days, we *must* be able to revoke it. If a user clicks "Log out everywhere", we delete this token from the DB.

### The Flow
1. API request fails with `401 Expired`.
2. Frontend silently sends Refresh Token to `/api/auth/refresh`.
3. Backend checks DB: "Is this refresh token valid and not revoked?"
4. Backend issues a NEW 5-minute Access Token.
5. Frontend retries the original API request.
*(The user never notices this happened).*

---

## 5. Security: Where to store tokens?

**NEVER STORE TOKENS IN `localStorage`.**
If your site has a Cross-Site Scripting (XSS) vulnerability (e.g., someone injects malicious JavaScript into a comment), that JavaScript can run `localStorage.getItem('token')` and send your token to a hacker.

**ALWAYS USE `HTTP-Only` COOKIES.**
An `HttpOnly` cookie cannot be read by JavaScript. Even if an attacker executes code on your site, they cannot steal the token. The browser automatically attaches the cookie to requests sent to your API.

---

## 6. Real-World Architecture Diagram

```ascii
Browser                          Next.js (Web)                   Express (API)
   │                                  │                               │
   │ 1. User enters credentials       │                               │
   ├─────────────────────────────────►│                               │
   │                                  │ 2. POST /api/auth/login       │
   │                                  ├──────────────────────────────►│
   │                                  │                               │ Verify Password
   │                                  │                               │ Generate JWT (5m)
   │                                  │                               │ Save Refresh Token to DB (30d)
   │                                  │                               │
   │                                  │ 3. Set-Cookie (HttpOnly)      │
   │                                  │◄──────────────────────────────┤
   │ 4. Redirect to /dashboard        │                               │
   │◄─────────────────────────────────┤                               │
   │                                  │                               │
   │ 5. GET /dashboard                │                               │
   ├─────────────────────────────────►│                               │
   │                                  │ 6. GET /api/users/me (Cookie) │
   │                                  ├──────────────────────────────►│
   │                                  │                               │ Verify JWT signature
   │                                  │ 7. Return User Data           │
   │                                  │◄──────────────────────────────┤
   │ 8. Render React Component        │                               │
   │◄─────────────────────────────────┤                               │
```

## Next Steps

You now understand the theory.
Proceed to **M1: MVP Auth** to implement the backend login and signup routes.
