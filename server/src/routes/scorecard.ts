import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireTenant } from '../middleware/resolveTenantContext.js';
import { ScorecardEntryRepository } from '../repositories/ScorecardEntryRepository.js';
import { ScorecardMetricRepository } from '../repositories/ScorecardMetricRepository.js';
import { publishTenantEvent } from '../lib/redis.js';
import { METRIC_CODE_PATTERN, normalizeCode, validateEntryImport, validateMetricImport } from '../lib/scorecardImport.js';
import { TenantMemberRepository } from '../repositories/TenantMemberRepository.js';

const comparisonSchema = z.enum(['gte', 'lte', 'eq']);
const frequencySchema = z.enum(['weekly', 'monthly']);
const codeSchema = z
  .string()
  .transform(normalizeCode)
  .refine((code) => code === '' || METRIC_CODE_PATTERN.test(code), {
    message: 'Código inválido: solo A-Z, 0-9, "_" y "-" (máx. 40)',
  })
  .transform((code) => (code === '' ? null : code));

const createMetricSchema = z.object({
  code: codeSchema.nullable().optional(),
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
  code: codeSchema.nullable().optional(),
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

// ~1 MB of CSV text; the JSON envelope needs a little headroom over Fastify's 1 MB default.
const MAX_IMPORT_CSV_LENGTH = 1_000_000;
const IMPORT_BODY_LIMIT = 2 * 1024 * 1024;

const importSchema = z.object({
  csv: z.string().min(1, 'El fichero está vacío').max(MAX_IMPORT_CSV_LENGTH, 'El fichero supera 1 MB'),
});

const metricImportSchema = importSchema.extend({
  ownerUserId: z.string().min(1).optional(),
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

  app.post('/metrics/import', { preHandler: requireTenant(app), bodyLimit: IMPORT_BODY_LIMIT }, async (request, reply) => {
    const { csv, ownerUserId } = metricImportSchema.parse(request.body);
    const tenantId = request.tenantId as string;
    const metricRepo = new ScorecardMetricRepository(tenantId);

    const [members, metrics] = await Promise.all([new TenantMemberRepository(tenantId).findAll(), metricRepo.findAll()]);
    // The default owner must be an active member of *this* tenant, never trusted from the body as-is.
    if (ownerUserId && !members.some((member) => member.userId === ownerUserId)) {
      return reply.code(400).send({ error: 'El responsable elegido no es miembro activo de esta organización' });
    }
    const result = validateMetricImport(csv, {
      memberIdByEmail: new Map(members.map((member) => [member.email.toLowerCase(), member.userId])),
      existingCodes: new Set(metrics.flatMap((metric) => (metric.code ? [metric.code] : []))),
      defaultOwnerUserId: ownerUserId,
    });
    if (!result.ok) {
      return reply.code(400).send({ error: 'El fichero tiene errores, no se ha importado nada', errors: result.errors });
    }

    const created = await metricRepo.createMany(result.rows, request.user.userId);
    await publishTenantEvent({
      type: 'ENTITY_CHANGED',
      entity: 'scorecard',
      action: 'create',
      id: 'import',
      tenantId,
      senderUserId: request.user.userId,
    });
    return reply.code(201).send({ created: created.length });
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

  app.post('/entries/import', { preHandler: requireTenant(app), bodyLimit: IMPORT_BODY_LIMIT }, async (request, reply) => {
    const { csv } = importSchema.parse(request.body);
    const tenantId = request.tenantId as string;

    const metrics = await new ScorecardMetricRepository(tenantId).findAll();
    const result = validateEntryImport(csv, {
      metricsByCode: new Map(
        metrics.flatMap((metric) => (metric.code ? [[metric.code, { id: metric.id, frequency: metric.frequency }] as const] : []))
      ),
    });
    if (!result.ok) {
      return reply.code(400).send({ error: 'El fichero tiene errores, no se ha importado nada', errors: result.errors });
    }

    const upserted = result.rows.length
      ? await new ScorecardEntryRepository(tenantId).upsertMany(result.rows, request.user.userId)
      : 0;
    if (upserted === 0) return { upserted, skipped: result.skipped };
    await publishTenantEvent({
      type: 'ENTITY_CHANGED',
      entity: 'scorecard',
      action: 'update',
      id: 'import',
      tenantId,
      senderUserId: request.user.userId,
    });
    return { upserted, skipped: result.skipped };
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
