import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { HttpError } from '../lib/httpError.js';
import { prisma } from '../lib/prisma.js';
import { requireTenant } from '../middleware/resolveTenantContext.js';
import { requireRole } from '../middleware/requireRole.js';
import { getMemberships, toPublicUser } from './auth.js';

/**
 * "Modo dios": herramienta de pruebas exclusiva de owners. Permite simular la
 * sesión de cualquier usuario firmando un JWT para ese usuario.
 *
 * Seguridad:
 * - Solo `owner` (del tenant activo) puede usarla.
 * - Un token que YA es una impersonación no puede abrir otra (guard
 *   `request.user.imp`), así que nunca se pueden encadenar suplantaciones.
 */
const impersonateBodySchema = z.object({ userId: z.string().uuid() });

export default async function impersonateRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/impersonate/users',
    { preHandler: [...requireTenant(app), requireRole(['owner'])] },
    async (request) => {
      if (request.user.imp) throw new HttpError(403, 'Cannot impersonate while impersonating');

      const users = await prisma.user.findMany({
        where: { memberships: { some: { isActive: true } } },
        select: {
          id: true,
          fullName: true,
          email: true,
          avatarUrl: true,
          memberships: {
            where: { isActive: true },
            select: {
              tenantId: true,
              role: true,
              tenant: { select: { name: true } },
            },
            orderBy: { tenant: { name: 'asc' } },
          },
        },
        orderBy: { fullName: 'asc' },
      });

      return users.map((user) => ({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        memberships: user.memberships.map((membership) => ({
          tenantId: membership.tenantId,
          tenantName: membership.tenant.name,
          role: membership.role,
        })),
      }));
    }
  );

  app.post(
    '/impersonate',
    { preHandler: [...requireTenant(app), requireRole(['owner'])] },
    async (request, reply) => {
      if (request.user.imp) throw new HttpError(403, 'Cannot impersonate while impersonating');

      const { userId } = impersonateBodySchema.parse(request.body);

      const target = await prisma.user.findUnique({ where: { id: userId } });
      if (!target) throw new HttpError(404, 'User not found');

      const activeMemberships = await prisma.tenantMembership.count({
        where: { userId, isActive: true },
      });
      if (activeMemberships === 0) {
        throw new HttpError(400, 'The user has no active tenant memberships');
      }

      const token = app.jwt.sign({ userId, imp: request.user.userId });
      const memberships = await getMemberships(userId);

      return reply.send({ token, user: toPublicUser(target), memberships });
    }
  );
}
