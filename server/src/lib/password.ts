import crypto from 'node:crypto';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function isStrongPassword(plain: string): boolean {
  return plain.length >= 10 && /[a-zA-Z]/.test(plain) && /[0-9]/.test(plain);
}

// Prefijo/sufijo fijos garantizan que pase `isStrongPassword` (letra + dígito)
// sin depender de qué caracteres caigan al azar en el bloque aleatorio.
export function generateTemporaryPassword(): string {
  const random = crypto.randomBytes(12).toString('base64url');
  return `Xk${random}7`;
}
