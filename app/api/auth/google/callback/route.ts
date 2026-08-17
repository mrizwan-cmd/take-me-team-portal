import { env } from "@/app/api/_runtime";
import { requestOrigin } from "@/app/api/_request";
import { ensureGoogleTables, getGoogleConfig, googleError, recordGoogleConnection, saveGoogleTokens } from "../../../google/_lib";

export async function GET(request: Request) {
  try {
    await ensureGoogleTables();
    const url = new URL(request.url);
    const state = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    const oauthError = url.searchParams.get("error");
    if (oauthError) return Response.redirect(new URL(`/?google=${encodeURIComponent(oauthError)}`, requestOrigin(request)), 302);
    if (!state || !code) throw new Error("Google authorization response is incomplete");
    const stateRow = await env.DB.prepare("SELECT user_id, user_email, expires_at FROM google_oauth_sessions WHERE state = ?").bind(state).first<{ user_id: string; user_email: string; expires_at: number }>();
    await env.DB.prepare("DELETE FROM google_oauth_sessions WHERE state = ?").bind(state).run();
    if (!stateRow || stateRow.expires_at < Date.now()) throw new Error("Google authorization state is invalid or expired");
    const config = await getGoogleConfig(request);
    const body = new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, code, grant_type: "authorization_code", redirect_uri: config.redirectUri });
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
    const token = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error_description?: string };
    if (!tokenResponse.ok || !token.access_token) throw new Error(token.error_description || "Google authorization failed");
    const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { authorization: `Bearer ${token.access_token}` } });
    const user = await userResponse.json() as { email?: string; verified_email?: boolean };
    if (!user.email || !user.verified_email || !user.email.toLowerCase().endsWith(`@${config.domain.toLowerCase()}`)) throw new Error(`Use a verified @${config.domain} Google Workspace account`);
    if (user.email.toLowerCase() !== stateRow.user_email.toLowerCase()) throw new Error("Connect the same Google Workspace account used to sign in to the portal");
    await saveGoogleTokens(stateRow.user_id, { accessToken: token.access_token, refreshToken: token.refresh_token, expiresAt: Date.now() + (token.expires_in || 3600) * 1000, scope: token.scope, email: user.email });
    await recordGoogleConnection(user.email);
    return Response.redirect(new URL("/?google=connected", requestOrigin(request)), 302);
  } catch (error) {
    return googleError(error, 400);
  }
}
