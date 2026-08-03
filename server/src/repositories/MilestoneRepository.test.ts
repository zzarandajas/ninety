import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    milestone: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

const baseMilestone = {
  id: 'milestone-1',
  tenantId: 'tenant-1',
  rockId: 'rock-1',
  description: 'Diseñar el schema',
  dueDate: new Date('2026-08-15'),
  completedAt: null,
};

describe('MilestoneRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findAllForRock scopes by rockId and tenantId', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.milestone.findMany).mockResolvedValue([baseMilestone] as never);

    const { MilestoneRepository } = await import('./MilestoneRepository.js');
    const repo = new MilestoneRepository('tenant-1');
    const result = await repo.findAllForRock('rock-1');

    expect(prisma.milestone.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { rockId: 'rock-1', tenantId: 'tenant-1' } })
    );
    expect(result).toEqual([baseMilestone]);
  });

  it('create injects rockId and tenantId', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.milestone.create).mockResolvedValue(baseMilestone as never);

    const { MilestoneRepository } = await import('./MilestoneRepository.js');
    const repo = new MilestoneRepository('tenant-1');
    await repo.create('rock-1', { description: 'Diseñar el schema', dueDate: new Date('2026-08-15') });

    expect(prisma.milestone.create).toHaveBeenCalledWith({
      data: {
        description: 'Diseñar el schema',
        dueDate: new Date('2026-08-15'),
        rockId: 'rock-1',
        tenantId: 'tenant-1',
      },
    });
  });

  it('update returns null when no row matched tenant+id', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.milestone.updateMany).mockResolvedValue({ count: 0 });

    const { MilestoneRepository } = await import('./MilestoneRepository.js');
    const repo = new MilestoneRepository('tenant-1');
    const completedAtDate = new Date();
    const result = await repo.update('missing', { completedAt: completedAtDate });

    expect(prisma.milestone.updateMany).toHaveBeenCalledWith({
      where: { id: 'missing', tenantId: 'tenant-1' },
      data: { completedAt: completedAtDate },
    });
    expect(result).toBeNull();
  });

  it('update returns the fresh row when a row matched', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.milestone.updateMany).mockResolvedValue({ count: 1 });
    const completedAtDate = new Date('2026-08-01');
    const completed = { ...baseMilestone, completedAt: completedAtDate };
    vi.mocked(prisma.milestone.findFirst).mockResolvedValue(completed as never);

    const { MilestoneRepository } = await import('./MilestoneRepository.js');
    const repo = new MilestoneRepository('tenant-1');
    const result = await repo.update('milestone-1', { completedAt: completedAtDate });

    expect(prisma.milestone.updateMany).toHaveBeenCalledWith({
      where: { id: 'milestone-1', tenantId: 'tenant-1' },
      data: { completedAt: completedAtDate },
    });
    expect(prisma.milestone.findFirst).toHaveBeenCalledWith({
      where: { id: 'milestone-1', tenantId: 'tenant-1' },
    });
    expect(result).toEqual(completed);
  });

  it('delete scopes by tenantId and reports whether a row was removed', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.milestone.deleteMany).mockResolvedValue({ count: 1 });

    const { MilestoneRepository } = await import('./MilestoneRepository.js');
    const repo = new MilestoneRepository('tenant-1');
    const result = await repo.delete('milestone-1');

    expect(prisma.milestone.deleteMany).toHaveBeenCalledWith({
      where: { id: 'milestone-1', tenantId: 'tenant-1' },
    });
    expect(result).toBe(true);
  });

  it('delete returns false when no row matched tenant+id', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.milestone.deleteMany).mockResolvedValue({ count: 0 });

    const { MilestoneRepository } = await import('./MilestoneRepository.js');
    const repo = new MilestoneRepository('tenant-1');
    const result = await repo.delete('missing');

    expect(prisma.milestone.deleteMany).toHaveBeenCalledWith({
      where: { id: 'missing', tenantId: 'tenant-1' },
    });
    expect(result).toBe(false);
  });
});
