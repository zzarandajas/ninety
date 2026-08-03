import type { TenantRole } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { generateTemporaryPassword, hashPassword } from '../lib/password.js';
import { TenantMembershipRepository } from '../repositories/TenantMembershipRepository.js';

export interface InviteUserInput {
  email: string;
  fullName: string;
  role: TenantRole;
}

export interface InviteUserResult {
  membershipId: string;
  userId: string;
  email: string;
  fullName: string;
  role: TenantRole;
  /** null si el usuario ya existía en el sistema: no se toca su password, solo se le añade el tenant. */
  temporaryPassword: string | null;
}

// Prefijo/sufijo fijos garantizan que pase `isStrongPassword` (letra + dígito)
// sin depender de qué caracteres caigan al azar en el bloque aleatorio.

/**
 * Orquesta la creación de User + TenantMembership. Vive fuera de los
 * repositorios tenant-aware porque cruza el límite de tenant: `User` es
 * global (un email puede pertenecer a Tasvalor y Cionet a la vez).
 */
export async function inviteUser(tenantId: string, input: InviteUserInput): Promise<InviteUserResult> {
  const membershipRepo = new TenantMembershipRepository(tenantId);

  let user = await prisma.user.findUnique({ where: { email: input.email } });
  let temporaryPassword: string | null = null;

  if (!user) {
    temporaryPassword = generateTemporaryPassword();
    user = await prisma.user.create({
      data: {
        email: input.email,
        fullName: input.fullName,
        passwordHash: await hashPassword(temporaryPassword),
        mustChangePassword: true,
      },
    });
  }

  const membership = await membershipRepo.create(user.id, input.role);

  return {
    membershipId: membership.id,
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    role: membership.role,
    temporaryPassword,
  };
}
