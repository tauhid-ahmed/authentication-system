/**
 * @file Device Information Parser
 * @milestone M11 (Session Management)
 *
 * WHY TRACK DEVICES?
 * ------------------
 * Multi-device session management requires knowing WHICH device a session belongs to.
 * When a user sees "Active Sessions", they need human-readable info:
 *   "Chrome on Windows — Last seen 2 hours ago — New York, US"
 *
 * This is what GitHub, Google, and Stripe show in their security settings.
 *
 * We parse the User-Agent string to extract browser + OS info.
 * UA strings are unreliable and easily spoofed, but they're the best we have
 * without requiring device fingerprinting (which has privacy implications).
 */
import type { DeviceInfo } from "@auth/shared";

/**
 * Parse a User-Agent string into structured device info.
 * This is a simplified parser — production systems use ua-parser-js.
 *
 * @example
 * parseUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...")
 * → { browser: "Chrome", os: "Windows", deviceType: "desktop", raw: "..." }
 */
export function parseUserAgent(userAgent?: string): DeviceInfo {
  if (!userAgent) {
    return { browser: "Unknown", os: "Unknown", deviceType: "desktop", raw: "" };
  }

  const ua = userAgent.toLowerCase();
  let browser = "Unknown";
  let os = "Unknown";
  let deviceType: "mobile" | "tablet" | "desktop" = "desktop";

  // Browser detection (order matters — Edge must come before Chrome)
  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("opr/") || ua.includes("opera")) browser = "Opera";
  else if (ua.includes("firefox/")) browser = "Firefox";
  else if (ua.includes("safari/") && !ua.includes("chrome")) browser = "Safari";
  else if (ua.includes("chrome/")) browser = "Chrome";
  else if (ua.includes("curl/")) browser = "curl";
  else if (ua.includes("postman")) browser = "Postman";

  // OS detection
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac os x") || ua.includes("macos")) os = "macOS";
  else if (ua.includes("linux")) os = "Linux";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";

  // Device type
  if (ua.includes("mobile") || ua.includes("iphone") || ua.includes("android")) {
    deviceType = "mobile";
  } else if (ua.includes("ipad") || ua.includes("tablet")) {
    deviceType = "tablet";
  }

  return { browser, os, deviceType, raw: userAgent };
}

/**
 * Extract IP address from request, handling proxies.
 *
 * WHY CHECK x-forwarded-for?
 * When your app is behind a reverse proxy (nginx, Cloudflare, AWS ALB),
 * req.ip is the proxy's IP, not the client's.
 * X-Forwarded-For contains the original client IP.
 *
 * SECURITY NOTE: Never trust X-Forwarded-For without validating the proxy.
 * In production, configure `app.set('trust proxy', 1)` for Nginx/Vercel.
 */
export function extractIpAddress(req: {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return ips.split(",")[0].trim();
  }
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}
