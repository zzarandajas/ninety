import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuarterRepository } from './QuarterRepository.js';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
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

describe('QuarterRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findAll returns periods with rock counts computed per label', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.quarter.findMany).mockResolvedValue([baseQuarter] as never);
    vi.mocked(prisma.rock.groupBy).mockResolvedValue([
      { quarter: '2026-Q3', status: 'on_track', _count: { _all: 2 } },
      { quarter: '2026-Q3', status: 'done', _count: { _all: 1 } },
    ] as never);

    const repo = new QuarterRepository('tenant-1');
    const result = await repo.findAll();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ rockCount: 3, openRockCount: 2 });
  });

  it('findById scopes the query to the tenant', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.quarter.findFirst).mockResolvedValue(baseQuarter as never);

    const repo = new QuarterRepository('tenant-1');
    await repo.findById('quarter-1');

    expect(prisma.quarter.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'quarter-1', tenantId: 'tenant-1' } })
    );
  });

  it('create rolls forward incomplete rocks inside the same transaction', async () => {
    const { prisma } = await import('../lib/prisma.js');
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

    const repo = new QuarterRepository('tenant-1');
    const { quarter, movedRockCount } = await repo.create(
      { label: '2026-Q4', startDate: new Date('2026-10-01'), endDate: new Date('2026-12-31') },
      '2026-Q3'
    );

    expect(quarter.label).toBe('2026-Q4');
    expect(movedRockCount).toBe(3);
    expect(prisma.rock.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1', quarter: '2026-Q3', status: { not: 'done' } }),
        data: { quarter: '2026-Q4' },
      })
    );
  });

  it('create without rolloverFromLabel does not touch rocks', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.quarter.create).mockResolvedValue(baseQuarter as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
      fn({
        quarter: prisma.quarter,
        rock: prisma.rock,
      } as never)
    );

    const repo = new QuarterRepository('tenant-1');
    await repo.create({ label: '2026-Q3', startDate: new Date('2026-07-01'), endDate: new Date('2026-09-30') });

    expect(prisma.rock.updateMany).not.toHaveBeenCalled();
  });

  it('update returns null when nothing matched in the tenant', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.quarter.updateMany).mockResolvedValue({ count: 0 });

    const repo = new QuarterRepository('tenant-1');
    const result = await repo.update('quarter-1', { theme: 'Nuevo' });

    expect(result).toBeNull();
  });
});
