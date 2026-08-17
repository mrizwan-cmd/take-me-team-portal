import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) throw new Error("DATABASE_URL is required to run database migrations");

const sql = postgres(connectionString, {
  max: 1,
  ssl: process.env.DATABASE_SSL === "false" ? false : "require",
  prepare: false,
});

try {
  await sql.unsafe("CREATE TABLE IF NOT EXISTS portal_schema_migrations (name TEXT PRIMARY KEY, applied_at BIGINT NOT NULL)");
  const directory = path.resolve("db/migrations");
  const migrations = (await readdir(directory)).filter(file => file.endsWith(".sql")).sort();
  for (const migration of migrations) {
    const applied = await sql.unsafe("SELECT name FROM portal_schema_migrations WHERE name = $1", [migration]);
    if (applied.length) continue;
    const source = await readFile(path.join(directory, migration), "utf8");
    await sql.begin(async transaction => {
      const statements = source.split(/;\s*(?:\r?\n|$)/u).map(statement => statement.trim()).filter(Boolean);
      for (const statement of statements) await transaction.unsafe(statement);
      await transaction.unsafe("INSERT INTO portal_schema_migrations (name, applied_at) VALUES ($1, $2)", [migration, Date.now()]);
    });
    process.stdout.write(`Applied ${migration}\n`);
  }
} finally {
  await sql.end();
}
