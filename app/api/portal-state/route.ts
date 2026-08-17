import { env } from "@/app/api/_runtime";
import { requirePortalUser, requireSameOrigin } from "../_auth";

const workspaceId = "take-me-group";
const arrayFields = ["requests", "approvals", "tasks", "events", "conversations", "documents", "articles", "leave", "shifts", "drivers", "vehicles", "incidents", "handovers", "services", "notifications", "audit", "projectBoards", "projectAutomations", "projectTemplates", "widgets"] as const;
const personalFields = ["tasks", "events", "notifications", "leave", "shifts"] as const;

async function ensureTables() {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS portal_state (
      workspace_id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL,
      updated_at BIGINT NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS portal_user_state (
      user_id TEXT PRIMARY KEY NOT NULL,
      profile TEXT NOT NULL,
      preferences TEXT NOT NULL,
      widgets TEXT NOT NULL,
      updated_at BIGINT NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS portal_user_data (
      user_id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL,
      updated_at BIGINT NOT NULL
    )`),
  ]);
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function validateState(data: unknown): data is Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const value = data as Record<string, unknown>;
  if (!value.profile || typeof value.profile !== "object" || !value.preferences || typeof value.preferences !== "object") return false;
  if (!value.features || typeof value.features !== "object" || !value.adminSettings || typeof value.adminSettings !== "object") return false;
  return arrayFields.every(field => Array.isArray(value[field]));
}

function sharedData(value: Record<string, unknown>) {
  const result = { ...value };
  delete result.profile; delete result.preferences; delete result.widgets;
  for (const field of personalFields) delete result[field];
  return result;
}

function personalData(value: Record<string, unknown>) {
  return Object.fromEntries(personalFields.map(field => [field, Array.isArray(value[field]) ? value[field] : []]));
}

function mergeEmployeeRequests(currentValue: unknown, incomingValue: unknown, userId: string) {
  const current = Array.isArray(currentValue) ? currentValue as Array<Record<string, unknown>> : [];
  const incoming = Array.isArray(incomingValue) ? incomingValue as Array<Record<string, unknown>> : [];
  const incomingById = new Map(incoming.map(item => [String(item.id || ""), item]));
  const merged = current.map(item => item._ownerId === userId && incomingById.has(String(item.id)) ? { ...incomingById.get(String(item.id)), _ownerId: userId } : item);
  const existingIds = new Set(current.map(item => String(item.id || "")));
  const added: Array<Record<string, unknown>> = incoming.filter(item => item.id && !existingIds.has(String(item.id))).map(item => ({ ...item, _ownerId: userId } as Record<string, unknown>));
  return { requests: [...added, ...merged], added };
}

export async function GET(request: Request) {
  const auth = requirePortalUser(request);
  if (auth.response || !auth.user) return auth.response;
  try {
    await ensureTables();
    const [shared, personalState, personalContent] = await env.DB.batch([
      env.DB.prepare("SELECT data, updated_at FROM portal_state WHERE workspace_id = ?").bind(workspaceId),
      env.DB.prepare("SELECT profile, preferences, widgets, updated_at FROM portal_user_state WHERE user_id = ?").bind(auth.user.id),
      env.DB.prepare("SELECT data, updated_at FROM portal_user_data WHERE user_id = ?").bind(auth.user.id),
    ]);
    const sharedRow = (shared.results?.[0] || null) as { data?: string; updated_at?: number } | null;
    const stateRow = (personalState.results?.[0] || null) as { profile?: string; preferences?: string; widgets?: string; updated_at?: number } | null;
    const contentRow = (personalContent.results?.[0] || null) as { data?: string; updated_at?: number } | null;
    const data = parseJson<Record<string, unknown> | null>(sharedRow?.data, null);
    if (data) {
      const savedProfile = parseJson<Record<string, unknown>>(stateRow?.profile, (data.profile || {}) as Record<string, unknown>);
      data.profile = { ...savedProfile, email: auth.user.email, name: savedProfile.name || auth.user.name };
      data.preferences = parseJson(stateRow?.preferences, data.preferences || {});
      data.widgets = parseJson(stateRow?.widgets, data.widgets || []);
      Object.assign(data, parseJson(contentRow?.data, personalData(data)));
      if (!auth.user.canApprove) {
        data.requests = (Array.isArray(data.requests) ? data.requests : []).filter((item: unknown) => Boolean(item && typeof item === "object" && (item as Record<string, unknown>)._ownerId === auth.user.id));
        data.approvals = [];
      }
    }
    return Response.json({ data, revision: sharedRow?.updated_at || 0, personalRevision: Math.max(stateRow?.updated_at || 0, contentRow?.updated_at || 0), user: auth.user }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load portal data" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

export async function PUT(request: Request) {
  const originError = requireSameOrigin(request); if (originError) return originError;
  const auth = requirePortalUser(request); if (auth.response || !auth.user) return auth.response;
  try {
    await ensureTables();
    const payload = await request.json() as { data?: unknown; revision?: number; personalRevision?: number };
    if (!validateState(payload.data)) return Response.json({ error: "Portal data is incomplete or invalid" }, { status: 400 });
    const incoming = payload.data;
    const serialized = JSON.stringify(incoming);
    if (serialized.length > 2_000_000) return Response.json({ error: "Portal data is too large" }, { status: 413 });
    const [current, userState, userContent] = await Promise.all([
      env.DB.prepare("SELECT data, updated_at FROM portal_state WHERE workspace_id = ?").bind(workspaceId).first<{ data: string; updated_at: number }>(),
      env.DB.prepare("SELECT updated_at FROM portal_user_state WHERE user_id = ?").bind(auth.user.id).first<{ updated_at: number }>(),
      env.DB.prepare("SELECT updated_at FROM portal_user_data WHERE user_id = ?").bind(auth.user.id).first<{ updated_at: number }>(),
    ]);
    const currentData = parseJson<Record<string, unknown>>(current?.data, {});
    const nextShared = sharedData(incoming);
    if (!auth.user.isAdmin) {
      nextShared.features = currentData.features || incoming.features;
      nextShared.adminSettings = currentData.adminSettings || incoming.adminSettings;
      nextShared.audit = currentData.audit || incoming.audit;
      nextShared.projectTemplates = currentData.projectTemplates || incoming.projectTemplates;
      nextShared.drivers = currentData.drivers || incoming.drivers;
      nextShared.vehicles = currentData.vehicles || incoming.vehicles;
      nextShared.services = currentData.services || incoming.services;
      const requestMerge = mergeEmployeeRequests(currentData.requests, incoming.requests, auth.user.id);
      nextShared.requests = requestMerge.requests;
      if (!auth.user.canApprove) {
        const currentApprovals = Array.isArray(currentData.approvals) ? currentData.approvals as Array<Record<string, unknown>> : [];
        const generated = requestMerge.added.filter(request => request.status !== "Draft").map(request => ({ id: `APR-${crypto.randomUUID()}`, requestId: request.id, title: request.title, requester: request.requester, due: "Within 2 days", amount: request.amount || "—", status: "Pending", type: request.type }));
        nextShared.approvals = [...generated, ...currentApprovals];
      } else {
        const currentApprovals = Array.isArray(currentData.approvals) ? currentData.approvals as Array<Record<string, unknown>> : [];
        const incomingApprovals = Array.isArray(incoming.approvals) ? incoming.approvals as Array<Record<string, unknown>> : [];
        const incomingApprovalById = new Map(incomingApprovals.map(item => [String(item.id || ""), item]));
        const changedRequestIds = new Set<string>();
        nextShared.approvals = currentApprovals.map(item => {
          const candidate = incomingApprovalById.get(String(item.id || ""));
          if (!candidate || candidate.status === item.status || !["Pending", "Approved", "Rejected"].includes(String(candidate.status))) return item;
          changedRequestIds.add(String(item.requestId || ""));
          return { ...item, status: candidate.status };
        });
        const incomingRequestById = new Map((Array.isArray(incoming.requests) ? incoming.requests as Array<Record<string, unknown>> : []).map(item => [String(item.id || ""), item]));
        nextShared.requests = requestMerge.requests.map(item => {
          if (!changedRequestIds.has(String(item.id || ""))) return item;
          const candidate = incomingRequestById.get(String(item.id || ""));
          return candidate ? { ...item, status: candidate.status, tone: candidate.tone, timeline: candidate.timeline } : item;
        });
      }
    }
    const sharedChanged = !current || JSON.stringify(nextShared) !== JSON.stringify(sharedData(currentData));
    const currentPersonalRevision = Math.max(userState?.updated_at || 0, userContent?.updated_at || 0);
    if (payload.personalRevision !== currentPersonalRevision) return Response.json({ error: "Your portal data changed in another session", code: "personal_revision_conflict", personalRevision: currentPersonalRevision }, { status: 409 });
    if (sharedChanged && current && payload.revision !== current.updated_at) return Response.json({ error: "Company portal data changed in another session", code: "revision_conflict", revision: current.updated_at }, { status: 409 });
    const personalNow = Math.max(Date.now(), currentPersonalRevision + 1);
    const profile = { ...(incoming.profile as Record<string, unknown>), email: auth.user.email };
    const statements = [
      env.DB.prepare(`INSERT INTO portal_user_state (user_id, profile, preferences, widgets, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET profile = excluded.profile, preferences = excluded.preferences, widgets = excluded.widgets, updated_at = excluded.updated_at`)
        .bind(auth.user.id, JSON.stringify(profile), JSON.stringify(incoming.preferences), JSON.stringify(incoming.widgets), personalNow),
      env.DB.prepare(`INSERT INTO portal_user_data (user_id, data, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`)
        .bind(auth.user.id, JSON.stringify(personalData(incoming)), personalNow),
    ];
    let nextRevision = current?.updated_at || 0;
    if (sharedChanged) {
      nextRevision = Math.max(Date.now(), (current?.updated_at || 0) + 1);
      if (current) statements.push(env.DB.prepare("UPDATE portal_state SET data = ?, updated_at = ? WHERE workspace_id = ? AND updated_at = ?").bind(JSON.stringify(nextShared), nextRevision, workspaceId, current.updated_at));
      else statements.push(env.DB.prepare("INSERT INTO portal_state (workspace_id, data, updated_at) VALUES (?, ?, ?)").bind(workspaceId, JSON.stringify(nextShared), nextRevision));
    }
    const results = await env.DB.batch(statements);
    if (sharedChanged && !Number(results[2]?.meta?.changes || 0)) return Response.json({ error: "Company portal data changed in another session", code: "revision_conflict" }, { status: 409 });
    return Response.json({ saved: true, revision: nextRevision, personalRevision: personalNow }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save portal data" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
