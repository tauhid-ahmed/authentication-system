# M3: Authorization & Role-Based Access Control (RBAC)

Authentication (AuthN) answers the question: **"Who are you?"**
Authorization (AuthZ) answers the question: **"What are you allowed to do?"**

In this milestone, we implement Role-Based Access Control (RBAC) to ensure that users can only access the data and perform the actions permitted by their role.

---

## 1. Defining Roles

Our system uses a simple hierarchical role structure defined in the Prisma schema (`apps/api/prisma/schema.prisma`):

```prisma
enum Role {
  USER
  ADMIN
  SUPER_ADMIN
}
```

The hierarchy implies permissions:
- `USER`: Can access their own profile and sessions.
- `ADMIN`: Can do everything a `USER` can, plus view all users in the system.
- `SUPER_ADMIN`: Can do everything an `ADMIN` can, plus change the roles of other users.

---

## 2. Embedding Roles in the Token

How does the API know the user's role without querying the database on every request? 
We embed the role directly into the **Access Token (JWT) payload**.

```typescript
// Payload generated during login
const payload = {
  sub: user.id,
  role: user.role, // e.g., "ADMIN"
};
```

When the `authenticate` middleware runs, it reads the role from the verified JWT and attaches it to `req.user`.

```typescript
// apps/api/src/middlewares/authenticate.ts
req.user = {
  id: payload.sub,
  role: payload.role,
};
```

---

## 3. The `authorize` Middleware

With the role attached to `req.user`, we can create a secondary middleware that runs *after* authentication to check permissions.

```typescript
// apps/api/src/middlewares/authorize.ts
export function authorize(minimumRole: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    // 1. Ensure user is authenticated (should be guaranteed by authenticate middleware)
    if (!req.user) {
      sendError(res, "Unauthorized", 401);
      return;
    }

    // 2. Check if the user's role meets the minimum requirement
    if (!hasMinimumRole(req.user.role, minimumRole)) {
      sendError(res, "Forbidden: Insufficient permissions.", 403);
      return;
    }

    next();
  };
}
```

### The Hierarchy Logic
We need a helper function to understand that `SUPER_ADMIN` > `ADMIN` > `USER`.
We share this logic between the frontend and backend in `@auth/shared/src/index.ts`:

```typescript
const ROLE_HIERARCHY = ["USER", "ADMIN", "SUPER_ADMIN"];

export function hasMinimumRole(userRole: string, requiredRole: string): boolean {
  const userLevel = ROLE_HIERARCHY.indexOf(userRole);
  const requiredLevel = ROLE_HIERARCHY.indexOf(requiredRole);
  return userLevel >= requiredLevel;
}
```

---

## 4. Applying Authorization to Routes

In our route definitions, we chain the middlewares. Order is absolutely critical.

```typescript
// apps/api/src/modules/users/users.routes.ts

// 1. Apply `authenticate` to ALL routes in this router
router.use(authenticate);

// 2. Self-service routes (Only requires USER level - implied by authenticate)
router.get("/me", usersController.getMe);
router.patch("/me", usersController.updateProfile);

// 3. Admin routes (Requires ADMIN level)
router.get("/", authorize("ADMIN"), usersController.listUsers);

// 4. Super Admin routes (Requires SUPER_ADMIN level)
router.patch("/roles", authorize("SUPER_ADMIN"), usersController.updateRole);
```

### Business Logic Authorization
Sometimes middleware isn't enough. For example, a `USER` can revoke their *own* session, but not someone else's. This requires checking the database, so the authorization logic must live in the **Service**.

```typescript
// apps/api/src/modules/sessions/sessions.service.ts
async revokeSession(userId: string, sessionId: string) {
  const session = await sessionsRepository.findById(sessionId);
  
  // Service-level authorization check
  if (session.userId !== userId) {
    throw new Error("FORBIDDEN"); // Can't revoke another user's session
  }
  
  // Proceed with revocation...
}
```

---

## 5. Security Pitfall: Privilege Escalation

What if a rogue `ADMIN` tries to change their own role to `SUPER_ADMIN`? 
We must explicitly prevent privilege escalation attacks in the service logic.

```typescript
// apps/api/src/modules/users/users.service.ts -> updateRole()

// Guard 1: Only SUPER_ADMIN can change roles
if (!hasMinimumRole(actorRole, "SUPER_ADMIN")) {
  throw new Error("INSUFFICIENT_ROLE");
}

// Guard 2: Cannot change your own role (prevents lockout accidents and abuse)
if (actorId === data.userId) {
  throw new Error("CANNOT_CHANGE_OWN_ROLE");
}
```

---

## 6. What's Next?

Our API is fully protected, but we need to ensure the frontend respects these roles as well. If an API route requires `ADMIN`, the frontend shouldn't even show the link to the Admin Panel for a regular `USER`.

Proceed to **M4: Next.js Frontend Integration** to see how we consume our secure API using React Server Components.
