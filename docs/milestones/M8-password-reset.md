# M8: Password Reset (Implementation Guide)

**Track:** Core Curriculum  
**Prerequisites:** M1 (MVP Auth)  
**Time:** ~2 hours  

---

## The Goal
In this module, we implement a highly secure "Forgot Password" flow. This involves:
1. Receiving an email address.
2. Generating a time-limited, cryptographically secure token.
3. Sending an email with a reset link.
4. Verifying the token and setting a new password.
5. Revoking all active sessions (logging the user out everywhere) for security.

---

## Step 1: The Database Schema

We cannot just store a "reset code" on the `User` model. We need a dedicated table to handle expiration times and token revocation. Open `packages/database/prisma/schema.prisma`.

```prisma
model PasswordResetToken {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // We store a HASH of the token, just like passwords and refresh tokens
  tokenHash String   @unique
  
  expiresAt DateTime // Usually 15 to 60 minutes
  usedAt    DateTime? // Null until the token is successfully used
  createdAt DateTime @default(now())
}
```

---

## Step 2: The "Forgot Password" Endpoint

When a user clicks "Forgot Password" and submits their email, they hit the `POST /api/auth/forgot-password` endpoint.

### 2.1 The Enumeration Defense
```typescript
// apps/api/src/modules/auth/auth.service.ts -> forgotPassword

const user = await db.user.findUnique({ where: { email } });

// CRITICAL SECURITY RULE:
// If the user doesn't exist, we STILL RETURN SUCCESS.
// We just don't send an email. 
// If we returned an error ("Email not found"), attackers could type 
// thousands of emails into the form to figure out who uses your site.
if (!user) {
  return; // Pretend it worked!
}
```

### 2.2 Generating the Token
```typescript
import crypto from "crypto";
import bcrypt from "bcrypt";

// 1. Generate a raw random string (This is what we email to the user)
const resetToken = crypto.randomBytes(32).toString("hex");

// 2. Hash the token (This is what we store in the DB)
const tokenHash = await bcrypt.hash(resetToken, 10);

// 3. Save to database with a 15-minute expiration
await db.passwordResetToken.create({
  data: {
    userId: user.id,
    tokenHash: tokenHash,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins
  }
});
```

### 2.3 Sending the Email
```typescript
// Construct the URL that the user will click
const resetUrl = `https://yourdomain.com/reset-password?token=${resetToken}`;

// Send the email (using SendGrid, AWS SES, Resend, etc.)
await emailService.sendPasswordResetEmail(user.email, resetUrl);
```

---

## Step 3: The "Reset Password" Endpoint

The user receives the email, clicks the link, and lands on your frontend. They type a new password and submit. The frontend sends `POST /api/auth/reset-password` with `{ token, newPassword }`.

### 3.1 Validate the Token
```typescript
// apps/api/src/modules/auth/auth.service.ts -> resetPassword

// 1. Find ALL active, unused tokens
const activeTokens = await db.passwordResetToken.findMany({
  where: { 
    usedAt: null, 
    expiresAt: { gt: new Date() } // Must not be expired
  },
  include: { user: true }
});

// 2. Compare the raw token against the hashes
let matchedToken = null;
for (const t of activeTokens) {
  const isValid = await bcrypt.compare(rawToken, t.tokenHash);
  if (isValid) {
    matchedToken = t;
    break;
  }
}

if (!matchedToken) {
  throw new AppError("INVALID_OR_EXPIRED_TOKEN", 400);
}
```

### 3.2 Update Password & Mark Token Used
```typescript
// Hash the NEW password
const newPasswordHash = await bcrypt.hash(newPassword, 10);

// Update the user's password in the DB
await db.user.update({
  where: { id: matchedToken.userId },
  data: { passwordHash: newPasswordHash }
});

// Mark the token as used so it can never be used again
await db.passwordResetToken.update({
  where: { id: matchedToken.id },
  data: { usedAt: new Date() }
});
```

### 3.3 The Final Security Step: Revoke All Sessions
If someone forgot their password, there is a chance their account was compromised. When a password is changed, **you must immediately log the user out of all devices.**

```typescript
// Revoke all refresh tokens (sessions) for this user
await db.session.updateMany({
  where: { userId: matchedToken.userId, isRevoked: false },
  data: { isRevoked: true }
});
```
The user will now have to log back in with their newly created password.

---

## Practice Exercises

1. **Token Lifetime:** Where in the code is the 15-minute expiration set? Change it to 1 minute, request a reset email, wait 2 minutes, and try to use it. What happens?
2. **Prevent Re-use:** Try submitting the same valid reset token twice. Why does the second attempt fail? Follow the logic in the validation step.
3. **Session Revocation Validation:** Log in on your browser. Then, use an API testing tool (like Postman) to hit the `/forgot-password` and `/reset-password` endpoints. After successfully resetting, refresh your browser dashboard. Are you logged out?
