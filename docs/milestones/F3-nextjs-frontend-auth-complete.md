# F3: Next.js Frontend Auth — The Complete Guide

**Track:** Frontend Deep Dives  
**Prerequisites:** M4 (Next.js Integration), F1 (Fetch Interceptor), F2 (Token Storage), B6 (Multi-Client API)  
**Time:** ~3 hours  

---

> **What this covers:** Everything the Next.js App Router frontend needs to implement a production-ready auth system — from the initial page load to token refresh, role-based UI rendering, protected routes, and graceful logout. No hand-waving. Every line of code explained.

---

## Part 1: The Mental Model — Two Environments, One App

Next.js App Router runs code in **two completely different environments**:

```
┌─────────────────────────────────────────────────────────────────┐
│                       NEXT.JS APP                               │
│                                                                 │
│   SERVER ENVIRONMENT              CLIENT ENVIRONMENT            │
│   (Node.js on the server)         (Browser JavaScript)         │
│                                                                 │
│   ✅ Can read cookies             ✅ Can read cookies           │
│      via next/headers                via document.cookie        │
│                                      (but HttpOnly = blocked)  │
│   ✅ Can fetch API directly        ✅ Fetches API via browser  │
│   ✅ Server Components             ✅ Client Components         │
│   ✅ Server Actions                ✅ React hooks               │
│   ❌ No window/document            ❌ No next/headers           │
│   ❌ No localStorage               ❌ No direct cookie access   │
│      (Node has no localStorage)       (HttpOnly blocks JS)     │
└─────────────────────────────────────────────────────────────────┘
```

**The consequence:** You need **two separate fetch utilities** — one for each environment.

---

## Part 2: The Two Fetch Utilities

### 2.1 `authFetchServer` — For Server Components & Server Actions

This runs on Node.js. It manually forwards the browser's cookies to the Express API.

```typescript
// apps/web/src/lib/fetch-server.ts
import { cookies } from "next/headers"; // Server-only import

export async function authFetchServer<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: string | null; status: number }> {
  const cookieStore = await cookies();

  // Forward ALL browser cookies to the API
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  try {
    const res = await fetch(`${process.env.API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
        ...options.headers,
      },
      // CRITICAL: Never cache authenticated responses
      // next: { revalidate: 0 } works in Next.js 14
      // In Next.js 15, use cache: "no-store"
      cache: "no-store",
    });

    if (res.status === 204) return { data: null, error: null, status: 204 };

    const json = await res.json();

    if (!res.ok) {
      return { data: null, error: json.error || "Request failed", status: res.status };
    }

    return { data: json.data ?? json, error: null, status: res.status };
  } catch (err) {
    console.error(`[authFetchServer] ${path}:`, err);
    return { data: null, error: "Network error", status: 0 };
  }
}
```

### 2.2 `authFetchClient` — For Client Components & React Hooks

This runs in the browser. It uses `credentials: "include"` to send cookies automatically AND has a built-in 401 interceptor that silently refreshes the token.

```typescript
// apps/web/src/lib/fetch-client.ts
"use client"; // Explicitly client-only

// Concurrency lock: prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (value: string) => void;
  reject: (reason?: any) => void;
}> = [];

async function waitForRefresh(): Promise<void> {
  return new Promise((resolve, reject) => {
    refreshQueue.push({ resolve: () => resolve(), reject });
  });
}

function resolveRefreshQueue() {
  refreshQueue.forEach(({ resolve }) => resolve(""));
  refreshQueue = [];
}

function rejectRefreshQueue(error: Error) {
  refreshQueue.forEach(({ reject }) => reject(error));
  refreshQueue = [];
}

