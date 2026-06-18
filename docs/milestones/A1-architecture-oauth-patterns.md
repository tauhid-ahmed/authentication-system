# A1: OAuth 2.0 Architectures — Complete Reference

**Track:** Architecture Deep Dive  
**Prerequisites:** M5 (OAuth 2.0)  
**Time:** ~2.5 hours  

---

## The Core Problem: Why OAuth Exists

When a user clicks "Sign in with Google," they want to give **your app** permission to see their email and profile. But they should never give your app their Google password.

OAuth 2.0 is the framework that solves this by introducing an intermediary: the **Authorization Server** (Google, GitHub, etc.). The user authenticates with Google, Google gives your app a code, and your app exchanges that code for verified user data. At no point does your app ever see the user's Google credentials.

There are three parties in every OAuth flow:
1. **Resource Owner:** The user.
2. **Client:** Your application (the frontend and/or backend).
3. **Authorization Server:** Google, GitHub, Facebook, etc.

---

## Pattern 1: Backend-First OAuth (Authorization Code Flow)

This is the **enterprise standard** and the most secure approach. It is the pattern implemented in this codebase (see M5).

### The Complete Flow, Step by Step

**Step 1: Frontend provides a simple link.**
```tsx
// apps/web/src/app/(auth)/login/page.tsx
<a href="http://localhost:5000/api/oauth/google">
  Sign in with Google
</a>
```
The frontend does nothing else. The link goes to YOUR backend.

---

**Step 2: Backend initiates the flow with CSRF protection.**
```typescript
// apps/api/src/modules/oauth/oauth.controller.ts
export function googleLogin(req, res) {
  const state = crypto.randomBytes(32).toString("hex"); // CSRF token
  res.cookie("oauth_state", state, { httpOnly: true, maxAge: 600_000 }); // 10 min

  const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleUrl.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID);
  googleUrl.searchParams.set("redirect_uri", "http://localhost:5000/api/oauth/google/callback");
  googleUrl.searchParams.set("response_type", "code");
  googleUrl.searchParams.set("scope", "email profile");
  googleUrl.searchParams.set("access_type", "offline"); // Gives us a refresh_token from Google
  googleUrl.searchParams.set("state", state); // Attach CSRF token

  res.redirect(googleUrl.toString()); // 302 → Google
}
```

The browser leaves your site entirely and lands on Google's login page.

---

**Step 3: User grants consent on Google's page.**

Google shows a screen: "ExecutionMastery wants to access your email and profile. Allow?"  
The user clicks **Allow**.

---

**Step 4: Google redirects back to your backend callback.**

```
GET http://localhost:5000/api/oauth/google/callback
  ?code=4/P7q7W91a-oMsCeLvIaQm6bTrgtp7
  &state=a1b2c3d4e5f6...
```

---

**Step 5: Backend validates CSRF state.**
```typescript
export async function googleCallback(req, res) {
  const { code, state } = req.query;
  const storedState = req.cookies.oauth_state;

  if (!state || !storedState || state !== storedState) {
    // State mismatch = someone forged this request
    return res.redirect("http://localhost:3000/login?error=csrf_failure");
  }
  res.clearCookie("oauth_state");
```

---

**Step 6: Backend exchanges code for tokens (server-to-server).**
```typescript
  // This is a private, server-to-server HTTP call. 
  // The browser never sees the Google Access Token.
  const tokenRes = await axios.post("https://oauth2.googleapis.com/token", {
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET, // Secret never leaves server
    code,
    redirect_uri: "http://localhost:5000/api/oauth/google/callback",
    grant_type: "authorization_code",
  });

  const { access_token } = tokenRes.data;
```

---

**Step 7: Fetch user profile using the Google token.**
```typescript
  const profileRes = await axios.get("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  const { email, name } = profileRes.data;
```

---

**Step 8: Issue your own app session and redirect to frontend.**
```typescript
  const result = await authService.oauthLogin(email, name);
  
  // Set YOUR application's HttpOnly cookies
  res.cookie("access_token", result.accessToken, { httpOnly: true, ... });
  res.cookie("refresh_token", result.rawRefreshToken, { httpOnly: true, ... });

  // Redirect browser back to frontend — fully logged in!
  res.redirect("http://localhost:3000/dashboard");
}
```

