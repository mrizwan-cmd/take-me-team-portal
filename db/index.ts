import { mkdir } from "node:fs/promises";

type DbValue = string | number | boolean | null | Uint8Array;
type QueryRow = Record<string, unknown>;
type QueryResult = { rows: QueryRow[]; affectedRows: number };
type PostgresResult = QueryRow[] & { count?: number };
type PostgresExecutor = { unsafe: (query: string, parameters?: DbValue[]) => Promise<PostgresResult> };
type PGliteExecutor = { query: <T extends QueryRow>(query: string, parameters?: DbValue[]) => Promise<{ rows: T[]; affectedRows?: number }> };

type Driver = {
  query: (query: string, parameters?: DbValue[]) => Promise<QueryResult>;
  transaction: <T>(callback: (driver: Driver) => Promise<T>) => Promise<T>;
};

export type DatabaseResult<T = QueryRow> = {
  success: boolean;
  results: T[];
  meta: { changes: number };
};

export class DatabaseConflictError extends Error {
  readonly statementIndex: number;

  constructor(statementIndex: number) {
    super("A conditional database write did not match the expected revision");
    this.name = "DatabaseConflictError";
    this.statementIndex = statementIndex;
  }
}

let driverPromise: Promise<Driver> | null = null;

async function createDriver(): Promise<Driver> {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (connectionString) {
    const { default: postgres } = await import("postgres");
    const client = postgres(connectionString, {
      max: Number(process.env.DATABASE_POOL_SIZE || (process.env.VERCEL ? "1" : "10")),
      idle_timeout: 20,
      connect_timeout: 15,
      ssl: process.env.DATABASE_SSL === "false" ? false : "require",
      prepare: false,
    });
    const wrap = (executor: PostgresExecutor): Driver => ({
      query: async (query, parameters = []) => {
        const result = await executor.unsafe(query, parameters);
        return { rows: Array.from(result) as QueryRow[], affectedRows: Number(result.count || 0) };
      },
      async transaction<T>(callback: (driver: Driver) => Promise<T>) {
        return await client.begin(async transaction => callback(wrap(transaction as unknown as PostgresExecutor))) as unknown as T;
      },
    });
    return wrap(client);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is not configured");
  }

  const { PGlite } = await import("@electric-sql/pglite");
  await mkdir(".portal-data", { recursive: true });
  const local = new PGlite("./.portal-data/postgres");
  await local.waitReady;
  const wrap = (executor: PGliteExecutor): Driver => ({
    query: async (query, parameters = []) => {
      const result = await executor.query<QueryRow>(query, parameters);
      return { rows: result.rows, affectedRows: Number(result.affectedRows || 0) };
    },
    async transaction<T>(callback: (driver: Driver) => Promise<T>) {
      return await local.transaction(async transaction => callback(wrap(transaction as unknown as PGliteExecutor))) as unknown as T;
    },
  });
  return wrap(local);
}

function getDriver() {
  driverPromise ||= createDriver();
  return driverPromise;
}

function postgresPlaceholders(query: string) {
  let index = 0;
  return query.replace(/\?/gu, () => `$${++index}`);
}

function normaliseRow<T>(row: QueryRow): T {
  const entries = Object.entries(row).map(([key, value]) => {
    if (typeof value === "bigint") return [key, Number(value)];
    if (typeof value === "string" && /(?:^|_)(?:expires_at|updated_at|created_at|size)$/u.test(key) && /^-?\d+$/u.test(value)) return [key, Number(value)];
    return [key, value];
  });
  return Object.fromEntries(entries) as T;
}

export class DatabaseStatement {
  readonly query: string;
  readonly parameters: DbValue[];

  constructor(query: string, parameters: DbValue[] = []) {
    this.query = postgresPlaceholders(query);
    this.parameters = parameters;
  }

  bind(...parameters: DbValue[]) {
    return new DatabaseStatement(this.query.replace(/\$\d+/gu, "?"), parameters);
  }

  async execute(driver?: Driver): Promise<DatabaseResult> {
    const active = driver || await getDriver();
    const result = await active.query(this.query, this.parameters);
    return { success: true, results: result.rows.map(row => normaliseRow(row)), meta: { changes: result.affectedRows } };
  }

  async first<T = QueryRow>(): Promise<T | null> {
    const result = await this.execute();
    return (result.results[0] as T | undefined) || null;
  }

  async all<T = QueryRow>(): Promise<DatabaseResult<T>> {
    return await this.execute() as DatabaseResult<T>;
  }

  async run(): Promise<DatabaseResult> {
    return this.execute();
  }
}

export const database = {
  prepare(query: string) {
    return new DatabaseStatement(query);
  },
  async batch(statements: DatabaseStatement[], options?: { requireSingleChange?: boolean }) {
    const driver = await getDriver();
    return driver.transaction(async transaction => {
      const results: DatabaseResult[] = [];
      for (const [index, statement] of statements.entries()) {
        const result = await statement.execute(transaction);
        if (options?.requireSingleChange && result.meta.changes !== 1) throw new DatabaseConflictError(index);
        results.push(result);
      }
      return results;
    });
  },
};

export async function checkDatabase() {
  return database.prepare("SELECT 1 AS healthy").first<{ healthy: number }>();
}
