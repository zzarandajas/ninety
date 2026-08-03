import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://u:p@host:5432/db';
  process.env.JWT_SECRET ??= 'a-very-long-random-secret-value';
});

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    tenantMembership: { findUnique: vi.fn() },
    quarter: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    rock: {
      groupBy: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const ownerMembership = {
  id: 'mem-1',
  userId: 'user-1',
  tenantId: 'tenant-1',
  role: 'owner',
  seatId: null,
  isActive: true,
};

const memberMembership = {
  ...ownerMembership,
  role: 'member',
};

const adminMembership = {
  ...ownerMembership,
  role: 'admin',
};

const baseQuarter = {
  id: 'quarter-1',
  tenantId: 'tenant-1',
  label: '2026-Q3',
  startDate: new Date('2026-07-01'),
  endDate: new Date('2026-09-30'),
  theme: 'Ejecutar con foco',
  isOpen: true,
  createdAt: new Date('2026-07-01'),
  updatedAt: new Date('2026-07-01'),
};

async function authedApp() {
  const { buildApp } = await import('../app.js');
  const app = await buildApp();
  const token = app.jwt.sign({ userId: 'user-1' });
  return { app, headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tenant-1' } };
}

describe('quarters routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /quarters requires authentication', async () => {
    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/quarters' });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('GET /quarters returns the tenant periods with rock counts', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(memberMembership as never);
    vi.mocked(prisma.quarter.findMany).mockResolvedValue([baseQuarter] as never);
    vi.mocked(prisma.rock.groupBy).mockResolvedValue([
      { quarter: '2026-Q3', status: 'on_track', _count: { _all: 2 } },
      { quarter: '2026-Q3', status: 'done', _count: { _all: 1 } },
    ] as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({ method: 'GET', url: '/quarters', headers });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      expect.objectContaining({
        id: 'quarter-1',
        label: '2026-Q3',
        rockCount: 3,
        openRockCount: 2,
      }),
    ]);
    await app.close();
  });

  it('POST /quarters returns 403 for a non-owner member', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(memberMembership as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'POST',
      url: '/quarters',
      headers,
      payload: {
        label: '2026-Q4',
        startDate: '2026-10-01',
        endDate: '2026-12-31',
      },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('POST /quarters allows an admin member to create a period', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(adminMembership as never);
    vi.mocked(prisma.quarter.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.quarter.create).mockResolvedValue(baseQuarter as never);
    vi.mocked(prisma.rock.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
      fn({
        quarter: prisma.quarter,
        rock: prisma.rock,
      } as never)
    );

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'POST',
      url: '/quarters',
      headers,
      payload: {
        label: '2026-Q4',
        startDate: '2026-10-01',
        endDate: '2026-12-31',
      },
    });

    expect(response.statusCode).toBe(201);
    await app.close();
  });

  it('POST /quarters validates the label format', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(ownerMembership as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'POST',
      url: '/quarters',
      headers,
      payload: {
        label: 'not-a-quarter',
        startDate: '2026-10-01',
        endDate: '2026-12-31',
      },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('POST /quarters rejects endDate before startDate', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(ownerMembership as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'POST',
      url: '/quarters',
      headers,
      payload: {
        label: '2026-Q4',
        startDate: '2026-12-31',
        endDate: '2026-10-01',
      },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('POST /quarters returns 409 when the period already exists', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(ownerMembership as never);
    vi.mocked(prisma.quarter.findFirst).mockResolvedValue(baseQuarter as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'POST',
      url: '/quarters',
      headers,
      payload: {
        label: '2026-Q3',
        startDate: '2026-07-01',
        endDate: '2026-09-30',
      },
    });

    expect(response.statusCode).toBe(409);
    await app.close();
  });

  it('POST /quarters creates the period and rolls forward incomplete rocks', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(ownerMembership as never);
    vi.mocked(prisma.quarter.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.quarter.create).mockResolvedValue({
      ...baseQuarter,
      id: 'quarter-2',
      label: '2026-Q4',
    } as never);
    vi.mocked(prisma.rock.updateMany).mockResolvedValue({ count: 3 });
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
      fn({
        quarter: prisma.quarter,
        rock: prisma.rock,
      } as never)
    );

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'POST',
      url: '/quarters',
      headers,
      payload: {
        label: '2026-Q4',
        startDate: '2026-10-01',
        endDate: '2026-12-31',
        theme: 'Cerrar el año con fuerza',
        rolloverFromLabel: '2026-Q3',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(expect.objectContaining({ label: '2026-Q4', movedRockCount: 3 }));
    expect(prisma.rock.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ quarter: '2026-Q3', status: { not: 'done' } }),
        data: { quarter: '2026-Q4' },
      })
    );
    await app.close();
  });

  it('PATCH /quarters/:id returns 404 for a period outside the tenant', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(ownerMembership as never);
    vi.mocked(prisma.quarter.findFirst).mockResolvedValue(null);

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'PATCH',
      url: '/quarters/00000000-0000-0000-0000-000000000000',
      headers,
      payload: { theme: 'Nuevo tema' },
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('PATCH /quarters/:id updates the theme and returns the period', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(ownerMembership as never);
    vi.mocked(prisma.quarter.findFirst)
      .mockResolvedValueOnce(baseQuarter as never)
      .mockResolvedValueOnce({ ...baseQuarter, theme: 'Nuevo tema' } as never);
    vi.mocked(prisma.quarter.updateMany).mockResolvedValue({ count: 1 });

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'PATCH',
      url: '/quarters/11111111-1111-1111-1111-111111111111',
      headers,
      payload: { theme: 'Nuevo tema' },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.quarter.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: '11111111-1111-1111-1111-111111111111', tenantId: 'tenant-1' }),
      })
    );
    expect(response.json().theme).toBe('Nuevo tema');
    await app.close();
  });
});
