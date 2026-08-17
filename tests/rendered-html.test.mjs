import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the standard Next.js build pre-renders only the secure loading shell", async () => {
  const html = await readFile(new URL("../.next/server/app/index.html", import.meta.url), "utf8");
  assert.match(html, /<title>Take Me Team Portal<\/title>/iu);
  assert.match(html, /Opening your secure workspace/iu);
  assert.doesNotMatch(html, /Good (?:morning|afternoon|evening), Muneeb/iu);
  assert.doesNotMatch(html, /Employee navigation/iu);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview/iu);
});
