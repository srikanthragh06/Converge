import * as dotenv from 'dotenv';

// Load env files before the NestJS app is created so process.env is fully
// populated during bootstrap. Must be called at the very top of main.ts.
// Environment-specific file takes precedence; .env provides shared fallback defaults.
// dotenv does not overwrite keys already set in process.env.
export function loadEnv() {
  dotenv.config({ path: `.env.${process.env.NODE_ENV ?? 'dev'}` });
  dotenv.config({ path: '.env' });
}
