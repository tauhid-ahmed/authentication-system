# M4: Next.js Frontend Integration

With our secure Express backend running, we now face the challenge of consuming it securely from a modern frontend framework. Next.js 15 uses the App Router, which blends Client Components (running in the browser) and Server Components (running in Node.js). 

This hybrid model requires us to handle authentication across two completely different environments.

---

## 1. The Cookie Problem

Our backend relies on `HttpOnly` cookies. 

### Client Components (Browser)
When a Client Component calls `fetch('/api/users/me')`, the browser automatically attaches the cookies (provided we set `credentials: 'include'`). This is straightforward.

### Server Components (Node.js)
Server Components render on the Next.js server *before* being sent to the browser. They do NOT have a `window` object, and they do NOT automatically attach the user's cookies when making outgoing `fetch` calls.

If a Server Component makes a `fetch` request to our Express API, the request will hit the API without any cookies, and the API will return `401 Unauthorized`.

#### The Solution: Manual Cookie Forwarding
To make authenticated requests from Server Components, we must manually extract the cookies from the incoming Next.js request and forward them to our Express API.

```typescript
// apps/web/src/lib/fetch.ts -> authFetchServer()

import { cookies } from "next/headers";

export async function authFetchServer(url: string, options: RequestInit = {}) {
  // 1. Get incoming cookies from the Next.js Request context
  const cookieStore = await cookies();
  
  // 2. Format them into a single Cookie string
  const allCookies = cookieStore.getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  // 3. Attach them to the outgoing fetch request
  const fetchOptions = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Cookie: allCookies, 
      ...options.headers,
    },
  };

  // 4. Make the request to the Express API
  return fetch(`${API_URL}${url}`, fetchOptions);
}
```

---

## 2. Next.js Middleware (UX vs Security)

In Next.js, `middleware.ts` runs on the Edge runtime for *every* request before the page renders. We use it to handle UI routing.

If a user tries to visit `/dashboard` but they don't have a token cookie, the middleware redirects them to `/login`.

### The Golden Rule of Frontend Middleware
**Frontend middleware is for User Experience, NOT Security.**

Why? Because an attacker can simply bypass your frontend and make HTTP requests directly to your Express API using Postman or `curl`. 

The Next.js middleware just prevents the annoying flash of a blank page before a redirect. The **True Security** lives exclusively in the Express backend `authenticate` middleware.

```typescript
// apps/web/src/middleware.ts
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // We check for the mere existence of the cookie. 
  // We do NOT verify the signature here (too slow for edge).
  const hasToken = request.cookies.has("access_token") || request.cookies.has("refresh_token");

  // Redirect unauthenticated users away from protected pages
  if (!hasToken && isProtectedRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect authenticated users away from the login page
  if (hasToken && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
}
```

---

## 3. Server-Side Authentication Checks

When rendering a protected page, we want to know *who* the user is, so we can display their profile or decide what UI elements to show (e.g., hiding the "Admin Panel" link).

We use our `authFetchServer` helper to ask the API.

```typescript
// apps/web/src/lib/auth.ts
export async function getCurrentUser() {
  try {
    const res = await authFetchServer("/api/auth/me", {
      next: { revalidate: 0 }, // Never cache this user data!
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data.data.user;
  } catch {
    return null;
  }
}
```

Then, in our Server Components, we protect the route layout:

```tsx
// apps/web/src/app/(protected)/layout.tsx
export default async function ProtectedLayout({ children }) {
  const user = await getCurrentUser();

  // If the API rejected the token, kick them to login
  if (!user) {
    redirect("/login");
  }

  return (
    <div>
      <nav>
        {/* Role-based UI rendering */}
        {user.role !== "USER" && <Link href="/admin">Admin</Link>}
      </nav>
      {children}
    </div>
  );
}
```

---

## 4. Summary

Our split architecture gives us the best of both worlds:
1. **Express API**: Handles the heavy lifting—database queries, cryptographic token signing/verification, and strict security rules.
2. **Next.js Web**: Focuses purely on rendering the UI, forwarding cookies to the API when Server Components need data.

Proceed to **M5: OAuth & Third-Party Logins** to learn how we integrate "Sign in with Google" seamlessly into this architecture.
