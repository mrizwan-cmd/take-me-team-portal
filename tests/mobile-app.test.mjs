import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readText = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

async function pngSize(path) {
  const bytes = await readFile(new URL(`../${path}`, import.meta.url));
  assert.equal(bytes.toString("ascii", 1, 4), "PNG", `${path} must be a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test("the portal exposes a valid Android and iPhone install manifest", async () => {
  const manifest = JSON.parse(await readText("public/manifest.webmanifest"));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.scope, "/");
  assert.ok(manifest.start_url.startsWith("/"));
  assert.ok(manifest.shortcuts.length >= 3);
  for (const icon of manifest.icons) {
    const expected = Number(icon.sizes.split("x")[0]);
    const actual = await pngSize(`public${icon.src}`);
    assert.deepEqual(actual, { width: expected, height: expected }, icon.src);
  }
  assert.deepEqual(await pngSize("public/apple-touch-icon.png"), { width: 180, height: 180 });
});

test("the service worker provides an offline shell without caching private APIs", async () => {
  const source = await readText("public/sw.js");
  assert.match(source, /offline\.html/u);
  assert.match(source, /pathname\.startsWith\("\/api\/"\)/u);
  assert.match(source, /const cacheCopy = response\.clone\(\);/u);
  assert.doesNotMatch(source, /cache\.put\([^\n]+response\.clone\(\)/u);
  assert.match(source, /event\.request\.mode === "navigate"/u);
  assert.match(source, /SKIP_WAITING/u);
});

test("the mobile app layer includes one-handed navigation and safe-area handling", async () => {
  const css = await readText("app/mobile.css");
  const portal = await readText("app/portal.tsx");
  assert.match(css, /\.mobile-bottom-nav/u);
  assert.match(css, /env\(safe-area-inset-bottom\)/u);
  assert.match(css, /100dvh/u);
  assert.match(css, /font-size:\s*16px\s*!important/u);
  assert.match(portal, /Employee app navigation/u);
  assert.match(portal, /beforeinstallprompt/u);
  assert.match(portal, /navigator\.onLine/u);
});

test("large uploads bypass serverless payload limits with signed private storage URLs", async () => {
  const route = await readText("app/api/files/route.ts");
  const client = await readText("app/employee-portal.tsx");
  const storage = await readText("lib/object-storage.ts");
  assert.match(route, /createUploadUrl/u);
  assert.match(route, /createDownloadUrl/u);
  assert.match(route, /export async function PUT/u);
  assert.match(client, /direct\.uploadUrl/u);
  assert.match(client, /method: "PUT"/u);
  assert.match(storage, /getSignedUrl/u);
});
