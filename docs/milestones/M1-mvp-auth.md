# M1: MVP Authentication

Now that we understand the stateful vs. stateless token architecture (M0), it's time to build the foundation: the Minimal Viable Product (MVP) Authentication system.

---

## 1. Goal

Our MVP authentication system will have the following capabilities:
1. **Signup**: Register a new user with an email and password.
2. **Login**: Authenticate a user and issue a JWT access token and a refresh token.
3. **Get Current User (`/me`)**: Verify an access token and return the user's profile.

We will NOT worry about refresh token rotation, logout, or session management yet. We are simply building the core token issuance and verification engine.

---

## 2. Core Concepts

### Hashing Passwords (Never store plain text)
We use `bcrypt` to hash passwords. `bcrypt` is slow by design. This slowness (work factor/cost) protects against brute-force and dictionary attacks if the database is ever compromised.

```typescript
// See: apps/api/src/utils/hash.ts
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12; // High enough to be secure, low enough to not slow down login
  return bcrypt.hash(password, saltRounds);
}
```

### JSON Web Tokens (JWT)
We use `jsonwebtoken` to sign and verify tokens.
A JWT is **signed** by the server using a secret key (`ACCESS_TOKEN_SECRET`).
When the client sends the token back, the server **verifies** the signature using the same secret key.

```typescript
// See: apps/api/src/utils/jwt.ts
export function signAccessToken(payload) {
  return jwt.sign(payload, env.ACCESS_TOKEN_SECRET, { expiresIn: '5m' });
}
```

---

## 3. The Implementation Flow

Let's trace the code for a **Login Request**.

### Step 1: Controller (`apps/api/src/modules/auth/auth.controller.ts`)
The controller's job is purely HTTP-related:
1. Validate the incoming JSON body using Zod (`LoginSchema`).
2. Call the Service layer with the validated data.
3. Take the resulting tokens and put them into `HttpOnly` cookies.
4. Send a success response.

*Notice that the controller doesn't know what a database is, nor does it hash passwords. It just orchestrates.*

### Step 2: Service (`apps/api/src/modules/auth/auth.service.ts`)
The service holds the **business logic**:
1. Ask the Repository to find a user by their email.
2. If the user doesn't exist, throw an error.
3. Compare the provided password with the hashed password in the database.
4. If they match, ask the Repository to create a new "Session" (refresh token) in the database.
5. Generate the JWT access token.
6. Return both tokens to the controller.

*Security Best Practice: When a login fails (wrong email OR wrong password), always return the same generic error message ("Invalid email or password"). This prevents attackers from guessing which emails are registered.*

### Step 3: Repository (`apps/api/src/modules/auth/auth.repository.ts`)
The repository is the ONLY layer that talks directly to Prisma (the database).
1. `findByEmail`: Runs a `SELECT` query.
2. `createSession`: Runs an `INSERT` query.

*Why separate the repository? If we ever move from Prisma to raw SQL or MongoDB, we only have to rewrite the repository. The controller and service remain untouched.*

---

## 4. Protecting Routes (The Middleware)

Once a user logs in, they receive an access token in an `HttpOnly` cookie.
When they make a request to `/api/users/me`, how do we verify them?

### The `authenticate` Middleware (`apps/api/src/middlewares/authenticate.ts`)
Middleware in Express runs *before* the route handler.

1. It extracts the access token from `req.cookies`.
2. It calls `jwt.verify()`.
3. If valid, it decodes the payload (which contains the user's ID and Role).
4. **Crucial Step**: It attaches this payload to `req.user`.
5. It calls `next()` to pass control to the actual route handler.

Now, any protected route can simply read `req.user.id` and trust that it is accurate, without ever querying the database!

---

## 5. What's Next?

We have a working login system, but access tokens expire in 5 minutes!
If the user stays on the site for 6 minutes, they will be rudely logged out.

In the next milestone, we will fix this by implementing the **Refresh Token Rotation** flow.

Proceed to **M2: Advanced Tokens & Security**.
