import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Neutralize dotenv so a real .env file on disk (the normal local-dev state)
// can't fill in vars this suite deliberately deletes to test the "missing" path.
vi.mock('dotenv', () => ({ config: () => ({}) }));

const ORIGINAL_ENV = { ...process.env };

describe('env config', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('throws if a required var is missing', async () => {
    delete process.env.JWT_SECRET;
    process.env.DATABASE_URL = 'postgresql://u:p@host:5432/db';
    await expect(import('./env.js')).rejects.toThrow(/JWT_SECRET/);
  });

  it('parses required vars and applies defaults', async () => {
    process.env.DATABASE_URL = 'postgresql://u:p@host:5432/db';
    process.env.JWT_SECRET = 'a-very-long-random-secret-value';
    delete process.env.NODE_ENV;
    const mod = await import('./env.js');
    expect(mod.env.DATABASE_URL).toBe('postgresql://u:p@host:5432/db');
    expect(mod.env.PORT).toBe(4000);
    expect(mod.env.NODE_ENV).toBe('development');
  });
});
