import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://u:p@host:5432/db';
  process.env.JWT_SECRET ??= 'a-very-long-random-secret-value';
});

describe('jwt plugin', () => {
  it('rejects a request with no Authorization header via app.authenticate', async () => {
    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    app.get('/protected', { preHandler: app.authenticate }, async () => ({ ok: true }));
    const response = await app.inject({ method: 'GET', url: '/protected' });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('accepts a request with a valid Bearer token', async () => {
    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    app.get('/protected', { preHandler: app.authenticate }, async (request) => ({
      userId: request.user.userId,
    }));
    const token = app.jwt.sign({ userId: 'user-123' });
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ userId: 'user-123' });
    await app.close();
  });
});
