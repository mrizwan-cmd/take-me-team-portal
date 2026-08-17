import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

type PutOptions = {
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
};

let client: S3Client | null = null;
const localRoot = path.resolve(".portal-data/files");

function localStorageEnabled() {
  return !process.env.S3_BUCKET?.trim() && process.env.NODE_ENV !== "production";
}

function localObjectPath(key: string) {
  const target = path.resolve(localRoot, key.replaceAll("\\", "/"));
  if (target !== localRoot && !target.startsWith(`${localRoot}${path.sep}`)) throw new Error("Invalid local object key");
  return target;
}

function storageConfig() {
  const bucket = process.env.S3_BUCKET?.trim();
  const region = process.env.S3_REGION?.trim() || "auto";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  if (!bucket || !accessKeyId || !secretAccessKey) throw new Error("S3-compatible file storage is not configured");
  return { bucket, region, accessKeyId, secretAccessKey };
}

function storageClient() {
  if (client) return client;
  const config = storageConfig();
  client = new S3Client({
    region: config.region,
    endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  return client;
}

function notFound(error: unknown) {
  const value = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return value?.name === "NoSuchKey" || value?.name === "NotFound" || value?.$metadata?.httpStatusCode === 404;
}

export const objectStorage = {
  async health() {
    if (localStorageEnabled()) { await mkdir(localRoot, { recursive: true }); return; }
    const { bucket } = storageConfig();
    await storageClient().send(new HeadBucketCommand({ Bucket: bucket }));
  },
  async get(key: string) {
    if (localStorageEnabled()) {
      try {
        const target = localObjectPath(key);
        const [body, details, metadata] = await Promise.all([
          readFile(target),
          stat(target),
          readFile(`${target}.metadata.json`, "utf8").then(value => JSON.parse(value) as { contentType?: string }).catch((): { contentType?: string } => ({})),
        ]);
        return {
          body,
          httpEtag: `local-${details.size}-${Math.floor(details.mtimeMs)}`,
          writeHttpMetadata(headers: Headers) {
            headers.set("content-type", metadata.contentType || "application/octet-stream");
            headers.set("content-length", String(details.size));
          },
        };
      } catch (error) {
        const value = error as { code?: string };
        if (value.code === "ENOENT") return null;
        throw error;
      }
    }
    const { bucket } = storageConfig();
    try {
      const result = await storageClient().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!result.Body) return null;
      const body = await result.Body.transformToByteArray();
      return {
        body,
        httpEtag: result.ETag || "",
        writeHttpMetadata(headers: Headers) {
          if (result.ContentType) headers.set("content-type", result.ContentType);
          if (result.ContentLength !== undefined) headers.set("content-length", String(result.ContentLength));
        },
      };
    } catch (error) {
      if (notFound(error)) return null;
      throw error;
    }
  },
  async head(key: string) {
    if (localStorageEnabled()) {
      try {
        const target = localObjectPath(key);
        const [details, metadata] = await Promise.all([
          stat(target),
          readFile(`${target}.metadata.json`, "utf8").then(value => JSON.parse(value) as { contentType?: string }).catch((): { contentType?: string } => ({})),
        ]);
        return { size: details.size, contentType: metadata.contentType || "application/octet-stream" };
      } catch (error) {
        if ((error as { code?: string }).code === "ENOENT") return null;
        throw error;
      }
    }
    const { bucket } = storageConfig();
    try {
      const result = await storageClient().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return { size: Number(result.ContentLength || 0), contentType: result.ContentType || "application/octet-stream" };
    } catch (error) {
      if (notFound(error)) return null;
      throw error;
    }
  },
  async createUploadUrl(key: string, contentType: string) {
    if (localStorageEnabled()) return null;
    const { bucket } = storageConfig();
    return getSignedUrl(storageClient(), new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), { expiresIn: 10 * 60 });
  },
  async createDownloadUrl(key: string, filename: string, contentType: string) {
    if (localStorageEnabled()) return null;
    const { bucket } = storageConfig();
    const asciiName = filename.replace(/[^\x20-\x7e]|["\\]/gu, "_");
    const disposition = `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
    return getSignedUrl(storageClient(), new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentType: contentType, ResponseContentDisposition: disposition }), { expiresIn: 5 * 60 });
  },
  async put(key: string, body: ArrayBuffer, options: PutOptions = {}) {
    if (localStorageEnabled()) {
      const target = localObjectPath(key);
      await mkdir(path.dirname(target), { recursive: true });
      await Promise.all([
        writeFile(target, new Uint8Array(body)),
        writeFile(`${target}.metadata.json`, JSON.stringify({ contentType: options.httpMetadata?.contentType, metadata: options.customMetadata })),
      ]);
      return;
    }
    const { bucket } = storageConfig();
    await storageClient().send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: new Uint8Array(body),
      ContentType: options.httpMetadata?.contentType,
      Metadata: options.customMetadata ? Object.fromEntries(Object.entries(options.customMetadata).map(([name, value]) => [name, encodeURIComponent(value)])) : undefined,
    }));
  },
  async delete(key: string) {
    if (localStorageEnabled()) {
      const target = localObjectPath(key);
      await Promise.all([rm(target, { force: true }), rm(`${target}.metadata.json`, { force: true })]);
      return;
    }
    const { bucket } = storageConfig();
    await storageClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  },
};
