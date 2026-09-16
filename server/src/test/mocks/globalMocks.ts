import { vi } from 'vitest';

// Define the global mock Prisma object with vi.fn() for all methods.
// Consumers must import this module (directly or transitively, e.g. via
// buildTestApp.js) before any route module that imports '../lib/prisma.js' —
// see the comment in test/helpers/buildTestApp.ts.
export const mockPrisma = {
  tenant: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  tenantMembership: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
  vTODocument: {
    create: vi.fn(),
  },
  seat: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
};

// Mock the actual Prisma client module to return our global mock object
vi.mock('../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));
