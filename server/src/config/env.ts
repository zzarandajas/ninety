import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

// Local (non-Docker) dev reads server/.env directly, since nothing injects
// environment variables for us the way Docker Compose does (Compose reads its
// own .env from the repo root — a separate file for a separate purpose).
// Silently does nothing if the file doesn't exist (e.g. in Docker, where env
// vars come from compose) and never overrides a variable that's already set.
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
loadDotenv({ path: path.join(serverRoot, '.env') });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.string().default('development'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
});

export const env = envSchema.parse(process.env);
