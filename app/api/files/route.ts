import { env } from "@/app/api/_runtime";
import { requirePortalUser, requireSameOrigin } from "../_auth";
import {
  del as deleteBlob,
  get as getBlob,
  head as headBlob,
  put as putBlob,
} from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

const allowedTypes = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/webp",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
const maximumFileSize = 20 * 1024 * 1024;

function blobStorageEnabled() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN),
  );
}

async function ensureFilesTable() {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS portal_files (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    object_key TEXT NOT NULL UNIQUE,
    content_type TEXT,
    size BIGINT NOT NULL,
    owner_id TEXT,
    created_at BIGINT NOT NULL
  )`,
  ).run();
}

function validKey(key: string | null) {
  return Boolean(key && key.startsWith("portal/") && !key.includes(".."));
}

function validateFile(name: string, type: string, size: number) {
  if (!name.trim()) return "A file name is required";
  if (!Number.isFinite(size) || size <= 0)
    return "Empty files cannot be uploaded";
  if (size > maximumFileSize) return "Files must be smaller than 20 MB";
  if (!allowedTypes.has(type.split(";")[0].toLowerCase()))
    return "This file type is not allowed";
  return "";
}

function fileIdentity(name: string) {
  const id = crypto.randomUUID();
  const safeName = name.replace(/[^a-zA-Z0-9._-]+/gu, "-");
  return { id, key: `portal/${id}-${safeName.slice(-120)}` };
}

async function saveRecord(record: {
  id: string;
  key: string;
  name: string;
  type: string;
  size: number;
  ownerId: string;
}) {
  await ensureFilesTable();
  await env.DB.prepare(
    "INSERT INTO portal_files (id, name, object_key, content_type, size, owner_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      record.id,
      record.name.slice(0, 180),
      record.key,
      record.type,
      record.size,
      record.ownerId,
      Date.now(),
    )
    .run();
}

async function canReadSharedChatFile(key: string, email: string) {
  try {
    const row = await env.DB.prepare(
      "SELECT data FROM portal_feature_state WHERE workspace_id = ? AND area = 'conversations'",
    )
      .bind("take-me-group")
      .first<{ data?: string }>();
    if (!row?.data) return false;
    const conversations = JSON.parse(row.data) as Array<{
      members?: string[];
      messages?: Array<{ attachments?: Array<{ key?: string }> }>;
    }>;
    return conversations.some(
      (conversation) =>
        conversation.members?.some(
          (member) => member.toLowerCase() === email.toLowerCase(),
        ) &&
        conversation.messages?.some((message) =>
          message.attachments?.some((attachment) => attachment.key === key),
        ),
    );
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const auth = requirePortalUser(request);
  if (auth.response) return auth.response;
  const key = new URL(request.url).searchParams.get("key");
  if (!key)
    return Response.json({ error: "A file key is required" }, { status: 400 });
  if (!validKey(key))
    return Response.json({ error: "Invalid file key" }, { status: 400 });
  await ensureFilesTable();
  const record = await env.DB.prepare(
    "SELECT name, content_type, owner_id FROM portal_files WHERE object_key = ?",
  )
    .bind(key)
    .first<{ name: string; content_type?: string; owner_id?: string }>();
  if (!record)
    return Response.json({ error: "File not found" }, { status: 404 });
  if (
    !auth.user?.isAdmin &&
    record.owner_id !== auth.user?.id &&
    !(await canReadSharedChatFile(key, auth.user?.email || ""))
  )
    return Response.json(
      { error: "You do not have access to this file" },
      { status: 403 },
    );
  const originalName = (record.name || "download")
    .replace(/[\r\n]/gu, "_")
    .slice(0, 180);
  if (blobStorageEnabled()) {
    const object = await getBlob(key!, { access: "private" });
    if (!object || object.statusCode !== 200 || !object.stream)
      return Response.json({ error: "File not found" }, { status: 404 });
    const headers = new Headers();
    object.headers.forEach((value, name) => headers.set(name, value));
    const asciiName = originalName.replace(/[^\x20-\x7e]|["\\]/gu, "_");
    headers.set(
      "content-type",
      record.content_type ||
        object.blob.contentType ||
        "application/octet-stream",
    );
    headers.set(
      "content-disposition",
      `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(originalName)}`,
    );
    headers.set("x-content-type-options", "nosniff");
    headers.set("cache-control", "private, no-store");
    return new Response(object.stream, { headers });
  }
  const directUrl = await env.FILES.createDownloadUrl(
    key,
    originalName,
    record.content_type || "application/octet-stream",
  );
  if (directUrl)
    return new Response(null, {
      status: 302,
      headers: { location: directUrl, "cache-control": "private, no-store" },
    });
  const object = await env.FILES.get(key);
  if (!object)
    return Response.json({ error: "File not found" }, { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  const asciiName = originalName.replace(/[^\x20-\x7e]|["\\]/gu, "_");
  headers.set(
    "content-disposition",
    `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(originalName)}`,
  );
  headers.set("x-content-type-options", "nosniff");
  headers.set("cache-control", "private, no-store");
  return new Response(new Blob([Uint8Array.from(object.body)]), { headers });
}

export async function POST(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const auth = requirePortalUser(request);
  if (auth.response || !auth.user) return auth.response;
  try {
    if (
      (request.headers.get("content-type") || "").includes("application/json")
    ) {
      const payload = (await request.json()) as HandleUploadBody & {
        name?: string;
        type?: string;
        size?: number;
      };
      if (
        blobStorageEnabled() &&
        typeof payload.type === "string" &&
        payload.type.startsWith("blob.")
      ) {
        const result = await handleUpload({
          body: payload,
          request,
          onBeforeGenerateToken: async (pathname) => {
            if (!validKey(pathname)) throw new Error("Invalid file key");
            const pending = await env.DB.prepare(
              "SELECT content_type, size, owner_id FROM portal_files WHERE object_key = ?",
            )
              .bind(pathname)
              .first<{
                content_type: string;
                size: number;
                owner_id: string;
              }>();
            if (!pending || pending.owner_id !== auth.user!.id)
              throw new Error("Upload is not authorized");
            const invalid = validateFile(
              pathname,
              pending.content_type,
              Number(pending.size),
            );
            if (invalid) throw new Error(invalid);
            return {
              allowedContentTypes: [pending.content_type],
              maximumSizeInBytes: maximumFileSize,
              addRandomSuffix: false,
              allowOverwrite: false,
              validUntil: Date.now() + 10 * 60 * 1000,
            };
          },
        });
        return Response.json(result, {
          headers: { "cache-control": "no-store" },
        });
      }
      const name = payload.name || "";
      const type = payload.type || "";
      const size = Number(payload.size || 0);
      const invalid = validateFile(name, type, size);
      if (invalid)
        return Response.json(
          { error: invalid },
          {
            status: invalid.startsWith("Files must")
              ? 413
              : invalid.startsWith("This file type")
                ? 415
                : 400,
          },
        );
      const identity = fileIdentity(name);
      if (blobStorageEnabled()) {
        await saveRecord({
          ...identity,
          name,
          type,
          size,
          ownerId: auth.user.id,
        });
        return Response.json(
          { direct: "blob", key: identity.key },
          { headers: { "cache-control": "no-store" } },
        );
      }
      const uploadUrl = await env.FILES.createUploadUrl(identity.key, type);
      if (!uploadUrl)
        return Response.json(
          { direct: false },
          { headers: { "cache-control": "no-store" } },
        );
      await saveRecord({
        ...identity,
        name,
        type,
        size,
        ownerId: auth.user.id,
      });
      return Response.json(
        { direct: true, uploadUrl, key: identity.key, contentType: type },
        { headers: { "cache-control": "no-store" } },
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      return Response.json(
        { error: "Choose a file to upload" },
        { status: 400 },
      );
    const invalid = validateFile(file.name, file.type, file.size);
    if (invalid)
      return Response.json(
        { error: invalid },
        {
          status: invalid.startsWith("Files must")
            ? 413
            : invalid.startsWith("This file type")
              ? 415
              : 400,
        },
      );
    const identity = fileIdentity(file.name);
    if (blobStorageEnabled()) {
      await putBlob(identity.key, file, {
        access: "private",
        addRandomSuffix: false,
        contentType: file.type,
      });
    } else {
      await env.FILES.put(identity.key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type },
        customMetadata: { filename: file.name },
      });
    }
    try {
      await saveRecord({
        ...identity,
        name: file.name,
        type: file.type,
        size: file.size,
        ownerId: auth.user.id,
      });
    } catch (error) {
      if (blobStorageEnabled()) await deleteBlob(identity.key);
      else await env.FILES.delete(identity.key);
      throw error;
    }
    return Response.json(
      {
        key: identity.key,
        name: file.name,
        size: file.size,
        type: file.type || "File",
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const auth = requirePortalUser(request);
  if (auth.response || !auth.user) return auth.response;
  try {
    const payload = (await request.json()) as { key?: string };
    const key = payload.key || "";
    if (!validKey(key))
      return Response.json({ error: "Invalid file key" }, { status: 400 });
    await ensureFilesTable();
    const record = await env.DB.prepare(
      "SELECT name, content_type, size, owner_id FROM portal_files WHERE object_key = ?",
    )
      .bind(key)
      .first<{
        name: string;
        content_type: string;
        size: number;
        owner_id: string;
      }>();
    if (!record)
      return Response.json(
        { error: "Upload record was not found" },
        { status: 404 },
      );
    if (record.owner_id !== auth.user.id)
      return Response.json(
        { error: "You cannot complete this upload" },
        { status: 403 },
      );
    const object = blobStorageEnabled()
      ? await headBlob(key)
          .then((value) => ({
            size: value.size,
            contentType: value.contentType,
          }))
          .catch(() => null)
      : await env.FILES.head(key);
    if (!object || object.size !== Number(record.size))
      return Response.json(
        { error: "The uploaded file is incomplete" },
        { status: 409 },
      );
    return Response.json(
      {
        key,
        name: record.name,
        size: record.size,
        type: record.content_type || "File",
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Upload confirmation failed",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const auth = requirePortalUser(request);
  if (auth.response || !auth.user) return auth.response;
  const key = new URL(request.url).searchParams.get("key");
  if (!validKey(key))
    return Response.json({ error: "Invalid file key" }, { status: 400 });
  try {
    await ensureFilesTable();
    const record = await env.DB.prepare(
      "SELECT owner_id FROM portal_files WHERE object_key = ?",
    )
      .bind(key)
      .first<{ owner_id?: string }>();
    if (!record)
      return Response.json({ error: "File not found" }, { status: 404 });
    if (!auth.user.isAdmin && record.owner_id !== auth.user.id)
      return Response.json(
        { error: "You cannot delete this file" },
        { status: 403 },
      );
    if (blobStorageEnabled()) await deleteBlob(key!);
    else await env.FILES.delete(key!);
    await env.DB.prepare("DELETE FROM portal_files WHERE object_key = ?")
      .bind(key)
      .run();
    return Response.json(
      { deleted: true },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "File deletion failed",
      },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
