import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireTenant } from '../middleware/resolveTenantContext.js';
import { L10AgendaItemLogRepository } from '../repositories/L10AgendaItemLogRepository.js';
import { L10MeetingRepository } from '../repositories/L10MeetingRepository.js';
import { publishTenantEvent } from '../lib/redis.js';
import { TenantMemberRepository } from '../repositories/TenantMemberRepository.js';
import { HttpError } from '../lib/httpError.js';

const meetingStatusEnum = z.enum(['scheduled', 'in_progress', 'completed']);
const agendaItemTypeEnum = z.enum(['rock_review', 'issue', 'todo']);

const createMeetingSchema = z.object({
  meetingDate: z.coerce.date(),
  facilitatorUserId: z.string().min(1),
});

const updateMeetingSchema = z.object({
  meetingDate: z.coerce.date().optional(),
  facilitatorUserId: z.string().min(1).optional(),
  status: meetingStatusEnum.optional(),
  segueNotes: z.string().nullable().optional(),
  headlines: z.string().nullable().optional(),
  timerStartedAt: z.coerce.date().nullable().optional(),
  timerAccumulatedSeconds: z.number().int().optional(),
  timerIsPaused: z.boolean().optional(),
  currentSectionId: z.string().nullable().optional(),
  currentSectionStartedAt: z.coerce.date().nullable().optional(),
  currentSectionAccumulatedSeconds: z.number().int().optional(),
  segueNotes: z.string().nullable().optional(),
  headlines: z.string().nullable().optional(),
  concludeNotes: z.string().nullable().optional(),
});

const closeMeetingSchema = z.object({
  concludeNotes: z.string().optional(),
});

const ratingSchema = z.object({
  rating: z.number().int().min(1).max(10),
  targetUserId: z.string().uuid().optional(),
});

const createAgendaItemSchema = z.object({
  itemType: agendaItemTypeEnum,
  referenceId: z.string().min(1),
  notes: z.string().optional(),
});

