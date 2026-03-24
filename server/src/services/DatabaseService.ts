// Owns the Postgres connection pool and Kysely instance.
// Exposes waitForDb() and migrate() as instance methods.
//
// Pool configuration is split by ENVIRONMENT (ENV_DEV | ENV_PROD):
//   DEV  — uses POSTGRES_DEV_* vars; connects to the local docker-compose postgres container.
//   PROD — uses POSTGRES_PROD_* vars; ssl: true required for Neon and most managed providers.
// Throws at construction time if ENVIRONMENT is missing or unrecognised.

import { Pool, types } from "pg";
import {
    FileMigrationProvider,
    Kysely,
    Migrator,
    PostgresDialect,
} from "kysely";
import { promises as fs } from "fs";
import * as path from "path";
import { DatabaseSchema } from "../db/schema";
import { sleep } from "../utils/utils";
import { ENV_DEV, ENV_PROD } from "../constants/constants";

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

        const environment = process.env.ENVIRONMENT;

        if (environment === ENV_DEV) {
            // DEV connects to the local docker-compose postgres container.
            this.pool = new Pool({
                host: process.env.POSTGRES_DEV_HOST,
                port: Number(process.env.POSTGRES_DEV_PORT),
                user: process.env.POSTGRES_DEV_USERNAME,
                password: process.env.POSTGRES_DEV_PASSWORD,
                database: process.env.POSTGRES_DEV_DBNAME,
            });
        } else if (environment === ENV_PROD) {
            // PROD connects to the production database.
            // ssl: true is required for Neon (and most managed Postgres providers).
            this.pool = new Pool({
                host: process.env.POSTGRES_PROD_HOST,
                user: process.env.POSTGRES_PROD_USERNAME,
                password: process.env.POSTGRES_PROD_PASSWORD,
                database: process.env.POSTGRES_PROD_DBNAME,
                ssl: true,
            });
        } else {
            throw new Error(
                `Unknown ENVIRONMENT "${environment}" — expected "${ENV_DEV}" or "${ENV_PROD}"`,
            );
        }

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
                    await sleep(DatabaseService.RETRY_DELAY_MS);
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
}
