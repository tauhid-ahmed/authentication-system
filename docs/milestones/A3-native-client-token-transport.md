# A3: Native Client Token Transport

**Track:** Architecture
**Prerequisites:** B1 (JWT Lifecycle), B2 (Token Rotation), F2 (Token Storage)
**Time:** ~1 hour

---

For copy/paste endpoint examples, request headers, and response shapes, use the
global [Multi-Client Auth API](../multi-client-api.md) reference.

## The Problem

HTTP-only cookies are excellent for browsers because the browser stores them, protects
them from JavaScript, and sends them automatically.

Mobile apps and desktop apps are different. They do not have the browser cookie jar
as their primary auth mechanism, so a backend that only accepts cookies is really a
browser backend, not a multi-client API.

---

## The Rule

Use transport based on client type:

| Client | Access token transport | Refresh token transport |
| --- | --- | --- |
| Browser web app | `HttpOnly` cookie | `HttpOnly` cookie |
| Mobile app | `Authorization: Bearer <accessToken>` | Request body or secure app storage |
| Desktop app | `Authorization: Bearer <accessToken>` | Request body or secure app storage |
| Service/API client | `Authorization: Bearer <accessToken>` | Client-specific secret flow |

The token lifecycle stays the same. Only the transport changes.

---

## Backend Contract

Browser login keeps working exactly as before:

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "user@example.com", "password": "Password1!" }
```

Response:

```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "email": "user@example.com" }
  },
  "message": "Login successful."
}
```

Native clients opt into response-body tokens:

```http
POST /api/auth/login
Content-Type: application/json
X-Auth-Token-Transport: body

{ "email": "user@example.com", "password": "Password1!" }
```

Response:

```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "email": "user@example.com" },
    "tokens": {
      "accessToken": "...",
      "refreshToken": "...",
      "sessionId": "..."
    }
  },
  "message": "Login successful."
}
```

Protected API calls then use:

```http
GET /api/auth/me
Authorization: Bearer <accessToken>
```

Refresh uses:

```http
POST /api/auth/refresh
Content-Type: application/json
X-Auth-Token-Transport: body

{ "refreshToken": "<refreshToken>" }
```

---

## Storage Guidance For Native Apps

Never store tokens in plain files or general preferences.

Use the platform secure storage:

| Platform | Recommended storage |
| --- | --- |
| iOS | Keychain |
| Android | EncryptedSharedPreferences or Keystore-backed storage |
| macOS | Keychain |
| Windows | Credential Manager or DPAPI-backed storage |
| Linux desktop | Secret Service / libsecret |

Keep access tokens short-lived. Store refresh tokens more carefully because they can
mint new access tokens.

---

## Practice Exercises

1. Log in with `X-Auth-Token-Transport: body` and confirm the response includes `tokens`.
2. Call `/api/auth/me` with `Authorization: Bearer <accessToken>` and no cookies.
3. Refresh with `{ "refreshToken": "..." }` and confirm the old refresh token no longer works.
4. Explain why the browser frontend should still prefer cookies even though the backend can return body tokens.
