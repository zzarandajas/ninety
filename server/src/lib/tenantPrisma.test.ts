import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./prisma.js', () => ({
  prisma: {
    $extends: vi.fn(),
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));

describe('forTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wraps every operation in a $transaction that sets app.current_tenant first', async () => {
    const { prisma } = await import('./prisma.js');
    let capturedAllOperations: ((ctx: { args: unknown; query: (args: unknown) => unknown }) => unknown) | undefined;
    vi.mocked(prisma.$extends).mockImplementation((config: unknown) => {
      capturedAllOperations = (
        config as { query: { $allModels: { $allOperations: typeof capturedAllOperations } } }
      ).query.$allModels.$allOperations;
      return prisma as never;
    });
    vi.mocked(prisma.$executeRaw).mockReturnValue('set-config-promise' as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([undefined, { id: 'rock-1' }]);

    const { forTenant } = await import('./tenantPrisma.js');
    forTenant('tenant-1');

    expect(capturedAllOperations).toBeDefined();
    const fakeQuery = vi.fn().mockReturnValue('the-query-promise');
    const result = await capturedAllOperations!({ args: { where: { id: 'rock-1' } }, query: fakeQuery });

    expect(prisma.$transaction).toHaveBeenCalledWith([
      expect.anything(),
      'the-query-promise',
    ]);
    expect(fakeQuery).toHaveBeenCalledWith({ where: { id: 'rock-1' } });
    expect(result).toEqual({ id: 'rock-1' });
  });
});
