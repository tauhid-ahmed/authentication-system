# A3: Native Client Token Transport — iOS, Android & Desktop Auth

**Track:** Architecture  
**Prerequisites:** M2 (Advanced Tokens), B4 (Sessions vs JWT), B6 (Multi-Client API)  
**Time:** ~1.5 hours  

---

> **The core challenge:** `HttpOnly` cookies are perfect for browsers — the browser sets, stores, and sends them automatically. But on iOS, Android, React Native, and desktop apps, there is no cookie jar. You cannot use `document.cookie`. You must transport and store tokens differently while keeping the same security guarantees.

---

## Part 1: Why Browsers and Native Apps Are Different

```
BROWSER                              NATIVE APP (iOS/Android/RN)
───────────────────────────────      ────────────────────────────────────
Cookie jar managed by browser ✅    No cookie jar ❌
HttpOnly blocks JS access ✅        localStorage unavailable ❌
SameSite prevents CSRF ✅           No CSRF concern (no browser) ✅
Auto-sends cookies on fetch ✅      Must manually set headers ✅
Origin enforced by CORS ✅          No browser Origin concept ✅
```

**Key insight:** Native apps are actually *safer* in some ways — there's no XSS risk in native code, no CSRF because there's no browser, and no shared cookie jar. The threat model is different: you're protecting against **stolen tokens from device storage**, not browser-based attacks.

---

## Part 2: The `X-Auth-Token-Transport` Header — Opting Into Body Tokens

The cleanest approach is a single backend that supports both clients via an opt-in header. When the header is present, the API returns tokens in the response body instead of setting cookies.

### 2.1 Backend: Detecting the Client Type

```typescript
// apps/api/src/utils/clientType.ts

export type TokenTransport = "cookie" | "body";

export function getTokenTransport(req: Request): TokenTransport {
  // Native clients send this header to opt into body-based token transport
  const header = req.headers["x-auth-token-transport"];
  return header === "body" ? "body" : "cookie";
}
```

### 2.2 Backend: Unified Login Controller

```typescript
// apps/api/src/modules/auth/auth.controller.ts

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const transport = getTokenTransport(req);

  // Authentication logic is identical for both client types
  const { user, accessToken, refreshToken } = await authService.login(
    email,
    password,
    req.ip,
    req.headers["user-agent"]
  );

  if (transport === "body") {
    // ── Native client: return tokens in JSON ─────────────────────────
    return res.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, role: user.role },
        tokens: {
          accessToken,              // JWT, 15 min
          refreshToken,             // Raw random token, 30 days
          accessTokenExpiresIn: 900, // seconds
        },
      },
    });
  }

  // ── Browser client: set HttpOnly cookies ─────────────────────────
  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/refresh",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });

  return res.json({
    success: true,
    data: {
      user: { id: user.id, email: user.email, role: user.role },
      // No tokens in body — they're in cookies!
    },
  });
}
```

### 2.3 Backend: Unified Refresh Controller

```typescript
export async function refreshToken(req: Request, res: Response) {
  const transport = getTokenTransport(req);

  // Browser sends refresh token in cookie; native app sends it in body
  const rawRefreshToken =
    transport === "body"
      ? req.body?.refreshToken
      : req.cookies?.refresh_token;

  if (!rawRefreshToken) {
    return res.status(401).json({ error: "No refresh token provided" });
  }

  const { newAccessToken, newRefreshToken } =
    await authService.rotateSession(rawRefreshToken);

  if (transport === "body") {
    return res.json({
      success: true,
      data: {
        tokens: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          accessTokenExpiresIn: 900,
        },
      },
    });
  }

  // Browser: update cookies
  res.cookie("access_token", newAccessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 15 * 60 * 1000,
  });
  res.cookie("refresh_token", newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/refresh",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  return res.json({ success: true });
}
```

---

## Part 3: Secure Storage on Each Platform

The equivalent of `HttpOnly` cookies for native apps is **platform secure storage**. This uses hardware-backed encryption (Secure Enclave on iOS, StrongBox on Android) and requires biometric/PIN to access.

### 3.1 React Native (Expo) — iOS Keychain + Android Keystore

```typescript
// apps/mobile/src/services/tokenStore.ts
import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "auth.access_token";
const REFRESH_TOKEN_KEY = "auth.refresh_token";

export const tokenStore = {
  async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    // Both calls write to:
    // iOS: Keychain (Secure Enclave backed)
    // Android: EncryptedSharedPreferences (Keystore backed)
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken, {
      requireAuthentication: false, // Set true if you want biometric to read
    });
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  },

  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },

  async clearTokens(): Promise<void> {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },
};
```

### 3.2 Platform Storage Equivalents

| Platform | Library / API | Backed By |
|---|---|---|
| iOS (native) | `Keychain Services` | Secure Enclave |
| Android (native) | `KeyStore` + `EncryptedSharedPreferences` | StrongBox / TEE |
| React Native | `expo-secure-store` or `react-native-keychain` | Delegates to above |
| macOS | `Keychain` | Secure Enclave |
| Windows | `Credential Manager` (DPAPI) | TPM chip |
| Linux desktop | `libsecret` / Secret Service | System keyring |
| Electron | `safeStorage` API | OS native keychain |

