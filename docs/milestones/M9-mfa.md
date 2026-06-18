# M9: Multi-Factor Authentication (MFA)

**Track:** Core Curriculum  
**Prerequisites:** M1 (MVP Auth), M8 (Password Reset)  
**Time:** ~3 hours  

---

## The Goal
Passwords are the weakest link in security. Multi-Factor Authentication (MFA), specifically Time-Based One-Time Passwords (TOTP), adds a second layer. 

In this module, we implement an enterprise-grade TOTP system using authenticator apps (Google Authenticator, Authy, etc.).

---

## Step 1: The Math Behind TOTP (RFC 6238)

TOTP relies on a **Shared Secret**.
1. The server generates a random string (the secret).
2. The user scans a QR code containing that secret.
3. Both the server and the user's phone put the secret and the *current time* into a cryptographic hashing algorithm (HMAC-SHA1).
4. They both take the last 6 digits of the hash.
5. If the 6 digits match, the user is authenticated.

This is why TOTP works entirely offline! The phone and server never communicate; they just use the same math and the same clock.

---

## Step 2: Enabling MFA (Backend)

We need to store the user's TOTP secret in the database.

### 2.1 Database Schema
```prisma
model User {
  // ... existing fields
  isMfaEnabled Boolean @default(false)
  mfaSecret    String? // The shared secret
}
```

### 2.2 Generating the Secret & QR Code
Open `apps/api/src/modules/mfa/mfa.service.ts`. We use the `otplib` and `qrcode` packages.

```typescript
import { authenticator } from "otplib";
import qrcode from "qrcode";

export async function setupMfa(userId) {
  // 1. Generate a massive, cryptographically secure secret
  const secret = authenticator.generateSecret();
  
  // 2. Temporarily save it to the DB (but MFA is not "enabled" yet)
  await db.user.update({
    where: { id: userId },
    data: { mfaSecret: secret, isMfaEnabled: false }
  });

  // 3. Create the otpauth URI (This is what the QR code encodes)
  // Format: otpauth://totp/MyAppName:user@email.com?secret=xyz&issuer=MyAppName
  const user = await db.user.findUnique({ where: { id: userId }});
  const otpauth = authenticator.keyuri(user.email, "ExecutionMastery", secret);

  // 4. Generate the QR code as a Base64 image
  const qrCodeDataUrl = await qrcode.toDataURL(otpauth);

  return { secret, qrCodeDataUrl };
}
```

### 2.3 Verifying the Setup
The user scans the QR code and types the 6-digit pin. The backend verifies it.

```typescript
export async function verifyMfaSetup(userId, token) {
  const user = await db.user.findUnique({ where: { id: userId }});

  // Mathematically verify the 6-digit pin against the secret
  const isValid = authenticator.verify({ token, secret: user.mfaSecret });

  if (!isValid) throw new AppError("INVALID_MFA_TOKEN", 400);

  // If valid, officially enable MFA!
  await db.user.update({
    where: { id: userId },
    data: { isMfaEnabled: true }
  });

  return { success: true };
}
```

---

## Step 3: Modifying the Login Flow

Now that MFA is enabled, we have to intercept the login flow.

Open `apps/api/src/modules/auth/auth.service.ts` and modify the `login` function.

```typescript
// STEP A: Verify Password
const isValid = await bcrypt.compare(password, user.passwordHash);
if (!isValid) throw new AppError("INVALID_CREDENTIALS", 401);

// STEP B: The MFA Intercept
if (user.isMfaEnabled) {
  // We DO NOT issue the Access/Refresh tokens!
  // Instead, we issue a temporary, short-lived "MFA Token"
  const mfaToken = jwt.sign({ userId: user.id, requiresMfa: true }, process.env.MFA_TOKEN_SECRET, { expiresIn: '5m' });
  
  return { mfaRequired: true, mfaToken };
}

// STEP C: Normal Login
const accessToken = signAccessToken(user.id, user.role);
// ...
```

---

## Step 4: The Final Verify Endpoint

The frontend sees `mfaRequired: true`, shows the 6-digit pin input UI, and calls `POST /api/auth/verify-mfa`.

