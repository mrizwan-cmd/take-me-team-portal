import { env } from "@/app/api/_runtime";
import { requestOrigin } from "@/app/api/_request";

export type GoogleTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
  email?: string;
};

export type StoredGoogleConfig = {
  clientId: string;
  clientSecret: string;
  projectId: string;
  domain: string;
};

const workspaceId = "take-me-group";

export async function ensureGoogleTables() {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS google_oauth_sessions (
      state TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      expires_at BIGINT NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS google_user_tokens (
      user_id TEXT PRIMARY KEY NOT NULL,
      encrypted_tokens TEXT NOT NULL,
      updated_at BIGINT NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS portal_integration_config (
      provider TEXT PRIMARY KEY NOT NULL,
      public_data TEXT NOT NULL,
      encrypted_secret TEXT NOT NULL,
      updated_at BIGINT NOT NULL,
      updated_by TEXT NOT NULL
    )`),
  ]);
}

async function portalGoogleSettings() {
  try {
    const row = await env.DB.prepare("SELECT data FROM portal_state WHERE workspace_id = ?").bind(workspaceId).first<{ data: string }>();
    const data = row ? JSON.parse(row.data) : {};
    return data.adminSettings || {};
  } catch {
    return {};
  }
}

export async function getGoogleConfig(request: Request) {
  const stored = await loadStoredGoogleConfig().catch(() => null);
  const settings = await portalGoogleSettings();
  const origin = requestOrigin(request);
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || stored?.clientId || settings.googleClientId || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || stored?.clientSecret || "",
    projectId: process.env.GOOGLE_PROJECT_ID || stored?.projectId || settings.googleProjectId || "",
    redirectUri: process.env.GOOGLE_REDIRECT_URI || `${origin}/api/auth/google/callback`,
    loginRedirectUri: process.env.GOOGLE_LOGIN_REDIRECT_URI || `${origin}/api/auth/google/login/callback`,
    domain: process.env.GOOGLE_WORKSPACE_DOMAIN || stored?.domain || settings.companyDomain || "takeme.taxi",
    calendarId: settings.calendarId || "primary",
    driveId: settings.driveId || "",
    encryptionConfigured: Boolean(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY),
    sessionConfigured: Boolean(process.env.PORTAL_SESSION_SECRET && process.env.PORTAL_SESSION_SECRET.length >= 32),
  };
}

function encryptionSecret() {
  const secret = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!secret) throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY is not configured");
  return secret;
}

function bytesToBase64(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function base64ToBytes(value: string) {
  const decoded = atob(value);
  return Uint8Array.from(decoded, char => char.charCodeAt(0));
}

async function cryptoKey() {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(encryptionSecret()));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encrypt<T>(value: T) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await cryptoKey(), new TextEncoder().encode(JSON.stringify(value)));
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`;
}

async function decrypt<T>(value: string): Promise<T> {
  const [ivValue, cipherValue] = value.split(".");
  if (!ivValue || !cipherValue) throw new Error("Stored Google credentials are invalid; reconnect your account");
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(ivValue) }, await cryptoKey(), base64ToBytes(cipherValue));
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

async function loadStoredGoogleConfig(): Promise<StoredGoogleConfig | null> {
  await ensureGoogleTables();
  const row = await env.DB.prepare("SELECT public_data, encrypted_secret FROM portal_integration_config WHERE provider = ?")
    .bind("google")
    .first<{ public_data: string; encrypted_secret: string }>();
  if (!row) return null;
  const publicData = JSON.parse(row.public_data) as Omit<StoredGoogleConfig, "clientSecret">;
  const privateData = row.encrypted_secret ? await decrypt<{ clientSecret?: string }>(row.encrypted_secret) : {};
  return { ...publicData, clientSecret: privateData.clientSecret || "" };
}

export async function saveStoredGoogleConfig(userId: string, value: StoredGoogleConfig) {
  await ensureGoogleTables();
  const existing = await loadStoredGoogleConfig().catch(() => null);
  const clientSecret = value.clientSecret || existing?.clientSecret || "";
  const publicData = JSON.stringify({ clientId: value.clientId, projectId: value.projectId, domain: value.domain });
  const encryptedSecret = clientSecret ? await encrypt({ clientSecret }) : "";
  await env.DB.prepare(`INSERT INTO portal_integration_config (provider, public_data, encrypted_secret, updated_at, updated_by)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(provider) DO UPDATE SET public_data = excluded.public_data, encrypted_secret = excluded.encrypted_secret, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
    .bind("google", publicData, encryptedSecret, Date.now(), userId)
    .run();
  return { clientSecretConfigured: Boolean(clientSecret) };
}

export async function saveGoogleTokens(userId: string, tokens: GoogleTokens) {
  await ensureGoogleTables();
  const existing = await loadStoredTokens(userId).catch(() => null);
  const next = { ...tokens, refreshToken: tokens.refreshToken || existing?.refreshToken };
  await env.DB.prepare(`INSERT INTO google_user_tokens (user_id, encrypted_tokens, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET encrypted_tokens = excluded.encrypted_tokens, updated_at = excluded.updated_at`)
    .bind(userId, await encrypt(next), Date.now())
    .run();
}

async function loadStoredTokens(userId: string) {
  await ensureGoogleTables();
  const row = await env.DB.prepare("SELECT encrypted_tokens FROM google_user_tokens WHERE user_id = ?").bind(userId).first<{ encrypted_tokens: string }>();
  if (!row) return null;
  return decrypt<GoogleTokens>(row.encrypted_tokens);
}

async function refreshTokens(request: Request, userId: string, current: GoogleTokens) {
  if (!current.refreshToken) throw new Error("Google Workspace needs to be connected again");
  const config = await getGoogleConfig(request);
  if (!config.clientId || !config.clientSecret) throw new Error("Google OAuth credentials are incomplete");
  const body = new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: current.refreshToken, grant_type: "refresh_token" });
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  const result = await response.json() as { access_token?: string; expires_in?: number; scope?: string; error_description?: string };
  if (!response.ok || !result.access_token) throw new Error(result.error_description || "Google token refresh failed");
  const next = { ...current, accessToken: result.access_token, expiresAt: Date.now() + (result.expires_in || 3600) * 1000, scope: result.scope || current.scope };
  await saveGoogleTokens(userId, next);
  return next;
}

export async function googleConnectionStatus(request: Request, userId: string) {
  const config = await getGoogleConfig(request);
  const missing = [!config.clientId && "GOOGLE_CLIENT_ID", !config.clientSecret && "GOOGLE_CLIENT_SECRET", !config.encryptionConfigured && "GOOGLE_TOKEN_ENCRYPTION_KEY"].filter(Boolean) as string[];
  const missingLogin = [!config.clientId && "GOOGLE_CLIENT_ID", !config.clientSecret && "GOOGLE_CLIENT_SECRET", !config.sessionConfigured && "PORTAL_SESSION_SECRET"].filter(Boolean) as string[];
  const tokens = missing.length ? null : await loadStoredTokens(userId).catch(() => null);
  return { configured: missing.length === 0, loginConfigured: missingLogin.length === 0, connected: Boolean(tokens), email: tokens?.email || "", scope: tokens?.scope || "", domain: config.domain, missing, missingLogin, loginRedirectUri: config.loginRedirectUri };
}

export async function disconnectGoogle(userId: string) {
  await ensureGoogleTables();
  await env.DB.prepare("DELETE FROM google_user_tokens WHERE user_id = ?").bind(userId).run();
}

export async function googleAccessToken(request: Request, userId: string) {
  const tokens = await loadStoredTokens(userId);
  if (!tokens) throw new Error("Connect your Google Workspace account first");
  if (tokens.expiresAt < Date.now() + 60_000) return (await refreshTokens(request, userId, tokens)).accessToken;
  return tokens.accessToken;
}

export async function googleRequest(request: Request, userId: string, url: string, init: RequestInit = {}) {
  const token = await googleAccessToken(request, userId);
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  let response = await fetch(url, { ...init, headers });
  if (response.status === 401) {
    const current = await loadStoredTokens(userId);
    if (!current) return response;
    const refreshed = await refreshTokens(request, userId, current);
    headers.set("authorization", `Bearer ${refreshed.accessToken}`);
    response = await fetch(url, { ...init, headers });
  }
  return response;
}

export async function recordGoogleConnection(email: string) {
  const row = await env.DB.prepare("SELECT data FROM portal_state WHERE workspace_id = ?").bind(workspaceId).first<{ data: string }>();
  if (!row) return;
  const data = JSON.parse(row.data);
  data.adminSettings = { ...(data.adminSettings || {}), googleConnected: true };
  data.audit = [{ id: `AUD-${Date.now().toString(36).toUpperCase()}`, actor: email, action: "Connected personal Google Workspace account", area: "Integrations", time: new Date().toISOString() }, ...(data.audit || [])];
  await env.DB.prepare("UPDATE portal_state SET data = ?, updated_at = ? WHERE workspace_id = ?").bind(JSON.stringify(data), Date.now(), workspaceId).run();
}

export function googleError(error: unknown, status = 503) {
  return Response.json({ error: error instanceof Error ? error.message : "Google Workspace request failed" }, { status, headers: { "cache-control": "no-store" } });
}
