# M7: Device & Session Management

One of the major benefits of storing Refresh Tokens in the database (as opposed to making them stateless) is that we can build a **Session Management Dashboard** (similar to what you see in GitHub or Google's security settings).

This allows a user to see all the devices they are currently logged in on, and remotely log out a device that they left at a coffee shop or don't recognize.

---

## 1. Tracking Device Context

Whenever a user logs in, we don't just generate a token. We extract metadata about their device and network.

```typescript
// apps/api/src/utils/device.ts

// Extract IP Address
export function extractIpAddress(req: Request): string {
  // Always check X-Forwarded-For if behind a proxy!
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) return Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(",")[0];
  return req.ip || "0.0.0.0";
}

// Parse User-Agent into a readable string
export function parseUserAgent(userAgentHeader?: string): string {
  // A real implementation would use a library like 'ua-parser-js'
  // to convert "Mozilla/5.0..." into "Chrome on macOS"
  if (!userAgentHeader) return "Unknown Device";
  if (userAgentHeader.includes("Mobile")) return "Mobile Browser";
  return "Desktop Browser";
}
```

We save this metadata directly into the `Session` table:

```prisma
model Session {
  id           String   @id @default(cuid())
  userId       String
  refreshToken String   @unique
  
  // Device tracking
  deviceInfo   String?  // "Chrome on macOS"
  ipAddress    String?  // "192.168.1.1"
  
  isRevoked    Boolean  @default(false)
  lastUsedAt   DateTime @default(now())
}
```

---

## 2. The API Endpoints

We need two endpoints to support the frontend dashboard:
1. `GET /api/sessions`: Returns a list of all active sessions for the current user.
2. `DELETE /api/sessions/:id`: Revokes a specific session.

### Fetching Active Sessions
```typescript
async getActiveSessions(userId: string) {
  return await prisma.session.findMany({
    where: { 
      userId, 
      isRevoked: false, 
      expiresAt: { gt: new Date() } // Not expired
    },
    select: { id: true, deviceInfo: true, ipAddress: true, lastUsedAt: true }
  });
}
```

### Revoking a Session
When the user clicks "Revoke" on a device in the UI, we don't delete the row (because we want to keep the audit trail). We simply mark it as revoked.

```typescript
async revokeSession(userId: string, sessionId: string) {
  // 1. Verify ownership (Security Check!)
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== userId) {
    throw new Error("FORBIDDEN");
  }

  // 2. Mark as revoked
  await prisma.session.update({
    where: { id: sessionId },
    data: { isRevoked: true }
  });
}
```

---

## 3. How the Revocation Actually Works

If a user revokes Session A, how does the person using Session A actually get logged out?

Remember our token architecture:
1. Access tokens are stateless (5-minute lifespan).
2. Refresh tokens are stateful (30-day lifespan).

When Session A is revoked, the person on Session A can continue browsing for **at most 5 minutes** using their existing access token.

Once their 5 minutes are up, their frontend will silently call `/api/auth/refresh`.
The backend will check the database:
```typescript
if (session.isRevoked) {
  throw new Error("SESSION_REVOKED");
}
```
The refresh will fail. The frontend will get a 401 error, and the Next.js routing will kick them back to the `/login` page.

### The 5-Minute Tradeoff
This 5-minute delay is the fundamental tradeoff of stateless JWTs. 
If an attacker steals a device, they have 5 minutes of access before the revocation takes effect.

For 99% of applications, this is acceptable. If you are building a banking app where immediate sub-second revocation is required, you cannot use stateless JWTs—you must check the database on every single API request.

---

## 4. Anomaly Detection (Advanced)

Because we are logging IPs and Devices, we can build automated anomaly detection.

When a user logs in:
1. Get their previous sessions.
2. If this is a new IP address or a new device type, trigger an email: *"New login from an unrecognized device in [Location]. Was this you?"*

This is exactly how Netflix, Google, and Stripe handle account security.

Proceed to **M8: Password Reset & Email Verification** to see how we implement secure emailed links.
