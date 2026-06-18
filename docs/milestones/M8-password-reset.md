# M8: Password Reset & Email Verification

When users forget their passwords or sign up with a new email, we need a secure way to verify that they actually own the email address they claim to own.

This milestone covers the architecture of one-time-use secure tokens sent via email.

---

## 1. The Verification Token Model

We cannot just send a link like `/reset-password?email=alice@gmail.com`. An attacker could click that link and reset anyone's password. 

We must send a cryptographically secure, random, expiring token.

### Database Schema
First, we add a generic Token table to our database:

```prisma
model VerificationToken {
  id        String   @id @default(cuid())
  email     String
  token     String   @unique
  type      TokenType // "EMAIL_VERIFICATION" | "PASSWORD_RESET"
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@unique([email, type]) // Only one active token per type per email
}
```

---

## 2. The Password Reset Flow

### Step 1: User requests a reset
1. User goes to `/forgot-password` and enters `alice@email.com`.
2. Backend generates a strong random token (e.g., using Node's `crypto.randomBytes`).
3. Backend saves it to `VerificationToken` with a 1-hour expiration.
4. Backend sends an email: *"Click here to reset: `https://app.com/reset-password?token=XYZ`"*

*Security Note: If `alice@email.com` does NOT exist in our DB, we still say "If an account exists, an email has been sent." This prevents attackers from using this form to guess which emails are registered.*

### Step 2: User clicks the link
1. User arrives at our Next.js frontend page `/reset-password?token=XYZ`.
2. They type a new password and submit the form.

### Step 3: Backend Verification
When the backend receives the `POST /api/auth/reset-password` request:

```typescript
// 1. Find the token
const verificationToken = await prisma.verificationToken.findUnique({
  where: { token: providedToken }
});

// 2. Validate token
if (!verificationToken) throw new Error("Invalid token");
if (verificationToken.expiresAt < new Date()) throw new Error("Token expired");

// 3. Find the user attached to that email
const user = await prisma.user.findUnique({ where: { email: verificationToken.email } });

// 4. Update the password
const newHash = await hashPassword(newPassword);
await prisma.user.update({
  where: { id: user.id },
  data: { passwordHash: newHash }
});

// 5. Delete the token (One-time use only!)
await prisma.verificationToken.delete({ where: { id: verificationToken.id } });

// 6. Security Measure: Revoke all existing sessions
// If the password was reset, the account might have been compromised. Kick out all other devices.
await revokeAllUserSessions(user.id);
```

---

## 3. Email Verification Flow

The Email Verification flow is nearly identical to Password Reset, but triggered during Signup rather than manually.

1. User signs up. Account is created with `emailVerified: false`.
2. Generate token, send email.
3. User clicks link: `/verify-email?token=XYZ`.
4. Backend finds token, updates user to `emailVerified: true`, deletes token.

### Gatekeeping Unverified Users
Depending on your application, you might want to prevent unverified users from doing certain actions.

We can enforce this in our middleware or service layer:
```typescript
if (!user.emailVerified) {
  throw new Error("EMAIL_NOT_VERIFIED");
}
```
In the frontend, if the API returns this error, the Next.js layout can display a persistent banner: *"Please verify your email address to unlock all features."*

---

## 4. Why not use JWTs for email links?

You *could* encode the user's email into a JWT and email them a link like `?token=eyJ...`. This avoids the need for the `VerificationToken` database table.

However, **database tokens are preferred over JWTs for email links.**
Why? Because JWTs cannot be easily revoked. If a user clicks "Reset Password" twice by accident, two valid JWTs are generated. If you use a database, the `@@unique([email, type])` constraint ensures the first token is deleted when the second is created.

Additionally, when the password reset is completed, we delete the database token so the link becomes instantly dead. You cannot kill a stateless JWT before its expiry.

Proceed to **M9: Two-Factor Authentication (MFA)** to learn the ultimate defense against compromised passwords.
