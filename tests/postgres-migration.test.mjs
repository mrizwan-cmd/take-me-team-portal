import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("the PostgreSQL migration creates every portable persistence table", async () => {
  const database = new PGlite();
  try {
    await database.waitReady;
    const directory = new URL("../db/migrations/", import.meta.url);
    const migrations = (await readdir(directory)).filter(file => file.endsWith(".sql")).sort();
    for (const migration of migrations) {
      const source = await readFile(new URL(migration, directory), "utf8");
      const statements = source.split(/;\s*(?:\r?\n|$)/u).map(statement => statement.trim()).filter(Boolean);
      for (const statement of statements) await database.exec(statement);
    }
    const result = await database.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    const tables = new Set(result.rows.map(row => row.table_name));
    for (const expected of ["portal_state", "portal_user_state", "portal_user_data", "portal_login_sessions", "google_oauth_sessions", "google_user_tokens", "portal_integration_config", "portal_files"]) assert.ok(tables.has(expected), expected);

    await database.query("INSERT INTO portal_state (workspace_id, data, updated_at) VALUES ($1, $2, $3)", ["take-me-group", JSON.stringify({ conversations: [{ name: "demo" }, { name: "Operations" }] }), 1]);
    const cleanup = await readFile(new URL("003_remove_test_chat.sql", directory), "utf8");
    await database.exec(cleanup);
    const cleaned = await database.query("SELECT data FROM portal_state WHERE workspace_id = $1", ["take-me-group"]);
    assert.deepEqual(JSON.parse(cleaned.rows[0].data).conversations.map(conversation => conversation.name), ["Operations"]);
  } finally {
    await database.close();
  }
});
