# F1: The Frontend Token Refresh Interceptor

**Track:** Frontend Deep Dive  
**Prerequisites:** M4 (Next.js Integration), B2 (Backend Token Rotation)  
**Time:** ~2 hours  

---

## The Frontend's Responsibility

In a secure JWT architecture, the frontend (Next.js, React, Vue, etc.) has three main responsibilities regarding authentication:
1. **Send credentials securely** (letting the browser handle HttpOnly cookies).
2. **Handle 401 Unauthorized errors gracefully** (silently refreshing tokens).
3. **Handle security events** (logging the user out if a token replay is detected).

The frontend **DOES NOT** store tokens in `localStorage`, decode JWTs to check expiration times manually, or manage the refresh token rotation logic directly. It acts as an intelligent router for HTTP requests.

---

## 1. Why We Wrap `fetch`

Instead of writing error handling logic in every component:
```typescript
// BAD: Repeating error logic everywhere
const res = await fetch("/api/data");
if (res.status === 401) {
  // Try to refresh...
  // Wait, what if it fails?
  // What if 3 components do this at the same time?
}
```

We create a single, centralized wrapper called `authFetchClient` (or use Axios interceptors). Every API call in the application goes through this wrapper.

---

## 2. The Auto-Refresh Flow

Here is the exact step-by-step process of what happens in `authFetchClient` when an access token expires:

1. **The Initial Request:** The frontend makes a request to `/api/users/me`.
2. **The 401 Response:** The backend returns `401 Unauthorized` with `{"error": {"code": "TOKEN_EXPIRED"}}`.
3. **The Catch:** `authFetchClient` intercepts this response.
4. **The Refresh:** It pauses the original request and sends a `POST` to `/api/auth/refresh`.
5. **The Retry:** If the refresh succeeds, the backend sets a new `access_token` cookie. The frontend then **retries** the original `/api/users/me` request.
6. **The Success:** The retried request succeeds, and the React component gets the data. *The user never noticed anything happened.*

---

## 3. The Concurrency Problem (The Race Condition)

Imagine a dashboard that loads three things in parallel:
1. User Profile (`/api/users/me`)
2. Recent Activity (`/api/activity`)
3. Notifications (`/api/notifications`)

If the access token expires, all three requests will fail with `401` at the exact same millisecond.

### What happens without a Concurrency Lock?
- Request 1 sends `POST /refresh`
- Request 2 sends `POST /refresh`
- Request 3 sends `POST /refresh`

The backend processes Request 1, rotates the token, and revokes the old refresh token.
When the backend processes Request 2, it sees the old refresh token being used *again*. 
**The backend detects a Replay Attack!** It revokes ALL sessions and logs the user out.

### The Solution: The Concurrency Lock

We must guarantee that only ONE refresh request happens, no matter how many API calls fail simultaneously. The other failed API calls must **wait** for that single refresh to finish.

```typescript
// apps/web/src/lib/fetch-client.ts

// Global state outside the function
let isRefreshing = false;
let pendingRefreshPromise: Promise<boolean> | null = null;

function refreshAccessToken(): Promise<boolean> {
  // If a refresh is NOT already in progress, start one
  if (!isRefreshing) {
    isRefreshing = true;
    
    // Save the promise to the global variable
    pendingRefreshPromise = fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include", // Send the HttpOnly refresh token
    })
      .then(res => res.ok)
      .catch(() => false)
      .finally(() => {
        // Clean up when done
        isRefreshing = false;
        pendingRefreshPromise = null;
      });
  }
  
  // Return the SAME promise to every caller
  return pendingRefreshPromise!;
}
```

Now, when the 3 parallel requests fail:
- Request 1 calls `refreshAccessToken()`. It sets `isRefreshing = true` and makes the HTTP call.
- Request 2 calls `refreshAccessToken()`. It sees `isRefreshing = true` and just waits on `pendingRefreshPromise`.
- Request 3 calls `refreshAccessToken()`. It also waits on `pendingRefreshPromise`.

When the HTTP call finishes, the promise resolves. All 3 requests wake up and retry their original endpoints using the new cookie!

---

## 4. Handling Security Events (Replay Attacks)

What if the `/refresh` endpoint returns a `401 TOKEN_REUSE_DETECTED`?

This means the backend caught someone trying to use an old refresh token. This is a severe security event. The frontend must immediately flush state and redirect the user to login.

```typescript
if (code === "TOKEN_REUSE_DETECTED") {
  // Possible replay/token-theft attack — force a clean logout
  console.error("[Auth] Security event! Logging out.");
  window.location.href = "/login?reason=security_event";
}
```

---

## 5. Next.js Specifics: Server vs Client Fetching

Next.js App Router introduced Server Components. This creates a split in how we fetch data:

### Client Components (`"use client"`)
Code runs in the browser. The browser automatically attaches `HttpOnly` cookies to every `fetch` call if we set `credentials: "include"`. 

We use `authFetchClient` here because it handles the interactive refresh flow described above.

### Server Components
Code runs on the Node.js server. **There is no browser automatically attaching cookies.** If a Server Component makes a `fetch` call to the Express API, it will fail unless we manually attach the cookies from the incoming Next.js request.

```typescript
// apps/web/src/lib/fetch-server.ts

import { cookies } from "next/headers";

export async function authFetchServer(url: string, options: RequestInit = {}) {
  // 1. Manually extract cookies from the Next.js request
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  // 2. Manually inject them into the outgoing fetch request
  const fetchOptions = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Cookie: allCookies, // <--- Crucial!
      ...options.headers,
    },
  };

  return fetch(`${API_URL}${url}`, fetchOptions);
}
```

**Why doesn't `authFetchServer` do auto-refresh?**
Server Components render once and send HTML to the browser. If a Server Component gets a `401 TOKEN_EXPIRED`, it cannot easily tell the browser to set a new cookie. Instead, the Server Component usually throws an error or redirects to login, relying on the Client Components or the Proxy Middleware to handle the state.

---

## Practice Exercises

1. **Test the Concurrency Lock:** Open `apps/web/src/lib/fetch-client.ts`. Comment out the `if (!isRefreshing)` check (so it always makes a fetch call). Log in, set your token expiry to 10 seconds, and refresh the dashboard. Watch the Network tab. What happens?
2. **Examine the headers:** In the Network tab, look at a request made by `authFetchClient`. Find the `Cookie` header. What does it contain?
3. **Trace Server Fetch:** Look at `apps/web/src/app/(protected)/dashboard/page.tsx`. Notice it uses `authFetchServer`. Why does it need `authFetchServer` instead of `authFetchClient`?
