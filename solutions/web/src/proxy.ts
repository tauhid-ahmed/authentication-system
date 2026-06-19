/**
 * @file Next.js Middleware
 * @milestone M8 (Next.js Auth System)
 *
 * ============================================================
 * MIDDLEWARE IS UX, NOT SECURITY
 * ============================================================
 *
 * This middleware runs on the Edge runtime BEFORE a page renders.
 * Its ONLY job is to redirect users for a better UX.
 *
 * Example: If a logged-out user tries to visit /dashboard, redirect them to /login.
 * Example: If a logged-in user tries to visit /login, redirect them to /dashboard.
 *
 * WHY ISN'T THIS SECURITY?
 * Because it only protects the *frontend UI*. It doesn't protect the data.
 * A malicious user can bypass this middleware by hitting the Express API directly.
 * The TRUE security is enforced by the Express backend `authenticate` middleware.
 *
 * ============================================================
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Only these routes require authentication
const protectedRoutes = ["/dashboard", "/admin", "/settings"];
// These routes redirect logged-in users away (to dashboard)
const authRoutes = ["/login", "/signup"];
// These are always public — never redirect
const publicRoutes = ["/", "/learn"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasAccessToken = request.cookies.has("access_token");
  const hasRefreshToken = request.cookies.has("refresh_token");

  // A user is "potentially authenticated" if they have either token
  // (If they only have a refresh token, the fetch interceptor will rotate it)
  const isAuth = hasAccessToken || hasRefreshToken;

  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // 1. Unauthenticated user trying to access protected route
  if (!isAuth && isProtectedRoute) {
    const url = new URL("/login", request.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // 2. Authenticated user trying to access login/signup
  if (isAuth && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

// Optimize middleware to only run on relevant paths
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
