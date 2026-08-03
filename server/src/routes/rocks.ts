import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireTenant } from '../middleware/resolveTenantContext.js';
import { MilestoneRepository } from '../repositories/MilestoneRepository.js';
import { RockRepository } from '../repositories/RockRepository.js';
import { publishTenantEvent } from '../lib/redis.js';

const quarterSchema = z.string().regex(/^\d{4}-Q[1-4]$/, 'Formato de trimestre inválido, usa YYYY-Qn');

const createRockSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  ownerUserId: z.string().min(1),
  quarter: quarterSchema,
  isCompanyRock: z.boolean().default(false),
  dueDate: z.coerce.date(),
});

const updateRockSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  ownerUserId: z.string().min(1).optional(),
  quarter: quarterSchema.optional(),
  isCompanyRock: z.boolean().optional(),
  status: z.enum(['on_track', 'off_track', 'done']).optional(),
  dueDate: z.coerce.date().optional(),
});

const listRocksQuerySchema = z.object({
  quarter: z.string().optional(),
  ownerUserId: z.string().optional(),
});

const createMilestoneSchema = z.object({
  description: z.string().min(1),
  dueDate: z.coerce.date(),
});

const updateMilestoneSchema = z.object({
  description: z.string().min(1).optional(),
  dueDate: z.coerce.date().optional(),
  completed: z.boolean().optional(),
});

export default async function rockRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', { preHandler: requireTenant(app) }, async (request) => {
    const query = listRocksQuerySchema.parse(request.query);
    const repo = new RockRepository(request.tenantId as string);
    return repo.findAll(query);
  });

  app.post('/', { preHandler: requireTenant(app) }, async (request, reply) => {
    const body = createRockSchema.parse(request.body);
    const repo = new RockRepository(request.tenantId as string);
    const rock = await repo.create(body, request.user.userId);
    await publishTenantEvent({
      type: 'ENTITY_CHANGED',
      entity: 'rock',
      action: 'create',
      id: rock.id,
      tenantId: request.tenantId as string,
      senderUserId: request.user.userId,
    });
    return reply.code(201).send(rock);
  });

  app.get('/:id', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const repo = new RockRepository(request.tenantId as string);
    const rock = await repo.findById(id);
    if (!rock) return reply.code(404).send({ error: 'Rock not found' });
    return rock;
  });

  app.patch('/:id', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateRockSchema.parse(request.body);
    const repo = new RockRepository(request.tenantId as string);
    const rock = await repo.update(id, body, request.user.userId);
    if (!rock) return reply.code(404).send({ error: 'Rock not found' });
    await publishTenantEvent({
      type: 'ENTITY_CHANGED',
      entity: 'rock',
      action: 'update',
      id: rock.id,
      tenantId: request.tenantId as string,
      senderUserId: request.user.userId,
    });
    return rock;
  });

  app.delete('/:id', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const repo = new RockRepository(request.tenantId as string);
    const deleted = await repo.delete(id);
    if (!deleted) return reply.code(404).send({ error: 'Rock not found' });
    await publishTenantEvent({
      type: 'ENTITY_CHANGED',
      entity: 'rock',
      action: 'delete',
      id,
      tenantId: request.tenantId as string,
      senderUserId: request.user.userId,
    });
    return reply.code(204).send();
  });

  app.post('/:rockId/milestones', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { rockId } = request.params as { rockId: string };
    const body = createMilestoneSchema.parse(request.body);

    const rockRepo = new RockRepository(request.tenantId as string);
    const rock = await rockRepo.findById(rockId);
    if (!rock) return reply.code(404).send({ error: 'Rock not found' });

    const milestoneRepo = new MilestoneRepository(request.tenantId as string);
    const milestone = await milestoneRepo.create(rockId, body);
    await publishTenantEvent({
      type: 'ENTITY_CHANGED',
      entity: 'rock',
      action: 'update',
      id: rockId,
      tenantId: request.tenantId as string,
      senderUserId: request.user.userId,
    });
    return reply.code(201).send(milestone);
  });

  app.patch('/:rockId/milestones/:id', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { rockId, id } = request.params as { rockId: string; id: string };
    const { completed, ...rest } = updateMilestoneSchema.parse(request.body);

    const milestoneRepo = new MilestoneRepository(request.tenantId as string);
    const milestone = await milestoneRepo.update(id, {
      ...rest,
      ...(completed === undefined ? {} : { completedAt: completed ? new Date() : null }),
    });
    if (!milestone) return reply.code(404).send({ error: 'Milestone not found' });
    await publishTenantEvent({
      type: 'ENTITY_CHANGED',
      entity: 'rock',
      action: 'update',
      id: rockId,
      tenantId: request.tenantId as string,
      senderUserId: request.user.userId,
    });
    return milestone;
  });

  app.delete('/:rockId/milestones/:id', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { rockId, id } = request.params as { rockId: string; id: string };
    const milestoneRepo = new MilestoneRepository(request.tenantId as string);
    const deleted = await milestoneRepo.delete(id);
    if (!deleted) return reply.code(404).send({ error: 'Milestone not found' });
    await publishTenantEvent({
      type: 'ENTITY_CHANGED',
      entity: 'rock',
      action: 'update',
      id: rockId,
      tenantId: request.tenantId as string,
      senderUserId: request.user.userId,
    });
    return reply.code(204).send();
  });
}
