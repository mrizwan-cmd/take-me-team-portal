import { PORTAL_SESSION_COOKIE, readCookie, verifyPortalSession } from "@/app/portal-session";
import { requestOrigin } from "@/app/api/_request";

export type PortalUser = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  canApprove: boolean;
  localDevelopment: boolean;
};

const localHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);

function emailSet(value: string | undefined) {
  return new Set((value || "").split(",").map(item => item.trim().toLowerCase()).filter(Boolean));
}

function nameFromEmail(email: string) {
  return email.split("@")[0].split(/[._-]+/).map(part => part ? part[0].toUpperCase() + part.slice(1) : "").join(" ");
}

export function portalUser(request: Request): PortalUser | null {
  const url = new URL(request.url);
  const isLocal = localHosts.has(url.hostname);
  const session = verifyPortalSession(process.env.PORTAL_SESSION_SECRET || "", readCookie(request, PORTAL_SESSION_COOKIE));
  let id = session ? `google:${session.sub}` : "";
  let email = session?.email.toLowerCase() || "";
  let name = session?.name || "";
  if (isLocal && process.env.PORTAL_FORCE_GOOGLE_LOGIN !== "true" && (!id || !email)) { id = "local-muneeb-rizwan"; email = "muneeb.rizwan@takeme.taxi"; name = "Muneeb Rizwan"; }
  if (!id || !email) return null;
  const domain = (process.env.PORTAL_ALLOWED_DOMAIN || "takeme.taxi").toLowerCase().replace(/^@/, "");
  if (!email.endsWith(`@${domain}`)) return null;
  const admins = emailSet(process.env.PORTAL_ADMIN_EMAILS || "mrizwan@takeme.taxi");
  const managers = emailSet(process.env.PORTAL_MANAGER_EMAILS);
  const isAdmin = admins.has(email);
  return { id, email, name: name || nameFromEmail(email), isAdmin, canApprove: isAdmin || managers.has(email), localDevelopment: isLocal };
}

export function requirePortalUser(request: Request, options: { admin?: boolean; approver?: boolean } = {}) {
  const user = portalUser(request);
  if (!user) return { user: null, response: Response.json({ error: "Company sign-in is required" }, { status: 401, headers: { "cache-control": "no-store" } }) };
  if (options.admin && !user.isAdmin) return { user: null, response: Response.json({ error: "Administrator access is required" }, { status: 403, headers: { "cache-control": "no-store" } }) };
  if (options.approver && !user.canApprove) return { user: null, response: Response.json({ error: "Approver access is required" }, { status: 403, headers: { "cache-control": "no-store" } }) };
  return { user, response: null };
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  if (origin !== requestOrigin(request)) return Response.json({ error: "Cross-origin requests are not allowed" }, { status: 403, headers: { "cache-control": "no-store" } });
  return null;
}
