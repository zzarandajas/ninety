import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';

beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgresql://u:p@host:5432/db';
  process.env.JWT_SECRET ??= 'a-very-long-random-secret-value';
});

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    tenantMembership: { findUnique: vi.fn() },
    scorecardMetric: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    scorecardEntry: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

const membership = { id: 'mem-1', userId: 'user-1', tenantId: 'tenant-1', role: 'owner', seatId: null };

const baseMetricRaw = {
  id: 'metric-1',
  tenantId: 'tenant-1',
  name: 'Nº leads cualificados/semana',
  ownerUserId: 'user-1',
  goalValue: new Decimal(10),
  comparison: 'gte',
  frequency: 'weekly',
  unit: '#',
  isActive: true,
};

async function authedApp() {
  const { buildApp } = await import('../app.js');
  const app = await buildApp();
  const token = app.jwt.sign({ userId: 'user-1' });
  return { app, headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tenant-1' } };
}

describe('scorecard routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /scorecard/metrics requires authentication', async () => {
    const { buildApp } = await import('../app.js');
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/scorecard/metrics' });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('GET /scorecard/metrics returns the tenant metric list with goalValue as a plain number', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.scorecardMetric.findMany).mockResolvedValue([baseMetricRaw] as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({ method: 'GET', url: '/scorecard/metrics', headers });

    expect(response.statusCode).toBe(200);
    expect(response.json()[0].goalValue).toBe(10);
    await app.close();
  });

  it('GET /scorecard/metrics?isActive=false filters for inactive metrics (not the string-coercion bug)', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.scorecardMetric.findMany).mockResolvedValue([] as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({ method: 'GET', url: '/scorecard/metrics?isActive=false', headers });

    expect(response.statusCode).toBe(200);
    expect(prisma.scorecardMetric.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: false }) })
    );
    await app.close();
  });

  it('POST /scorecard/metrics validates the body with Zod (400 on invalid comparison)', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'POST',
      url: '/scorecard/metrics',
      headers,
      payload: { name: 'X', ownerUserId: 'user-1', goalValue: 10, comparison: 'not-valid', frequency: 'weekly', unit: '#' },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('POST /scorecard/metrics creates a metric and returns 201', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.scorecardMetric.create).mockResolvedValue(baseMetricRaw as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'POST',
      url: '/scorecard/metrics',
      headers,
      payload: {
        name: 'Nº leads cualificados/semana',
        ownerUserId: 'user-1',
        goalValue: 10,
        comparison: 'gte',
        frequency: 'weekly',
        unit: '#',
      },
    });

    expect(response.statusCode).toBe(201);
    await app.close();
  });

  it('PATCH /scorecard/metrics/:id returns 404 when not found in tenant', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.scorecardMetric.updateMany).mockResolvedValue({ count: 0 });

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'PATCH',
      url: '/scorecard/metrics/missing',
      headers,
      payload: { isActive: false },
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('DELETE /scorecard/metrics/:id returns 204 on success', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.scorecardMetric.deleteMany).mockResolvedValue({ count: 1 });

    const { app, headers } = await authedApp();
    const response = await app.inject({ method: 'DELETE', url: '/scorecard/metrics/metric-1', headers });

    expect(response.statusCode).toBe(204);
    await app.close();
  });

  it('GET /scorecard/entries defaults to 12 weeks and returns plain-number actualValue', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.scorecardEntry.findMany).mockResolvedValue([
      {
        id: 'entry-1',
        tenantId: 'tenant-1',
        metricId: 'metric-1',
        periodStart: new Date('2026-07-13'),
        actualValue: new Decimal(12),
        enteredByUserId: 'user-1',
        enteredAt: new Date('2026-07-13T10:00:00.000Z'),
      },
    ] as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({ method: 'GET', url: '/scorecard/entries', headers });

    expect(response.statusCode).toBe(200);
    expect(response.json()[0].actualValue).toBe(12);
    const callArg = vi.mocked(prisma.scorecardEntry.findMany).mock.calls[0][0] as { where: { periodStart: { gte: Date } } };
    expect(callArg.where.periodStart.gte).toBeInstanceOf(Date);
    await app.close();
  });

  it('PUT /scorecard/entries returns 404 when the metric does not exist in the tenant', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.scorecardMetric.findFirst).mockResolvedValue(null);

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'PUT',
      url: '/scorecard/entries',
      headers,
      payload: { metricId: 'missing', periodStart: '2026-07-13', actualValue: 12 },
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('PUT /scorecard/entries upserts using the authenticated user as enteredByUserId', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue(membership as never);
    vi.mocked(prisma.scorecardMetric.findFirst).mockResolvedValue(baseMetricRaw as never);
    vi.mocked(prisma.scorecardEntry.upsert).mockResolvedValue({
      id: 'entry-1',
      tenantId: 'tenant-1',
      metricId: 'metric-1',
      periodStart: new Date('2026-07-13'),
      actualValue: new Decimal(12),
      enteredByUserId: 'user-1',
      enteredAt: new Date('2026-07-13T10:00:00.000Z'),
    } as never);

    const { app, headers } = await authedApp();
    const response = await app.inject({
      method: 'PUT',
      url: '/scorecard/entries',
      headers,
      payload: { metricId: 'metric-1', periodStart: '2026-07-13', actualValue: 12 },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.scorecardEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ enteredByUserId: 'user-1', actualValue: 12 }),
      })
    );
    await app.close();
  });
});