async function silentRefresh(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include", // Sends refresh_token cookie automatically
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function authFetchClient<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: string | null; status: number }> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";

  const makeRequest = () =>
    fetch(`${baseUrl}${path}`, {
      ...options,
      credentials: "include", // ← Always send cookies
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

  let res = await makeRequest();

  // ── 401 Handler: Silent Token Refresh ────────────────────────────
  if (res.status === 401) {
    const errorBody = await res.json().catch(() => ({}));

    // Only attempt refresh if the error is specifically "TOKEN_EXPIRED"
    // (not "Invalid token" or "Forbidden")
    if (errorBody.code !== "TOKEN_EXPIRED") {
      return { data: null, error: errorBody.error, status: 401 };
    }

    // If another request is already refreshing, wait for it
    if (isRefreshing) {
      await waitForRefresh();
      res = await makeRequest(); // Retry with the new token (from cookie)
    } else {
      isRefreshing = true;

      const refreshed = await silentRefresh();
      isRefreshing = false;

      if (refreshed) {
        resolveRefreshQueue(); // Let all waiting requests retry
        res = await makeRequest(); // Retry our own request
      } else {
        rejectRefreshQueue(new Error("Session expired"));
        // Redirect to login
        if (typeof window !== "undefined") {
          window.location.href = "/login?reason=session_expired";
        }
        return { data: null, error: "Session expired", status: 401 };
      }
    }
  }

  if (res.status === 204) return { data: null, error: null, status: 204 };

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    return { data: null, error: json.error || "Request failed", status: res.status };
  }

  return { data: json.data ?? json, error: null, status: res.status };
}
```

> **Why the concurrency lock?** Imagine 3 React components all mount at the same time and all get 401. Without the lock, all 3 would call `/refresh` simultaneously, causing token rotation chaos (each rotation invalidates the previous refresh token). The lock ensures only ONE refresh happens, and the other 2 wait for it.

---

## Part 3: Getting the Current User

### 3.1 Server-Side (Page Load)

```typescript
// apps/web/src/lib/auth.ts
import { authFetchServer } from "./fetch-server";
import { cache } from "react";

// React's `cache()` deduplicates calls within a single server render tree.
// If three Server Components all call getCurrentUser(), the API is hit ONCE.
export const getCurrentUser = cache(async () => {
  const { data } = await authFetchServer<{ user: User }>("/api/auth/me");
  return data?.user ?? null;
});

export type User = {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN" | "SUPER_ADMIN";
  emailVerified: boolean;
  avatar?: string;
};
```

### 3.2 Client-Side (React Context)

```typescript
// apps/web/src/contexts/AuthContext.tsx
"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { authFetchClient } from "@/lib/fetch-client";

type AuthState = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  // Actions
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({
  children,
  initialUser, // ← Passed from the Server Component
}: {
  children: ReactNode;
  initialUser: User | null;
}) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [isLoading, setIsLoading] = useState(false);

  // Re-fetch user data (e.g., after profile update)
  const refreshUser = async () => {
    setIsLoading(true);
    const { data } = await authFetchClient<{ user: User }>("/api/auth/me");
    setUser(data?.user ?? null);
    setIsLoading(false);
  };

  const logout = async () => {
    await authFetchClient("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.href = "/login"; // Full page navigation clears all state
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
```

### 3.3 Wiring AuthProvider into the Layout

```tsx
// apps/web/src/app/(protected)/layout.tsx
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AuthProvider } from "@/contexts/AuthContext";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  // Server fetches the user ONCE for this render tree
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    // Pass the server-fetched user into the client context
    // This avoids a client-side loading flash
    <AuthProvider initialUser={user}>
      <div className="app-layout">
        <Sidebar />
        <main>{children}</main>
      </div>
    </AuthProvider>
  );
}
```

> **Why pass `initialUser` from the server?** Without it, `AuthProvider` would start with `user = null`, show a loading spinner, then fetch `/api/auth/me` from the browser, causing a layout shift. By pre-loading from the server, the UI renders with real data on first paint — zero loading flash.

---

## Part 4: Next.js Middleware — Route Protection at the Edge

```typescript
// apps/web/src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";

// Routes that require authentication
const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/settings", "/profile"];

// Routes only for unauthenticated users
const AUTH_ROUTES = ["/login", "/signup", "/forgot-password"];

// Routes that require specific roles
const ADMIN_ROUTES = ["/admin"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasAccessToken = request.cookies.has("access_token");
  const hasRefreshToken = request.cookies.has("refresh_token");
  
  // Consider authenticated if either token cookie exists
  // (access token might be expired, but refresh token will renew it)
  const isAuthenticated = hasAccessToken || hasRefreshToken;

  const isProtectedRoute = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p));

  // ── Rule 1: Unauthenticated on protected route → Login ──────────
  if (!isAuthenticated && isProtectedRoute) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname); // Remember where they were going
    return NextResponse.redirect(url);
  }

  // ── Rule 2: Authenticated on auth route → Dashboard ─────────────
  if (isAuthenticated && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // ── Rule 3: Add security headers to every response ───────────────
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  
  return response;
}

