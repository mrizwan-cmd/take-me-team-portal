import { createHash, scryptSync, timingSafeEqual } from "node:crypto";
import { requireSameOrigin } from "@/app/api/_auth";
import { secureRequest } from "@/app/api/_request";
import { portalSessionCookie, signPortalSession } from "@/app/portal-session";

type Attempt = { failures: number; blockedUntil: number };

const attempts = new Map<string, Attempt>();
const maximumFailures = 5;
const blockDurationMs = 15 * 60 * 1000;

function requesterKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

function sameText(left: string, right: string) {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function passwordMatches(password: string, stored: string) {
  try {
    const [version, saltValue, hashValue] = stored.split("$");
    if (version !== "scrypt-v1" || !saltValue || !hashValue) return false;
    const salt = Buffer.from(saltValue, "base64url");
    const expected = Buffer.from(hashValue, "base64url");
    if (salt.length < 16 || expected.length !== 64) return false;
    const actual = scryptSync(password, salt, expected.length, { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function temporaryLoginEnabled() {
  const expiresAt = Date.parse(process.env.TEMP_ADMIN_EXPIRES_AT || "");
  return Boolean(
    process.env.TEMP_ADMIN_USERNAME
    && process.env.TEMP_ADMIN_PASSWORD_HASH
    && Number.isFinite(expiresAt)
    && expiresAt > Date.now(),
  );
}

function unavailable() {
  return Response.json({ error: "Temporary administrator access is not available" }, { status: 404, headers: { "cache-control": "no-store" } });
}

export async function GET() {
  return Response.json({ enabled: temporaryLoginEnabled() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  if (!temporaryLoginEnabled()) return unavailable();

  const requestLength = Number(request.headers.get("content-length") || "0");
  if (requestLength > 4_096) return Response.json({ error: "Invalid sign-in request" }, { status: 400 });

  const key = requesterKey(request);
  const previous = attempts.get(key);
  if (previous?.blockedUntil && previous.blockedUntil > Date.now()) {
    return Response.json(
      { error: "Too many attempts. Try again in 15 minutes." },
      { status: 429, headers: { "cache-control": "no-store", "retry-after": "900" } },
    );
  }

  let username = "";
  let password = "";
  try {
    const body = await request.json() as { username?: unknown; password?: unknown };
    username = typeof body.username === "string" ? body.username.trim() : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return Response.json({ error: "Invalid sign-in request" }, { status: 400, headers: { "cache-control": "no-store" } });
  }

  const expectedUsername = process.env.TEMP_ADMIN_USERNAME || "";
  const valid = username.length <= 128
    && password.length <= 256
    && sameText(username, expectedUsername)
    && passwordMatches(password, process.env.TEMP_ADMIN_PASSWORD_HASH || "");

  if (!valid) {
    const failures = (previous?.failures || 0) + 1;
    attempts.set(key, { failures, blockedUntil: failures >= maximumFailures ? Date.now() + blockDurationMs : 0 });
    return Response.json(
      { error: failures >= maximumFailures ? "Too many attempts. Try again in 15 minutes." : "Username or password is incorrect" },
      { status: failures >= maximumFailures ? 429 : 401, headers: { "cache-control": "no-store" } },
    );
  }

  attempts.delete(key);
  const email = (process.env.TEMP_ADMIN_EMAIL || process.env.PORTAL_ADMIN_EMAILS?.split(",")[0] || "muneeb.rizwan@takeme.taxi").trim().toLowerCase();
  const domain = (process.env.PORTAL_ALLOWED_DOMAIN || "takeme.taxi").trim().toLowerCase().replace(/^@/, "");
  if (!email.endsWith(`@${domain}`)) return unavailable();

  const now = Math.floor(Date.now() / 1000);
  const signed = signPortalSession(process.env.PORTAL_SESSION_SECRET || "", {
    sub: "temporary-admin",
    email,
    name: "Muneeb Rizwan",
    hd: domain,
    iat: now,
    exp: now + 60 * 60,
  });

  return Response.json(
    { ok: true, destination: "/?admin=1&page=Integrations" },
    { headers: { "cache-control": "no-store", "set-cookie": portalSessionCookie(signed, secureRequest(request), 60 * 60) } },
  );
}
