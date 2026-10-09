import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import type { PoolConfig } from 'pg';

/**
 * Builds the Postgres connection settings for the current ENVIRONMENT. The
 * single source for both DatabaseService's pool and the pg-boss schedulers,
 * so every connection to the database uses the same host, port and SSL rules.
 * Callers add their own pool size (`max`) on top.
 * @param configService - reads the POSTGRES_* variables for the environment
 * @returns the host, port, user, password, database and SSL settings
 */
export function getPostgresConnectionConfig(
  configService: ConfigService,
): PoolConfig {
  const environment = configService.getOrThrow<string>('ENVIRONMENT');

  if (environment === 'DEV') {
    // DEV connects to the local docker-compose postgres container.
    return {
      host: configService.getOrThrow<string>('POSTGRES_DEV_HOST'),
      port: configService.getOrThrow<number>('POSTGRES_DEV_PORT'),
      user: configService.getOrThrow<string>('POSTGRES_DEV_USERNAME'),
      password: configService.getOrThrow<string>('POSTGRES_DEV_PASSWORD'),
      database: configService.getOrThrow<string>('POSTGRES_DEV_DBNAME'),
    };
  } else if (environment === 'PROD') {
    // PROD connects to DigitalOcean Managed Postgres through its PgBouncer
    // connection pool, over the VPC's private host.
    return {
      host: configService.getOrThrow<string>('POSTGRES_PROD_HOST'),
      port: configService.getOrThrow<number>('POSTGRES_PROD_PORT'),
      user: configService.getOrThrow<string>('POSTGRES_PROD_USERNAME'),
      password: configService.getOrThrow<string>('POSTGRES_PROD_PASSWORD'),
      database: configService.getOrThrow<string>('POSTGRES_PROD_DBNAME'),
      // Verifies the server's certificate against DigitalOcean's CA
      // certificate, so the connection is encrypted and proven to reach our
      // own database rather than anything presenting a certificate.
      ssl: {
        ca: readFileSync(
          configService.getOrThrow<string>('POSTGRES_PROD_CA_CERT_PATH'),
          'utf8',
        ),
      },
    };
  } else {
    throw new Error(`Unknown ENVIRONMENT "${environment}"`);
  }
}
