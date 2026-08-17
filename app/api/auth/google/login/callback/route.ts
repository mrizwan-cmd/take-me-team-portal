import { env } from "@/app/api/_runtime";
import { requestOrigin, secureRequest } from "@/app/api/_request";
import { portalSessionCookie, signPortalSession } from "../../../../../portal-session";
import { ensureGoogleLoginTable, googleLoginConfig, safeReturnTo, verifyGoogleIdToken } from "../_lib";

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    if (url.searchParams.get("error")) throw new Error("access_denied");
    const state = url.searchParams.get("state"); const code = url.searchParams.get("code");
    if (!state || !code) throw new Error("incomplete");
    await ensureGoogleLoginTable();
    const session = await env.DB.prepare("SELECT nonce, code_verifier, return_to, expires_at FROM portal_login_sessions WHERE state = ?").bind(state).first<{ nonce: string; code_verifier: string; return_to: string; expires_at: number }>();
    await env.DB.prepare("DELETE FROM portal_login_sessions WHERE state = ?").bind(state).run();
    if (!session || session.expires_at < Date.now()) throw new Error("expired");
    const config = await googleLoginConfig(request);
    if (!config.clientId || !config.clientSecret || !config.sessionSecret) throw new Error("setup");
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, code, code_verifier: session.code_verifier, grant_type: "authorization_code", redirect_uri: config.redirectUri }) });
    const token = await tokenResponse.json() as { id_token?: string; error_description?: string };
    if (!tokenResponse.ok || !token.id_token) throw new Error(token.error_description || "token");
    const user = await verifyGoogleIdToken(token.id_token, config.clientId, session.nonce, config.domain);
    const now = Math.floor(Date.now() / 1000);
    const signed = await signPortalSession(config.sessionSecret, { ...user, iat: now, exp: now + 8 * 60 * 60 });
    const destination = new URL(safeReturnTo(session.return_to), requestOrigin(request));
    destination.searchParams.set("welcome", "1");
    return new Response(null, {
      status: 302,
      headers: {
        location: destination.toString(),
        "set-cookie": portalSessionCookie(signed, secureRequest(request)),
      },
    });
  } catch (error) {
    const reason = error instanceof Error && ["access_denied", "expired", "setup"].includes(error.message) ? error.message : error instanceof Error && error.message.startsWith("Use your @") ? "domain" : "failed";
    return Response.redirect(new URL(`/?login_error=${reason}`, requestOrigin(request)), 302);
  }
}
