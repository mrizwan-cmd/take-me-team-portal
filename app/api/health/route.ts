import { env } from "@/app/api/_runtime";
import { requirePortalUser } from "../_auth";
import { googleConnectionStatus } from "../google/_lib";

export async function GET(request: Request) {
  const auth = requirePortalUser(request, { admin: true }); if (auth.response || !auth.user) return auth.response;
  const checks = { database: "Unavailable", fileStorage: "Unavailable", googleWorkspace: "Not configured", realtime: "Polling fallback" };
  try { await env.DB.prepare("SELECT 1 AS healthy").first(); checks.database = "Healthy"; } catch { /* report unavailable */ }
  try { await env.FILES.health(); checks.fileStorage = "Healthy"; } catch { /* report unavailable */ }
  try {
    const google = await googleConnectionStatus(request, auth.user.id);
    checks.googleWorkspace = google.connected ? "Connected" : google.configured ? "Ready to connect" : "Not configured";
  } catch { checks.googleWorkspace = "Unavailable"; }
  if (process.env.REALTIME_URL && process.env.REALTIME_TOKEN_SECRET && process.env.REALTIME_TOKEN_SECRET.length >= 32) checks.realtime = "Gateway configured";
  const healthy = checks.database === "Healthy" && checks.fileStorage === "Healthy" && !["Not configured", "Unavailable"].includes(checks.googleWorkspace);
  return Response.json({ healthy, checks, checkedAt: new Date().toISOString() }, { status: healthy ? 200 : 503, headers: { "cache-control": "no-store" } });
}
