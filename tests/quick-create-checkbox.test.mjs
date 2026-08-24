import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("quick-create checkbox rows override the generic full-width form input layout", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.create-form label\.check-row\s*\{[^}]*display: flex;/su);
  assert.match(css, /\.create-form label\.check-row input\[type="checkbox"\]\s*\{[^}]*width: 18px;/su);
  assert.match(css, /flex: 0 0 18px;/u);
});