export const config = {
  // Run on all routes EXCEPT static assets and Next.js internals
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
```

> **⚠️ Critical reminder:** Middleware runs at the Edge with no Node.js crypto. It CAN'T verify JWT signatures. It only checks if the cookie *exists*. The Express API performs true validation. Middleware is for **UX redirects only**.

---

## Part 5: Role-Based UI — What to Render Based on Role

### 5.1 A `<Can>` Component for Declarative Access Control

```tsx
// apps/web/src/components/Can.tsx
"use client";
import { useAuth } from "@/contexts/AuthContext";

type Role = "USER" | "ADMIN" | "SUPER_ADMIN";

const ROLE_HIERARCHY: Record<Role, number> = {
  USER: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

function hasRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

interface CanProps {
  role: Role;         // Minimum role required
  children: React.ReactNode;
  fallback?: React.ReactNode; // What to show if access denied
}

export function Can({ role, children, fallback = null }: CanProps) {
  const { user } = useAuth();

  if (!user) return <>{fallback}</>;
  if (!hasRole(user.role as Role, role)) return <>{fallback}</>;

  return <>{children}</>;
}
```

**Usage:**

```tsx
export default function DashboardPage() {
  return (
    <div>
      {/* Visible to ALL authenticated users */}
      <UserProfile />

      {/* Only visible to ADMIN and SUPER_ADMIN */}
      <Can role="ADMIN">
        <AdminPanel />
      </Can>

      {/* Only visible to SUPER_ADMIN, shows nothing for others */}
      <Can
        role="SUPER_ADMIN"
        fallback={<p className="text-muted">You don't have access to this section.</p>}
      >
        <DangerZone />
      </Can>
    </div>
  );
}
```

### 5.2 Server-Side Role Guard (More Secure)

Client-side guards are for UX only. For truly sensitive pages, use a Server Component guard:

```tsx
// apps/web/src/app/admin/layout.tsx
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) redirect("/login");

  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    redirect("/dashboard?error=insufficient_permissions");
  }

  return <>{children}</>;
}
```

> **Server guards vs Client guards:** Use server guards for routes that should be entirely inaccessible. Use `<Can>` for showing/hiding UI elements within a page the user CAN access.

---

## Part 6: The Complete Auth State Machine

Here's every possible state transition in your frontend auth system:

```
                    ┌────────────────────────────────────┐
                    │           NOT AUTHENTICATED         │
                    │   user = null                       │
                    │   Middleware redirects /dashboard   │
                    └──────────────┬─────────────────────┘
                                   │
                          User submits login form
                                   │
                                   ▼
                    ┌─────────────────────────────────────┐
                    │          AUTHENTICATED               │
                    │   user = { id, email, role }         │
                    │   access_token cookie: 15 min        │
                    │   refresh_token cookie: 30 days      │
                    └──────────────┬──────────────────────┘
                                   │
           ┌───────────────────────┼───────────────────────────┐
           │                       │                           │
     Access token               User logs out          Access token expires
     still valid                (POST /logout)          (authFetchClient gets 401)
           │                       │                           │
           ▼                       ▼                           ▼
   API calls succeed        Cookies cleared           Silent refresh attempt
   No refresh needed         user = null               (POST /refresh)
                            Redirect /login                    │
                                                ┌──────────────┴──────────────┐
                                                │                             │
                                          Refresh OK                  Refresh FAILS
                                          New cookies                  (token expired/
                                          set by API                    revoked)
                                          Retry original               Redirect /login
                                          request                      ?reason=session_expired
