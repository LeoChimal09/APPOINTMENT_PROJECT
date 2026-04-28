import { NextRequest } from "next/server";

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

export function isOwnerAuthorized(request: NextRequest) {
  const configuredToken = getConfiguredOwnerToken();
  if (!configuredToken) {
    return false;
  }

  const presentedToken = getPresentedOwnerToken(request);
  if (!presentedToken) {
    return false;
  }

  return presentedToken === configuredToken;
}
