import { prisma } from '../lib/prisma.js';
import { generateTemporaryPassword, hashPassword } from '../lib/password.js';
import { HttpError } from '../lib/httpError.js';

export interface ResetPasswordResult {
  userId: string;
  email: string;
  fullName: string;
  temporaryPassword: string;
  mustChangePassword: boolean;
}

/**
 * Genera una contraseña temporal para un usuario existente, la guarda
 * (hasheada) y marca `mustChangePassword` para forzar el cambio en el próximo
 * login. Devuelve la temporal una única vez para que el admin/owner pueda
 * entregarla al usuario.
 */
export async function resetUserPassword(userId: string): Promise<ResetPasswordResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, 'User not found');

  const temporaryPassword = generateTemporaryPassword();
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(temporaryPassword), mustChangePassword: true },
  });

  return {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    temporaryPassword,
    mustChangePassword: true,
  };
}
