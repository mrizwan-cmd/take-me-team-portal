import { env } from "@/app/api/_runtime";
import { requestOrigin, secureRequest } from "@/app/api/_request";
import { portalSessionCookie, signPortalSession } from "../../../../../portal-session";
import { ensureGoogleLoginTable, googleLoginConfig, googleLoginTraceId, recordGoogleLoginDiagnostic, safeReturnTo, verifyGoogleIdToken } from "../_lib";
import { upsertGoogleEmployee } from "../../employee-directory";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const startedAt = Date.now();
  const state = url.searchParams.get("state");
  const traceId = await googleLoginTraceId(state);
  let stage = "request";
  let diagnosticCode = "unknown";
  let diagnosticStatus = 0;
  try {
    if (url.searchParams.get("error")) throw new Error("access_denied");
    const code = url.searchParams.get("code");
    if (!state || !code) throw new Error("incomplete");
    await ensureGoogleLoginTable();
    stage = "login_session";
    const session = await env.DB.prepare("SELECT nonce, code_verifier, return_to, expires_at FROM portal_login_sessions WHERE state = ?").bind(state).first<{ nonce: string; code_verifier: string; return_to: string; expires_at: number }>();
    await env.DB.prepare("DELETE FROM portal_login_sessions WHERE state = ?").bind(state).run();
    if (!session || session.expires_at < Date.now()) throw new Error("expired");
    const config = await googleLoginConfig(request);
    stage = "configuration";
    if (!config.clientId || !config.clientSecret || !config.sessionSecret) throw new Error("setup");
    stage = "token_exchange";
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, code, code_verifier: session.code_verifier, grant_type: "authorization_code", redirect_uri: config.redirectUri }) });
    diagnosticStatus = tokenResponse.status;
    const token = await tokenResponse.json() as { id_token?: string; error?: string; error_description?: string };
    if (!tokenResponse.ok || !token.id_token) {
      diagnosticCode = token.error || "missing_id_token";
      throw new Error(`google_${diagnosticCode}`);
    }
    stage = "identity_verification";
    const user = await verifyGoogleIdToken(token.id_token, config.clientId, session.nonce, config.domain);
    stage = "employee_directory";
    await upsertGoogleEmployee(user);
    stage = "session_cookie";
    const now = Math.floor(Date.now() / 1000);
    const signed = await signPortalSession(config.sessionSecret, { sub: user.sub, email: user.email, name: user.name, hd: user.hd, iat: now, exp: now + 8 * 60 * 60 });
    const destination = new URL(safeReturnTo(session.return_to), requestOrigin(request));
    destination.searchParams.set("welcome", "1");
    await recordGoogleLoginDiagnostic({ traceId, stage: "complete", outcome: "succeeded", httpStatus: 302, durationMs: Date.now() - startedAt });
    return new Response(null, {
      status: 302,
      headers: {
        location: destination.toString(),
        "set-cookie": portalSessionCookie(signed, secureRequest(request)),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (diagnosticCode === "unknown") diagnosticCode = message.replace(/[^a-z0-9_-]+/giu, "_").slice(0, 80).toLowerCase() || "unknown";
    await recordGoogleLoginDiagnostic({ traceId, stage, outcome: "failed", errorCode: diagnosticCode, httpStatus: diagnosticStatus, durationMs: Date.now() - startedAt });
    const reason = ["access_denied", "expired", "setup"].includes(message)
      ? message
      : message.startsWith("Use your @")
        ? "domain"
        : stage === "token_exchange"
          ? "credentials"
          : stage === "identity_verification"
            ? "identity"
            : stage === "employee_directory"
              ? "directory"
              : stage === "session_cookie"
                ? "session"
                : "failed";
    return Response.redirect(new URL(`/?login_error=${reason}&login_trace=${encodeURIComponent(traceId)}`, requestOrigin(request)), 302);
  }
}
