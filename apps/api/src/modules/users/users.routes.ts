/**
 * @file Users Routes
 * @milestone M7, M10
 *
 * ┌─────────────────────────────┬────────┬───────────────────────────┬──────────────┐
 * │ Route                       │ Method │ Description               │ Min Role     │
 * ├─────────────────────────────┼────────┼───────────────────────────┼──────────────┤
 * │ /api/users/me               │ GET    │ Get current user          │ USER         │
 * │ /api/users/me               │ PATCH  │ Update profile            │ USER         │
 * │ /api/users/me/password      │ POST   │ Change password           │ USER         │
 * │ /api/users                  │ GET    │ List all users            │ ADMIN        │
 * │ /api/users/roles            │ PATCH  │ Update user role          │ SUPER_ADMIN  │
 * └─────────────────────────────┴────────┴───────────────────────────┴──────────────┘
 */
import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { adminLimiter } from "../../middlewares/rateLimiter.js";
import * as usersController from "./users.controller.js";

const router: Router = Router();

// All users routes require authentication
router.use(authenticate);

// Self-service routes (any authenticated user)
router.get("/me", usersController.getMe);
router.patch("/me", usersController.updateProfile);
router.post("/me/password", usersController.changePassword);

// Admin routes
router.get("/", adminLimiter, authorize("ADMIN"), usersController.listUsers);

// Super admin routes
router.patch(
  "/roles",
  adminLimiter,
  authorize("SUPER_ADMIN"),
  usersController.updateRole
);

export default router;
