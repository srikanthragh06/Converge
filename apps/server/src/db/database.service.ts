import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, types } from 'pg';
import { sleep } from '../utils/utils';
import {
  FileMigrationProvider,
  Kysely,
  Migrator,
  PostgresDialect,
} from 'kysely';
import { DatabaseSchema } from './database.schema';
import path from 'path';
import { promises as fs } from 'fs';

@Injectable()
export class DatabaseService {
  public readonly kysely: Kysely<DatabaseSchema>; // type-safe query builder wrapping the pool
  private readonly pool: Pool; // pg connection pool shared across all queries

  private static readonly MAX_RETRIES = 10; // total connection attempts before giving up
  private static readonly RETRY_DELAY_MS = 3000; // ms to wait between attempts

  constructor(private readonly configService: ConfigService) {
    // By default pg returns BIGINT (OID 20) as strings to avoid JS number precision loss.
    // Configure the type parser once here so BigInt arithmetic works correctly at runtime.
    types.setTypeParser(20, (val: string) => BigInt(val));

    const environment = this.configService.getOrThrow<string>('ENVIRONMENT');

    if (environment === 'DEV') {
      // DEV connects to the local docker-compose postgres container.
      this.pool = new Pool({
        host: this.configService.getOrThrow<string>('POSTGRES_DEV_HOST'),
        port: this.configService.getOrThrow<number>('POSTGRES_DEV_PORT'),
        user: this.configService.getOrThrow<string>('POSTGRES_DEV_USERNAME'),
        password: this.configService.getOrThrow<string>(
          'POSTGRES_DEV_PASSWORD',
        ),
        database: this.configService.getOrThrow<string>('POSTGRES_DEV_DBNAME'),
      });
    } else if (environment === 'PROD') {
      // PROD connects to the production database.
      // ssl: true is required for Neon (and most managed Postgres providers).
      this.pool = new Pool({
        host: this.configService.getOrThrow<string>('POSTGRES_PROD_HOST'),
        user: this.configService.getOrThrow<string>('POSTGRES_PROD_USERNAME'),
        password: this.configService.getOrThrow<string>(
          'POSTGRES_PROD_PASSWORD',
        ),
        database: this.configService.getOrThrow<string>('POSTGRES_PROD_DBNAME'),
        ssl: true,
      });
    } else {
      throw new Error(`Unknown ENVIRONMENT "${environment}"`);
    }

    this.kysely = new Kysely<DatabaseSchema>({
      dialect: new PostgresDialect({ pool: this.pool }),
    });
  }

  /**
   * Verifies that the database is reachable by running a trivial query.
   * Retries up to MAX_RETRIES times with a fixed RETRY_DELAY_MS delay between
   * attempts. Throws if the database is still unreachable after all retries.
   */
  async verifyDBConnection(): Promise<void> {
    for (let attempt = 1; attempt <= DatabaseService.MAX_RETRIES; attempt++) {
      try {
        const client = await this.pool.connect();
        try {
          await client.query('SELECT 1');
        } finally {
          client.release();
        }
        console.log('Postgres connection established');
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

  /**
   * Runs all pending migrations to latest using Kysely's Migrator.
   * Logs the result of each individual migration file and throws if any
   * migration fails, so a broken schema change prevents the app from starting.
   */
  async migrate(): Promise<void> {
    const migrator = new Migrator({
      db: this.kysely,
      provider: new FileMigrationProvider({
        fs,
        path,
        // Absolute path to the migrations directory — works for both
        // ts-node/tsx (dev) and compiled JS (prod) because __dirname
        // resolves relative to this file in both cases.
        migrationFolder: path.join(__dirname, '../migrations'),
      }),
    });

    const { error, results } = await migrator.migrateToLatest();

    for (const result of results ?? []) {
      if (result.status === 'Success') {
        console.log(`Migration "${result.migrationName}" applied successfully`);
      } else if (result.status === 'Error') {
        console.error(`Migration "${result.migrationName}" failed`);
      }
    }

    if (error) {
      throw new Error(`Migration failed: ${String(error)}`);
    }

    console.log('All migrations complete');
  }
}
