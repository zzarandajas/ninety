import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    $transaction: vi.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    scorecardEntry: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

const baseEntryRaw = {
  id: 'entry-1',
  tenantId: 'tenant-1',
  metricId: 'metric-1',
  periodStart: new Date('2026-07-13'),
  actualValue: new Decimal(12),
  enteredByUserId: 'user-1',
  enteredAt: new Date('2026-07-13T10:00:00.000Z'),
};

describe('ScorecardEntryRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findAllSince scopes by tenantId and periodStart >=, converts actualValue to number', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.scorecardEntry.findMany).mockResolvedValue([baseEntryRaw] as never);

    const { ScorecardEntryRepository } = await import('./ScorecardEntryRepository.js');
    const repo = new ScorecardEntryRepository('tenant-1');
    const result = await repo.findAllSince(new Date('2026-05-01'));

    expect(prisma.scorecardEntry.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', periodStart: { gte: new Date('2026-05-01') } },
    });
    expect(result).toEqual([{ ...baseEntryRaw, actualValue: 12 }]);
  });

  it('upsert scopes the where by the compound unique key and injects tenantId on create', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.scorecardEntry.upsert).mockResolvedValue(baseEntryRaw as never);

    const { ScorecardEntryRepository } = await import('./ScorecardEntryRepository.js');
    const repo = new ScorecardEntryRepository('tenant-1');
    const result = await repo.upsert('metric-1', new Date('2026-07-13'), 12, 'user-1');

    expect(prisma.scorecardEntry.upsert).toHaveBeenCalledWith({
      where: { metricId_periodStart: { metricId: 'metric-1', periodStart: new Date('2026-07-13') } },
      create: {
        tenantId: 'tenant-1',
        metricId: 'metric-1',
        periodStart: new Date('2026-07-13'),
        actualValue: 12,
        enteredByUserId: 'user-1',
      },
      update: { actualValue: 12, enteredByUserId: 'user-1' },
    });
    expect(result.actualValue).toBe(12);
  });

  it('upsertMany runs every tenant-scoped upsert inside a single transaction', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.scorecardEntry.upsert).mockResolvedValue(baseEntryRaw as never);

    const { ScorecardEntryRepository } = await import('./ScorecardEntryRepository.js');
    const repo = new ScorecardEntryRepository('tenant-1');
    const count = await repo.upsertMany(
      [
        { metricId: 'metric-1', periodStart: new Date('2026-07-13'), actualValue: 1 },
        { metricId: 'metric-2', periodStart: new Date('2026-07-01'), actualValue: 2 },
      ],
      'user-1'
    );

    expect(count).toBe(2);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.scorecardEntry.upsert).toHaveBeenCalledTimes(2);
    expect(vi.mocked(prisma.scorecardEntry.upsert).mock.calls[1][0].create).toEqual({
      tenantId: 'tenant-1',
      metricId: 'metric-2',
      periodStart: new Date('2026-07-01'),
      actualValue: 2,
      enteredByUserId: 'user-1',
    });
  });
});
