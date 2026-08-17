import { createHmac, timingSafeEqual } from "node:crypto";

export const REALTIME_WORKSPACE = "take-me-group";

export type RealtimeTokenClaims = {
  sub: string;
  email: string;
  name: string;
  workspace: string;
  iat: number;
  exp: number;
};

function base64Url(value: string | Uint8Array) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}

export function signRealtimeToken(secret: string, claims: RealtimeTokenClaims) {
  if (secret.length < 32) throw new Error("REALTIME_TOKEN_SECRET must contain at least 32 characters");
  const payload = base64Url(JSON.stringify(claims));
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyRealtimeToken(secret: string, token: string): RealtimeTokenClaims | null {
  try {
    if (secret.length < 32) return null;
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    const expected = createHmac("sha256", secret).update(payload).digest();
    const supplied = fromBase64Url(signature);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    const claims = JSON.parse(fromBase64Url(payload).toString("utf8")) as RealtimeTokenClaims;
    if (!claims.sub || !claims.email || !claims.name || claims.workspace !== REALTIME_WORKSPACE || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch { return null; }
}
