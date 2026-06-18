# M3: Authorization (RBAC) Implementation Guide

**Track:** Core Curriculum  
**Prerequisites:** M1 (MVP Auth)  
**Time:** ~1.5 hours  

---

## The Goal
Authentication (M1) proved *who* the user is. Authorization proves *what* they are allowed to do. 

In this module, we implement **Role-Based Access Control (RBAC)** across the entire stack. We will protect sensitive API endpoints on the backend, and conditionally hide UI elements on the frontend based on the user's role.

---

## Step 1: The Database Role Enum

Our Prisma schema defines a `Role` enum for the User model.

```prisma
enum Role {
  USER
  ADMIN
  SUPER_ADMIN
}
```
By default, all new signups receive the `USER` role. The `SUPER_ADMIN` role is strictly for the system owner, and `ADMIN` is for staff.

---

## Step 2: Backend API Protection

Never trust the frontend. Just because you hide a "Delete User" button in React doesn't stop an attacker from opening Postman and sending a `DELETE` request directly to your API.

The backend must explicitly verify the role for every sensitive endpoint.

### 2.1 The `requireRole` Middleware
We create a higher-order middleware function. Open `apps/api/src/middlewares/requireRole.ts`.

```typescript
import { NextFunction, Request, Response } from "express";

export function requireRole(allowedRoles: string[]) {
  // Return an Express middleware function
  return (req: Request, res: Response, next: NextFunction) => {
    
    // req.user is guaranteed to exist here because this middleware 
    // is always placed AFTER the `authenticate` middleware.
    const userRole = req.user?.role;

    if (!userRole) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if the user's role is in the allowed list
    if (!allowedRoles.includes(userRole)) {
      // 403 Forbidden means: "I know who you are, but you aren't allowed to do this."
      return res.status(403).json({ error: "FORBIDDEN" });
    }

    // Role is valid, proceed to the controller
    next();
  };
}
```

### 2.2 Applying the Middleware to Routes
Now we apply this to our router. Open `apps/api/src/modules/users/users.routes.ts`.

```typescript
import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { requireRole } from "../../middlewares/requireRole";

const router = Router();

// Notice the order:
// 1. `authenticate` verifies the JWT and attaches req.user
// 2. `requireRole` checks req.user.role
// 3. `deleteUser` actually performs the action

router.delete(
  "/:id",
  authenticate,
  requireRole(["ADMIN", "SUPER_ADMIN"]), // Only admins can delete
  userController.deleteUser
);

export default router;
```

---

## Step 3: Frontend UI Protection

Now that the backend is secure, we need to provide a good UX on the frontend. A `USER` should not see links to an Admin Dashboard, nor should they see buttons that will just result in a `403 Forbidden` error.

### 3.1 The User Object in Memory
Recall from the F2 module that our frontend fetches the User Object on load and stores it in React memory (or passes it down from a Server Component).

```typescript
// The object returned from /api/auth/me
type UserResponse = {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN" | "SUPER_ADMIN"; // We have the role!
};
```

### 3.2 Conditionally Rendering UI in Server Components
In Next.js App Router, Server Components run on the Node server. We can check the role before we even send the HTML to the browser.

Open `apps/web/src/app/(protected)/layout.tsx`.

```tsx
import { getCurrentUser } from "@/lib/auth";

export default async function ProtectedLayout({ children }) {
  const user = await getCurrentUser();

  return (
    <div>
      <nav>
        <Link href="/dashboard">Dashboard</Link>
        
        {/* Only render this link if the user is an Admin */}
        {(user.role === "ADMIN" || user.role === "SUPER_ADMIN") && (
          <Link href="/admin">Admin Panel</Link>
        )}
      </nav>
      {children}
    </div>
  );
}
```

### 3.3 Protecting Whole Pages (Next.js)
What if a `USER` manually types `http://localhost:3000/admin` into their URL bar? 
We need to protect the page itself, not just the navigation link.

Open `apps/web/src/app/(protected)/admin/page.tsx`.

```tsx
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const user = await getCurrentUser();

  // If they aren't an admin, kick them back to the dashboard
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    redirect("/dashboard");
  }

  return (
    <div>
      <h1>Super Secret Admin Dashboard</h1>
      {/* Admin content here */}
    </div>
  );
}
```

---

## Practice Exercises

1. **Test Backend Security:** Log in with a normal `USER` account. Use Postman or `curl` to send a request to a route protected by `requireRole(["ADMIN"])`. Ensure you get a `403 Forbidden` response.
2. **Promote Yourself:** Open Prisma Studio (`npx prisma studio`), find your user record, and change your role from `USER` to `ADMIN`. Refresh your browser dashboard. Notice how the Admin links magically appear because the `/me` endpoint returned your new role.
3. **Add a Role:** Add a `MANAGER` role to the Prisma enum. Run the migration. Update the backend middleware to allow `MANAGER` to access a specific new endpoint. Update the frontend to show a Manager-specific UI.
