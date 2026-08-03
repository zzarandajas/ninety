import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireTenant } from '../middleware/resolveTenantContext.js';
import { requireRole } from '../middleware/requireRole.js';
import { TenantMembershipRepository } from '../repositories/TenantMembershipRepository.js';
import { inviteUser } from '../services/inviteUser.js';
import { resetUserPassword } from '../services/resetPassword.js';
import { HttpError } from '../lib/httpError.js';
import { publishTenantEvent } from '../lib/redis.js';

const roleSchema = z.enum(['owner', 'admin', 'member']);

const inviteSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  role: roleSchema.default('member'),
});

const patchSchema = z.object({
  role: roleSchema.optional(),
  seatId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

const membershipIdParamsSchema = z.object({ id: z.string().uuid() });

const MANAGE_MEMBERS = ['owner', 'admin'] as const;

export default async function memberRoutes(app: FastifyInstance): Promise<void> {
  app.get('/members', { preHandler: requireTenant(app) }, async (request) => {
    const repo = new TenantMembershipRepository(request.tenantId!);
    return repo.findAll();
  });

  app.post(
    '/members/invite',
    { preHandler: [...requireTenant(app), requireRole([...MANAGE_MEMBERS])] },
    async (request, reply) => {
      const body = inviteSchema.parse(request.body);

      // Solo un owner puede otorgar el rol owner — evita que un admin se autopromocione.
      if (body.role === 'owner' && request.userRole !== 'owner') {
        return reply.code(403).send({ error: 'Only an owner can grant the owner role' });
      }

      const result = await inviteUser(request.tenantId!, body);
      await publishTenantEvent({
        type: 'member:invited',
        entity: 'member',
        action: 'created',
        tenantId: request.tenantId!,
        senderUserId: request.user.userId,
      });
      return reply.code(201).send(result);
    }
  );

  app.patch(
    '/members/:id',
    { preHandler: [...requireTenant(app), requireRole([...MANAGE_MEMBERS])] },
    async (request, reply) => {
      const { id } = membershipIdParamsSchema.parse(request.params);
      const body = patchSchema.parse(request.body);

      if (body.role === 'owner' && request.userRole !== 'owner') {
        return reply.code(403).send({ error: 'Only an owner can grant the owner role' });
      }

      const repo = new TenantMembershipRepository(request.tenantId!);

      if (body.seatId !== undefined) {
        await repo.assignSeat(id, body.seatId);
      }
      if (body.role !== undefined) {
        await repo.updateRole(id, body.role);
      }
      if (body.isActive !== undefined) {
        await repo.setActive(id, body.isActive);
      }

      const membership = await repo.findOne(id);
      if (!membership) throw new HttpError(404, 'Membership not found');

      await publishTenantEvent({
        type: 'member:updated',
        entity: 'member',
        action: 'updated',
        id: membership.id,
        tenantId: request.tenantId!,
        senderUserId: request.user.userId,
      });

      return membership;
    }
  );

  app.post(
    '/members/:id/reset-password',
    { preHandler: [...requireTenant(app), requireRole([...MANAGE_MEMBERS])] },
    async (request, reply) => {
      const { id } = membershipIdParamsSchema.parse(request.params);

      const repo = new TenantMembershipRepository(request.tenantId!);
      const membership = await repo.findOne(id);
      if (!membership) throw new HttpError(404, 'Membership not found');

      // Un admin no puede resetear la contraseña de un owner; solo el owner puede hacerlo.
      if (membership.role === 'owner' && request.userRole !== 'owner') {
        return reply.code(403).send({ error: 'Only an owner can reset an owner password' });
      }

      const result = await resetUserPassword(membership.userId);

      await publishTenantEvent({
        type: 'member:updated',
        entity: 'member',
        action: 'updated',
        id: membership.id,
        tenantId: request.tenantId!,
        senderUserId: request.user.userId,
      });

      return reply.send(result);
    }
  );
}
