import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireTenant } from '../middleware/resolveTenantContext.js';
import { ScorecardEntryRepository } from '../repositories/ScorecardEntryRepository.js';
import { ScorecardMetricRepository } from '../repositories/ScorecardMetricRepository.js';
import { publishTenantEvent } from '../lib/redis.js';

const comparisonSchema = z.enum(['gte', 'lte', 'eq']);
const frequencySchema = z.enum(['weekly', 'monthly']);

const createMetricSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  ownerUserId: z.string().min(1),
  goalValue: z.number(),
  comparison: comparisonSchema,
  frequency: frequencySchema,
  unit: z.string().min(1),
  isActive: z.boolean().default(true),
});

const updateMetricSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  ownerUserId: z.string().min(1).optional(),
  goalValue: z.number().optional(),
  comparison: comparisonSchema.optional(),
  frequency: frequencySchema.optional(),
  unit: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

const listMetricsQuerySchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

const listEntriesQuerySchema = z.object({
  weeks: z.coerce.number().int().positive().default(12),
});

const upsertEntrySchema = z.object({
  metricId: z.string().min(1),
  periodStart: z.coerce.date(),
  actualValue: z.number(),
});

function weeksAgo(weeks: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - weeks * 7);
  return date;
}

export default async function scorecardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/metrics', { preHandler: requireTenant(app) }, async (request) => {
    const query = listMetricsQuerySchema.parse(request.query);
    const repo = new ScorecardMetricRepository(request.tenantId as string);
    return repo.findAll(query);
  });

  app.post('/metrics', { preHandler: requireTenant(app) }, async (request, reply) => {
    const body = createMetricSchema.parse(request.body);
    const repo = new ScorecardMetricRepository(request.tenantId as string);
    const metric = await repo.create(body, request.user.userId);
    await publishTenantEvent({
      type: 'ENTITY_CHANGED',
      entity: 'scorecard',
      action: 'create',
      id: metric.id,
      tenantId: request.tenantId as string,
      senderUserId: request.user.userId,
    });
    return reply.code(201).send(metric);
  });

  app.patch('/metrics/:id', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateMetricSchema.parse(request.body);
    const repo = new ScorecardMetricRepository(request.tenantId as string);
    const metric = await repo.update(id, body, request.user.userId);
    if (!metric) return reply.code(404).send({ error: 'Metric not found' });
    await publishTenantEvent({
      type: 'ENTITY_CHANGED',
      entity: 'scorecard',
      action: 'update',
      id: metric.id,
      tenantId: request.tenantId as string,
      senderUserId: request.user.userId,
    });
    return metric;
  });

  app.delete('/metrics/:id', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const repo = new ScorecardMetricRepository(request.tenantId as string);
    const deleted = await repo.delete(id);
    if (!deleted) return reply.code(404).send({ error: 'Metric not found' });
    await publishTenantEvent({
      type: 'ENTITY_CHANGED',
      entity: 'scorecard',
      action: 'delete',
      id,
      tenantId: request.tenantId as string,
      senderUserId: request.user.userId,
    });
    return reply.code(204).send();
  });

  app.get('/entries', { preHandler: requireTenant(app) }, async (request) => {
    const { weeks } = listEntriesQuerySchema.parse(request.query);
    const repo = new ScorecardEntryRepository(request.tenantId as string);
    return repo.findAllSince(weeksAgo(weeks));
  });

  app.put('/entries', { preHandler: requireTenant(app) }, async (request, reply) => {
    const body = upsertEntrySchema.parse(request.body);

    const metricRepo = new ScorecardMetricRepository(request.tenantId as string);
    const metric = await metricRepo.findById(body.metricId);
    if (!metric) return reply.code(404).send({ error: 'Metric not found' });

    const entryRepo = new ScorecardEntryRepository(request.tenantId as string);
    const entry = await entryRepo.upsert(body.metricId, body.periodStart, body.actualValue, request.user.userId);
    await publishTenantEvent({
      type: 'ENTITY_CHANGED',
      entity: 'scorecard',
      action: 'update',
      id: body.metricId,
      tenantId: request.tenantId as string,
      senderUserId: request.user.userId,
    });
    return entry;
  });
}
