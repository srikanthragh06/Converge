// Owns the Postgres connection pool and Kysely instance.
// Exposes waitForDb() and migrate() as instance methods.
// All Postgres credentials come from environment variables.

import { Pool, types } from "pg";
import { Kysely, PostgresDialect, sql } from "kysely";
import { DatabaseSchema } from "./schema";

export class Database {
    // Public readonly so Persistence and Compactor can receive it via constructor injection.
    public readonly kysely: Kysely<DatabaseSchema>;
    private readonly pool: Pool;

    private static readonly MAX_RETRIES = 10;
    private static readonly RETRY_DELAY_MS = 3000;

    constructor() {
        // By default pg returns BIGINT (OID 20) as strings to avoid JS number precision loss.
        // Configure the type parser once here so BigInt arithmetic works correctly at runtime.
        types.setTypeParser(20, (val: string) => BigInt(val));

        // Pool shared across all queries in this process — reads env vars set by dotenv.
        this.pool = new Pool({
            host: process.env.POSTGRES_HOST,
            port: Number(process.env.POSTGRES_PORT),
            user: process.env.POSTGRES_USERNAME,
            password: process.env.POSTGRES_PASSWORD,
            database: process.env.POSTGRES_DBNAME,
        });
        this.kysely = new Kysely<DatabaseSchema>({
            dialect: new PostgresDialect({ pool: this.pool }),
        });
    }

    // Polls Postgres until a connection succeeds or retries are exhausted.
    // Needed because on a cold docker-compose up the server container can start
    // before Postgres is ready to accept connections.
    async waitForDb(): Promise<void> {
        for (let attempt = 1; attempt <= Database.MAX_RETRIES; attempt++) {
            try {
                const client = await this.pool.connect();
                try {
                    await client.query("SELECT 1");
                } finally {
                    client.release();
                }
                console.log("Postgres connection established");
                return;
            } catch (err) {
                if (attempt < Database.MAX_RETRIES) {
                    console.log(
                        `Postgres not ready, retrying in ${Database.RETRY_DELAY_MS / 1000}s... (${attempt}/${Database.MAX_RETRIES})`,
                    );
                    await Database.sleep(Database.RETRY_DELAY_MS);
                } else {
                    throw new Error(
                        `Postgres unavailable after ${Database.MAX_RETRIES} attempts: ${String(err)}`,
                    );
                }
            }
        }
    }

    // Creates all tables and indexes idempotently. Safe to call on every startup.
    async migrate(): Promise<void> {
        // Append-only Yjs update log — primary persistence store.
        await this.kysely.schema
            .createTable("document_updates")
            .ifNotExists()
            .addColumn("id", "bigserial", (c) => c.primaryKey())
            .addColumn("document_id", "integer", (c) => c.notNull())
            .addColumn("update", "bytea", (c) => c.notNull())
            .addColumn("created_at", "timestamptz", (c) =>
                c.notNull().defaultTo(sql`now()`),
            )
            .execute();

        // Index on document_id so range queries (load, compact) don't do full-table scans.
        await this.kysely.schema
            .createIndex("document_updates_document_id_idx")
            .ifNotExists()
            .on("document_updates")
            .column("document_id")
            .execute();

        // One row per document: monotonic update counter + last compaction threshold.
        // update_count increments on every write; last_compact_count tracks which
        // 1000-multiple was last compacted so each threshold is only processed once.
        await this.kysely.schema
            .createTable("document_meta")
            .ifNotExists()
            .addColumn("document_id", "integer", (c) => c.primaryKey())
            .addColumn("update_count", "bigint", (c) =>
                c.notNull().defaultTo(0),
            )
            .addColumn("last_compact_count", "bigint", (c) =>
                c.notNull().defaultTo(0),
            )
            .execute();

        console.log("Migration complete");
    }

    private static sleep(ms: number): Promise<void> {
        return new Promise((r) => setTimeout(r, ms));
    }
}
