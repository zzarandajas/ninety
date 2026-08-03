import { prisma } from './prisma.js';

/**
 * Cliente de Prisma con RLS: fija `app.current_tenant` en la misma conexión que la query
 * siguiente (mismo patrón que el cookbook oficial de Prisma para RLS — un `$transaction`
 * en modo array garantiza que ambas queries del array se ejecutan en la misma conexión).
 *
 * NO USAR TODAVÍA — ningún repositorio importa esto. Ver
 * docs/superpowers/plans/2026-08-01-sprint7-hardening.md, "Decisiones de diseño", punto 2,
 * y server/prisma/rls/enable-rls.sql antes de conectarlo a un repositorio real.
 */
export function forTenant(tenantId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, TRUE)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}
