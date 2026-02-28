// Database layer: Kysely instance, type interfaces, startup helpers.
// All Postgres credentials come from environment variables (set in .env for local dev
// and .env.local + docker-compose environment: block for Docker).

import { Pool } from "pg";
import { Kysely, PostgresDialect, sql, Generated } from "kysely";

// --- DB type interfaces ---

// Row shape for the document_updates table.
// BYTEA columns deserialise to Buffer via the pg driver.
// Generated<T> marks columns that Postgres populates automatically (serial, default now()).
interface DocumentUpdatesTable {
    id: Generated<bigint>;
    document_id: number;
    update: Buffer;
    snapshot_version: number | null; // null for all v0.04 inserts; populated in v0.06
    created_at: Generated<Date>;
}

// Row shape for the snapshots table.
// Table is created here so the schema is correct from day one; populated in v0.06.
interface SnapshotsTable {
    id: Generated<number>;
    document_id: number;
    s3_key: string;
    created_at: Generated<Date>;
}

// Root schema passed as a generic to Kysely<Database>.
// Table names must exactly match the Postgres table names.
export interface Database {
    document_updates: DocumentUpdatesTable;
    snapshots: SnapshotsTable;
}

// --- Pool + Kysely instance ---

// Shared connection pool — reused across all queries in this process.
const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    user: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DBNAME,
});

// Typed Kysely instance — all queries go through this.
export const db = new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
});

// --- waitForDb ---

const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 3000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Polls Postgres until a connection succeeds or retries are exhausted.
// Needed because on a cold docker-compose up the server container can start
// before Postgres is ready to accept connections.
export const waitForDb = async (): Promise<void> => {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const client = await pool.connect();
            try {
                await client.query("SELECT 1");
            } finally {
                client.release();
            }
            console.log("Postgres connection established");
            return;
        } catch (err) {
            if (attempt < MAX_RETRIES) {
                console.log(
                    `Postgres not ready, retrying in ${RETRY_DELAY_MS / 1000}s... (${attempt}/${MAX_RETRIES})`,
                );
                await sleep(RETRY_DELAY_MS);
            } else {
                throw new Error(
                    `Postgres unavailable after ${MAX_RETRIES} attempts: ${String(err)}`,
                );
            }
        }
    }
};

// --- migrate ---

// Creates both tables idempotently (IF NOT EXISTS). Safe to call on every startup.
// snapshots is created first so that document_updates can FK into it in v0.06.
// The FK constraint on snapshot_version is intentionally omitted for v0.04 —
// the column is always NULL now; the constraint will be added in v0.06.
export const migrate = async (): Promise<void> => {
    // Snapshot registry — unused until v0.06, but schema must be correct from the start
    await db.schema
        .createTable("snapshots")
        .ifNotExists()
        .addColumn("id", "serial", (c) => c.primaryKey())
        .addColumn("document_id", "integer", (c) => c.notNull())
        .addColumn("s3_key", "text", (c) => c.notNull())
        .addColumn(
            "created_at",
            "timestamptz",
            (c) => c.notNull().defaultTo(sql`now()`),
        )
        .execute();

    // Append-only Yjs update log — primary persistence store
    await db.schema
        .createTable("document_updates")
        .ifNotExists()
        .addColumn("id", "bigserial", (c) => c.primaryKey())
        .addColumn("document_id", "integer", (c) => c.notNull())
        .addColumn("update", "bytea", (c) => c.notNull())
        .addColumn("snapshot_version", "integer") // nullable; FK added in v0.06
        .addColumn(
            "created_at",
            "timestamptz",
            (c) => c.notNull().defaultTo(sql`now()`),
        )
        .execute();

    console.log("Migration complete");
};
