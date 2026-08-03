import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { type PrismaClient } from '@prisma/client';
import { vi } from 'vitest';
import jwtPlugin from '../../plugins/jwt.js';
import adminRoutes from '../../routes/admin.js';

interface BuildMinimalAppOptions {
  mockPrisma: PrismaClient;
}

export async function buildMinimalApp(options: BuildMinimalAppOptions): Promise<FastifyInstance> {
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

  // Decorate app with mockPrisma
  app.decorate('prisma', options.mockPrisma);

  return app;
}
