import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://u:p@host:5432/db';
  process.env.JWT_SECRET ??= 'a-very-long-random-secret-value';
});

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    tenantMembership: {
      findMany: vi.fn(),
    },
  },
}));

const baseUser = {
  id: 'user-1',
  email: 'me@example.com',
  fullName: 'Me',
  mustChangePassword: false,
  avatarUrl: null,
  createdAt: new Date(),
};

describe('auth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /auth/register no longer exists (no public self-registration)', async () => {
    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'new@example.com', password: 'supersecret123', fullName: 'New User' },
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('POST /auth/login returns 400 for a malformed body instead of a 500', async () => {
    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'not-an-email', password: '' },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('POST /auth/login returns a token, user (with mustChangePassword/avatarUrl), and memberships', async () => {
    const { hashPassword } = await import('../lib/password.js');
    const { prisma } = await import('../lib/prisma.js');
    const passwordHash = await hashPassword('supersecret123');
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...baseUser,
      passwordHash,
      mustChangePassword: true,
    } as never);
    vi.mocked(prisma.tenantMembership.findMany).mockResolvedValue([
      {
        id: 'mem-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'owner',
        seatId: null,
        tenant: { id: 'tenant-1', name: 'Tasvalor', slug: 'tasvalor' },
      },
    ] as never);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'me@example.com', password: 'supersecret123' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(typeof body.token).toBe('string');
    expect(body.user).toEqual({
      id: 'user-1',
      email: 'me@example.com',
      fullName: 'Me',
      mustChangePassword: true,
      avatarUrl: null,
    });
    expect(body.memberships).toEqual([
      { tenantId: 'tenant-1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' },
    ]);
    await app.close();
  });

  it('POST /auth/login returns 401 for wrong password', async () => {
    const { hashPassword } = await import('../lib/password.js');
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...baseUser,
      passwordHash: await hashPassword('supersecret123'),
    } as never);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'me@example.com', password: 'wrong' },
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('POST /auth/login returns 401 for an unknown email (still runs a bcrypt compare)', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'nobody@example.com', password: 'whatever123' },
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('GET /auth/me requires a valid Bearer token', async () => {
    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/auth/me' });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('GET /auth/me returns the user and memberships for a valid Bearer token', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...baseUser,
      passwordHash: 'hashed',
    } as never);
    vi.mocked(prisma.tenantMembership.findMany).mockResolvedValue([
      {
        id: 'mem-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'owner',
        seatId: null,
        tenant: { id: 'tenant-1', name: 'Tasvalor', slug: 'tasvalor' },
      },
    ] as never);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      user: {
        id: 'user-1',
        email: 'me@example.com',
        fullName: 'Me',
        mustChangePassword: false,
        avatarUrl: null,
      },
      memberships: [{ tenantId: 'tenant-1', tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'owner' }],
    });
    await app.close();
  });

  it('POST /auth/change-password rejects a wrong current password with 401', async () => {
    const { hashPassword } = await import('../lib/password.js');
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...baseUser,
      passwordHash: await hashPassword('supersecret123'),
    } as never);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      headers: { authorization: `Bearer ${token}` },
      payload: { currentPassword: 'wrong', newPassword: 'NewSecret123' },
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('POST /auth/change-password rejects a weak new password with 400', async () => {
    const { hashPassword } = await import('../lib/password.js');
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...baseUser,
      passwordHash: await hashPassword('supersecret123'),
    } as never);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      headers: { authorization: `Bearer ${token}` },
      payload: { currentPassword: 'supersecret123', newPassword: 'short' },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('POST /auth/change-password updates the hash and clears mustChangePassword on success', async () => {
    const { hashPassword } = await import('../lib/password.js');
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...baseUser,
      mustChangePassword: true,
      passwordHash: await hashPassword('supersecret123'),
    } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({ ...baseUser, mustChangePassword: false } as never);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      headers: { authorization: `Bearer ${token}` },
      payload: { currentPassword: 'supersecret123', newPassword: 'NewSecret123' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({ mustChangePassword: false }),
      })
    );
    await app.close();
  });
});
