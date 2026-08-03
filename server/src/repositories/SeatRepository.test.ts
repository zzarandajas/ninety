import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

const createMockPrisma = () => ({
  seat: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  tenantMembership: {
    count: vi.fn(),
  },
});

describe('SeatRepository', () => {
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    vi.mock('../lib/prisma.js', () => ({ prisma }));
  });

  // Test: findAll scopes the query to its own tenant only
  it('findAll scopes the query to its own tenant only', async () => {
    prisma.seat.findMany.mockResolvedValue([] as never);

    const { SeatRepository } = await import('./SeatRepository.js');
    await new SeatRepository('tasvalor', prisma as unknown as PrismaClient).findAll();

    expect(prisma.seat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tasvalor' } })
    );
  });

  // Test: create rejects a parentSeatId that belongs to a different tenant
  it('create rejects a parentSeatId that belongs to a different tenant', async () => {
    prisma.seat.findFirst.mockResolvedValue(null); // cross-tenant lookup misses

    const { SeatRepository } = await import('./SeatRepository.js');
    const repo = new SeatRepository('tasvalor', prisma as unknown as PrismaClient);

    await expect(repo.create({ name: 'Ventas', parentSeatId: 'seat-from-cionet' }, 'user-1')).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(prisma.seat.create).not.toHaveBeenCalled();
  });

  // Test: create scopes the new row to the repository tenantId regardless of input
  it('create scopes the new row to the repository tenantId regardless of input', async () => {
    prisma.seat.create.mockResolvedValue({ id: 'seat-1' } as never);

    const { SeatRepository } = await import('./SeatRepository.js');
    await new SeatRepository('tasvalor', prisma as unknown as PrismaClient).create({ name: 'CEO' }, 'user-1');

    expect(prisma.seat.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tasvalor',
        name: 'CEO',
        parentSeatId: null,
        rolesAndResponsibilities: [],
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1',
      },
    });
  });

  // Test: update rejects moving a seat under one of its own descendants (cycle)
  it('update rejects moving a seat under one of its own descendants (cycle)', async () => {
    // seat-1 exists; seat-2's parent is seat-1 (so seat-2 is a child of seat-1)
    prisma.seat.findFirst.mockImplementation((async (args: {
      where: { id: string; tenantId: string };
      select?: { parentSeatId: true };
    }) => {
      if (args.where.id === 'seat-1') return { id: 'seat-1', tenantId: 'tasvalor', parentSeatId: null };
      if (args.where.id === 'seat-2') return { parentSeatId: 'seat-1' };
      return null;
    }) as never);

    const { SeatRepository } = await import('./SeatRepository.js');
    const repo = new SeatRepository('tasvalor', prisma as unknown as PrismaClient);

    await expect(repo.update('seat-1', { parentSeatId: 'seat-2' }, 'user-1')).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(prisma.seat.update).not.toHaveBeenCalled();
  });

  // Test: delete blocks when the seat has child seats
  it('delete blocks when the seat has child seats', async () => {
    prisma.seat.findFirst.mockResolvedValue({ id: 'seat-1', tenantId: 'tasvalor' } as never);
    prisma.seat.count.mockResolvedValue(2 as never);

    const { SeatRepository } = await import('./SeatRepository.js');
    await expect(new SeatRepository('tasvalor', prisma as unknown as PrismaClient).delete('seat-1')).rejects.toMatchObject({ statusCode: 409 });
    expect(prisma.seat.delete).not.toHaveBeenCalled();
  });

  // Test: delete blocks when the seat has an active occupant
  it('delete blocks when the seat has an active occupant', async () => {
    prisma.seat.findFirst.mockResolvedValue({ id: 'seat-1', tenantId: 'tasvalor' } as never);
    prisma.seat.count.mockResolvedValue(0 as never);
    prisma.tenantMembership.count.mockResolvedValue(1 as never);

    const { SeatRepository } = await import('./SeatRepository.js');
    await expect(new SeatRepository('tasvalor', prisma as unknown as PrismaClient).delete('seat-1')).rejects.toMatchObject({ statusCode: 409 });
    expect(prisma.seat.delete).not.toHaveBeenCalled();
  });

  // Test: delete succeeds when there are no children and no active occupant
  it('delete succeeds when there are no children and no active occupant', async () => {
    prisma.seat.findFirst.mockResolvedValue({ id: 'seat-1', tenantId: 'tasvalor' } as never);
    prisma.seat.count.mockResolvedValue(0 as never);
    prisma.tenantMembership.count.mockResolvedValue(0 as never);
    prisma.seat.delete.mockResolvedValue({} as never);

    const { SeatRepository } = await import('./SeatRepository.js');
    await new SeatRepository('tasvalor', prisma as unknown as PrismaClient).delete('seat-1');

    expect(prisma.seat.delete).toHaveBeenCalledWith({ where: { id_tenantId: { id: 'seat-1', tenantId: 'tasvalor' } } });
  });

  // Test: update throws 404 for a seat id that does not belong to this tenant
  it('update throws 404 for a seat id that does not belong to this tenant', async () => {
    prisma.seat.findFirst.mockResolvedValue(null); // not found for this tenant

    const { SeatRepository } = await import('./SeatRepository.js');
    await expect(
      new SeatRepository('tasvalor', prisma as unknown as PrismaClient).update('seat-from-cionet', { name: 'x' }, 'user-1')
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  // Test: update sets updatedByUserId on the row
  it('update sets updatedByUserId on the row', async () => {
    prisma.seat.findFirst.mockResolvedValue({
      id: 'seat-1',
      tenantId: 'tasvalor',
      parentSeatId: null,
    } as never);
    prisma.seat.update.mockResolvedValue({ id: 'seat-1', name: 'Renombrado' } as never);

    const { SeatRepository } = await import('./SeatRepository.js');
    await new SeatRepository('tasvalor', prisma as unknown as PrismaClient).update('seat-1', { name: 'Renombrado' }, 'user-2');

    expect(prisma.seat.update).toHaveBeenCalledWith({
      where: { id_tenantId: { id: 'seat-1', tenantId: 'tasvalor' } },
      data: { name: 'Renombrado', updatedByUserId: 'user-2' },
    });
  });
});
