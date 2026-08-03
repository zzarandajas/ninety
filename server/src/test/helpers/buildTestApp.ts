import Fastify, { FastifyInstance, type FastifyRequest } from 'fastify';
import { vi } from 'vitest';
import jwtPlugin from '../../plugins/jwt.js';
import adminRoutes from '../../routes/admin.js';
import seatsRoutes from '../../routes/seats.js';
import { type PrismaClient } from '@prisma/client';
import { prisma as mockedPrisma } from '../../lib/prisma.js'; // Import the globally mocked prisma

interface BuildTestAppOptions {
  // No need for mockPrisma argument here, as it will use the globally mocked one
}

export async function buildTestApp(options?: BuildTestAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    disableRequestLogging: true,
    logger: false,
  });

  // Mock Fastify's authenticate decorator
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorate('authenticate', vi.fn(async (request: FastifyRequest) => {
    (request as any).user = { userId: 'user-1', role: 'owner', tenantId: 't-1' }; // Default test user
  }));

  await app.register(jwtPlugin);
  await app.register(adminRoutes, { prefix: '/admin' });
  await app.register(seatsRoutes); // Register seats routes

  // Decorate app with the globally mocked prisma (ensuring it's correctly typed for Fastify)
  app.decorate('prisma', mockedPrisma as unknown as PrismaClient);

  return app;
}
