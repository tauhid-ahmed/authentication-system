# M1: MVP Authentication (Implementation Guide)

**Track:** Core Curriculum  
**Prerequisites:** M0 (Foundations)  
**Time:** ~2 hours  

---

## The Goal
In this module, we build the core engine of our authentication system from scratch. We will implement:
1. **Signup:** Hashing a password and saving a user to the database.
2. **Login:** Verifying a password, issuing a JWT, and setting an `HttpOnly` cookie.
3. **Me:** An endpoint that reads the cookie, verifies the JWT, and returns the user profile.

We are writing the actual backend code for these flows in our Express API.

---

## Step 1: The Database Schema

Everything starts with the data. Open `packages/database/prisma/schema.prisma`.

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String?  // Nullable because OAuth users don't have passwords
  name         String
  role         Role     @default(USER)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  sessions     Session[]
}

enum Role {
  USER
  ADMIN
  SUPER_ADMIN
}
```

**Why `passwordHash` and not `password`?**
Never, ever store plain text passwords. If your database is stolen, attackers will have your users' passwords (which they probably reuse on other sites). We will use `bcrypt` to mathematically hash the passwords before saving them.

---

## Step 2: The Signup Flow

Let's implement the `POST /api/auth/signup` endpoint. Open `apps/api/src/modules/auth/auth.service.ts` and look at the `signup` function.

### 2.1 Check if the user exists
```typescript
const existingUser = await db.user.findUnique({ where: { email } });
if (existingUser) {
  throw new AppError("EMAIL_ALREADY_EXISTS", 400);
}
```

### 2.2 Hash the password
```typescript
// We use bcrypt with a salt round of 10.
// This means the hashing algorithm is run 2^10 times.
// It takes about 100ms, which is too slow for brute-forcing, 
// but fast enough that the user doesn't notice during signup.
const passwordHash = await bcrypt.hash(password, 10);
```

### 2.3 Save to the database
```typescript
const user = await db.user.create({
  data: {
    email,
    passwordHash, // Save the hash, NOT the plain text
    name,
  },
});
```

*(At this point, you could require email verification, but for the MVP, the user is immediately active.)*

---

## Step 3: The Login Flow

This is the most critical part of the system. Open the `login` function in the same `auth.service.ts` file.

### 3.1 Find the user
```typescript
const user = await db.user.findUnique({ where: { email } });

// If the user doesn't exist, OR if they signed up via Google (no passwordHash)
if (!user || !user.passwordHash) {
  throw new AppError("INVALID_CREDENTIALS", 401);
}
```

### 3.2 Verify the password
```typescript
// bcrypt.compare hashes the provided plain text password using the same salt 
// stored in the DB hash, and checks if the outputs match.
const isValid = await bcrypt.compare(password, user.passwordHash);

if (!isValid) {
  throw new AppError("INVALID_CREDENTIALS", 401);
}
```
> **Security Rule:** Notice that whether the email is wrong, or the password is wrong, we throw the EXACT SAME `INVALID_CREDENTIALS` error. This prevents attackers from guessing which emails are registered in your database.

### 3.3 Issue the Tokens
If the password matches, we generate our Token Pair (Access + Refresh).

```typescript
// Generate a 5-minute JWT Access Token
const accessToken = signAccessToken(user.id, user.role);

// Generate a 30-day random string Refresh Token
const refreshToken = crypto.randomBytes(64).toString("hex");

// Hash the refresh token and save it to the DB session table
// (We cover this deeply in the B2 Backend Token Rotation track)
await createSessionInDatabase(user.id, refreshToken);
```

### 3.4 Set the Cookies (The Controller)
Now we move up to the Controller (`auth.controller.ts`) to send the tokens to the browser.

```typescript
// We NEVER return the tokens in the JSON response body.
// We put them in HttpOnly cookies.
res.cookie("access_token", accessToken, {
  httpOnly: true, // Prevents XSS attacks
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax", // Prevents CSRF attacks
  maxAge: 5 * 60 * 1000, // 5 minutes
});

res.cookie("refresh_token", refreshToken, {
  // ... similar options, but 30 days maxAge
});

return res.json({ success: true, user: { id: user.id, email: user.email } });
```

---

## Step 4: The `/me` Endpoint (Verifying the Token)

Now the user is logged in. They navigate to the dashboard. The frontend needs to know who they are, so it makes a `GET` request to `/api/auth/me`.

Because we used cookies, the browser automatically attaches the `access_token` cookie to this request.

### 4.1 The Authenticate Middleware
Open `apps/api/src/middlewares/authenticate.ts`. This middleware runs *before* the route handler.

```typescript
export function authenticate(req, res, next) {
  // 1. Grab the token from the cookie
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    // 2. Verify the JWT signature using our secret
    const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    
    // 3. Attach the decoded payload (user info) to the request object
    req.user = { id: payload.userId, role: payload.role };
    
    // 4. Move on to the actual route
    next();
  } catch (err) {
    // If the token is expired or forged, jwt.verify throws an error
    return res.status(401).json({ error: "Token Expired" });
  }
}
```

### 4.2 The Route Handler
Because the middleware already verified the token and attached the user data to `req.user`, the actual route handler is incredibly simple:

```typescript
// apps/api/src/modules/auth/auth.controller.ts -> getMe

export async function getMe(req, res) {
  // The middleware guaranteed that req.user exists and is valid!
  
  // Look up their latest profile data from the DB
  const user = await db.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, email: true, name: true, role: true }
  });

  return res.json({ data: { user } });
}
```

---

## Practice Exercises

1. **Test Invalid Passwords:** Try to log in with a fake email. Then try with a real email but wrong password. Look at the API response in the Network tab. Are the error messages identical?
2. **Break the Middleware:** Open `authenticate.ts`. Change `process.env.ACCESS_TOKEN_SECRET` to a hardcoded string like `"wrong-secret"`. What happens when you try to load the dashboard? Why?
3. **Add a Field:** Add a `phoneNumber` field to the Prisma `User` model, update the Zod schema for signup, and modify the Signup service to save it.
