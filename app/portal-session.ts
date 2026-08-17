import { createHmac, timingSafeEqual } from "node:crypto";

export const PORTAL_SESSION_COOKIE = "take_me_session";

export type PortalSessionClaims = {
  sub: string;
  email: string;
  name: string;
  hd: string;
  iat: number;
  exp: number;
};

function base64Url(value: string | Uint8Array) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}

export function signPortalSession(secret: string, claims: PortalSessionClaims) {
  if (secret.length < 32) throw new Error("PORTAL_SESSION_SECRET must contain at least 32 characters");
  const payload = base64Url(JSON.stringify(claims));
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyPortalSession(secret: string, token: string): PortalSessionClaims | null {
  try {
    if (secret.length < 32) return null;
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    const expected = createHmac("sha256", secret).update(payload).digest();
    const supplied = fromBase64Url(signature);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    const claims = JSON.parse(fromBase64Url(payload).toString("utf8")) as PortalSessionClaims;
    if (!claims.sub || !claims.email || !claims.name || !claims.hd || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch { return null; }
}

export function readCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return "";
}

export function portalSessionCookie(token: string, secure: boolean, maxAge = 8 * 60 * 60) {
  return `${PORTAL_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

export function clearPortalSessionCookie(secure: boolean) {
  return `${PORTAL_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}
