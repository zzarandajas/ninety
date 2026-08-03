import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireTenant } from '../middleware/resolveTenantContext.js';
import { requireRole } from '../middleware/requireRole.js';
import { SeatRepository } from '../repositories/SeatRepository.js';
import { publishTenantEvent } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';

const seatInputSchema = z.object({
  name: z.string().min(1),
  parentSeatId: z.string().uuid().nullable().optional(),
  rolesAndResponsibilities: z.array(z.string()).optional(),
});

const seatUpdateSchema = seatInputSchema.partial();
const seatIdParamsSchema = z.object({ id: z.string().uuid() });

const MANAGE_SEATS = ['owner', 'admin'] as const;

export default async function seatRoutes(app: FastifyInstance): Promise<void> {
  app.get('/seats', { preHandler: requireTenant(app) }, async (request) => {
    const repo = new SeatRepository(request.tenantId!, prisma);
    return repo.findAll();
  });

  app.post(
    '/seats',
    { preHandler: [...requireTenant(app), requireRole([...MANAGE_SEATS])] },
    async (request, reply) => {
      const body = seatInputSchema.parse(request.body);
      const repo = new SeatRepository(request.tenantId!, prisma);
      const seat = await repo.create(body, request.user.userId);
      await publishTenantEvent({
        type: 'ENTITY_CHANGED',
        entity: 'seat',
        action: 'create',
        id: seat.id,
        tenantId: request.tenantId!,
        senderUserId: request.user.userId,
      });
      return reply.code(201).send(seat);
    }
  );

  // Reset debe ir ANTES de las rutas con :id para evitar conflictos
  app.post(
    '/seats/reset',
    { preHandler: [...requireTenant(app), requireRole([...MANAGE_SEATS])] },
    async (request) => {
      const repo = new SeatRepository(request.tenantId!, prisma);
      const seats = await repo.resetToDefault(request.user.userId);
      await publishTenantEvent({
        type: 'ENTITY_CHANGED',
        entity: 'seat',
        action: 'reset',
        id: request.tenantId!,
        tenantId: request.tenantId!,
        senderUserId: request.user.userId,
      });
      return seats;
    }
  );

  app.patch(
    '/seats/:id',
    { preHandler: [...requireTenant(app), requireRole([...MANAGE_SEATS])] },
    async (request) => {
      const { id } = seatIdParamsSchema.parse(request.params);
      const body = seatUpdateSchema.parse(request.body);
      const repo = new SeatRepository(request.tenantId!, prisma);
      const seat = await repo.update(id, body, request.user.userId);
      await publishTenantEvent({
        type: 'ENTITY_CHANGED',
        entity: 'seat',
        action: 'update',
        id: seat.id,
        tenantId: request.tenantId!,
        senderUserId: request.user.userId,
      });
      return seat;
    }
  );

  app.delete(
    '/seats/:id',
    { preHandler: [...requireTenant(app), requireRole([...MANAGE_SEATS])] },
    async (request, reply) => {
      const { id } = seatIdParamsSchema.parse(request.params);
      const repo = new SeatRepository(request.tenantId!, prisma);
      await repo.delete(id);
      await publishTenantEvent({
        type: 'ENTITY_CHANGED',
        entity: 'seat',
        action: 'delete',
        id,
        tenantId: request.tenantId!,
        senderUserId: request.user.userId,
      });
      return reply.code(204).send();
    }
  );
}
