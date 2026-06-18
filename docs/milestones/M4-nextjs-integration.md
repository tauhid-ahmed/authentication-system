# M4: Next.js Integration (Implementation Guide)

**Track:** Core Curriculum  
**Prerequisites:** M1 (MVP Auth)  
**Time:** ~2 hours  

---

## The Goal
In previous modules, we built our Express.js backend API and secured it with `HttpOnly` cookies. However, consuming this secure API from a hybrid framework like Next.js App Router presents a unique challenge: **We have to authenticate from two completely different environments** (the Node.js server and the user's Browser).

In this module, we implement the step-by-step code required to bridge Next.js with our backend.

---

## Step 1: The `authFetchServer` Utility

When a Next.js **Server Component** makes a `fetch()` request, it runs on the Next.js Node server. It does *not* have access to the browser's cookies automatically. We must manually extract the cookies from the incoming Next.js request and forward them to the Express API.

Open `apps/web/src/lib/fetch-server.ts`.

```typescript
import { cookies } from "next/headers";

export async function authFetchServer(url: string, options: RequestInit = {}) {
  // 1. Get the cookies that the browser sent to Next.js
  const cookieStore = await cookies();
  
  // 2. Serialize them into a standard Cookie header string
  const allCookies = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  // 3. Attach the Cookie string to the outgoing request
  const fetchOptions = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Cookie: allCookies, // 👈 This is the magic
      ...options.headers,
    },
  };

  // 4. Send the request to the Express API
  return fetch(`${process.env.NEXT_PUBLIC_API_URL}${url}`, fetchOptions);
}
```

This single utility is what allows our Server Components to fetch protected data securely!

---

## Step 2: Extracting the User Object (Server-Side)

Now that we can make authenticated requests from the server, we need a standard way to get the current user's profile before we render a page. 

Open `apps/web/src/lib/auth.ts`.

```typescript
import { authFetchServer } from "./fetch-server";

export async function getCurrentUser() {
  try {
    // Call the /me endpoint using our server-side utility
    const res = await authFetchServer("/api/auth/me", {
      // CRITICAL: We NEVER want Next.js to cache this response.
      // If we cached it, User A might see User B's profile!
      next: { revalidate: 0 }, 
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data.data.user;
  } catch {
    return null; // Express API is down or token is invalid
  }
}
```

---

## Step 3: Protecting the UI with Middleware

If a user tries to load `/dashboard` without being logged in, we want to immediately redirect them to `/login`. We *could* do this in the Server Component, but Next.js provides `middleware.ts` which runs at the **Edge**, long before React starts rendering.

Open `apps/web/src/proxy.ts` (or `middleware.ts`).

### The Golden Rule of Next.js Middleware
> [!WARNING]
> Next.js Edge Middleware cannot verify JWT signatures because it lacks access to native Node `crypto` modules. **Frontend middleware is for User Experience, NOT Security.** Your Express backend is responsible for true security.

```typescript
import { NextResponse, NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Check if the token cookie EXISTS. We do NOT verify it.
  const hasToken = request.cookies.has("access_token") || request.cookies.has("refresh_token");

  const isProtectedRoute = pathname.startsWith("/dashboard") || pathname.startsWith("/admin");
  const isAuthRoute = pathname === "/login" || pathname === "/signup";

  // 2. UX Redirect: Kick unauthenticated users out
  if (!hasToken && isProtectedRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 3. UX Redirect: Kick logged-in users away from the login page
  if (hasToken && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Allow the request to proceed to the Server Component
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

---

## Step 4: The Protected Layout (Server Component)

Finally, we combine everything in a layout that wraps our protected routes. 

Open `apps/web/src/app/(protected)/layout.tsx`.

```tsx
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ProtectedLayout({ children }) {
  // 1. Fetch the user using the cookies
  const user = await getCurrentUser();

  // 2. The Next.js middleware said they had a cookie, but the Express API 
  // might have rejected it (expired or revoked). If so, kick them out!
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="app-container">
      <Sidebar user={user} />
      <main>{children}</main>
    </div>
  );
}
```

Notice how the `user` object is fetched *once* in the Layout on the Server, and can be passed down to Client Components as React props, perfectly keeping state in memory without exposing tokens!

---

## Practice Exercises

1. **Test the Cache:** In `apps/web/src/lib/auth.ts`, remove `next: { revalidate: 0 }`. Log in, change your name in the database, and refresh. Notice how your name doesn't update? This is why preventing caching on user data is critical.
2. **Bypass the Middleware:** In Chrome DevTools, add a fake cookie named `access_token` with the value `fake-token`. Refresh the page. You will bypass the Next.js `middleware.ts` (because the cookie *exists*), but the Express API will reject it and the `layout.tsx` will redirect you back to login. This proves middleware is just for UX!
3. **Trace the Network:** Open your Next.js terminal logs. How many times is `/api/auth/me` called when you load the dashboard?