> **Never use:** `AsyncStorage` (React Native), `localStorage` (Electron), `UserDefaults` (iOS), `SharedPreferences` (Android) — all are plaintext on disk.

---

## Part 4: The Complete Native Client Auth Flow

### 4.1 Login

```typescript
// apps/mobile/src/services/authService.ts

const API_URL = process.env.EXPO_PUBLIC_API_URL!;

export async function login(email: string, password: string): Promise<User> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Token-Transport": "body", // ← Opt into body tokens
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Login failed");
  }

  const { data } = await res.json();

  // Store tokens securely
  await tokenStore.saveTokens(
    data.tokens.accessToken,
    data.tokens.refreshToken
  );

  // Schedule proactive refresh (before token expires)
  scheduleTokenRefresh(data.tokens.accessTokenExpiresIn);

  return data.user;
}
```

### 4.2 Making Authenticated Requests

```typescript
// apps/mobile/src/services/apiFetch.ts

let isRefreshing = false;
const refreshQueue: Array<() => void> = [];

async function performRefresh(): Promise<boolean> {
  const refreshToken = await tokenStore.getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Token-Transport": "body",
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      await tokenStore.clearTokens();
      return false;
    }

    const { data } = await res.json();
    await tokenStore.saveTokens(
      data.tokens.accessToken,
      data.tokens.refreshToken
    );
    scheduleTokenRefresh(data.tokens.accessTokenExpiresIn);
    return true;
  } catch {
    return false;
  }
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const accessToken = await tokenStore.getAccessToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  if (response.status === 401) {
    const body = await response.json().catch(() => ({}));

    if (body.code !== "TOKEN_EXPIRED") {
      throw new Error(body.error || "Unauthorized");
    }

    // Concurrency lock (same pattern as browser)
    if (isRefreshing) {
      await new Promise<void>((resolve) => refreshQueue.push(resolve));
      return apiFetch(path, options); // Retry with new token
    }

    isRefreshing = true;
    const refreshed = await performRefresh();
    isRefreshing = false;
    refreshQueue.forEach((resolve) => resolve());
    refreshQueue.length = 0;

    if (!refreshed) {
      // Trigger app-level logout
      throw new Error("SESSION_EXPIRED");
    }

    return apiFetch(path, options); // Retry
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  return response.json();
}
```

### 4.3 Proactive Token Refresh (Mobile Best Practice)

Unlike browsers where the user just waits for a background refresh, mobile apps should refresh proactively just before the token expires to avoid any failed requests:

```typescript
// apps/mobile/src/services/authService.ts

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleTokenRefresh(expiresInSeconds: number): void {
  if (refreshTimer) clearTimeout(refreshTimer);

  // Refresh 60 seconds before expiry to be safe
  const refreshInMs = Math.max(0, (expiresInSeconds - 60) * 1000);

  refreshTimer = setTimeout(async () => {
    console.log("[Auth] Proactively refreshing access token...");
    const success = await performRefresh();
    if (!success) {
      // Emit an event for the app to handle (e.g., show re-login modal)
      authEventEmitter.emit("session-expired");
    }
  }, refreshInMs);
}

export function clearRefreshTimer(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}
```

### 4.4 Logout

```typescript
export async function logout(): Promise<void> {
  try {
    const refreshToken = await tokenStore.getRefreshToken();
    if (refreshToken) {
      // Tell the server to revoke the session
      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Token-Transport": "body",
        },
        body: JSON.stringify({ refreshToken }),
      });
    }
  } catch {
    // Even if the server call fails, we still clear local tokens
  } finally {
    await tokenStore.clearTokens();
    clearRefreshTimer();
  }
}
```

---

## Part 5: PKCE for OAuth in Native Apps

When using OAuth (Google, Apple Sign-In) in a native app, you must use **PKCE** (Proof Key for Code Exchange). Unlike the browser OAuth flow where the backend handles the code exchange, native apps do PKCE client-side.

