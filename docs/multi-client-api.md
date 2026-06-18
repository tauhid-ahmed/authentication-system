# Multi-Client Auth API

This backend supports more than one client type:

- Browser web apps
- Mobile apps
- Desktop apps
- API tools and service clients

The token lifecycle is the same for all clients:

1. Login or signup creates an access token and refresh token.
2. Access tokens authenticate normal API requests.
3. Refresh tokens rotate through `/api/auth/refresh`.
4. Logout revokes the refresh-token session.

Only the token transport changes.

---

## Client Transport Matrix

| Client type | Access token | Refresh token | Why |
| --- | --- | --- | --- |
| Browser web app | `HttpOnly` cookie | `HttpOnly` cookie | Protects tokens from browser JavaScript and works with `credentials: "include"`. |
| Mobile app | `Authorization: Bearer <accessToken>` | JSON body or `X-Refresh-Token` | Mobile apps do not use browser cookies as their main auth storage. |
| Desktop app | `Authorization: Bearer <accessToken>` | JSON body or `X-Refresh-Token` | Desktop apps need explicit token storage and request headers. |
| API client | `Authorization: Bearer <accessToken>` | JSON body or `X-Refresh-Token` | Postman, curl, CLIs, and SDKs should not depend on browser cookies. |

Browsers should prefer cookies. Native clients should prefer Bearer tokens.

---

## Opting Into Body Tokens

By default, login/signup set secure cookies and return the user.

Native clients request token values in the response body with:

```http
X-Auth-Token-Transport: body
```

You can also include this in JSON:

```json
{
  "tokenTransport": "body",
  "clientType": "mobile"
}
```

The header is preferred because it describes transport instead of user data.

---

## Signup

```http
POST /api/auth/signup
Content-Type: application/json
X-Auth-Token-Transport: body
```

```json
{
  "email": "user@example.com",
  "password": "Password1!",
  "confirmPassword": "Password1!",
  "name": "Example User"
}
```

Response for native clients:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clx...",
      "email": "user@example.com",
      "name": "Example User",
      "role": "USER",
      "emailVerified": false
    },
    "tokens": {
      "accessToken": "eyJ...",
      "refreshToken": "eyJ...",
      "sessionId": "clx..."
    }
  },
  "message": "Account created successfully."
}
```

Browser clients receive the same user data without `tokens` unless they opt in.
They also receive `Set-Cookie` headers.

---

## Login

```http
POST /api/auth/login
Content-Type: application/json
X-Auth-Token-Transport: body
```

```json
{
  "email": "user@example.com",
  "password": "Password1!"
}
```

Use the returned access token on protected routes:

```http
GET /api/auth/me
Authorization: Bearer <accessToken>
```

---

## Refresh

Browser clients:

```http
POST /api/auth/refresh
Cookie: refresh_token=<refreshToken>
```

Native clients:

```http
POST /api/auth/refresh
Content-Type: application/json
X-Auth-Token-Transport: body
```

```json
{
  "refreshToken": "<refreshToken>"
}
```

Alternative native header:

```http
X-Refresh-Token: <refreshToken>
```

Refresh response for native clients:

```json
{
  "success": true,
  "data": {
    "message": "Tokens refreshed.",
    "tokens": {
      "accessToken": "eyJ...",
      "refreshToken": "eyJ...",
      "sessionId": "clx..."
    }
  },
  "message": "Tokens refreshed."
}
```

The refresh token is rotated. Store the new refresh token and discard the old one.

---

## Logout

Browser clients can log out with cookies:

```http
POST /api/auth/logout
```

Native clients should send both tokens if available:

```http
POST /api/auth/logout
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "refreshToken": "<refreshToken>"
}
```

The backend clears browser cookies when present and revokes the matching session
when it can verify the refresh token.

---

## Storage Rules

Do not store tokens in plain text files, unencrypted preferences, or browser
`localStorage`.

Recommended native storage:

| Platform | Storage |
| --- | --- |
| iOS | Keychain |
| Android | EncryptedSharedPreferences or Keystore-backed storage |
| macOS | Keychain |
| Windows | Credential Manager or DPAPI-backed storage |
| Linux desktop | Secret Service / libsecret |

Access tokens should be short-lived. Refresh tokens should be treated like
password-equivalent credentials because they can mint new access tokens.

---

## Security Notes

- `Authorization: Bearer` avoids browser CSRF because tokens are not sent automatically.
- Cookie auth needs CORS credentials and SameSite/CSRF thinking because browsers attach cookies automatically.
- Never send response-body tokens to browser JavaScript unless you have a very specific reason and accept the XSS risk.
- Refresh token rotation applies to every client type.
- A reused refresh token should be treated as a security event.
