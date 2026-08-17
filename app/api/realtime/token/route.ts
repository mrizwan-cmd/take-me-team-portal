import { requirePortalUser, requireSameOrigin } from "../../_auth";
import { REALTIME_WORKSPACE, signRealtimeToken } from "@/app/realtime-token";

export const runtime = "nodejs";

function realtimeUrl(request: Request) {
  const configured = (process.env.REALTIME_URL || process.env.NEXT_PUBLIC_REALTIME_URL || "").trim();
  if (!configured) return "";
  const url = new URL(configured);
  const localRequest = ["127.0.0.1", "localhost", "[::1]"].includes(new URL(request.url).hostname);
  if (url.protocol !== "wss:" && !(localRequest && url.protocol === "ws:")) throw new Error("The realtime gateway must use a secure wss:// address");
  return url.toString();
}

export async function GET(request: Request) {
  const originError = requireSameOrigin(request); if (originError) return originError;
  const auth = requirePortalUser(request); if (auth.response || !auth.user) return auth.response;
  try {
    const url = realtimeUrl(request);
    if (!url) return Response.json({ configured: false }, { headers: { "cache-control": "no-store" } });
    const secret = process.env.REALTIME_TOKEN_SECRET || "";
    const now = Math.floor(Date.now() / 1000);
    const token = signRealtimeToken(secret, {
      sub: auth.user.id,
      email: auth.user.email,
      name: auth.user.name,
      workspace: REALTIME_WORKSPACE,
      iat: now,
      exp: now + 5 * 60,
    });
    return Response.json({ configured: true, url, token, expiresAt: (now + 5 * 60) * 1000 }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ configured: false, error: error instanceof Error ? error.message : "Realtime connection could not be configured" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
