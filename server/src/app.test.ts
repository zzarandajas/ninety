import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://u:p@host:5432/db';
  process.env.JWT_SECRET ??= 'a-very-long-random-secret-value';
});

describe('app', () => {
  it('responds to GET /health with 200 and status ok', async () => {
    const { buildApp } = await import('./app.js');
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('does not leak internal error messages on a 500', async () => {
    const { buildApp } = await import('./app.js');
    const app = await buildApp();
    app.get('/__test/boom', async () => {
      throw new Error('Invalid `prisma.rock.findMany()` invocation: column "tenant_id" does not exist');
    });

    const response = await app.inject({ method: 'GET', url: '/__test/boom' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: 'Internal Server Error' });
    expect(response.body).not.toContain('prisma');
    await app.close();
  });
});
