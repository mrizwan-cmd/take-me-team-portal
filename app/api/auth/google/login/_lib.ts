import { env } from "@/app/api/_runtime";
import { requestOrigin } from "@/app/api/_request";
import { getGoogleConfig } from "../../../google/_lib";

const encoder = new TextEncoder();

export async function ensureGoogleLoginTable() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS portal_login_sessions (
    state TEXT PRIMARY KEY NOT NULL,
    nonce TEXT NOT NULL,
    code_verifier TEXT NOT NULL,
    return_to TEXT NOT NULL,
    expires_at BIGINT NOT NULL
  )`).run();
}

export async function googleLoginConfig(request: Request) {
  const base = await getGoogleConfig(request);
  const origin = requestOrigin(request);
  return { ...base, redirectUri: process.env.GOOGLE_LOGIN_REDIRECT_URI || `${origin}/api/auth/google/login/callback`, sessionSecret: process.env.PORTAL_SESSION_SECRET || "" };
}

export function randomToken(bytes = 32) {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function codeChallenge(verifier: string) {
  return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(verifier))));
}

export function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://portal.local");
    if (url.origin !== "https://portal.local" || url.pathname.startsWith("/api/auth/")) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return "/"; }
}

type GoogleIdClaims = {
  iss?: string;
  aud?: string | string[];
  azp?: string;
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  hd?: string;
  nonce?: string;
  exp?: number;
};

type GoogleJwk = JsonWebKey & { kid?: string };

export async function verifyGoogleIdToken(idToken: string, clientId: string, nonce: string, domain: string) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Google identity token is malformed");
  const header = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[0]))) as { alg?: string; kid?: string };
  const claims = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[1]))) as GoogleIdClaims;
  if (header.alg !== "RS256" || !header.kid) throw new Error("Google identity token algorithm is invalid");
  const certificates = await fetch("https://www.googleapis.com/oauth2/v3/certs", { headers: { accept: "application/json" } });
  if (!certificates.ok) throw new Error("Google signing keys could not be loaded");
  const jwks = await certificates.json() as { keys?: GoogleJwk[] };
  const jwk = (jwks.keys || []).find(key => key.kid === header.kid);
  if (!jwk) throw new Error("Google signing key was not found");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, fromBase64Url(parts[2]), encoder.encode(`${parts[0]}.${parts[1]}`));
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud || ""];
  const expectedDomain = domain.toLowerCase().replace(/^@/u, "");
  if (!verified) throw new Error("Google identity token signature is invalid");
  if (!claims.iss || !["accounts.google.com", "https://accounts.google.com"].includes(claims.iss)) throw new Error("Google identity issuer is invalid");
  if (!audience.includes(clientId)) throw new Error("Google identity audience is invalid");
  if ((audience.length > 1 || claims.azp) && claims.azp !== clientId) throw new Error("Google identity authorised party is invalid");
  if (!claims.exp || claims.exp <= Math.floor(Date.now() / 1000)) throw new Error("Google identity token has expired");
  if (!claims.sub || !claims.email || !claims.email_verified) throw new Error("Google account email is not verified");
  if (claims.nonce !== nonce) throw new Error("Google identity nonce is invalid");
  if (!claims.hd || claims.hd.toLowerCase() !== expectedDomain || !claims.email.toLowerCase().endsWith(`@${expectedDomain}`)) throw new Error(`Use your @${expectedDomain} Google Workspace account`);
  return { sub: claims.sub, email: claims.email.toLowerCase(), name: claims.name || claims.email.split("@")[0], hd: expectedDomain };
}

function base64Url(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const decoded = atob(normalized);
  return Uint8Array.from(decoded, character => character.charCodeAt(0));
}