export default async function l10Routes(app: FastifyInstance): Promise<void> {
  app.get('/', { preHandler: requireTenant(app) }, async (request) => {
    const query = listMeetingsQuerySchema.parse(request.query);
    const repo = new L10MeetingRepository(request.tenantId as string);
    return repo.findAll(query);
  });

  app.post('/', { preHandler: requireTenant(app) }, async (request, reply) => {
    const body = createMeetingSchema.parse(request.body);
    const repo = new L10MeetingRepository(request.tenantId as string);
    const meeting = await repo.create(body, request.user.userId);
    await publishTenantEvent({
      type: 'ENTITY_CHANGED',
      entity: 'l10',
      action: 'create',
      id: meeting.id,
      tenantId: request.tenantId as string,
      senderUserId: request.user.userId,
    });
    return reply.code(201).send(meeting);
  });

  app.get('/:id', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const repo = new L10MeetingRepository(request.tenantId as string);
    const meeting = await repo.findByIdWithRatings(id);
    if (!meeting) return reply.code(404).send({ error: 'Meeting not found' });
    return meeting;
  });

  app.patch('/:id', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateMeetingSchema.parse(request.body);
    const repo = new L10MeetingRepository(request.tenantId as string);
    const meeting = await repo.update(id, body, request.user.userId);
    if (!meeting) return reply.code(404).send({ error: 'Meeting not found' });
    await publishTenantEvent({
      type: 'ENTITY_CHANGED',
      entity: 'l10',
      action: 'update',
      id: meeting.id,
      tenantId: request.tenantId as string,
      senderUserId: request.user.userId,
    });
    return meeting;
  });

  app.delete('/:id', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };

    // Comprobar rol de admin/owner
    const memberRepo = new TenantMemberRepository(request.tenantId as string);
    const members = await memberRepo.findAll();
    const currentUserRole = members.find((m) => m.userId === request.user.userId)?.role;
    if (currentUserRole !== 'admin' && currentUserRole !== 'owner') {
      return reply.code(403).send({ error: 'Permission denied' });
    }

    const repo = new L10MeetingRepository(request.tenantId as string);
    const deleted = await repo.delete(id);
    if (!deleted) return reply.code(404).send({ error: 'Meeting not found' });
    await publishTenantEvent({
      type: 'ENTITY_CHANGED',
      entity: 'l10',
      action: 'delete',
      id,
      tenantId: request.tenantId as string,
      senderUserId: request.user.userId,
    });
    return reply.code(204).send();
  });

  app.post('/:id/close', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = closeMeetingSchema.parse(request.body);
    const repo = new L10MeetingRepository(request.tenantId as string);
    const meeting = await repo.update(
      id,
      {
        status: 'completed',
        concludeNotes: body.concludeNotes,
      },
      request.user.userId
    );
    if (!meeting) return reply.code(404).send({ error: 'Meeting not found' });
    await publishTenantEvent({
      type: 'ENTITY_CHANGED',
      entity: 'l10',
      action: 'close',
      id: meeting.id,
      tenantId: request.tenantId as string,
      senderUserId: request.user.userId,
    });
    return meeting;
  });

  // ─────────────────────────────────────────────
  // RATINGS INDIVIDUALES
  // ─────────────────────────────────────────────

  // Obtener ratings de una reunión
  app.get('/:id/ratings', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const repo = new L10MeetingRepository(request.tenantId as string);
    const meeting = await repo.findById(id);
    if (!meeting) return reply.code(404).send({ error: 'Meeting not found' });
    return repo.getRatings(id);
  });

  // Añadir o actualizar el rating del usuario (propio o de otros si tiene permisos)
  app.post('/:id/ratings', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = ratingSchema.parse(request.body);
    const repo = new L10MeetingRepository(request.tenantId as string);
    const meeting = await repo.findById(id);
    if (!meeting) return reply.code(404).send({ error: 'Meeting not found' });

    const targetUserId = body.targetUserId ?? request.user.userId;

    // Si el usuario intenta calificar a otro, comprobar permisos
    if (targetUserId !== request.user.userId) {
      const memberRepo = new TenantMemberRepository(request.tenantId as string);
      const currentUserMembership = await memberRepo.findByUserId(request.user.userId);

      if (!currentUserMembership) {
        throw new HttpError(403, 'No tienes permiso para calificar a otros miembros');
      }

      const isFacilitator = meeting.facilitatorUserId === request.user.userId;
      const isAdminOrOwner = currentUserMembership.role === 'admin' || currentUserMembership.role === 'owner';

      if (!isFacilitator && !isAdminOrOwner) {
        throw new HttpError(403, 'Solo el facilitador o un administrador pueden calificar a otros miembros');
      }
    }
    
    const rating = await repo.upsertRating(id, targetUserId, body.rating);
    await publishTenantEvent({
      type: 'ENTITY_CHANGED',
      entity: 'l10',
      action: 'update',
      id,
      tenantId: request.tenantId as string,
      senderUserId: request.user.userId,
    });
    return reply.code(201).send(rating);
  });

  app.get('/:id/agenda-items', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const meetingRepo = new L10MeetingRepository(request.tenantId as string);
    const meeting = await meetingRepo.findById(id);
    if (!meeting) return reply.code(404).send({ error: 'Meeting not found' });
    const logRepo = new L10AgendaItemLogRepository(request.tenantId as string);
    return logRepo.findAllForMeeting(id);
  });

  app.post('/:id/agenda-items', { preHandler: requireTenant(app) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = createAgendaItemSchema.parse(request.body);
    const meetingRepo = new L10MeetingRepository(request.tenantId as string);
    const meeting = await meetingRepo.findById(id);
    if (!meeting) return reply.code(404).send({ error: 'Meeting not found' });
    const logRepo = new L10AgendaItemLogRepository(request.tenantId as string);
    const log = await logRepo.create(id, body);
    await publishTenantEvent({
      type: 'ENTITY_CHANGED',
      entity: 'l10',
      action: 'update',
      id,
      tenantId: request.tenantId as string,
      senderUserId: request.user.userId,
    });
    return reply.code(201).send(log);
  });
}
