# A1: OAuth 2.0 Architectures (Backend-first vs Frontend-first)

**Track:** Architecture Deep Dive  
**Prerequisites:** M5 (OAuth 2.0)  
**Time:** ~2 hours  

---

## The Core Problem of OAuth

When integrating "Log in with Google/GitHub/etc.", there are three parties involved:
1. **The User** (Browser/App)
2. **The Authorization Server** (Google/GitHub)
3. **Your Application** (Frontend + Backend)

The goal is to get user data from Google, verify it, and issue *your own* application session (JWT/Refresh Token) to the user.

There are two primary ways to architect this flow: **Backend-first** (The Authorization Code Flow) and **Frontend-first** (The Implicit/Token Flow). 

---

## 1. Backend-First OAuth (Authorization Code Flow)

This is the **most secure** and standard approach. This is the pattern implemented in this repository (M5).

### How it works:
1. **Initiation:** The frontend redirects the user to the Backend (`/api/oauth/google`).
2. **Redirection:** The Backend generates a secure `state` parameter, saves it in a cookie, and redirects the user to Google.
3. **Consent:** The user logs in at Google and grants permission.
4. **Callback:** Google redirects the user back to the Backend (`/api/oauth/google/callback`) with a short-lived `code`.
5. **Exchange:** The Backend takes the `code` and exchanges it directly with Google server-to-server for an Access Token and User Profile.
6. **Session Creation:** The Backend looks up the user email in the DB, generates your app's JWT and Refresh Token, sets HttpOnly cookies, and redirects the user back to the frontend dashboard.

### Pros:
- **Maximum Security:** The Google Access Token is never exposed to the browser.
- **CSRF Protection:** The `state` parameter ensures the callback was initiated by your server.
- **Clean Frontend:** The frontend does literally nothing except provide an `<a>` tag pointing to `/api/oauth/google`.

### Cons:
- Requires a backend server (cannot be done with pure static site).
- The callback URL must be correctly configured in the Google Console.

---

## 2. Frontend-First OAuth (Implicit / Token Flow)

In this approach, the frontend handles the interaction with Google using an SDK (like Firebase Auth or Google Identity Services).

### How it works:
1. **Initiation:** The frontend loads the Google SDK and opens a popup.
2. **Consent:** The user logs in and grants permission.
3. **Callback:** Google returns an `id_token` (a JWT) directly to the frontend JavaScript.
4. **Transmission:** The frontend sends a `POST /api/auth/google-login` with the `id_token` in the body.
5. **Verification:** The Backend verifies the signature of the `id_token` using Google's public keys.
6. **Session Creation:** The Backend creates the user in the DB, generates your app's JWT/Refresh Token, sets HttpOnly cookies, and returns success.

### Pros:
- **Easier Frontend UX:** No full-page redirects (can use popups).
- **Decoupled:** The frontend SDK handles all the heavy lifting of the OAuth redirect dance.

### Cons:
- **Token Exposure:** The Google `id_token` is exposed to the frontend JavaScript (though usually short-lived).
- **Trust Issues:** The backend MUST rigorously verify the `id_token` signature and `aud` (audience) claim to ensure the token was meant for your app and wasn't stolen from another app.

---

## 3. The BFF Pattern (Backend For Frontend)

You will often hear the term **BFF** in modern enterprise architectures.

A BFF is an API gateway that exists solely to serve a specific frontend. In the context of Authentication, a BFF is responsible for translating stateless frontend requests into stateful backend sessions.

### How BFF Auth Works:
1. The Core API is fully stateless (expects JWTs in the `Authorization: Bearer <token>` header).
2. The Frontend cannot securely store JWTs (localStorage is vulnerable to XSS).
3. **The Solution:** The BFF sits in the middle.
4. The Frontend talks to the BFF using `HttpOnly` cookies.
5. The BFF reads the cookie, extracts the JWT, and forwards the request to the Core API with the `Authorization: Bearer` header.

### Why use a BFF?
If you have a massive microservice architecture with 50 APIs, you don't want every API to handle cookie parsing, CORS, and refresh token rotation. You build one BFF that handles the web session, and the microservices only deal with simple Bearer tokens.

### Our Architecture vs BFF
In this learning system, our Express API (`apps/api`) acts as a hybrid. It handles the business logic AND it parses the HttpOnly cookies directly. This is perfectly fine for small to medium apps. As you scale to microservices, you would extract the auth routes and cookie parsing into a BFF.

---

## Practice Exercises

1. **Trace the Backend-First Flow:** Open `apps/api/src/modules/oauth/oauth.controller.ts`. Read the `googleCallback` function. Where does the server-to-server exchange happen? How is the user profile extracted?
2. **Security Audit:** In the `googleCallback` function, find where the `state` parameter is verified. What would happen if an attacker sent a valid `code` to the callback URL without a valid `state` cookie?
3. **Mental Sandbox:** If you were building a React Native mobile app, which OAuth flow would you use? (Hint: Mobile apps can't easily use HttpOnly cookies for the initial OAuth redirect).
