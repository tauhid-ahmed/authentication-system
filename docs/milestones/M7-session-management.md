# M7: Session Management (Implementation Guide)

**Track:** Core Curriculum  
**Prerequisites:** M2 (Advanced Tokens)  
**Time:** ~2 hours  

---

## The Goal
A user might be logged into your app on their Laptop, their iPhone, and an office computer. If they lose their iPhone, they need a way to see all active sessions and remotely log out of the lost device.

In this module, we build the "Active Devices" security feature.

---

## Step 1: Capturing Device Information (Backend)

When a user logs in, we generate a Refresh Token (Session). But we need to know *what* device generated it. The browser automatically sends a `User-Agent` string with every request, and the IP address can be used to approximate location.

### 1.1 Updating the Database Schema
Open `packages/database/prisma/schema.prisma`.

```prisma
model Session {
  id           String   @id @default(cuid())
  userId       String
  refreshToken String   @unique // Hashed
  isRevoked    Boolean  @default(false)
  
  // NEW FIELDS:
  ipAddress    String?
  userAgent    String?
  
  expiresAt    DateTime
  createdAt    DateTime @default(now())
}
```

### 1.2 Saving the Metadata on Login
Open `apps/api/src/modules/auth/auth.controller.ts`.

```typescript
export async function login(req, res) {
  // Capture the IP and User-Agent
  const ip = req.headers["x-forwarded-for"] || req.ip;
  const userAgent = req.headers["user-agent"];

  // Pass them to the service
  const result = await authService.login(email, password, ip, userAgent);
  // ...
}
```

In `auth.service.ts`, when we call `createSessionInDatabase`, we save these values to the `Session` table.

---

## Step 2: Fetching Active Sessions

We need an endpoint that returns all non-revoked sessions for the current user.

Open `apps/api/src/modules/sessions/sessions.controller.ts`.

```typescript
import parser from "ua-parser-js"; // Parses raw User-Agent strings into friendly objects

export async function getActiveSessions(req, res) {
  const sessions = await db.session.findMany({
    where: { 
      userId: req.user.id, 
      isRevoked: false,
      expiresAt: { gt: new Date() } // Must not be expired
    },
    orderBy: { createdAt: 'desc' }
  });

  // We don't want to send the hashed refresh token to the frontend!
  // We format the output nicely using ua-parser-js
  const formattedSessions = sessions.map(s => {
    const ua = parser(s.userAgent || "");
    return {
      id: s.id,
      device: `${ua.os.name} - ${ua.browser.name}`, // e.g., "macOS - Chrome"
      ipAddress: s.ipAddress,
      isCurrentSession: s.refreshToken === req.cookies.refresh_token, // Highlight current!
      createdAt: s.createdAt,
    };
  });

  return res.json({ data: formattedSessions });
}
```

---

## Step 3: Revoking a Session (Remote Logout)

The user clicks "Revoke" next to the iPhone session.

### 3.1 The Revoke Endpoint
```typescript
export async function revokeSession(req, res) {
  const { sessionId } = req.params;

  // 1. Find the session AND ensure it belongs to the current user!
  const session = await db.session.findUnique({ where: { id: sessionId }});
  
  if (!session || session.userId !== req.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // 2. Mark it as revoked
  await db.session.update({
    where: { id: sessionId },
    data: { isRevoked: true }
  });

  return res.json({ success: true });
}
```

When the iPhone tries to make a request:
1. Its 5-minute access token will eventually expire.
2. It will silently call `POST /refresh`.
3. The backend will see `isRevoked: true` for that session.
4. The backend will throw a `401 Unauthorized` and trigger the Replay Attack block.
5. The iPhone will be forcefully logged out!

---

## Step 4: The Frontend UI

The frontend simply fetches the active sessions and displays them in a list.

```tsx
// apps/web/src/app/(protected)/security/page.tsx

function ActiveSessions() {
  const { data: sessions } = useSWR("/api/sessions", authFetchClient);

  const handleRevoke = async (id: string) => {
    await authFetchClient(`/api/sessions/${id}`, { method: "DELETE" });
    // Refresh the list...
  };

  return (
    <div>
      {sessions.map(s => (
        <div key={s.id}>
          <p>{s.device}</p>
          <p>{s.ipAddress}</p>
          {s.isCurrentSession && <span>(This Device)</span>}
          {!s.isCurrentSession && (
            <button onClick={() => handleRevoke(s.id)}>Log Out Device</button>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

## Practice Exercises

1. **Multiple Logins:** Open Chrome and log in. Then open an Incognito window (or a different browser like Firefox) and log in again. Go to the active sessions UI in Chrome. Do you see both devices?
2. **Remote Logout:** In Chrome, click "Revoke" on the Firefox session. Go back to Firefox and try to navigate the dashboard. Wait up to 5 minutes (for the access token to expire). Watch the Network tab as the `POST /refresh` request gets denied and kicks you out!
3. **Current Session Check:** How does the backend know which session is the "current" one? Look at the `getActiveSessions` code to see how it compares the incoming cookie.
