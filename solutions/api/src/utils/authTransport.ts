import type { Request } from "express";
import { COOKIE_NAMES } from "./jwt.js";

export const TOKEN_TRANSPORT_HEADER = "x-auth-token-transport";
export const REFRESH_TOKEN_HEADER = "x-refresh-token";

type BodyWithTokens = {
  refreshToken?: unknown;
  tokenTransport?: unknown;
  clientType?: unknown;
};

function getBody(req: Request): BodyWithTokens {
  return typeof req.body === "object" && req.body !== null
    ? (req.body as BodyWithTokens)
    : {};
}

export function wantsTokenResponse(req: Request): boolean {
  const transport = req.header(TOKEN_TRANSPORT_HEADER)?.toLowerCase();
  const body = getBody(req);
  const bodyTransport =
    typeof body.tokenTransport === "string"
      ? body.tokenTransport.toLowerCase()
      : undefined;
  const clientType =
    typeof body.clientType === "string" ? body.clientType.toLowerCase() : undefined;

  return (
    transport === "body" ||
    bodyTransport === "body" ||
    clientType === "mobile" ||
    clientType === "desktop" ||
    clientType === "native"
  );
}

export function getAccessTokenFromRequest(req: Request): string | undefined {
  const cookieToken = req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN] as string | undefined;
  if (cookieToken) return cookieToken;

  const authHeader = req.header("authorization");
  if (!authHeader) return undefined;

  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return undefined;

  return token;
}

export function getRefreshTokenFromRequest(req: Request): string | undefined {
  const cookieToken = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] as string | undefined;
  if (cookieToken) return cookieToken;

  const bodyToken = getBody(req).refreshToken;
  if (typeof bodyToken === "string" && bodyToken.length > 0) return bodyToken;

  const headerToken = req.header(REFRESH_TOKEN_HEADER);
  return headerToken || undefined;
}