```typescript
// apps/mobile/src/services/oauth.ts
import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";

async function generatePKCE() {
  // 1. Generate a random code verifier (43-128 chars)
  const codeVerifier = Crypto.randomUUID().replace(/-/g, "") + 
                       Crypto.randomUUID().replace(/-/g, "");

  // 2. SHA-256 hash it and base64url-encode to create the challenge
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    codeVerifier,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  );
  const codeChallenge = digest
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return { codeVerifier, codeChallenge };
}

export async function loginWithGoogle(): Promise<void> {
  const { codeVerifier, codeChallenge } = await generatePKCE();
  const state = Crypto.randomUUID(); // CSRF protection

  const authUrl = new URL(`${API_URL}/api/oauth/google`);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("transport", "body"); // ← Get tokens in body

  // Open the OAuth flow in a system browser (SFSafariViewController on iOS)
  const result = await WebBrowser.openAuthSessionAsync(
    authUrl.toString(),
    "myapp://auth/callback" // Deep link back to the app
  );

  if (result.type === "success") {
    // Parse the authorization code from the redirect URL
    const url = new URL(result.url);
    const code = url.searchParams.get("code");
    const returnedState = url.searchParams.get("state");

    if (returnedState !== state) throw new Error("CSRF mismatch");

    // Exchange the code for tokens (include the PKCE verifier)
    const tokenRes = await fetch(`${API_URL}/api/oauth/google/callback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Token-Transport": "body",
      },
      body: JSON.stringify({ code, codeVerifier }),
    });

    const { data } = await tokenRes.json();
    await tokenStore.saveTokens(data.tokens.accessToken, data.tokens.refreshToken);
  }
}
```

---

## Part 6: Security Differences vs Browser

| Threat | Browser Defense | Native App Defense |
|---|---|---|
| XSS | `HttpOnly` cookie | N/A — no HTML/JS injection |
| CSRF | `SameSite` cookie | N/A — no browser, no cookies |
| Token theft from storage | Cookie not readable by JS | Secure Enclave / Keychain |
| Man-in-the-middle | HTTPS + `Secure` cookie | HTTPS + Certificate pinning |
| Token exfiltration via app | N/A | Code obfuscation, root detection |
| Replay attacks | Refresh token rotation | Same rotation + `isRevoked` check |

### Certificate Pinning (Advanced)

For high-security apps, pin your SSL certificate so even a compromised root CA can't MITM you:

```typescript
// React Native with react-native-ssl-pinning
import { fetch as pinnedFetch } from "react-native-ssl-pinning";

const secureResponse = await pinnedFetch(`${API_URL}/api/auth/me`, {
  method: "GET",
  sslPinning: {
    certs: ["YOUR_CERT_HASH"], // SHA-256 of your server's public key
  },
  headers: { Authorization: `Bearer ${token}` },
});
```

---

## Part 7: Multi-Session Support on Native

Mobile users can be logged in on both their phone AND tablet. The session system (B4) supports this — each login creates a separate `Session` row with `clientType: "MOBILE"` and `deviceName`.

```typescript
// On login, send device info so it shows in "Active Devices" UI
const res = await fetch(`${API_URL}/api/auth/login`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Auth-Token-Transport": "body",
    "X-Device-Name": await DeviceInfo.getDeviceName(), // "John's iPhone 15"
    "X-Device-Type": "mobile",
  },
  body: JSON.stringify({ email, password }),
});
```

```typescript
// Backend: capture the device name
const deviceName = req.headers["x-device-name"] as string | undefined;
await db.session.create({
  data: {
    userId,
    refreshToken: hashedToken,
    clientType: "MOBILE",
    deviceName: deviceName?.slice(0, 100), // Limit length
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
    expiresAt,
  },
});
```

---

## Part 8: Summary — Browser vs Native Comparison

```
BROWSER                              NATIVE APP
═══════════════════════════════════  ══════════════════════════════════
Login response:   Set-Cookie         Login response:   JSON body tokens
Token storage:    Browser cookie jar Token storage:    Platform Keychain
Send on request:  Automatic          Send on request:  Authorization: Bearer
Refresh trigger:  401 interceptor    Refresh trigger:  401 interceptor OR timer
Refresh method:   Cookie sent auto   Refresh method:   Token in request body
Logout:           Clear cookies      Logout:           Clear Keychain + server
CSRF protection:  SameSite=Lax       CSRF protection:  N/A (no browser)
XSS protection:   HttpOnly           XSS protection:   N/A (native code)
```

---

## Practice Exercises

1. **Simulate a native client with curl:**
   ```bash
   # Login (opt into body tokens)
   curl -X POST http://localhost:4000/api/auth/login \
     -H "Content-Type: application/json" \
     -H "X-Auth-Token-Transport: body" \
     -d '{"email":"test@test.com","password":"Password1!"}'
   
   # Use the returned accessToken
   curl http://localhost:4000/api/auth/me \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
   
   # Refresh using body token
   curl -X POST http://localhost:4000/api/auth/refresh \
     -H "Content-Type: application/json" \
     -H "X-Auth-Token-Transport: body" \
     -d '{"refreshToken":"YOUR_REFRESH_TOKEN"}'
   ```

2. **Verify browser still works:** After adding the `X-Auth-Token-Transport` logic, log in from your browser (no header). Confirm cookies are still set normally and the dashboard loads.

3. **Replay attack on native:** Log in as a native client, get a `refreshToken`. Use it once to refresh. Try to use the OLD `refreshToken` again. Verify you get `401` with a replay attack error, and all your sessions are revoked.

4. **Multi-session:** Log in twice (simulating phone + tablet) with the curl command above. Go to the "Active Sessions" page in the browser app. Do you see both `MOBILE` sessions listed?
