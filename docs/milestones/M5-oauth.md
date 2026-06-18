# M5: OAuth 2.0 & Third-Party Logins

Users don't like creating new passwords. Providing "Sign in with Google" or "Sign in with GitHub" significantly increases conversion rates.

In this milestone, we explore how to integrate external Identity Providers (IdPs) into our system without compromising our own security architecture.

---

## 1. The OAuth 2.0 Flow (Authorization Code + PKCE)

There are two ways to implement OAuth:
1. **Frontend-First**: The frontend uses a Google SDK, gets a token, and sends it to the backend. (Easier, but less secure; the backend must trust the frontend).
2. **Backend-First (The right way)**: The backend redirects the user to Google, Google redirects back to the backend with a temporary `code`, and the backend exchanges the code for a token. 

We use the **Backend-First** approach with **PKCE (Proof Key for Code Exchange)**.

### Why PKCE?
Without PKCE, if a malicious app intercepts the callback URL containing the `code`, it can steal the user's account. 
PKCE fixes this:
1. Our server generates a secret `verifier` and its hash, the `challenge`.
2. We send the `challenge` to Google when redirecting the user.
3. When exchanging the `code` later, we send the original `verifier` to Google.
4. Google hashes the `verifier`. If it matches the `challenge`, Google knows we are the legitimate client.

---

## 2. The Implementation Architecture

Let's trace the flow in `apps/api/src/modules/oauth/oauth.routes.ts`.

### Step 1: Initiation (`/api/oauth/google/authorize`)
The user clicks the "Sign in with Google" button. The frontend redirects them to this backend endpoint.

```typescript
// Generate PKCE secrets
const { verifier, challenge, state } = generatePKCE();
pkceStore.set(state, { verifier, createdAt: Date.now() }); // Store temporarily

// Redirect to Google's consent screen
const params = new URLSearchParams({
  client_id: env.GOOGLE_CLIENT_ID,
  redirect_uri: env.GOOGLE_CALLBACK_URL,
  response_type: "code",
  state, // Prevents CSRF attacks
  code_challenge: challenge,
  code_challenge_method: "S256",
  scope: "openid email profile",
});
res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
```

### Step 2: The Callback (`/api/oauth/google/callback`)
After the user agrees, Google redirects them back to our server with a `code` in the URL query string.

1. We retrieve the `verifier` from our temporary store using the `state` parameter.
2. We make a POST request to Google's token endpoint, trading the `code` and `verifier` for an `access_token` and `id_token`.
3. We use the `access_token` to fetch the user's profile information from Google.

```typescript
// Fetch user info from Google
const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
  headers: { Authorization: `Bearer ${tokenData.access_token}` },
});
const googleUser = await userInfoRes.json();
```

---

## 3. Unifying the User Pipeline

Once we have the `googleUser` profile (which contains their Google ID, email, name, and picture), we hit a critical architectural juncture.

We do **not** want two separate authentication systems. We want the OAuth user to be treated exactly like a password-credential user inside our application.

### Account Linking and Creation
In `oauthService.findOrCreateOAuthUser`:

1. **Does the OAuth Account exist?** We check if this specific Google ID is already linked to a user. If yes, log them in.
2. **Does the Email exist?** We check if a user registered via password with `alice@gmail.com`. If they did, and they just clicked "Sign in with Google", we automatically link their Google account to their existing password account.
3. **New User?** If neither exists, we create a new `User` record (with a `null` passwordHash) and a linked `OAuthAccount` record.

### Issuing Our Own Tokens
This is the most important part: **We do not use Google's token inside our app.**

Once we have verified the user's identity via Google, we generate our own 5-minute Access Token and 30-day Refresh Token, exactly like we do in the standard `/login` route.

```typescript
// 1. Create a session in our database
const session = await createSession(user.id, deviceInfo, ipAddress);

// 2. Generate our internal JWT
const accessToken = signAccessToken({ sub: user.id, role: user.role });

// 3. Set the cookies
res.cookie(COOKIE_NAMES.ACCESS_TOKEN, accessToken, ...);
res.cookie(COOKIE_NAMES.REFRESH_TOKEN, session.refreshToken, ...);

// 4. Redirect the browser to the frontend dashboard
res.redirect(`${env.WEB_URL}/dashboard`);
```

From this point forward, the frontend doesn't know (or care) that the user logged in with Google. It just has an `access_token` cookie, and the `authenticate` middleware processes it identically to a password login.

---

## 4. Summary

By keeping the OAuth flow entirely on the backend, we achieve:
1. **Higher Security**: Tokens and secrets are never exposed to the browser javascript.
2. **Unified Architecture**: Every user, regardless of how they logged in, receives the exact same internal JWTs and follows the exact same session rules.

Proceed to **M6: Advanced Security & Observability** to learn how we protect this entire system from brute force attacks and audit everything.
