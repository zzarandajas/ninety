import '../mocks/globalMocks.js'; // Registers vi.mock('../lib/prisma.js') before any route module (which imports it) loads below
import Fastify, { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
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

  // Same shape as app.ts's setErrorHandler, so HttpError/ZodError thrown by routes
  // surface their intended `{ error: message }` body instead of Fastify's generic
  // "Bad Request"/500 default.
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: error.issues.map((issue) => issue.message).join(', ') });
    }
    const statusCode = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    if (statusCode >= 500) {
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
    return reply.code(statusCode).send({ error: error.message });
  });

  await app.register(jwtPlugin);
  await app.register(adminRoutes, { prefix: '/admin' });
  await app.register(seatsRoutes); // Register seats routes

  // Decorate app with the globally mocked prisma (ensuring it's correctly typed for Fastify)
  app.decorate('prisma', mockedPrisma as unknown as PrismaClient);

  return app;
}
