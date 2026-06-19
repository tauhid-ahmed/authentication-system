/**
 * @file Auth Helpers for Next.js
 * @milestone M8 (Next.js Auth System)
 */
import { cookies } from "next/headers";
import { UserResponse } from "@auth/shared";
import { authFetchServer } from "./fetch-server";

/**
 * Get the currently authenticated user in a Server Component.
 *
 * Usage:
 * ```tsx
 * const user = await getCurrentUser();
 * if (!user) redirect("/login");
 * return <div>Hello {user.name}</div>
 * ```
 */
export async function getCurrentUser(): Promise<UserResponse | null> {
  try {
    const res = await authFetchServer("/api/auth/me", {
      next: { revalidate: 0 }, // Don't cache user data
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data.data.user as UserResponse;
  } catch {
    return null;
  }
}

/**
 * Check if the user has a specific role.
 */
export async function checkRole(minimumRole: "USER" | "ADMIN" | "SUPER_ADMIN"): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  const roles = ["USER", "ADMIN", "SUPER_ADMIN"];
  const userIdx = roles.indexOf(user.role);
  const minIdx = roles.indexOf(minimumRole);

  return userIdx >= minIdx;
}
