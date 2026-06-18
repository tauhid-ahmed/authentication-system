/**
 * @file Authenticated Fetch Wrapper — Client Side
 * @milestone M4 (Next.js Integration) + M2 (Token Rotation)
 *
 * ============================================================
 * THE AUTO-REFRESH INTERCEPTOR — HOW IT WORKS
 * ============================================================
 *
 * Problem: Access tokens expire every 5 minutes. We should NEVER
 * log the user out just because their token expired. We should
 * silently refresh it and retry the original request.
 *
 * The full client-side refresh flow:
 *
 *  1. Make API request with credentials (cookies auto-sent by browser)
 *  2. If response is 200 → return normally. Done.
 *  3. If response is 401 with code TOKEN_EXPIRED:
 *     a. Acquire a "refresh lock" (prevent concurrent refresh attempts)
 *     b. Call POST /api/auth/refresh — backend rotates the token pair
 *     c. If refresh succeeds → retry the original request (new cookie sent)
 *     d. If refresh fails (token revoked/expired) → redirect to /login
 *  4. If response is 401 with code TOKEN_REUSE_DETECTED:
 *     → A replay attack may be happening. Force logout immediately.
 *
 * ============================================================
 * THE CONCURRENCY PROBLEM (Why we need a lock)
 * ============================================================
 *
 *  Imagine: Dashboard loads 3 parallel requests (profile, stats, sessions).
 *  All 3 hit 401 simultaneously (token just expired).
 *
 *  WITHOUT a lock:
 *   - Request 1: calls /refresh → backend rotates T1 → T2, gives T2
 *   - Request 2: calls /refresh with T1 → backend: "T1 already rotated!"
 *                → TOKEN_REUSE_DETECTED → user forcibly logged out! ❌
 *
 *  WITH the lock:
 *   - Request 1: acquires lock, calls /refresh → gets T2
 *   - Requests 2 & 3: wait for the same refreshPromise → also get T2
 *   - All 3 retry their original requests → ✅
 *
 * ============================================================
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

// --- Concurrency Lock ---
// Only one refresh request can happen at a time. All parallel requests
// that hit 401 will await the SAME promise.
let isRefreshing = false;
let pendingRefreshPromise: Promise<boolean> | null = null;

/**
 * Attempt to silently refresh the access token.
 * Returns true if refresh succeeded, false otherwise.
 * Ensures only one refresh request happens even if called concurrently.
 */
function refreshAccessToken(): Promise<boolean> {
  if (!isRefreshing) {
    isRefreshing = true;
    pendingRefreshPromise = fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include", // Send the refresh token cookie
    })
      .then((res) => {
        if (!res.ok) {
          console.warn("[Auth] Token refresh failed:", res.status);
          return false;
        }
        // New access_token cookie is now set by the backend via Set-Cookie
        return true;
      })
      .catch((err) => {
        console.error("[Auth] Token refresh network error:", err);
        return false;
      })
      .finally(() => {
        // Release lock after refresh completes (success or failure)
        isRefreshing = false;
        pendingRefreshPromise = null;
      });
  }
  // Return the same pending promise to all concurrent callers
  return pendingRefreshPromise!;
}

/**
 * authFetchClient — A fetch wrapper for Client Components.
 *
 * Automatically handles:
 * - Credential forwarding (HTTP-only cookies)
 * - Token expiration + silent refresh
 * - Replay attack detection
 * - Concurrency safety for parallel requests
 *
 * Usage in a Client Component:
 * ```ts
 * const res = await authFetchClient("/api/users/me");
 * const data = await res.json();
 * ```
 */
export async function authFetchClient(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const fetchOptions: RequestInit = {
    ...options,
    credentials: "include", // Always send cookies (HttpOnly tokens)
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  };

  // --- Step 1: Make the initial request ---
  let response = await fetch(`${API_URL}${url}`, fetchOptions);

  // --- Step 2: Handle 401 responses ---
  if (response.status === 401) {
    // Clone before reading body so we can still return the response if needed
    const errorData = await response.clone().json().catch(() => null);
    const code: string | undefined = errorData?.error?.code;

    if (code === "TOKEN_EXPIRED") {
      // --- Step 3: Attempt silent token refresh ---
      const refreshed = await refreshAccessToken();

      if (refreshed) {
        // --- Step 4: Retry the original request with the new access token ---
        // The browser will automatically send the new cookie
        response = await fetch(`${API_URL}${url}`, fetchOptions);
      } else {
        // Refresh failed — the refresh token is also expired or revoked
        // Redirect to login, preserving the current path so we can return after login
        if (typeof window !== "undefined") {
          const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.href = `/login?reason=session_expired&returnTo=${returnTo}`;
        }
      }
    } else if (code === "TOKEN_REUSE_DETECTED") {
      // Possible replay/token-theft attack — force a clean logout
      console.error("[Auth] TOKEN_REUSE_DETECTED — potential security event! Logging out.");
      if (typeof window !== "undefined") {
        window.location.href = "/login?reason=security_event";
      }
    }
  }

  return response;
}

/**
 * A simpler fetch helper for public endpoints (no auth needed).
 * Still points to the API server.
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${API_URL}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}
