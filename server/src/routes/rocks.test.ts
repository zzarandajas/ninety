import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://u:p@host:5432/db';
  process.env.JWT_SECRET ??= 'a-very-long-random-secret-value';
});

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    tenantMembership: { findUnique: vi.fn() },
    rock: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    milestone: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

const membership = {
  id: 'mem-1',
  userId: 'user-1',
  tenantId: 'tenant-1',
  role: 'owner',
  seatId: null,
};

const baseRock = {
  id: 'rock-1',
  tenantId: 'tenant-1',
  title: 'Lanzar módulo de Scorecard',
  description: null,
  ownerUserId: 'user-1',
  quarter: '2026-Q3',
  isCompanyRock: true,
  status: 'on_track',
  createdAt: new Date('2026-07-01'),
  dueDate: new Date('2026-09-30'),
  milestones: [],
};

async function authedApp() {
  const { buildApp } = await import('../app.js');
  const app = await buildApp();
  const token = app.jwt.sign({ userId: 'user-1' });
  return { app, headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tenant-1' } };
}

describe('rocks routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /rocks requires authentication', async () => {
    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/rocks' });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('GET /rocks returns the tenant rock list', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.rock.findMany).mockResolvedValue([baseRock] as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({ method: 'GET', url: '/rocks?quarter=2026-Q3', headers });

    expect(response.statusCode).toBe(200);
    expect(prisma.rock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-1', quarter: '2026-Q3' }) })
    );
    await app.close();
  });

  it('POST /rocks validates the body with Zod (400 on invalid quarter)', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'POST',
      url: '/rocks',
      headers,
      payload: {
        title: 'Rock sin trimestre válido',
        ownerUserId: 'user-1',
        quarter: 'not-a-quarter',
        isCompanyRock: false,
        dueDate: '2026-09-30',
      },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('POST /rocks creates a rock and returns 201', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.rock.create).mockResolvedValue(baseRock as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'POST',
      url: '/rocks',
      headers,
      payload: {
        title: 'Lanzar módulo de Scorecard',
        ownerUserId: 'user-1',
        quarter: '2026-Q3',
        isCompanyRock: true,
        dueDate: '2026-09-30',
      },
    });

    expect(response.statusCode).toBe(201);
    await app.close();
  });

  it('POST /rocks sets createdByUserId/updatedByUserId from the JWT, not from the body', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.rock.create).mockResolvedValue(baseRock as never);

    const { app, headers } = await authedApp();
    await app.inject({
      method: 'POST',
      url: '/rocks',
      headers,
      payload: {
        title: 'Lanzar módulo de Scorecard',
        ownerUserId: 'user-1',
        quarter: '2026-Q3',
        isCompanyRock: true,
        dueDate: '2026-09-30',
        createdByUserId: 'attacker-id',
      },
    });

    expect(prisma.rock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ createdByUserId: 'user-1', updatedByUserId: 'user-1' }),
      })
    );
    await app.close();
  });

  it('GET /rocks/:id returns 404 when not found in tenant', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.rock.findFirst).mockResolvedValue(null);

    const { app, headers } = await authedApp();
    const response = await app.inject({ method: 'GET', url: '/rocks/missing', headers });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('GET /rocks/:id returns 200 with the rock when found in tenant', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.rock.findFirst).mockResolvedValue(baseRock as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({ method: 'GET', url: '/rocks/rock-1', headers });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ...baseRock,
      createdAt: baseRock.createdAt.toISOString(),
      dueDate: baseRock.dueDate.toISOString(),
    });
    await app.close();
  });

  it('PATCH /rocks/:id updates status and returns 200', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.rock.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.rock.findFirst).mockResolvedValue({ ...baseRock, status: 'done' } as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'PATCH',
      url: '/rocks/rock-1',
      headers,
      payload: { status: 'done' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('done');
    await app.close();
  });

  it('DELETE /rocks/:id returns 204 on success', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.rock.deleteMany).mockResolvedValue({ count: 1 });

    const { app, headers } = await authedApp();
    const response = await app.inject({ method: 'DELETE', url: '/rocks/rock-1', headers });

    expect(response.statusCode).toBe(204);
    await app.close();
  });

  it('DELETE /rocks/:id returns 404 when nothing was removed', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.rock.deleteMany).mockResolvedValue({ count: 0 });

    const { app, headers } = await authedApp();
    const response = await app.inject({ method: 'DELETE', url: '/rocks/missing', headers });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('POST /rocks/:rockId/milestones returns 404 when the rock does not exist in the tenant', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.rock.findFirst).mockResolvedValue(null);

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'POST',
      url: '/rocks/missing/milestones',
      headers,
      payload: { description: 'Diseñar el schema', dueDate: '2026-08-15' },
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('POST /rocks/:rockId/milestones creates a milestone and returns 201', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.rock.findFirst).mockResolvedValue(baseRock as never);
    vi.mocked(prisma.milestone.create).mockResolvedValue({
      id: 'milestone-1',
      tenantId: 'tenant-1',
      rockId: 'rock-1',
      description: 'Diseñar el schema',
      dueDate: new Date('2026-08-15'),
      completedAt: null,
    } as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'POST',
      url: '/rocks/rock-1/milestones',
      headers,
      payload: { description: 'Diseñar el schema', dueDate: '2026-08-15' },
    });

    expect(response.statusCode).toBe(201);
    await app.close();
  });

  it('PATCH /rocks/:rockId/milestones/:id maps completed=true to a completedAt timestamp', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.milestone.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.milestone.findFirst).mockResolvedValue({
      id: 'milestone-1',
      tenantId: 'tenant-1',
      rockId: 'rock-1',
      description: 'Diseñar el schema',
      dueDate: new Date('2026-08-15'),
      completedAt: new Date('2026-08-02'),
    } as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'PATCH',
      url: '/rocks/rock-1/milestones/milestone-1',
      headers,
      payload: { completed: true },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.milestone.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ completedAt: expect.any(Date) }) })
    );
    await app.close();
  });

  it('DELETE /rocks/:rockId/milestones/:id returns 204 on success', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.milestone.deleteMany).mockResolvedValue({ count: 1 });

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/rocks/rock-1/milestones/milestone-1',
      headers,
    });

    expect(response.statusCode).toBe(204);
    await app.close();
  });
});
