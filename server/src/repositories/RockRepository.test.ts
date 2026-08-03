import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    rock: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

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

describe('RockRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findAll scopes by tenantId and applies optional filters', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.rock.findMany).mockResolvedValue([baseRock] as never);

    const { RockRepository } = await import('./RockRepository.js');
    const repo = new RockRepository('tenant-1');
    const result = await repo.findAll({ quarter: '2026-Q3', ownerUserId: 'user-1' });

    expect(prisma.rock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', quarter: '2026-Q3', ownerUserId: 'user-1' },
      })
    );
    expect(result).toEqual([baseRock]);
  });

  it('findAll with no filters only scopes by tenantId', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.rock.findMany).mockResolvedValue([] as never);

    const { RockRepository } = await import('./RockRepository.js');
    const repo = new RockRepository('tenant-1');
    await repo.findAll();

    expect(prisma.rock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' } })
    );
  });

  it('findById scopes by tenantId, returns null when not found', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.rock.findFirst).mockResolvedValue(null);

    const { RockRepository } = await import('./RockRepository.js');
    const repo = new RockRepository('tenant-1');
    const result = await repo.findById('missing');

    expect(prisma.rock.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'missing', tenantId: 'tenant-1' } })
    );
    expect(result).toBeNull();
  });

  it('create injects tenantId into the data', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.rock.create).mockResolvedValue(baseRock as never);

    const { RockRepository } = await import('./RockRepository.js');
    const repo = new RockRepository('tenant-1');
    await repo.create(
      {
        title: 'Lanzar módulo de Scorecard',
        ownerUserId: 'user-1',
        quarter: '2026-Q3',
        isCompanyRock: true,
        dueDate: new Date('2026-09-30'),
      },
      'user-1'
    );

    expect(prisma.rock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: 'tenant-1', title: 'Lanzar módulo de Scorecard' }),
      include: { milestones: true },
    });
  });

  it('update returns null when no row matched tenant+id', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.rock.updateMany).mockResolvedValue({ count: 0 });

    const { RockRepository } = await import('./RockRepository.js');
    const repo = new RockRepository('tenant-1');
    const result = await repo.update('missing', { status: 'done' }, 'user-1');

    expect(prisma.rock.updateMany).toHaveBeenCalledWith({
      where: { id: 'missing', tenantId: 'tenant-1' },
      data: { status: 'done', updatedByUserId: 'user-1' },
    });
    expect(result).toBeNull();
  });

  it('update returns the fresh row when a row matched', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.rock.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.rock.findFirst).mockResolvedValue({ ...baseRock, status: 'done' } as never);

    const { RockRepository } = await import('./RockRepository.js');
    const repo = new RockRepository('tenant-1');
    const result = await repo.update('rock-1', { status: 'done' }, 'user-1');

    expect(result).toEqual({ ...baseRock, status: 'done' });
  });

  it('delete scopes by tenantId and returns false when nothing matched', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.rock.deleteMany).mockResolvedValue({ count: 0 });

    const { RockRepository } = await import('./RockRepository.js');
    const repo = new RockRepository('tenant-1');
    const result = await repo.delete('missing');

    expect(prisma.rock.deleteMany).toHaveBeenCalledWith({ where: { id: 'missing', tenantId: 'tenant-1' } });
    expect(result).toBe(false);
  });

  it('delete returns true when a row was removed', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.rock.deleteMany).mockResolvedValue({ count: 1 });

    const { RockRepository } = await import('./RockRepository.js');
    const repo = new RockRepository('tenant-1');
    const result = await repo.delete('rock-1');

    expect(result).toBe(true);
  });

  it('create sets createdByUserId and updatedByUserId to the same value', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.rock.create).mockResolvedValue(baseRock as never);

    const { RockRepository } = await import('./RockRepository.js');
    const repo = new RockRepository('tenant-1');
    await repo.create(
      {
        title: 'Lanzar módulo de Scorecard',
        ownerUserId: 'user-1',
        quarter: '2026-Q3',
        isCompanyRock: true,
        dueDate: new Date('2026-09-30'),
      },
      'user-1'
    );

    expect(prisma.rock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ createdByUserId: 'user-1', updatedByUserId: 'user-1' }),
      include: { milestones: true },
    });
  });

  it('update sets updatedByUserId without touching createdByUserId', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.rock.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.rock.findFirst).mockResolvedValue({ ...baseRock, status: 'done' } as never);

    const { RockRepository } = await import('./RockRepository.js');
    const repo = new RockRepository('tenant-1');
    await repo.update('rock-1', { status: 'done' }, 'user-2');

    expect(prisma.rock.updateMany).toHaveBeenCalledWith({
      where: { id: 'rock-1', tenantId: 'tenant-1' },
      data: { status: 'done', updatedByUserId: 'user-2' },
    });
  });
});
