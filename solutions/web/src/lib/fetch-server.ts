/**
 * @file Authenticated Fetch Wrapper (Server)
 * @milestone M6 (Refresh Token Rotation)
 */
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export async function authFetchServer(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const fetchOptions: RequestInit = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Cookie: allCookies,
      ...options.headers,
    },
  };

  const response = await fetch(`${API_URL}${url}`, fetchOptions);
  return response;
}
