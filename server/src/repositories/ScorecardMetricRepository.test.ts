import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    scorecardMetric: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

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

describe('ScorecardMetricRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findAll scopes by tenantId, applies isActive filter, and converts goalValue to number', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.scorecardMetric.findMany).mockResolvedValue([baseMetricRaw] as never);

    const { ScorecardMetricRepository } = await import('./ScorecardMetricRepository.js');
    const repo = new ScorecardMetricRepository('tenant-1');
    const result = await repo.findAll({ isActive: true });

    expect(prisma.scorecardMetric.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1', isActive: true } })
    );
    expect(result).toEqual([{ ...baseMetricRaw, goalValue: 10 }]);
  });

  it('findAll with no filters only scopes by tenantId', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.scorecardMetric.findMany).mockResolvedValue([] as never);

    const { ScorecardMetricRepository } = await import('./ScorecardMetricRepository.js');
    const repo = new ScorecardMetricRepository('tenant-1');
    await repo.findAll();

    expect(prisma.scorecardMetric.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' } })
    );
  });

  it('findById scopes by tenantId, converts goalValue, returns null when not found', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.scorecardMetric.findFirst).mockResolvedValueOnce(baseMetricRaw as never).mockResolvedValueOnce(null);

    const { ScorecardMetricRepository } = await import('./ScorecardMetricRepository.js');
    const repo = new ScorecardMetricRepository('tenant-1');
    const found = await repo.findById('metric-1');
    const missing = await repo.findById('missing');

    expect(prisma.scorecardMetric.findFirst).toHaveBeenCalledWith({
      where: { id: 'metric-1', tenantId: 'tenant-1' },
    });
    expect(found).toEqual({ ...baseMetricRaw, goalValue: 10 });
    expect(missing).toBeNull();
  });

  it('create injects tenantId and converts the returned goalValue', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.scorecardMetric.create).mockResolvedValue(baseMetricRaw as never);

    const { ScorecardMetricRepository } = await import('./ScorecardMetricRepository.js');
    const repo = new ScorecardMetricRepository('tenant-1');
    const result = await repo.create(
      {
        name: 'Nº leads cualificados/semana',
        ownerUserId: 'user-1',
        goalValue: 10,
        comparison: 'gte',
        frequency: 'weekly',
        unit: '#',
      },
      'user-1'
    );

    expect(prisma.scorecardMetric.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: 'tenant-1', name: 'Nº leads cualificados/semana', goalValue: 10 }),
    });
    expect(result.goalValue).toBe(10);
  });

  it('update returns null when no row matched tenant+id', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.scorecardMetric.updateMany).mockResolvedValue({ count: 0 });

    const { ScorecardMetricRepository } = await import('./ScorecardMetricRepository.js');
    const repo = new ScorecardMetricRepository('tenant-1');
    const result = await repo.update('missing', { isActive: false }, 'user-1');

    expect(prisma.scorecardMetric.updateMany).toHaveBeenCalledWith({
      where: { id: 'missing', tenantId: 'tenant-1' },
      data: { isActive: false, updatedByUserId: 'user-1' },
    });
    expect(result).toBeNull();
  });

  it('update returns the fresh converted row when a row matched', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.scorecardMetric.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.scorecardMetric.findFirst).mockResolvedValue({ ...baseMetricRaw, isActive: false } as never);

    const { ScorecardMetricRepository } = await import('./ScorecardMetricRepository.js');
    const repo = new ScorecardMetricRepository('tenant-1');
    const result = await repo.update('metric-1', { isActive: false }, 'user-1');

    expect(result).toEqual({ ...baseMetricRaw, goalValue: 10, isActive: false });
  });

  it('delete scopes by tenantId and reports whether a row was removed', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.scorecardMetric.deleteMany).mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    const { ScorecardMetricRepository } = await import('./ScorecardMetricRepository.js');
    const repo = new ScorecardMetricRepository('tenant-1');
    const removed = await repo.delete('metric-1');
    const notRemoved = await repo.delete('missing');

    expect(prisma.scorecardMetric.deleteMany).toHaveBeenCalledWith({ where: { id: 'metric-1', tenantId: 'tenant-1' } });
    expect(removed).toBe(true);
    expect(notRemoved).toBe(false);
  });
});
