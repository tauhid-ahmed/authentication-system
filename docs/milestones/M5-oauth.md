# M5: OAuth 2.0 (Google) Implementation Guide

**Track:** Core Curriculum  
**Prerequisites:** M1 (MVP Auth)  
**Time:** ~2.5 hours  

---

## The Goal
In this module, we implement "Sign in with Google" using the highly secure **Backend-First Authorization Code Flow**. 

Instead of letting the frontend handle Google tokens, the entire flow happens on the backend. The browser is merely redirected between URLs. This ensures Google tokens never touch JavaScript.

---

## Step 1: Initiating the Flow (Frontend)

The frontend's only job is to provide an anchor tag.
```tsx
// apps/web/src/app/(auth)/login/page.tsx
<a href="http://localhost:5000/api/oauth/google">
  Sign in with Google
</a>
```

When the user clicks this link, they leave our Next.js application completely and hit our Express API.

---

## Step 2: The Login Endpoint & CSRF Protection (Backend)

Open `apps/api/src/modules/oauth/oauth.controller.ts`.

When the user hits `/api/oauth/google`, we must generate the Google login URL and redirect them to it. But we must include a `state` parameter to prevent CSRF attacks (e.g., an attacker tricking a user into logging into the attacker's account).

```typescript
import crypto from "crypto";

export function googleLogin(req, res) {
  // 1. Generate a random "state" string
  const state = crypto.randomBytes(32).toString("hex");

  // 2. Store the state in a highly secure, short-lived HttpOnly cookie
  res.cookie("oauth_state", state, {
    httpOnly: true,
    maxAge: 1000 * 60 * 10, // 10 minutes
    sameSite: "lax",
  });

  // 3. Construct the Google URL
  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.append("client_id", process.env.GOOGLE_CLIENT_ID);
  googleAuthUrl.searchParams.append("redirect_uri", "http://localhost:5000/api/oauth/google/callback");
  googleAuthUrl.searchParams.append("response_type", "code");
  googleAuthUrl.searchParams.append("scope", "email profile");
  googleAuthUrl.searchParams.append("state", state); // 👈 Attach the state

  // 4. Redirect the browser to Google
  res.redirect(googleAuthUrl.toString());
}
```

---

## Step 3: The Callback Endpoint

The user logs into Google and grants permission. Google redirects their browser back to our API:
`GET /api/oauth/google/callback?code=4/P7q...&state=xyz`

### 3.1 Validate the State
```typescript
export async function googleCallback(req, res) {
  const { code, state } = req.query;
  const storedState = req.cookies.oauth_state;

  // If the states don't match, the request was forged!
  if (!state || !storedState || state !== storedState) {
    return res.redirect("http://localhost:3000/login?error=csrf");
  }

  // Clear the state cookie since it was used
  res.clearCookie("oauth_state");
```

### 3.2 Exchange the Code for Tokens
Our backend makes a direct, server-to-server POST request to Google.
```typescript
  // Call Google's token endpoint
  const tokenResponse = await axios.post("https://oauth2.googleapis.com/token", {
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    code,
    redirect_uri: "http://localhost:5000/api/oauth/google/callback",
    grant_type: "authorization_code",
  });

  const { id_token, access_token } = tokenResponse.data;
```

### 3.3 Get the User Profile
We use Google's `access_token` to fetch the user's profile.
```typescript
  const profileResponse = await axios.get("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  const { email, name, id: googleId } = profileResponse.data;
```

---

## Step 4: Account Linking & Token Issuance

Now we have the verified `email` and `name` from Google. We pass this to our `authService`.

```typescript
// apps/api/src/modules/auth/auth.service.ts -> oauthLogin()

export async function oauthLogin(email, name, googleId) {
  // 1. Check if the user already exists
  let user = await db.user.findUnique({ where: { email } });

  if (user) {
    // If they exist but signed up with a password earlier, we still log them in!
    // We seamlessly "link" their Google login to their existing account based on email.
  } else {
    // 2. Create the user if they don't exist
    user = await db.user.create({
      data: {
        email,
        name,
        // passwordHash is NULL!
      }
    });
  }

  // 3. Issue our own Application Tokens!
  const accessToken = signAccessToken(user.id, user.role);
  const rawRefreshToken = crypto.randomBytes(64).toString("hex");
  await createSessionInDatabase(user.id, rawRefreshToken);

  return { accessToken, refreshToken };
}
```

Finally, the controller sets the cookies and redirects the user back to the Next.js dashboard!
```typescript
  // Back in oauth.controller.ts
  const result = await authService.oauthLogin(email, name, googleId);

  res.cookie("access_token", result.accessToken, getAccessTokenCookieOptions());
  res.cookie("refresh_token", result.refreshToken, getRefreshTokenCookieOptions());

  // Redirect to the frontend dashboard!
  return res.redirect("http://localhost:3000/dashboard");
}
```

---

## Practice Exercises

1. **State Validation Check:** Comment out the `state !== storedState` check in your callback endpoint. Notice how the flow still works. Now, manually change the `state` in the URL Google redirects you to. Why is it dangerous to accept this request without validation?
2. **Account Merging:** Sign up normally with `your.email@gmail.com` and a password. Then log out, and use "Sign in with Google" with the exact same email. Notice how the backend logs you into the exact same account instead of throwing an error.
3. **Null Password Security:** Try to log in via the normal email/password form using the email of an account that *only* ever used Google login. Does the backend crash? Check M1 to see why `if (!user || !user.passwordHash)` protects us.
