# F4: Next.js Server Actions for Auth

**Track:** Frontend Deep Dives  
**Prerequisites:** F3 (Next.js Auth — Complete), M1 (MVP Auth)  
**Time:** ~2 hours  

---

> **What are Server Actions?** Introduced in Next.js 14, Server Actions let you define async functions that run **on the server** and can be called directly from forms or client components — no API route needed. For auth mutations (login, signup, logout, profile update), they eliminate the need for separate route handlers in Next.js.

---

## Part 1: Server Actions vs Client-Side Fetch — When to Use Each

```
┌─────────────────────────────────────────────────────────────────┐
│                   WHICH APPROACH TO USE?                        │
│                                                                 │
│   User submits a FORM                                          │
│   (login, signup, profile update, password change)             │
│        → Use Server Actions                                     │
│                                                                 │
│   Component needs DATA (fetching, polling, SWR)                │
│   (dashboard data, user profile, session list)                 │
│        → Use authFetchClient with React Query / SWR            │
│                                                                 │
│   Server Component needs DATA before first render              │
│        → Use authFetchServer                                    │
└─────────────────────────────────────────────────────────────────┘
```

**Advantages of Server Actions for auth mutations:**
- No `<form onSubmit>` + `e.preventDefault()` boilerplate
- Built-in Progressive Enhancement (works without JavaScript!)
- `useFormState` / `useActionState` for error handling
- Can set cookies directly from the server (critical for login!)
- No separate API route file needed

---

## Part 2: The Login Server Action

This is the key pattern. The server action calls the Express API and sets cookies from the server, so the browser never handles the raw token.

```typescript
// apps/web/src/actions/auth.actions.ts
"use server"; // ← This directive makes every export a Server Action

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API_URL = process.env.API_URL!; // Server-side env var (no NEXT_PUBLIC_)

// ── Login ─────────────────────────────────────────────────────────────

export type AuthActionState = {
  error: string | null;
  fieldErrors?: {
    email?: string[];
    password?: string[];
  };
};

export async function loginAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // ── Validation ────────────────────────────────────────────────────
  const fieldErrors: AuthActionState["fieldErrors"] = {};

  if (!email || !email.includes("@")) {
    fieldErrors.email = ["Please enter a valid email address"];
  }
  if (!password || password.length < 8) {
    fieldErrors.password = ["Password must be at least 8 characters"];
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: null, fieldErrors };
  }

  // ── Call Express API ──────────────────────────────────────────────
  try {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      // No credentials: "include" — this is a server-to-server call.
      // The Express API returns Set-Cookie headers directly.
    });

    if (!res.ok) {
      const data = await res.json();
      if (res.status === 429) {
        return { error: "Too many login attempts. Please wait and try again." };
      }
      if (res.status === 423) {
        return { error: "This account has been locked due to too many failed attempts." };
      }
      return { error: data.error || "Invalid email or password" };
    }

    // ── Set cookies from the server response ──────────────────────
    // The Express API sends Set-Cookie headers. We forward them to the browser.
    const setCookieHeader = res.headers.getSetCookie();
    const cookieStore = await cookies();

    for (const cookieString of setCookieHeader) {
      // Parse each Set-Cookie string and set it via Next.js cookies API
      const [nameValue, ...directives] = cookieString.split("; ");
      const [name, value] = nameValue.split("=");

      const options: any = {};
      for (const directive of directives) {
        const lower = directive.toLowerCase();
        if (lower === "httponly") options.httpOnly = true;
        if (lower === "secure") options.secure = true;
        if (lower.startsWith("max-age=")) options.maxAge = parseInt(directive.split("=")[1]);
        if (lower.startsWith("path=")) options.path = directive.split("=")[1];
        if (lower.startsWith("samesite=")) options.sameSite = directive.split("=")[1].toLowerCase();
      }

      cookieStore.set(name, value, options);
    }
  } catch {
    return { error: "Network error. Please check your connection." };
  }

  // ── Redirect AFTER cookies are set ────────────────────────────────
  // redirect() must be called OUTSIDE try/catch — it throws internally.
  redirect("/dashboard");
}
```

### 2.1 The Login Form (using `useActionState`)