### Why This is Secure
- `client_secret` is **never sent to the browser**
- Google tokens are **never exposed to JavaScript**
- The CSRF `state` cookie prevents token injection attacks
- Your app issues its own short-lived JWT, decoupled from Google's session

---

## Pattern 2: Frontend-First OAuth (Token/ID Token Flow)

Used by Firebase Auth, Supabase Auth, Auth0, and similar services that provide a JavaScript SDK.

### The Complete Flow, Step by Step

**Step 1: Frontend loads the Google Identity Services SDK.**
```html
<script src="https://accounts.google.com/gsi/client"></script>
```

**Step 2: Frontend renders a button and handles the response.**
```typescript
google.accounts.id.initialize({
  client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  callback: async (response) => {
    // response.credential is a Google id_token (JWT)
    await fetch("/api/auth/google-login", {
      method: "POST",
      body: JSON.stringify({ idToken: response.credential }),
    });
  },
});
```

**Step 3: Backend verifies the Google id_token.**
```typescript
import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function googleLogin(req, res) {
  const { idToken } = req.body;
  
  // Verify using Google's public keys
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID, // Must match!
  });
  
  const { email, name } = ticket.getPayload();
  
  // Proceed to create/find user in DB, issue your own tokens...
  const result = await authService.oauthLogin(email, name);
  res.cookie("access_token", result.accessToken, { httpOnly: true });
  // ...
}
```

### Key Differences from Backend-First
| | Backend-First | Frontend-First |
|---|---|---|
| Google token in browser | ❌ Never | ✅ Briefly (id_token) |
| UX | Full-page redirect | Popup (no page change) |
| Complexity | Higher backend setup | Easier frontend SDK |
| client_secret needed | ✅ Yes | ❌ No |
| Use when | Most web apps | Firebase, Supabase, mobile |

---

## Pattern 3: The BFF (Backend For Frontend) Architecture

As companies grow from a single API to dozens of microservices, they face a new problem: every microservice would need to parse cookies, handle refresh token rotation, and manage CORS. This doesn't scale.

The BFF pattern solves this.

### Architecture Diagram

```ascii
Browser                     BFF                     Microservices
   │                         │                           │
   │  Request + Cookie        │                           │
   ├────────────────────────►│                           │
   │                         │ Validate cookie           │
   │                         │ Extract JWT               │
   │                         │ Forward: Bearer <jwt>     │
   │                         ├──────────────────────────►│
   │                         │                           │ Stateless:
   │                         │                           │ verify JWT only
   │                         │     Response              │
   │                         │◄──────────────────────────┤
   │      Response            │                           │
   │◄────────────────────────┤                           │
```

### The Responsibilities Split
- **BFF:** Session management, cookie parsing, refresh token rotation, CORS, CSRF.
- **Microservices:** Pure business logic, expect only `Authorization: Bearer <jwt>`.

### Our System vs BFF
Our Express API (`apps/api`) is a **monolith** that handles both roles — it manages sessions AND contains business logic. This is perfectly appropriate for apps serving up to hundreds of thousands of users. As you scale:
1. Extract auth routes (`/login`, `/signup`, `/refresh`) into a dedicated **Auth Microservice**
2. Extract cookie-to-Bearer forwarding into a **BFF/API Gateway**
3. Let remaining business services only accept Bearer tokens

---

## Practice Exercises

1. **State Forgery Test:** Comment out the `state !== storedState` check. Now open Postman and manually send a GET request to `/api/oauth/google/callback?code=fake&state=anything`. Does the callback try to proceed? Why is this dangerous?
2. **Frontend-First Simulation:** Read the `google-auth-library` `verifyIdToken` docs. What happens if someone takes an `id_token` issued for a *different* Google app and posts it to your backend? Why does the `audience` check protect against this?
3. **Draw the BFF:** On paper, sketch an architecture with: a Next.js frontend, a BFF written in Node.js, and three microservices (Users, Orders, Notifications). Draw how a logged-in user's request to fetch their orders flows through the system.
