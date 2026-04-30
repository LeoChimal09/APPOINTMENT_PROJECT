import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { getToken } from "next-auth/jwt";
import { isAdminEmail } from "@/lib/auth";

function getConfiguredOwnerToken() {
  const token = process.env.OWNER_DASHBOARD_TOKEN?.trim();
  return token && token.length > 0 ? token : null;
}

function getPresentedOwnerToken(request: NextRequest) {
  const directHeader = request.headers.get("x-owner-token")?.trim();
  if (directHeader) {
    return directHeader;
  }

  const authorizationHeader = request.headers.get("authorization")?.trim();
  if (!authorizationHeader) {
    return null;
  }

  const bearerPrefix = "Bearer ";
  if (!authorizationHeader.startsWith(bearerPrefix)) {
    return null;
  }

  return authorizationHeader.slice(bearerPrefix.length).trim() || null;
}

export async function isOwnerAuthorized(request: NextRequest) {
  const authToken = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  }).catch(() => null);

  const sessionEmail =
    typeof authToken?.email === "string" ? authToken.email.trim().toLowerCase() : null;

  if (isAdminEmail(sessionEmail)) {
    return true;
  }

  // Legacy fallback for non-OAuth flows still using OWNER_DASHBOARD_TOKEN.
  const configuredToken = getConfiguredOwnerToken();
  if (!configuredToken) {
    return false;
  }

  const presentedToken = getPresentedOwnerToken(request);
  if (!presentedToken) {
    return false;
  }

  // Use constant-time comparison to prevent timing attacks.
  const configuredBuf = Buffer.from(configuredToken, "utf8");
  const presentedBuf = Buffer.from(presentedToken, "utf8");
  if (configuredBuf.length !== presentedBuf.length) {
    return false;
  }

  return timingSafeEqual(configuredBuf, presentedBuf);
}
