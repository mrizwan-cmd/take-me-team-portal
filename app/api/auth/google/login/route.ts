import { env } from "@/app/api/_runtime";
import { requestOrigin } from "@/app/api/_request";
import { codeChallenge, ensureGoogleLoginTable, googleLoginConfig, randomToken, safeReturnTo } from "./_lib";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  try {
    const config = await googleLoginConfig(request);
    if (!config.clientId || !config.clientSecret || !config.sessionSecret) throw new Error("Google company sign-in has not been configured");
    await ensureGoogleLoginTable();
    const state = randomToken(48); const nonce = randomToken(32); const verifier = randomToken(48);
    await env.DB.prepare("DELETE FROM portal_login_sessions WHERE expires_at < ?").bind(Date.now()).run();
    await env.DB.prepare("INSERT INTO portal_login_sessions (state, nonce, code_verifier, return_to, expires_at) VALUES (?, ?, ?, ?, ?)")
      .bind(state, nonce, verifier, safeReturnTo(requestUrl.searchParams.get("return_to")), Date.now() + 10 * 60_000).run();
    const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    google.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code", scope: "openid email profile", state, nonce, hd: config.domain, prompt: "select_account", access_type: "online", code_challenge: await codeChallenge(verifier), code_challenge_method: "S256" }).toString();
    return Response.redirect(google, 302);
  } catch {
    return Response.redirect(new URL("/?login_error=setup", requestOrigin(request)), 302);
  }
}
