import * as dotenv from 'dotenv';

/**
 * Loads environment variables from .env.<NODE_ENV> and .env before the
 * NestJS app is created. Must be called at the very top of main.ts.
 * The environment-specific file takes precedence; .env is the shared fallback.
 * dotenv does not overwrite keys already set in process.env.
 */
export function loadEnv() {
  // load the environment-specific file first so it takes precedence
  dotenv.config({ path: `.env.${process.env.NODE_ENV ?? 'dev'}` });
  // load the shared fallback; keys already set above are not overwritten
  dotenv.config({ path: '.env' });
}
