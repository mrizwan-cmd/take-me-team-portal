import { env } from "@/app/api/_runtime";
import { requirePortalUser, requireSameOrigin } from "../../_auth";
import { featureAreas, type FeatureArea, validateArea } from "../_schema";

const workspaceId = "take-me-group";

function operationalFeatureData(area: string, value: unknown, employeeEmails?: Set<string>, userEmail?: string) {
  if (area !== "conversations" || !Array.isArray(value)) return value;
  return value.filter(item => {
    if (!item || typeof item !== "object") return false;
    const conversation = item as Record<string, unknown>;
    const members = Array.isArray(conversation.members) ? conversation.members : [];
    const normalized = members.map(member => String(member).toLowerCase());
    return conversation.type === "Direct" && members.length === 2 && new Set(normalized).size === 2 && (!employeeEmails || normalized.every(email => employeeEmails.has(email))) && (!userEmail || normalized.includes(userEmail.toLowerCase()));
  });
}

async function activeEmployeeEmails() {
  const rows = await env.DB.prepare("SELECT email FROM portal_employees WHERE status = 'Active'").all<{ email: string }>();
  return new Set((rows.results || []).map(row => row.email.toLowerCase()));
}

async function ensureTable() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS portal_feature_state (
    workspace_id TEXT NOT NULL,
    area TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (workspace_id, area)
  )`).run();
}

export async function GET(request: Request) {
  const auth = requirePortalUser(request);
  if (auth.response || !auth.user) return auth.response;
  await ensureTable();
  const requested = new URL(request.url).searchParams.get("area");
  if (!requested || !featureAreas.includes(requested as FeatureArea)) return Response.json({ error: "A valid feature area is required" }, { status: 400 });
  const row = await env.DB.prepare("SELECT data, updated_at FROM portal_feature_state WHERE workspace_id = ? AND area = ?").bind(workspaceId, requested).first<{ data: string; updated_at: number }>();
  const emails = requested === "conversations" ? await activeEmployeeEmails() : undefined;
  const data = row ? operationalFeatureData(requested, JSON.parse(row.data), emails, requested === "conversations" ? auth.user.email : undefined) : null;
  return Response.json({ area: requested, data, revision: row?.updated_at || 0 }, { headers: { "cache-control": "no-store" } });
}

export async function PUT(request: Request) {
  const originError = requireSameOrigin(request); if (originError) return originError;
  const auth = requirePortalUser(request); if (auth.response || !auth.user) return auth.response;
  await ensureTable();
  const payload = await request.json() as { areas?: Record<string, unknown>; revisions?: Record<string, number> };
  if (!payload.areas || typeof payload.areas !== "object" || Array.isArray(payload.areas)) return Response.json({ error: "Feature areas are required" }, { status: 400 });
  const entries = Object.entries(payload.areas);
  const employeeEmails = entries.some(([area]) => area === "conversations") ? await activeEmployeeEmails() : undefined;
  if (!entries.length || entries.length > featureAreas.length) return Response.json({ error: "No valid feature changes supplied" }, { status: 400 });
  for (const [area, rawValue] of entries) {
    const value = operationalFeatureData(area, rawValue, employeeEmails, area === "conversations" ? auth.user.email : undefined);
    if (area === "conversations" && JSON.stringify(value) !== JSON.stringify(rawValue)) return Response.json({ error: "Direct messages can only include active employees who have signed in" }, { status: 400 });
    if (!featureAreas.includes(area as FeatureArea)) return Response.json({ error: `Unsupported feature area: ${area}` }, { status: 400 });
    if (area === "projectTemplates" && !auth.user.isAdmin) return Response.json({ error: "Administrator access is required" }, { status: 403 });
    const validationError = validateArea(area, value);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });
  }
  const revisions: Record<string, number> = {};
  for (const [area, rawValue] of entries) {
    let value = operationalFeatureData(area, rawValue, employeeEmails, area === "conversations" ? auth.user.email : undefined);
    const current = await env.DB.prepare("SELECT data, updated_at FROM portal_feature_state WHERE workspace_id = ? AND area = ?").bind(workspaceId, area).first<{ data: string; updated_at: number }>();
    const expected = payload.revisions?.[area] || 0;
    if ((current?.updated_at || 0) !== expected) return Response.json({ error: `${area} changed in another session`, code: "feature_revision_conflict", area, revision: current?.updated_at || 0 }, { status: 409 });
    if (area === "conversations") {
      const existing = current?.data ? JSON.parse(current.data) as Array<{ members?: string[] }> : [];
      const others = existing.filter(item => !item.members?.some(member => member.toLowerCase() === auth.user!.email.toLowerCase()));
      value = [...(value as unknown[]), ...others];
    }
    const next = Math.max(Date.now(), (current?.updated_at || 0) + 1);
    if (current) {
      const result = await env.DB.prepare("UPDATE portal_feature_state SET data = ?, updated_at = ? WHERE workspace_id = ? AND area = ? AND updated_at = ?").bind(JSON.stringify(value), next, workspaceId, area, current.updated_at).run();
      if (!Number(result.meta?.changes || 0)) return Response.json({ error: `${area} changed in another session`, code: "feature_revision_conflict", area }, { status: 409 });
    } else {
      await env.DB.prepare("INSERT INTO portal_feature_state (workspace_id, area, data, updated_at) VALUES (?, ?, ?, ?)").bind(workspaceId, area, JSON.stringify(value), next).run();
    }
    revisions[area] = next;
  }
  return Response.json({ saved: true, featureRevisions: revisions }, { headers: { "cache-control": "no-store" } });
}
