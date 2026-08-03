import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { publishTenantEvent } from '../lib/redis.js';
import { requireTenant } from '../middleware/resolveTenantContext.js';
import { requireRole } from '../middleware/requireRole.js';
import { QuarterRepository } from '../repositories/QuarterRepository.js';

const labelSchema = z.string().regex(/^\d{4}-Q[1-4]$/, 'Formato de periodo inválido, usa YYYY-Qn');

const createQuarterSchema = z.object({
  label: labelSchema,
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  theme: z.string().nullable().optional(),
  rolloverFromLabel: labelSchema.optional(),
});

const updateQuarterSchema = z.object({
  theme: z.string().nullable().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  isOpen: z.boolean().optional(),
});

const idParamsSchema = z.object({ id: z.string().uuid() });

const MANAGE_PERIODS = ['owner', 'admin'] as const;

export default async function quarterRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', { preHandler: requireTenant(app) }, async (request) => {
    const repo = new QuarterRepository(request.tenantId as string);
    return repo.findAll();
  });

  app.post(
    '/',
    { preHandler: [...requireTenant(app), requireRole([...MANAGE_PERIODS])] },
    async (request, reply) => {
      const body = createQuarterSchema.parse(request.body);
      if (body.endDate <= body.startDate) {
        return reply.code(400).send({ error: 'La fecha de fin debe ser posterior a la de inicio' });
      }

      const repo = new QuarterRepository(request.tenantId as string);

      const existing = await repo.findByLabel(body.label);
      if (existing) {
        return reply.code(409).send({ error: `El periodo ${body.label} ya existe` });
      }

      if (body.rolloverFromLabel && body.rolloverFromLabel === body.label) {
        return reply.code(400).send({ error: 'No se puede arrastrar rocks hacia el mismo periodo' });
      }

      const { theme, rolloverFromLabel, ...createData } = body;
      const { quarter, movedRockCount } = await repo.create(
        { ...createData, ...(theme !== undefined ? { theme } : {}) },
        rolloverFromLabel
      );

      await publishTenantEvent({
        type: 'ENTITY_CHANGED',
        entity: 'quarter',
        action: 'create',
        id: quarter.id,
        tenantId: request.tenantId as string,
        senderUserId: request.user.userId,
      });

      return reply.code(201).send({ ...quarter, movedRockCount });
    }
  );

  app.patch(
    '/:id',
    { preHandler: [...requireTenant(app), requireRole([...MANAGE_PERIODS])] },
    async (request, reply) => {
      const { id } = idParamsSchema.parse(request.params);
      const body = updateQuarterSchema.parse(request.body);

      const repo = new QuarterRepository(request.tenantId as string);
      const existing = await repo.findById(id);
      if (!existing) return reply.code(404).send({ error: 'Periodo no encontrado' });

      const startDate = body.startDate ?? existing.startDate;
      const endDate = body.endDate ?? existing.endDate;
      if (endDate <= startDate) {
        return reply.code(400).send({ error: 'La fecha de fin debe ser posterior a la de inicio' });
      }

      const quarter = await repo.update(id, body);
      if (!quarter) return reply.code(404).send({ error: 'Periodo no encontrado' });

      await publishTenantEvent({
        type: 'ENTITY_CHANGED',
        entity: 'quarter',
        action: 'update',
        id: quarter.id,
        tenantId: request.tenantId as string,
        senderUserId: request.user.userId,
      });

      return quarter;
    }
  );
}
