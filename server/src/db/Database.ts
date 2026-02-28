// Owns the Postgres connection pool and Kysely instance.
// Exposes waitForDb() and migrate() as instance methods.
// All Postgres credentials come from environment variables.

import { Pool } from "pg";
import { Kysely, PostgresDialect, sql } from "kysely";
import { DatabaseSchema } from "./schema";

export class Database {
    // Public readonly so Persistence can receive it via constructor injection.
    public readonly kysely: Kysely<DatabaseSchema>;
    private readonly pool: Pool;

    private static readonly MAX_RETRIES = 10;
    private static readonly RETRY_DELAY_MS = 3000;

    constructor() {
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

    // Creates both tables idempotently (IF NOT EXISTS). Safe to call on every startup.
    // snapshots is created first so document_updates can FK into it in v0.06.
    async migrate(): Promise<void> {
        // Snapshot registry — unused until v0.06, but schema must be correct from the start
        await this.kysely.schema
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
        await this.kysely.schema
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
    }

    private static sleep(ms: number): Promise<void> {
        return new Promise((r) => setTimeout(r, ms));
    }
}