```typescript
export async function verifyMfaLogin(req, res) {
  const { mfaToken, pin } = req.body;

  // 1. Verify the temporary MFA JWT
  const decoded = jwt.verify(mfaToken, process.env.MFA_TOKEN_SECRET);
  
  // 2. Look up the user's secret
  const user = await db.user.findUnique({ where: { id: decoded.userId }});

  // 3. Verify the 6-digit pin
  const isValid = authenticator.verify({ token: pin, secret: user.mfaSecret });
  if (!isValid) throw new AppError("INVALID_PIN", 400);

  // 4. Success! Now we issue the REAL tokens!
  const accessToken = signAccessToken(user.id, user.role);
  const rawRefreshToken = crypto.randomBytes(64).toString("hex");
  await createSessionInDatabase(user.id, rawRefreshToken);

  // Set cookies...
  return res.json({ success: true });
}
```

---

## Step 5: MFA Backup Codes (Account Recovery)

What happens if a user **loses their phone**? Without a recovery mechanism, they are permanently locked out of their account. Backup codes are the industry-standard solution.

### How Backup Codes Work
1. When the user enables MFA, the server generates **10 one-time backup codes** (e.g., `7f3a-b2c9`).
2. The user downloads or prints these codes and stores them somewhere safe.
3. Each code can be used **once** instead of the TOTP pin to log in.
4. Once all 10 codes are used, the user must regenerate them.

### 5.1 Database Schema
```prisma
model MfaBackupCode {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  codeHash  String    // SHA-256 hash of the 8-character code
  usedAt    DateTime? // Null until consumed
  createdAt DateTime  @default(now())
}
```

### 5.2 Generating Backup Codes on MFA Enable
```typescript
import { createHash } from "crypto";

export async function generateBackupCodes(userId: string) {
  // Generate 10 random 8-character codes (formatted as XXXX-XXXX)
  const rawCodes = Array.from({ length: 10 }, () => {
    const bytes = crypto.randomBytes(4).toString("hex").toUpperCase();
    return `${bytes.slice(0, 4)}-${bytes.slice(4, 8)}`;
  });

  // Hash and store each code
  await db.$transaction(
    rawCodes.map((code) =>
      db.mfaBackupCode.create({
        data: {
          userId,
          codeHash: createHash("sha256").update(code).digest("hex"),
        },
      })
    )
  );

  // Return the RAW codes to the user — this is the ONLY time they are shown
  return rawCodes;
}
```

> [!CAUTION]
> Show the raw backup codes **only once**, immediately after generation. After that, only hashes are stored. If the user loses the codes, they must regenerate the entire set (which invalidates all old ones).

### 5.3 Using a Backup Code at Login
When the user submits a backup code instead of a TOTP pin in `POST /verify-mfa`:

```typescript
export async function verifyWithBackupCode(userId: string, submittedCode: string) {
  const submittedHash = createHash("sha256").update(submittedCode).digest("hex");

  // Find the matching, unused backup code
  const backupCode = await db.mfaBackupCode.findFirst({
    where: { userId, codeHash: submittedHash, usedAt: null },
  });

  if (!backupCode) {
    throw new AppError("INVALID_BACKUP_CODE", 401);
  }

  // Mark it as used — it can never be used again
  await db.mfaBackupCode.update({
    where: { id: backupCode.id },
    data: { usedAt: new Date() },
  });

  // Optionally: warn the user how many codes remain
  const remainingCodes = await db.mfaBackupCode.count({
    where: { userId, usedAt: null },
  });

  return { success: true, remainingCodes };
}
```

---

## Practice Exercises

1. **Scan the Code:** Use Google Authenticator or Authy on your phone to scan the generated QR code.
2. **Test Expiration:** Look at the authenticator app. Wait for the circle to deplete so a new code generates. Use the *old* code. Ensure the backend rejects it.
3. **Bypass Attempt:** Try to hit `POST /verify-mfa` without passing the `mfaToken`. Why is the temporary `mfaToken` JWT required? (Hint: The backend needs to know *who* is trying to log in statelessly!).
4. **Backup Code Flow:** Enable MFA, generate backup codes, log out. On the login screen, use a backup code instead of the 6-digit pin. Verify the code is marked `usedAt` in the database. Try using the same code again — what happens?
5. **Regenerate Codes:** Build an endpoint `POST /api/mfa/backup-codes/regenerate` that deletes all existing backup codes for the user and generates a fresh set of 10. What security check should you perform before allowing this operation?

