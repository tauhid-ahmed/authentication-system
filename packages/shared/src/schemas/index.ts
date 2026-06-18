/**
 * @file Shared Schemas Index
 *
 * Re-exports everything from all schema files so consumers can do:
 *   import { LoginSchema, SignupSchema, Role } from "@auth/shared/schemas"
 */
export * from "./auth.js";
export * from "./user.js";
export * from "./session.js";
