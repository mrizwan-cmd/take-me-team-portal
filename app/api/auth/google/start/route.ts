import { env } from "@/app/api/_runtime";
import { ensureGoogleTables, getGoogleConfig, googleError } from "../../../google/_lib";
import { requirePortalUser } from "../../../_auth";

const scopes = [
  "openid", "email", "profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "https://www.googleapis.com/auth/chat.spaces.readonly",
  "https://www.googleapis.com/auth/chat.messages",
];

export async function GET(request: Request) {
  try {
    const auth = requirePortalUser(request); if (auth.response || !auth.user) return auth.response;
    const config = await getGoogleConfig(request);
    if (!config.clientId || !config.clientSecret || !config.encryptionConfigured) throw new Error("An administrator must finish the secure Google OAuth runtime settings first");
    await ensureGoogleTables();
    const state = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
    await env.DB.prepare("DELETE FROM google_oauth_sessions WHERE expires_at < ?").bind(Date.now()).run();
    await env.DB.prepare("INSERT INTO google_oauth_sessions (state, user_id, user_email, expires_at) VALUES (?, ?, ?, ?)").bind(state, auth.user.id, auth.user.email, Date.now() + 10 * 60_000).run();
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code", access_type: "offline", prompt: "consent", include_granted_scopes: "true", scope: scopes.join(" "), state, hd: config.domain }).toString();
    return Response.redirect(url, 302);
  } catch (error) {
    return googleError(error);
  }
}
