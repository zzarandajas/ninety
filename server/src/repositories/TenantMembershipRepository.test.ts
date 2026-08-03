import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    tenantMembership: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    seat: {
      findFirst: vi.fn(),
    },
  },
}));

describe('TenantMembershipRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findAll scopes the query to its own tenant only', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findMany).mockResolvedValue([] as never);

    const { TenantMembershipRepository } = await import('./TenantMembershipRepository.js');
    await new TenantMembershipRepository('tasvalor').findAll();

    expect(prisma.tenantMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tasvalor' } })
    );
  });

  it('assignSeat rejects a seat that belongs to a different tenant', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue({ id: 'mem-1', tenantId: 'tasvalor' } as never);
    vi.mocked(prisma.seat.findFirst).mockResolvedValue(null); // seat not found for this tenant

    const { TenantMembershipRepository } = await import('./TenantMembershipRepository.js');
    await expect(new TenantMembershipRepository('tasvalor').assignSeat('mem-1', 'seat-from-cionet')).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(prisma.tenantMembership.update).not.toHaveBeenCalled();
  });

  it('assignSeat rejects a seat that already has a different active occupant', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findFirst)
      .mockResolvedValueOnce({ id: 'mem-2', tenantId: 'tasvalor' } as never) // findOrThrow(membershipId)
      .mockResolvedValueOnce({ id: 'mem-1', seatId: 'seat-1', isActive: true } as never); // occupiedBy check
    vi.mocked(prisma.seat.findFirst).mockResolvedValue({ id: 'seat-1', tenantId: 'tasvalor' } as never);

    const { TenantMembershipRepository } = await import('./TenantMembershipRepository.js');
    await expect(new TenantMembershipRepository('tasvalor').assignSeat('mem-2', 'seat-1')).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(prisma.tenantMembership.update).not.toHaveBeenCalled();
  });

  it('assignSeat allows re-assigning the same seat to its current occupant (no self-conflict)', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findFirst)
      .mockResolvedValueOnce({ id: 'mem-1', tenantId: 'tasvalor' } as never) // findOrThrow
      .mockResolvedValueOnce(null); // occupiedBy excludes id:{not: membershipId} -> nobody else
    vi.mocked(prisma.seat.findFirst).mockResolvedValue({ id: 'seat-1', tenantId: 'tasvalor' } as never);
    vi.mocked(prisma.tenantMembership.update).mockResolvedValue({} as never);

    const { TenantMembershipRepository } = await import('./TenantMembershipRepository.js');
    await new TenantMembershipRepository('tasvalor').assignSeat('mem-1', 'seat-1');

    expect(prisma.tenantMembership.update).toHaveBeenCalledWith({ where: { id: 'mem-1' }, data: { seatId: 'seat-1' } });
  });

  it('setActive(false) also clears seatId so the seat becomes available again', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue({ id: 'mem-1', tenantId: 'tasvalor' } as never);
    vi.mocked(prisma.tenantMembership.update).mockResolvedValue({} as never);

    const { TenantMembershipRepository } = await import('./TenantMembershipRepository.js');
    await new TenantMembershipRepository('tasvalor').setActive('mem-1', false);

    expect(prisma.tenantMembership.update).toHaveBeenCalledWith({
      where: { id: 'mem-1' },
      data: { isActive: false, seatId: null },
    });
  });

  it('create rejects when the user already has an active membership in this tenant', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue({ id: 'mem-1', isActive: true } as never);

    const { TenantMembershipRepository } = await import('./TenantMembershipRepository.js');
    await expect(new TenantMembershipRepository('tasvalor').create('user-1', 'member')).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(prisma.tenantMembership.create).not.toHaveBeenCalled();
  });

  it('create reactivates a previously deactivated membership instead of duplicating it', async () => {
    const { prisma } = await import('../lib/prisma.js');
    vi.mocked(prisma.tenantMembership.findUnique).mockResolvedValue({ id: 'mem-1', isActive: false } as never);
    vi.mocked(prisma.tenantMembership.update).mockResolvedValue({} as never);

    const { TenantMembershipRepository } = await import('./TenantMembershipRepository.js');
    await new TenantMembershipRepository('tasvalor').create('user-1', 'admin');

    expect(prisma.tenantMembership.update).toHaveBeenCalledWith({
      where: { id: 'mem-1' },
      data: { isActive: true, role: 'admin' },
    });
    expect(prisma.tenantMembership.create).not.toHaveBeenCalled();
  });
});
