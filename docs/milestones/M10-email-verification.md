# M10: Email Verification (Implementation Guide)

**Track:** Core Curriculum  
**Prerequisites:** M1 (MVP Auth)  
**Time:** ~2 hours  

---

## Why Email Verification Matters

Without email verification, **anyone can sign up with someone else's email address**. This creates three serious problems:
1. **Spam:** Attacker signs up thousands of bots using real people's emails.
2. **Account Hijacking:** Attacker registers with `victim@gmail.com`, then later claims password resets.
3. **False Trust:** Your system treats unverified addresses as real, skewing data and enabling abuse.

Email verification ensures that only the actual owner of an email address can activate an account.

---

## Step 1: The Database Schema

We need to track whether an account is verified and store the verification token.

```prisma
model User {
  // ... existing fields
  isEmailVerified Boolean  @default(false)
  
  emailVerifications EmailVerification[]
}

model EmailVerification {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  tokenHash String   @unique // SHA-256 hash of the raw token
  expiresAt DateTime
  usedAt    DateTime? // Null until used
  createdAt DateTime @default(now())
}
```

> [!NOTE]
> We hash the token before storing it (like password reset tokens) so that if your database is breached, the tokens cannot be used by an attacker.

---

## Step 2: Sending the Verification Email on Signup

After creating the user, we generate a verification token and send an email.

Open `apps/api/src/modules/auth/auth.service.ts` — in the `signup` function:

```typescript
import crypto from "crypto";
import { createHash } from "crypto";

export async function signup(email, password, name) {
  // 1. Create the user (as before)
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await db.user.create({
    data: { email, passwordHash, name, isEmailVerified: false },
  });

  // 2. Generate a verification token
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  await db.emailVerification.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  });

  // 3. Send the email (non-blocking)
  const verifyUrl = `https://yourdomain.com/verify-email?token=${rawToken}`;
  emailService.sendVerificationEmail(user.email, verifyUrl).catch(console.error);

  // 4. Return success (user is created but not yet verified)
  return { user, message: "Check your email to verify your account." };
}
```

> [!IMPORTANT]
> We send the email **non-blocking** (`.catch` instead of `await`). Email delivery is not instant and should never block the HTTP response.

---

## Step 3: The Verify Email Endpoint

When the user clicks the link in their email, the frontend sends the token to the backend.

```
GET /api/auth/verify-email?token=abc123...
```

Open `apps/api/src/modules/auth/auth.service.ts`:

```typescript
export async function verifyEmail(rawToken: string) {
  // 1. Hash the incoming token to look up in the DB
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  // 2. Find the token record
  const record = await db.emailVerification.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  // 3. Validate
  if (!record) {
    throw new AppError("INVALID_TOKEN", 400);
  }
  if (record.usedAt) {
    throw new AppError("TOKEN_ALREADY_USED", 400);
  }
  if (record.expiresAt < new Date()) {
    throw new AppError("TOKEN_EXPIRED", 400);
  }

  // 4. Mark user as verified & token as used (in a transaction)
  await db.$transaction([
    db.user.update({
      where: { id: record.userId },
      data: { isEmailVerified: true },
    }),
    db.emailVerification.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { success: true, message: "Email verified! You can now log in." };
}
```

> [!TIP]
> Using a **database transaction** (`db.$transaction`) ensures both operations succeed or both fail together. You never want a user marked `isEmailVerified: true` with the token not consumed, or vice versa.

---

## Step 4: Enforcing Verification at Login

Now we must decide: **do we block login entirely until the email is verified, or do we allow login but restrict features?**

**Enterprise Standard: Block login.** Unverified accounts should not be able to act in your system.

Open `auth.service.ts` → `login()`:

```typescript
const user = await db.user.findUnique({ where: { email } });
if (!user || !user.passwordHash) throw new AppError("INVALID_CREDENTIALS", 401);

// ✅ Email Verification Check
if (!user.isEmailVerified) {
  throw new AppError("EMAIL_NOT_VERIFIED", 403);
}

const isValid = await bcrypt.compare(password, user.passwordHash);
// ...
```

The frontend must handle this specific error code and show: _"Please verify your email address. Check your inbox."_ with a "Resend verification" button.

---

## Step 5: Resend Verification Email

Users might miss the email or have it go to spam. We must offer a resend.

```typescript
export async function resendVerification(email: string) {
  const user = await db.user.findUnique({ where: { email } });

  // ENUMERATION DEFENSE: Same response whether user exists or not
  if (!user || user.isEmailVerified) {
    return; // Silently do nothing
  }

  // Rate limit: only allow resend every 2 minutes
  const recentToken = await db.emailVerification.findFirst({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 2 * 60 * 1000) } },
  });

  if (recentToken) {
    throw new AppError("RESEND_RATE_LIMIT", 429, "Please wait 2 minutes before requesting another email.");
  }

  // Generate and send a fresh token
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  await db.emailVerification.create({
    data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });

  const verifyUrl = `https://yourdomain.com/verify-email?token=${rawToken}`;
  await emailService.sendVerificationEmail(user.email, verifyUrl);
}
```

---

## Step 6: The Frontend Flow

```tsx
// apps/web/src/app/(auth)/verify-email/page.tsx

export default function VerifyEmailPage({ searchParams }) {
  const token = searchParams.token;

  useEffect(() => {
    if (!token) return;
    
    fetch(`/api/auth/verify-email?token=${token}`, { method: "GET" })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          router.push("/login?verified=true");
        }
      })
      .catch(() => setError("Invalid or expired verification link."));
  }, [token]);

  return (
    <div>
      <h1>Verifying your email...</h1>
    </div>
  );
}
```

---

## Practice Exercises

1. **Test the flow:** Sign up with a new account. Check the backend terminal logs for the verification URL (if using a dev email logger like Mailhog). Open the URL and verify. Try to log in before verifying vs after.
2. **Token expiry:** Change the token expiry to 30 seconds. Sign up, wait 35 seconds, then click the link. Ensure you get a clear "Token Expired" message.
3. **Resend rate limiting:** Call the resend endpoint twice in under 2 minutes. Verify the second call is rejected with a `429` status.
4. **Add `isEmailVerified` to `/me` response:** Update the `getMe` endpoint to include `isEmailVerified` in the user object. Use this on the frontend to show a persistent banner: _"⚠ Your email is not verified."_
