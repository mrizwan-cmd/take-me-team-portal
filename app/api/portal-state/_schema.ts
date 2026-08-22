const MAX_TEXT = 20_000;
const MAX_ITEMS = 10_000;

export const portalArrayFields = ["employees", "requests", "approvals", "tasks", "events", "conversations", "documents", "articles", "leave", "shifts", "drivers", "vehicles", "incidents", "handovers", "services", "notifications", "audit", "projectBoards", "projectAutomations", "projectTemplates", "widgets"] as const;
export const featureAreas = ["conversations", "documents", "articles", "projectBoards", "projectAutomations", "projectTemplates"] as const;
export type FeatureArea = typeof featureAreas[number];

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const text = (value: unknown, max = 500) => typeof value === "string" && value.length <= max;
const idRecord = (value: unknown) => isObject(value) && text(value.id, 160) && Boolean(value.id);

function safeTree(value: unknown, depth = 0): boolean {
  if (depth > 12) return false;
  if (typeof value === "string") return value.length <= MAX_TEXT;
  if (value === null || typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length <= MAX_ITEMS && value.every(item => safeTree(item, depth + 1));
  if (!isObject(value) || Object.keys(value).length > 500) return false;
  return Object.entries(value).every(([key, item]) => key.length <= 160 && safeTree(item, depth + 1));
}

function validConversation(value: unknown) {
  if (!isObject(value) || !idRecord(value) || !text(value.name, 300) || value.type !== "Direct" || !Array.isArray(value.members)) return false;
  const members = value.members.map(member => String(member).toLowerCase());
  if (members.length !== 2 || new Set(members).size !== 2 || !value.members.every(member => text(member, 320) && String(member).includes("@"))) return false;
  if (value.unreadBy && (!Array.isArray(value.unreadBy) || value.unreadBy.length > 2 || !value.unreadBy.every(email => text(email, 320) && String(email).includes("@") && members.includes(String(email).toLowerCase())))) return false;
  if (!Array.isArray(value.messages)) return false;
  return value.messages.every(message => {
    if (!isObject(message) || !idRecord(message) || !text(message.author, 300) || !text(message.text, 10_000)) return false;
    if (message.authorEmail && (!text(message.authorEmail, 320) || !String(message.authorEmail).includes("@") || !members.includes(String(message.authorEmail).toLowerCase()))) return false;
    if (!message.attachments) return true;
    return Array.isArray(message.attachments) && message.attachments.length <= 12 && message.attachments.every(attachment => isObject(attachment) && text(attachment.key, 500) && String(attachment.key).startsWith("portal/") && text(attachment.name, 300) && text(attachment.type, 160) && Number.isFinite(Number(attachment.size)) && Number(attachment.size) > 0);
  });
}

const validators: Partial<Record<(typeof portalArrayFields)[number], (value: unknown) => boolean>> = {
  employees: value => isObject(value) && idRecord(value) && text(value.googleId, 160) && text(value.name, 300) && text(value.email, 320) && String(value.email).includes("@") && ["Active", "Suspended"].includes(String(value.status)),
  tasks: value => isObject(value) && idRecord(value) && text(value.title, 500) && ["To do", "In progress", "Done", "Waiting"].includes(String(value.status)),
  events: value => isObject(value) && idRecord(value) && text(value.title, 500) && /^\d{4}-\d{2}-\d{2}$/.test(String(value.date || "")) && text(value.start, 20) && text(value.end, 20),
  conversations: validConversation,
  documents: value => isObject(value) && idRecord(value) && text(value.name, 500) && text(value.type, 120),
  articles: value => isObject(value) && idRecord(value) && text(value.title, 500) && text(value.summary, 5_000),
  projectBoards: value => isObject(value) && idRecord(value) && text(value.title, 500) && Array.isArray(value.lists) && Array.isArray(value.cards) && value.cards.every(idRecord),
  projectAutomations: value => isObject(value) && idRecord(value) && text(value.name, 500),
  projectTemplates: value => isObject(value) && idRecord(value) && text(value.name, 500) && Array.isArray(value.lists),
};

export function validateArea(area: string, value: unknown): string | null {
  if (!portalArrayFields.includes(area as (typeof portalArrayFields)[number])) return `Unknown portal area: ${area}`;
  if (!Array.isArray(value)) return `${area} must be an array`;
  if (value.length > MAX_ITEMS) return `${area} contains too many records`;
  if (!safeTree(value)) return `${area} contains an invalid or oversized value`;
  const validator = validators[area as keyof typeof validators];
  if (validator && !value.every(validator)) return `${area} contains an invalid record`;
  const ids = value.filter(idRecord).map(item => String(item.id));
  if (new Set(ids).size !== ids.length) return `${area} contains duplicate record IDs`;
  return null;
}

export function validatePortalState(data: unknown): data is Record<string, unknown> {
  if (!isObject(data) || !isObject(data.profile) || !isObject(data.preferences) || !isObject(data.features) || !isObject(data.adminSettings)) return false;
  if (data.dataMode !== "sample" && data.dataMode !== "operational") return false;
  if (!text(data.profile.name, 300) || !text(data.profile.email, 320) || (Boolean(data.profile.email) && !String(data.profile.email).includes("@"))) return false;
  return portalArrayFields.every(field => !validateArea(field, data[field]));
}
