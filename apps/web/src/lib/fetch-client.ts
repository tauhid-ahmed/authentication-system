/**
 * @file Authenticated Fetch Wrapper (Client)
 * @milestone M6 (Refresh Token Rotation)
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

export async function authFetchClient(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const fetchOptions: RequestInit = {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  };

  let response = await fetch(`${API_URL}${url}`, fetchOptions);

  if (response.status === 401) {
    const errorData = await response.clone().json().catch(() => null);

    if (errorData?.error?.code === "TOKEN_EXPIRED") {
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = fetch(`${API_URL}/api/auth/refresh`, {
          method: "POST",
          credentials: "include",
        })
          .then((res) => res.ok)
          .catch(() => false)
          .finally(() => {
            isRefreshing = false;
          });
      }

      const refreshSuccess = await refreshPromise;

      if (refreshSuccess) {
        response = await fetch(`${API_URL}${url}`, fetchOptions);
      } else {
        window.location.href = "/login?session_expired=true";
      }
    } else if (errorData?.error?.code === "TOKEN_REUSE_DETECTED") {
      window.location.href = "/login?error=security_breach";
    }
  }

  return response;
}
