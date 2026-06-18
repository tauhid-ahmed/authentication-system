# M9: Two-Factor Authentication (MFA / 2FA)

No matter how strong your password hashing algorithm is, users will reuse passwords from other sites. If those sites get breached, your users get breached. 

Two-Factor Authentication (2FA) is the ultimate defense. Even if an attacker has the password, they cannot log in without the user's physical device.

---

## 1. TOTP Architecture (Time-Based One-Time Password)

We use TOTP (the standard behind Google Authenticator, Authy, etc.). 

TOTP works on a shared secret.
1. Our server generates a random string (the secret).
2. We show this secret to the user as a QR code.
3. The user scans it with their Authenticator App.
4. Now, both the server and the app can use the exact same mathematical formula (combining the secret + the current time) to generate the exact same 6-digit code every 30 seconds.

### Database Updates
```prisma
model User {
  // ... existing fields ...
  mfaEnabled Boolean @default(false)
  mfaSecret  String? // Stored encrypted or hashed ideally, but plain text for MVP
}
```

---

## 2. The Setup Flow

When a user wants to enable MFA:

1. **Generate Secret**: The backend generates a TOTP secret using a library like `otplib`.
2. **Generate QR Code**: The backend generates an `otpauth://` URI and converts it to a QR code image (or sends the URI to the frontend to render).
3. **Verify**: The user scans the code and enters the 6-digit number shown on their phone.
4. **Enable**: The backend verifies the code. If it matches, `mfaEnabled` is set to `true` and the `mfaSecret` is permanently saved.

---

## 3. The Login Flow (The 2FA Challenge)

When MFA is introduced, the login flow splits into two steps. This is the hardest part of building an auth system.

### Step 1: Password Verification
User submits Email + Password to `/api/auth/login`.

```typescript
// If the password is correct, but MFA is enabled:
if (user.mfaEnabled) {
  // DO NOT ISSUE FULL TOKENS YET!
  
  // Instead, issue a temporary, restricted "pre-auth" token
  const preAuthToken = signPreAuthToken({ sub: user.id });
  
  return res.json({ 
    requiresMfa: true, 
    preAuthToken 
  });
}

// If MFA is disabled, proceed to full login normally.
```

### Step 2: The MFA Challenge
The frontend redirects the user to a screen asking for their 6-digit code.
The user submits the Code + the `preAuthToken` to a new endpoint: `/api/auth/login/mfa`.

```typescript
// 1. Verify the preAuthToken (ensures they actually provided a valid password recently)
const payload = verifyPreAuthToken(preAuthToken);
const user = await prisma.user.findUnique({ where: { id: payload.sub }});

// 2. Verify the 6-digit code against the user's saved mfaSecret
const isValid = otplib.authenticator.check(providedCode, user.mfaSecret);
if (!isValid) throw new Error("Invalid Code");

// 3. SUCCESS! Generate the full Access Token and Refresh Token sessions.
const session = await createSession(user.id, ...);
const accessToken = signAccessToken(...);
// ... set cookies and return
```

### Why use a `preAuthToken`?
If you don't use a temporary token, you have to store the "half-logged-in" state somewhere (like a server-side session or a database flag). A short-lived JWT (e.g., 5 minutes) containing the `userId` is perfect for stateless "half-logins" because it requires no database storage. It simply says: "This person successfully provided the password for User 123 in the last 5 minutes."

---

## 4. Recovery Codes

If a user drops their phone in the ocean, they are permanently locked out.
To fix this, when MFA is first enabled, we must generate 10 backup codes.

```prisma
model BackupCode {
  id        String  @id @default(cuid())
  userId    String
  codeHash  String  // Hashed, just like a password!
  used      Boolean @default(false)
}
```

During Step 2 of the login flow, if the user clicks "Use Recovery Code", they submit a long string instead of a 6-digit TOTP. The backend checks if the string matches any unused `BackupCode` for that user. If it does, they log in, and that specific backup code is marked `used = true`.

---

## 5. Summary

MFA completes the modern authentication stack. By implementing Password Resets, Session Revocation, and TOTP, you have built a system functionally equivalent to GitHub or Stripe.

### The Learning Journey Complete
You have now conceptually walked through every layer of a Senior-level authentication architecture. 
The codebase provided alongside these documents is the living implementation of these concepts. Explore the code, break it, add these MFA features as an exercise, and you will master Authentication engineering.