```

---

## Part 7: The Login Page — Complete Implementation

```tsx
// apps/web/src/app/login/page.tsx
"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/dashboard";
  const reason = searchParams.get("reason");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
        method: "POST",
        credentials: "include", // ← This is how the cookie gets set!
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      // Cookie is now set by the browser automatically.
      // Next.js middleware will now allow access to protected routes.
      router.push(nextUrl);
      router.refresh(); // Force Next.js to re-run server components with new cookies
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="login-page">
      {reason === "session_expired" && (
        <div className="alert alert-warning">
          Your session has expired. Please log in again.
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          autoComplete="email"
        />
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          autoComplete="current-password"
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={isLoading}>
          {isLoading ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
```

> **`router.refresh()`** is critical after login. Without it, Next.js Server Components that already rendered (without a user) won't re-render with the new cookie. `router.refresh()` invalidates the Server Component cache and re-fetches all server data for the current page tree.

---

## Part 8: Handling Email Verification Gates

After signup, before allowing dashboard access, the user must verify their email.

```typescript
// apps/web/src/app/(protected)/layout.tsx — extended
export default async function ProtectedLayout({ children }) {
  const user = await getCurrentUser();

  if (!user) redirect("/login");

  // Gate: Email must be verified for most protected routes
  const currentPath = headers().get("x-pathname") || "";
  const isVerifyPage = currentPath.startsWith("/verify-email");
  
  if (!user.emailVerified && !isVerifyPage) {
    redirect("/verify-email?sent=true");
  }

  return (
    <AuthProvider initialUser={user}>
      {children}
    </AuthProvider>
  );
}
```

---

## Part 9: Optimistic UI with Auth State

When a user updates their profile, you don't want to wait for the API to re-fetch to update the name in the navbar.

```tsx
// apps/web/src/app/(protected)/settings/profile/page.tsx
"use client";
import { useAuth } from "@/contexts/AuthContext";
import { authFetchClient } from "@/lib/fetch-client";
import { useState } from "react";

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    
    const { error } = await authFetchClient("/api/user/profile", {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });

    if (!error) {
      setSuccess(true);
      await refreshUser(); // Re-fetch user from API → updates AuthContext → updates navbar
    }
    
    setIsSaving(false);
  }

  return (
    <div>
      <h1>Edit Profile</h1>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
      />
      <button onClick={handleSave} disabled={isSaving}>
        {isSaving ? "Saving…" : "Save Changes"}
      </button>
      {success && <p>Profile updated!</p>}
    </div>
  );
}
```

---

## Part 10: The Complete File Structure

```
apps/web/src/
├── app/
│   ├── (auth)/                     ← Public routes (no cookie needed)
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── forgot-password/page.tsx
│   │
│   ├── (protected)/                ← Guarded by layout.tsx
│   │   ├── layout.tsx              ← getCurrentUser() + AuthProvider
│   │   ├── dashboard/page.tsx
│   │   ├── settings/
│   │   │   └── profile/page.tsx
│   │   └── admin/
│   │       ├── layout.tsx          ← Extra role check
│   │       └── page.tsx
│   │
│   └── verify-email/page.tsx       ← Semi-public (no session needed)
│
├── middleware.ts                   ← Edge route protection (UX only)
│
├── contexts/
│   └── AuthContext.tsx             ← Global user state (client)
│
├── lib/
│   ├── auth.ts                     ← getCurrentUser() with React cache()
│   ├── fetch-server.ts             ← authFetchServer() for Server Components
│   └── fetch-client.ts             ← authFetchClient() with 401 interceptor
│
└── components/
    ├── Can.tsx                     ← Role-based rendering
    └── UserMenu.tsx                ← Uses useAuth()
```

---

## Part 11: Common Mistakes and How to Avoid Them

| Mistake | Consequence | Fix |
|---|---|---|
| Using `fetch` without `credentials: "include"` in client components | Cookies not sent → all requests fail with 401 | Always use `authFetchClient` |
| Using `authFetchClient` in a Server Component | Runtime error — `fetch` behaves differently on server | Use `authFetchServer` in Server Components |
| Caching `/api/auth/me` response | User B sees User A's data after hot reload | Always `cache: "no-store"` |
| Forgetting `router.refresh()` after login | Server Components don't see new cookie | Always call `router.refresh()` after login/logout |
| Role check only in the `<Can>` component | User can navigate directly to `/admin` URL | Add server-side role check in `admin/layout.tsx` |
| Multiple refresh calls without concurrency lock | Token rotation collision → all sessions invalidated | Use the lock pattern in `authFetchClient` |

---

## Practice Exercises

1. **Trace the login flow:** Add `console.log` statements to: the login form submit, the middleware, `getCurrentUser()`, and `AuthProvider`. Log in and trace the exact sequence of calls. Which ones are server-side? Which are client-side?

2. **Test role guards:** In the database, manually change your user's role to `USER`. Try to navigate to `/admin`. You should be redirected. Change it back to `ADMIN` and try again.

3. **Force a token refresh:** Open DevTools → Application → Cookies. Delete only the `access_token` cookie (keep `refresh_token`). Click any link. Watch the Network tab — you should see a `POST /api/auth/refresh` automatically fire, then the original request succeed.

4. **Test the concurrency lock:** In `authFetchClient`, add a `console.log("Making request:", path)` and `console.log("Is refreshing:", isRefreshing)`. Open a page that mounts 3 components simultaneously, each calling `authFetchClient`. Verify only ONE refresh request fires.

5. **Optimistic user update:** Change your name in the profile settings. Verify the name in the navbar updates immediately after save WITHOUT a full page reload.
