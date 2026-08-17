import { requirePortalUser, requireSameOrigin } from "../../_auth";
import { getGoogleConfig, googleError, saveStoredGoogleConfig } from "../_lib";

function clean(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

export async function GET(request: Request) {
  const auth = requirePortalUser(request, { admin: true });
  if (auth.response || !auth.user) return auth.response;
  try {
    const config = await getGoogleConfig(request);
    return Response.json({
      clientId: config.clientId,
      projectId: config.projectId,
      domain: config.domain,
      clientSecretConfigured: Boolean(config.clientSecret),
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return googleError(error);
  }
}

export async function PUT(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const auth = requirePortalUser(request, { admin: true });
  if (auth.response || !auth.user) return auth.response;
  try {
    const contentLength = Number(request.headers.get("content-length") || "0");
    if (contentLength > 8_192) return Response.json({ error: "Google configuration is too large" }, { status: 413 });
    const body = await request.json() as Record<string, unknown>;
    const clientId = clean(body.clientId, 512);
    const clientSecret = clean(body.clientSecret, 1_024);
    const projectId = clean(body.projectId, 256);
    const domain = clean(body.domain, 253).toLowerCase().replace(/^@/, "");
    if (!clientId || !projectId || !/^[a-z0-9.-]+$/u.test(domain)) {
      return Response.json({ error: "Project ID, OAuth Client ID and company domain are required" }, { status: 400 });
    }
    const result = await saveStoredGoogleConfig(auth.user.id, { clientId, clientSecret, projectId, domain });
    return Response.json({ saved: true, ...result }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return googleError(error, 400);
  }
}
