import type { FastifyReply, FastifyRequest } from 'fastify';
import type { TenantRole } from '@prisma/client';

/**
 * Debe ir en la cadena de preHandlers DESPUÉS de `requireTenant`, que es quien
 * deja `request.userRole` seteado. Usarlo suelto (sin requireTenant antes)
 * siempre falla cerrado con 403 en vez de asumir un rol.
 */
export function requireRole(allowedRoles: TenantRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.userRole || !allowedRoles.includes(request.userRole)) {
      reply.code(403).send({ error: 'Insufficient role for this action' });
    }
  };
}