```tsx
// apps/web/src/app/(auth)/login/page.tsx
"use client";
import { useActionState } from "react";
import { loginAction } from "@/actions/auth.actions";
import { useSearchParams } from "next/navigation";

const initialState = { error: null, fieldErrors: undefined };

export default function LoginPage() {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");

  // useActionState replaces the old useFormState
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <div className="auth-page">
      {reason === "session_expired" && (
        <div className="alert alert-warning">
          Your session expired. Please sign in again.
        </div>
      )}

      <form action={formAction}>
        {/* action={formAction} wires the form to the Server Action */}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"          // ← formData.get("email") reads this
            type="email"
            autoComplete="email"
            aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
          />
          {state.fieldErrors?.email && (
            <p id="email-error" className="field-error">
              {state.fieldErrors.email[0]}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
          />
          {state.fieldErrors?.password && (
            <p className="field-error">{state.fieldErrors.password[0]}</p>
          )}
        </div>

        {state.error && (
          <div className="form-error" role="alert">
            {state.error}
          </div>
        )}

        <button type="submit" disabled={isPending}>
          {isPending ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
```

> **Key difference from `fetch` approach:** There's no `router.refresh()` needed. When the Server Action calls `redirect()`, Next.js automatically re-renders the destination page with fresh server data including the new cookies.

---

## Part 3: The Signup Server Action

```typescript
// apps/web/src/actions/auth.actions.ts (continued)

import { z } from "zod"; // Zod for schema validation

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export async function signupAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  // Validate with Zod
  const result = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!result.success) {
    const fieldErrors: AuthActionState["fieldErrors"] = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as string;
      if (!fieldErrors[field as keyof typeof fieldErrors]) {
        fieldErrors[field as keyof typeof fieldErrors] = [];
      }
      fieldErrors[field as keyof typeof fieldErrors]!.push(issue.message);
    }
    return { error: null, fieldErrors };
  }

  const res = await fetch(`${API_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(result.data),
  });

  if (!res.ok) {
    const data = await res.json();
    if (res.status === 409) {
      return { error: "An account with this email already exists." };
    }
    return { error: data.error || "Signup failed. Please try again." };
  }

  // After signup, log them in automatically
  // (The API could return cookies directly if it creates a session on signup)
  const setCookieHeader = res.headers.getSetCookie();
  const cookieStore = await cookies();

  for (const cookieString of setCookieHeader) {
    const [nameValue, ...directives] = cookieString.split("; ");
    const [name, value] = nameValue.split("=");
    // ... (same cookie parsing as loginAction)
    cookieStore.set(name, value, { httpOnly: true, secure: true, sameSite: "lax" });
  }

  redirect("/verify-email?sent=true");
}
```

---

## Part 4: The Logout Server Action

```typescript
// apps/web/src/actions/auth.actions.ts (continued)

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("refresh_token")?.value;

  // Tell the Express API to invalidate the session
  if (refreshToken) {
    try {
      const allCookies = cookieStore
        .getAll()
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");

      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        headers: { Cookie: allCookies },
      });
    } catch {
      // Even if the API call fails, we still clear the local cookies
    }
  }

  // Clear auth cookies
  cookieStore.delete("access_token");
  cookieStore.delete("refresh_token");

  redirect("/login");
}
```

**Using it in a component:**

```tsx
// apps/web/src/components/UserMenu.tsx
"use client";
import { logoutAction } from "@/actions/auth.actions";

export function UserMenu({ user }: { user: User }) {
  return (
    <div className="user-menu">
      <p>{user.name}</p>
      {/* form with action = Server Action, no onClick handler needed */}
      <form action={logoutAction}>
        <button type="submit">Sign Out</button>
      </form>
    </div>
  );
}
```

---

## Part 5: Profile Update Server Action (with Optimistic UI)

```typescript
// apps/web/src/actions/profile.actions.ts
"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function updateProfileAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const name = formData.get("name") as string;

  if (!name || name.trim().length < 2) {
    return { error: null, fieldErrors: { name: ["Name must be at least 2 characters"] } };
  }

  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");

  const res = await fetch(`${API_URL}/api/user/profile`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: allCookies,
    },
    body: JSON.stringify({ name: name.trim() }),
  });

  if (!res.ok) {
    return { error: "Failed to update profile. Please try again." };
  }

  // Revalidate the layout so the updated name appears in the nav
  revalidatePath("/", "layout");

  return { error: null };
}
```

> **`revalidatePath` vs `router.refresh()`:** In Server Actions, `revalidatePath` invalidates the Next.js cache for a route and triggers a re-fetch of Server Components. It's the server-side equivalent of `router.refresh()` — and you don't need to call it from the client.

---

## Part 6: Password Change Server Action

```typescript
// apps/web/src/actions/profile.actions.ts (continued)

