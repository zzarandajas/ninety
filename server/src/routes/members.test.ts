import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://u:p@host:5432/db';
  process.env.JWT_SECRET ??= 'a-very-long-random-secret-value';
});

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    tenantMembership: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    seat: {
      findFirst: vi.fn(),
    },
  },
}));

const ACTOR_MEMBERSHIP = {
  id: 'mem-actor',
  userId: 'user-1',
  tenantId: 'tasvalor',
  seatId: null,
  isActive: true,
};

async function actingAs(role: 'owner' | 'admin' | 'member') {
  const { prisma } = await import('../lib/prisma.js');
  // resolveTenantContext looks up the *acting* user's own membership by userId_tenantId.
  // TenantMembershipRepository.findByUserId (used by invite) looks up the *target* email's
  // user by a different userId — mockImplementation tells them apart by userId.
  vi.mocked(prisma.tenantMembership.findUnique).mockImplementation((async (args: {
    where: { userId_tenantId: { userId: string; tenantId: string } };
  }) => {
    if (args.where.userId_tenantId.userId === 'user-1') {
      return { ...ACTOR_MEMBERSHIP, role };
    }
    return null; // target user has no existing membership in this tenant yet
  }) as never);
}

describe('members routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /members/invite creates a new User with a temp password and returns it once', async () => {
    await actingAs('admin');
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'user-new',
      email: 'nuevo@tasvalor.com',
      fullName: 'Nuevo',
    } as never);
    vi.mocked(prisma.tenantMembership.create).mockResolvedValue({ id: 'mem-new', role: 'member' } as never);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'POST',
      url: '/members/invite',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tasvalor' },
      payload: { email: 'nuevo@tasvalor.com', fullName: 'Nuevo', role: 'member' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().temporaryPassword).not.toBeNull();
    await app.close();
  });

  it('POST /members/invite is rejected with 403 for a plain member', async () => {
    await actingAs('member');

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'POST',
      url: '/members/invite',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tasvalor' },
      payload: { email: 'nuevo@tasvalor.com', fullName: 'Nuevo', role: 'member' },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('POST /members/invite blocks an admin from granting the owner role', async () => {
    await actingAs('admin');

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'POST',
      url: '/members/invite',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tasvalor' },
      payload: { email: 'nuevo@tasvalor.com', fullName: 'Nuevo', role: 'owner' },
    });

    expect(response.statusCode).toBe(403);
    const { prisma } = await import('../lib/prisma.js');
    expect(prisma.user.create).not.toHaveBeenCalled();
    await app.close();
  });

  it('PATCH /members/:id blocks an admin from promoting someone to owner', async () => {
    await actingAs('admin');

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'PATCH',
      url: '/members/22222222-2222-2222-2222-222222222222',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tasvalor' },
      payload: { role: 'owner' },
    });

    expect(response.statusCode).toBe(403);
    const { prisma } = await import('../lib/prisma.js');
    expect(prisma.tenantMembership.update).not.toHaveBeenCalled();
    await app.close();
  });

  it('PATCH /members/:id assigns a seat and updates the role in one call', async () => {
    await actingAs('owner');
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findFirst)
      .mockResolvedValueOnce({ id: 'mem-target', tenantId: 'tasvalor', seatId: null } as never) // findOrThrow (assignSeat)
      .mockResolvedValueOnce(null) // occupiedBy check: nobody else has this seat
      .mockResolvedValueOnce({ id: 'mem-target', tenantId: 'tasvalor' } as never) // findOrThrow (updateRole)
      .mockResolvedValue({ id: 'mem-target', tenantId: 'tasvalor', role: 'admin' } as never); // findOne (final response)
    vi.mocked(prisma.seat.findFirst).mockResolvedValue({
      id: '33333333-3333-3333-3333-333333333333',
      tenantId: 'tasvalor',
    } as never);
    vi.mocked(prisma.tenantMembership.update).mockResolvedValue({} as never);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'PATCH',
      url: '/members/22222222-2222-2222-2222-222222222222',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tasvalor' },
      payload: { seatId: '33333333-3333-3333-3333-333333333333', role: 'admin' },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.tenantMembership.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { seatId: '33333333-3333-3333-3333-333333333333' } })
    );
    expect(prisma.tenantMembership.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: 'admin' } })
    );
    await app.close();
  });

  it('PATCH /members/:id with isActive:false frees the seat (seatId set to null)', async () => {
    await actingAs('owner');
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue({
      id: 'mem-target',
      tenantId: 'tasvalor',
      seatId: 'seat-1',
    } as never);
    vi.mocked(prisma.tenantMembership.update).mockResolvedValue({} as never);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'PATCH',
      url: '/members/22222222-2222-2222-2222-222222222222',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tasvalor' },
      payload: { isActive: false },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.tenantMembership.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false, seatId: null } })
    );
    await app.close();
  });

  it('POST /members/:id/reset-password returns a temporary password and forces change', async () => {
    await actingAs('owner');
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue({
      id: 'mem-target',
      userId: 'user-target',
      tenantId: 'tasvalor',
      role: 'member',
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-target',
      email: 'target@tasvalor.com',
      fullName: 'Target',
      passwordHash: 'old-hash',
    } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({
      id: 'user-target',
      email: 'target@tasvalor.com',
      fullName: 'Target',
      passwordHash: 'new-hash',
      mustChangePassword: true,
    } as never);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'POST',
      url: '/members/22222222-2222-2222-2222-222222222222/reset-password',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tasvalor' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.temporaryPassword).not.toBeNull();
    expect(body.mustChangePassword).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-target' },
        data: expect.objectContaining({ mustChangePassword: true }),
      })
    );
    await app.close();
  });

  it('POST /members/:id/reset-password allows an admin to reset an admin/member', async () => {
    await actingAs('admin');
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue({
      id: 'mem-target',
      userId: 'user-target',
      tenantId: 'tasvalor',
      role: 'admin',
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-target',
      email: 'target@tasvalor.com',
      fullName: 'Target',
      passwordHash: 'old-hash',
    } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'POST',
      url: '/members/22222222-2222-2222-2222-222222222222/reset-password',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tasvalor' },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.user.update).toHaveBeenCalled();
    await app.close();
  });

  it('POST /members/:id/reset-password blocks an admin from resetting an owner', async () => {
    await actingAs('admin');
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue({
      id: 'mem-target',
      userId: 'user-target',
      tenantId: 'tasvalor',
      role: 'owner',
    } as never);

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'POST',
      url: '/members/22222222-2222-2222-2222-222222222222/reset-password',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tasvalor' },
    });

    expect(response.statusCode).toBe(403);
    const { prisma: prismaAfter } = await import('../lib/prisma.js');
    expect(prismaAfter.user.update).not.toHaveBeenCalled();
    await app.close();
  });

  it('POST /members/:id/reset-password rejects a plain member', async () => {
    await actingAs('member');

    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const token = app.jwt.sign({ userId: 'user-1' });
    const response = await app.inject({
      method: 'POST',
      url: '/members/22222222-2222-2222-2222-222222222222/reset-password',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tasvalor' },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
