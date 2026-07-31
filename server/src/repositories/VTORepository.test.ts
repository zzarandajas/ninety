import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    vTODocument: {
      upsert: vi.fn(),
    },
  },
}));

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

describe('VTORepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findOrCreate upserts on tenantId with an empty document as the create branch', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.vTODocument.upsert).mockResolvedValue(baseDoc as never);

    const { VTORepository } = await import('./VTORepository.js');
    const repo = new VTORepository('tenant-1');
    const result = await repo.findOrCreate();

    expect(prisma.vTODocument.upsert).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      update: {},
      create: {
        tenantId: 'tenant-1',
        coreValues: [],
        marketingStrategy: {},
        threeYearPicture: {},
        oneYearPlan: {},
      },
    });
    expect(result).toEqual(baseDoc);
  });

  it('update upserts with the partial data and injects updatedByUserId', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.vTODocument.upsert).mockResolvedValue({
      ...baseDoc,
      coreFocusPurpose: 'Ayudar a pymes a ejecutar',
      updatedByUserId: 'user-1',
    } as never);

    const { VTORepository } = await import('./VTORepository.js');
    const repo = new VTORepository('tenant-1');
    const result = await repo.update({ coreFocusPurpose: 'Ayudar a pymes a ejecutar' }, 'user-1');

    expect(prisma.vTODocument.upsert).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      update: { coreFocusPurpose: 'Ayudar a pymes a ejecutar', updatedByUserId: 'user-1' },
      create: {
        tenantId: 'tenant-1',
        coreFocusPurpose: 'Ayudar a pymes a ejecutar',
        updatedByUserId: 'user-1',
      },
    });
    expect(result.coreFocusPurpose).toBe('Ayudar a pymes a ejecutar');
  });

  it('update with a Json field forwards it verbatim to Prisma', async () => {
    const { prisma } = await import('../lib/prisma.js');
    const oneYearPlan = { revenue: '1M', companyRockIds: ['rock-1', 'rock-2'] };
    vi.mocked(prisma.vTODocument.upsert).mockResolvedValue({ ...baseDoc, oneYearPlan } as never);

    const { VTORepository } = await import('./VTORepository.js');
    const repo = new VTORepository('tenant-1');
    await repo.update({ oneYearPlan }, 'user-1');

    expect(prisma.vTODocument.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ oneYearPlan, updatedByUserId: 'user-1' }),
      })
    );
  });
});