export async function changePasswordAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (newPassword !== confirmPassword) {
    return { error: null, fieldErrors: { confirmPassword: ["Passwords do not match"] } };
  }

  if (newPassword.length < 8) {
    return { error: null, fieldErrors: { newPassword: ["Password must be at least 8 characters"] } };
  }

  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");

  const res = await fetch(`${API_URL}/api/user/password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: allCookies },
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  if (res.status === 400) {
    return { error: null, fieldErrors: { currentPassword: ["Current password is incorrect"] } };
  }
  if (!res.ok) {
    return { error: "Failed to change password. Please try again." };
  }

  // After password change, revoke all OTHER sessions for security
  // (The user stays logged in on the current device)
  revalidatePath("/settings/security");

  return { error: null };
}
```

---

## Part 7: When Server Actions Can't Help — Client Fetch Is Still Needed

Server Actions are for **mutations triggered by the user**. They're not suitable for:

| Scenario | Use Instead |
|---|---|
| Polling for notifications | `authFetchClient` + `setInterval` |
| Real-time data (WebSocket) | Native WebSocket with Bearer token |
| Infinite scroll / pagination | `authFetchClient` + `IntersectionObserver` |
| Search-as-you-type | `authFetchClient` + debounce |
| File upload with progress | `authFetchClient` + `XMLHttpRequest` |
| Optimistic UI (instant feedback) | `authFetchClient` + `useOptimistic` |

```
Server Actions ← MUTATIONS (login, logout, update, delete)
authFetchClient ← READS + STREAMING (fetch data, real-time)
authFetchServer ← INITIAL SERVER RENDER (Server Components)
```

---

## Part 8: The Complete Auth Action File

```typescript
// apps/web/src/actions/auth.actions.ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const API_URL = process.env.API_URL!;

export type AuthActionState = {
  error: string | null;
  success?: boolean;
  fieldErrors?: Partial<Record<string, string[]>>;
};

// Helper: set cookies from Express Set-Cookie response headers
async function forwardCookies(res: Response): Promise<void> {
  const cookieStore = await cookies();
  for (const cookieString of res.headers.getSetCookie()) {
    const [nameValue, ...rest] = cookieString.split("; ");
    const [name, ...valueParts] = nameValue.split("=");
    const value = valueParts.join("=");
    const opts: Record<string, any> = {};
    for (const d of rest) {
      const lower = d.toLowerCase().trim();
      if (lower === "httponly") opts.httpOnly = true;
      if (lower === "secure") opts.secure = true;
      if (lower.startsWith("max-age=")) opts.maxAge = Number(d.split("=")[1]);
      if (lower.startsWith("path=")) opts.path = d.split("=")[1];
      if (lower.startsWith("samesite=")) opts.sameSite = d.split("=")[1].toLowerCase();
    }
    cookieStore.set(name.trim(), value, opts);
  }
}

// Helper: get all cookies as a header string for server-to-Express calls
async function getAuthCookieHeader(): Promise<string> {
  const cookieStore = await cookies();
  return cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");
}

export async function loginAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email?.includes("@")) return { error: null, fieldErrors: { email: ["Invalid email"] } };
  if (!password || password.length < 8) return { error: null, fieldErrors: { password: ["Min 8 characters"] } };

  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 429) return { error: "Too many attempts. Please wait." };
    if (res.status === 423) return { error: "Account locked due to too many failed attempts." };
    return { error: data.error || "Invalid credentials" };
  }

  await forwardCookies(res);
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  const cookieHeader = await getAuthCookieHeader();
  
  await fetch(`${API_URL}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: cookieHeader },
  }).catch(() => {});

  const cookieStore = await cookies();
  cookieStore.delete("access_token");
  cookieStore.delete("refresh_token");

  redirect("/login");
}
```

---

## Practice Exercises

1. **Progressive Enhancement test:** Disable JavaScript in Chrome DevTools → Settings → Debugger → Disable JavaScript. Try to log in using the Server Action form. It should still work — the form submits as a standard HTML POST.

2. **Error display:** Submit the login form with an invalid email. Verify `fieldErrors.email` appears under the email field without a page reload.

3. **Compare with client fetch:** Implement login both ways — with Server Action and with `authFetchClient`. Compare the network waterfall in DevTools. The Server Action has one fewer round-trip.

4. **Cookie forwarding:** Add a `console.log(res.headers.getSetCookie())` in `loginAction`. Run the login. See the raw `Set-Cookie` strings from Express in your Next.js terminal.

5. **`revalidatePath` test:** Change your name via `updateProfileAction`. Check if the name in the nav bar updates without a full page reload. Add/remove `revalidatePath` and see the difference.
