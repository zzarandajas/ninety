import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://u:p@host:5432/db';
  process.env.JWT_SECRET ??= 'a-very-long-random-secret-value';
});

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    tenantMembership: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const TARGET_ID = '22222222-2222-4222-8222-222222222222';
const TENANT_ID = '33333333-3333-4333-8333-333333333333';

const ACTOR_MEMBERSHIP = {
  id: 'mem-actor',
  userId: OWNER_ID,
  tenantId: TENANT_ID,
  seatId: null,
  isActive: true,
};

async function actingAs(role: 'owner' | 'admin' | 'member') {
  const { prisma } = await import('../lib/prisma.js');
  // resolveTenantContext busca la membresía del actor (owner) por userId_tenantId.
  vi.mocked(prisma.tenantMembership.findUnique).mockImplementation((async (args: {
    where: { userId_tenantId: { userId: string; tenantId: string } };
  }) => {
    if (args.where.userId_tenantId.userId === OWNER_ID) {
      return { ...ACTOR_MEMBERSHIP, role };
    }
    return null;
  }) as never);
}

const TARGET_USER = {
  id: TARGET_ID,
  email: 'ana@tasvalor.com',
  fullName: 'Ana Sales',
  mustChangePassword: false,
  avatarUrl: null,
  passwordHash: 'hashed',
};

const TARGET_MEMBERSHIPS = [
  {
    id: 'mem-2',
    userId: TARGET_ID,
    tenantId: TENANT_ID,
    role: 'member',
    seatId: null,
    isActive: true,
    tenant: { id: TENANT_ID, name: 'Tasvalor', slug: 'tasvalor' },
  },
];

describe('impersonate routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /admin/impersonate/users requires the owner role', async () => {
    await actingAs('member');
    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: OWNER_ID });
    const response = await app.inject({
      method: 'GET',
      url: '/admin/impersonate/users',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': TENANT_ID },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('GET /admin/impersonate/users lists users with active memberships for an owner', async () => {
    await actingAs('owner');
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      {
        id: TARGET_ID,
        fullName: 'Ana Sales',
        email: 'ana@tasvalor.com',
        avatarUrl: null,
        memberships: [{ tenantId: TENANT_ID, role: 'member', tenant: { name: 'Tasvalor' } }],
      },
    ] as never);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: OWNER_ID });
    const response = await app.inject({
      method: 'GET',
      url: '/admin/impersonate/users',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': TENANT_ID },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        id: TARGET_ID,
        fullName: 'Ana Sales',
        email: 'ana@tasvalor.com',
        avatarUrl: null,
        memberships: [{ tenantId: TENANT_ID, tenantName: 'Tasvalor', role: 'member' }],
      },
    ]);
    await app.close();
  });

  it('POST /admin/impersonate returns a token for the target user with the imp claim', async () => {
    await actingAs('owner');
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.user.findUnique).mockResolvedValue(TARGET_USER as never);
    vi.mocked(prisma.tenantMembership.count).mockResolvedValue(1);
    vi.mocked(prisma.tenantMembership.findMany).mockResolvedValue(TARGET_MEMBERSHIPS as never);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: OWNER_ID });
    const response = await app.inject({
      method: 'POST',
      url: '/admin/impersonate',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': TENANT_ID },
      payload: { userId: TARGET_ID },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(typeof body.token).toBe('string');
    expect(body.user).toEqual({
      id: TARGET_ID,
      email: 'ana@tasvalor.com',
      fullName: 'Ana Sales',
      mustChangePassword: false,
      avatarUrl: null,
    });
    expect(body.memberships).toEqual([
      { tenantId: TENANT_ID, tenantName: 'Tasvalor', tenantSlug: 'tasvalor', role: 'member' },
    ]);

    const decoded = app.jwt.verify<{ userId: string; imp: string }>(body.token);
    expect(decoded.userId).toBe(TARGET_ID);
    expect(decoded.imp).toBe(OWNER_ID);
    await app.close();
  });

  it('POST /admin/impersonate rejects when the requester is already impersonating', async () => {
    await actingAs('owner');
    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: OWNER_ID, imp: 'original-user' });
    const response = await app.inject({
      method: 'POST',
      url: '/admin/impersonate',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': TENANT_ID },
      payload: { userId: TARGET_ID },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('POST /admin/impersonate returns 404 for an unknown target user', async () => {
    await actingAs('owner');
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: OWNER_ID });
    const response = await app.inject({
      method: 'POST',
      url: '/admin/impersonate',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': TENANT_ID },
      payload: { userId: TARGET_ID },
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('POST /admin/impersonate returns 400 when the target has no active memberships', async () => {
    await actingAs('owner');
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.user.findUnique).mockResolvedValue(TARGET_USER as never);
    vi.mocked(prisma.tenantMembership.count).mockResolvedValue(0);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: OWNER_ID });
    const response = await app.inject({
      method: 'POST',
      url: '/admin/impersonate',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': TENANT_ID },
      payload: { userId: TARGET_ID },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });
});
