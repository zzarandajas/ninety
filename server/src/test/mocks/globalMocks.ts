import { vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import jwtPlugin from '../../plugins/jwt.js';
import adminRoutes from '../../routes/admin.js';
import seatsRoutes from '../../routes/seats.js';
import { type PrismaClient } from '@prisma/client';

// Define the global mock Prisma object with vi.fn() for all methods
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
    count: vi.fn(),
  },
};

// Mock the actual Prisma client module to return our global mock object
vi.mock('../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

// Helper function to build a minimal Fastify app for tests
// Note: buildTestApp is NOT mocked globally here. It will be imported by tests directly
// to ensure the app.decorate('prisma', mockPrisma) gets the same mockPrisma instance.
export async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({
    disableRequestLogging: true,
    logger: false,
  });

  // Mock Fastify's authenticate decorator
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorate('authenticate', vi.fn(async (request) => {
    request.user = { userId: 'user-1', role: 'owner', tenantId: 't-1' }; // Default test user
  }));

  await app.register(jwtPlugin);
  await app.register(adminRoutes, { prefix: '/admin' });
  await app.register(seatsRoutes); // Register seats routes

  // Decorate app with the globally mocked prisma (ensuring it's correctly typed for Fastify)
  app.decorate('prisma', mockPrisma as unknown as PrismaClient);

  return app;
}
