import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { prisma } from '../lib/prisma.js';

export async function resolveTenantContext(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // Defensa en profundidad: este middleware asume que `app.authenticate` ya corrió y
  // dejó `request.user`. Si alguien lo registra suelto, fallamos cerrado con 401 en
  // vez de reventar con `undefined.userId`.
  if (!request.user?.userId) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  const tenantId = request.headers['x-tenant-id'];

  if (!tenantId || typeof tenantId !== 'string') {
    reply.code(400).send({ error: 'Missing X-Tenant-Id header' });
    return;
  }

  const membership = await prisma.tenantMembership.findUnique({
    where: { userId_tenantId: { userId: request.user.userId, tenantId } },
  });

  if (!membership || membership.isActive === false) {
    reply.code(403).send({ error: 'No access to this tenant' });
    return;
  }

  request.tenantId = membership.tenantId;
  request.userRole = membership.role;
}

/**
 * Cadena de preHandlers para cualquier ruta de negocio con scope de tenant.
 * Usar siempre esto en vez de registrar `resolveTenantContext` a mano: así es
 * imposible olvidarse de `app.authenticate` y dejar la ruta medio cableada.
 *
 *   app.get('/rocks', { preHandler: requireTenant(app) }, handler)
 */
export function requireTenant(app: FastifyInstance): preHandlerHookHandler[] {
  return [app.authenticate as preHandlerHookHandler, resolveTenantContext as preHandlerHookHandler];
}
