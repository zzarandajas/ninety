import { beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://u:p@host:5432/db';
  process.env.JWT_SECRET ??= 'a-very-long-random-secret-value';
  process.env.REDIS_URL ??= 'redis://localhost:6379';
});

// Mock ioredis so test doesn't require a running redis instance
vi.mock('ioredis', () => {
  class MockRedis {
    public on() {}
    public psubscribe(_pattern: string, cb?: (err: Error | null) => void) {
      if (cb) cb(null);
    }
    public publish() {
      return Promise.resolve(1);
    }
    public quit() {
      return Promise.resolve('OK');
    }
  }
  return { Redis: MockRedis };
});

describe('websocket plugin', () => {
  it('registers /ws route in Fastify application', async () => {
    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    expect(app.hasRoute({ method: 'GET', url: '/ws' })).toBe(true);
    await app.close();
  });
});
