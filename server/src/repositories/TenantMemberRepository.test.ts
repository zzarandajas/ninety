import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    tenantMembership: {
      findMany: vi.fn(),
    },
  },
}));

describe('TenantMemberRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findAll scopes by tenantId and maps to userId/fullName/email/avatarUrl', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findMany).mockResolvedValue([
      {
        id: 'mem-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'owner',
        seatId: null,
        user: { id: 'user-1', fullName: 'Pablo', email: 'correopro@gmail.com', avatarUrl: '/uploads/avatars/user-1.jpg' },
      },
    ] as never);

    const { TenantMemberRepository } = await import('./TenantMemberRepository.js');
    const repo = new TenantMemberRepository('tenant-1');
    const members = await repo.findAll();

    expect(prisma.tenantMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1', isActive: true } })
    );
    expect(members).toEqual([
      { userId: 'user-1', fullName: 'Pablo', email: 'correopro@gmail.com', avatarUrl: '/uploads/avatars/user-1.jpg', role: 'owner' },
    ]);
  });
});
