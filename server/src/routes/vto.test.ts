import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://u:p@host:5432/db';
  process.env.JWT_SECRET ??= 'a-very-long-random-secret-value';
});

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    tenantMembership: { findUnique: vi.fn() },
    vTODocument: { upsert: vi.fn() },
  },
}));

const membership = { id: 'mem-1', userId: 'user-1', tenantId: 'tenant-1', role: 'owner', seatId: null };

const baseDoc = {
  id: 'vto-1',
  tenantId: 'tenant-1',
  coreValues: ['Honestidad'],
  coreFocusPurpose: null,
  coreFocusNiche: null,
  tenYearTarget: null,
  marketingStrategy: {},
  threeYearPicture: {},
  oneYearPlan: {},
  updatedAt: new Date('2026-07-01'),
  updatedByUserId: null,
};

async function authedApp() {
  const { buildApp } = await import('../app.js');
  const app = await buildApp();
  const token = app.jwt.sign({ userId: 'user-1' });
  return { app, headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tenant-1' } };
}

describe('vto routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /vto requires authentication', async () => {
    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/vto' });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('GET /vto returns the tenant document, creating it on first access', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.vTODocument.upsert).mockResolvedValue(baseDoc as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({ method: 'GET', url: '/vto', headers });

    expect(response.statusCode).toBe(200);
    expect(prisma.vTODocument.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' }, update: {} })
    );
    expect(response.json()).toEqual(JSON.parse(JSON.stringify(baseDoc)));
    await app.close();
  });

  it('PUT /vto validates the body and forwards updatedByUserId from the JWT', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.vTODocument.upsert).mockResolvedValue({
      ...baseDoc,
      coreFocusPurpose: 'Ayudar a pymes a ejecutar',
    } as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'PUT',
      url: '/vto',
      headers,
      payload: { coreFocusPurpose: 'Ayudar a pymes a ejecutar' },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.vTODocument.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { coreFocusPurpose: 'Ayudar a pymes a ejecutar', updatedByUserId: 'user-1' },
      })
    );
    await app.close();
  });

  it('PUT /vto rejects a oneYearPlan.companyRockIds that is not an array of strings', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'PUT',
      url: '/vto',
      headers,
      payload: { oneYearPlan: { companyRockIds: [123] } },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });
});
