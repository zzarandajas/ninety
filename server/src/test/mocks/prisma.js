import { vi } from 'vitest';

export const createMockPrisma = () => ({
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
