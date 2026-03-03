// Owns the Postgres connection pool and Kysely instance.
// Exposes waitForDb() and migrate() as instance methods.
// All Postgres credentials come from environment variables.

import { Pool, types } from "pg";
import { FileMigrationProvider, Kysely, Migrator, PostgresDialect } from "kysely";
import { promises as fs } from "fs";
import * as path from "path";
import { DatabaseSchema } from "../db/schema";

export class DatabaseService {
    // Public readonly so the container can expose it via services.databaseService.kysely.
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
        for (
            let attempt = 1;
            attempt <= DatabaseService.MAX_RETRIES;
            attempt++
        ) {
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
                if (attempt < DatabaseService.MAX_RETRIES) {
                    console.log(
                        `Postgres not ready, retrying in ${DatabaseService.RETRY_DELAY_MS / 1000}s... (${attempt}/${DatabaseService.MAX_RETRIES})`,
                    );
                    await DatabaseService.sleep(DatabaseService.RETRY_DELAY_MS);
                } else {
                    throw new Error(
                        `Postgres unavailable after ${DatabaseService.MAX_RETRIES} attempts: ${String(err)}`,
                    );
                }
            }
        }
    }

    // Runs all pending migrations to latest using Kysely's Migrator.
    // Logs the result of each individual migration file.
    // Throws if any migration fails.
    async migrate(): Promise<void> {
        const migrator = new Migrator({
            db: this.kysely,
            provider: new FileMigrationProvider({
                fs,
                path,
                // Absolute path to the migrations directory — works for both
                // ts-node/tsx (dev) and compiled JS (prod) because __dirname
                // resolves relative to this file in both cases.
                migrationFolder: path.join(__dirname, "../migrations"),
            }),
        });

        const { error, results } = await migrator.migrateToLatest();

        for (const result of results ?? []) {
            if (result.status === "Success") {
                console.log(
                    `Migration "${result.migrationName}" applied successfully`,
                );
            } else if (result.status === "Error") {
                console.error(`Migration "${result.migrationName}" failed`);
            }
        }

        if (error) {
            throw new Error(`Migration failed: ${String(error)}`);
        }

        console.log("All migrations complete");
    }

    private static sleep(ms: number): Promise<void> {
        return new Promise((r) => setTimeout(r, ms));
    }
}
