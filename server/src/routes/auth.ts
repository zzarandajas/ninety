import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { hashPassword, isStrongPassword, verifyPassword } from '../lib/password.js';
import { prisma } from '../lib/prisma.js';

// No hay auto-registro público: esta es una herramienta interna privada. Los usuarios
// se crean con `prisma/seed.ts` o, a partir del Sprint 1, con un flujo de invitación
// hecho por un admin.
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
});

const updateProfileSchema = z.object({
  fullName: z.string().min(1).optional(),
});

// Constant-time-ish guard against user-enumeration via login timing: always run a
// bcrypt compare even when the user doesn't exist, so a nonexistent email and a
// wrong password take comparable time.
const DUMMY_HASH_PROMISE = hashPassword('not-a-real-password-just-for-timing-parity');

export function toPublicUser(user: {
  id: string;
  email: string;
  fullName: string;
  mustChangePassword: boolean;
  avatarUrl: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    mustChangePassword: user.mustChangePassword,
    avatarUrl: user.avatarUrl,
  };
}

export async function getMemberships(userId: string) {
  const memberships = await prisma.tenantMembership.findMany({
    where: { userId, isActive: true },
    include: { tenant: true },
  });

  return memberships.map((membership) => ({
    tenantId: membership.tenantId,
    tenantName: membership.tenant.name,
    tenantSlug: membership.tenant.slug,
    role: membership.role,
    logoUrl: membership.tenant.logoUrl,
    isotypeUrl: membership.tenant.isotypeUrl,
    bgColor: membership.tenant.bgColor,
    accentColor: membership.tenant.accentColor,
  }));
}

export default async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    const passwordValid = user
      ? await verifyPassword(body.password, user.passwordHash)
      : await verifyPassword(body.password, await DUMMY_HASH_PROMISE).then(() => false);

    if (!user || !passwordValid) {
      return reply.code(401).send({ error: 'Invalid email or password' });
    }

    const token = app.jwt.sign({ userId: user.id });
    const memberships = await getMemberships(user.id);

    return reply.send({ token, user: toPublicUser(user), memberships });
  });

  app.get('/me', { preHandler: app.authenticate }, async (request) => {
    const user = await prisma.user.findUnique({ where: { id: request.user.userId } });
    const memberships = await getMemberships(request.user.userId);
    return { user: user && toPublicUser(user), memberships };
  });

  app.patch('/me', { preHandler: app.authenticate }, async (request, reply) => {
    const body = updateProfileSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { id: request.user.userId } });
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(body.fullName ? { fullName: body.fullName } : {}),
      },
    });

    const memberships = await getMemberships(updated.id);
    return reply.send({ user: toPublicUser(updated), memberships });
  });

  app.post('/change-password', { preHandler: app.authenticate }, async (request, reply) => {
    const body = changePasswordSchema.parse(request.body);

    const user = await prisma.user.findUnique({ where: { id: request.user.userId } });
    if (!user || !(await verifyPassword(body.currentPassword, user.passwordHash))) {
      return reply.code(401).send({ error: 'Current password is incorrect' });
    }

    if (!isStrongPassword(body.newPassword)) {
      return reply
        .code(400)
        .send({ error: 'New password must be at least 10 characters and include a letter and a digit' });
    }

    const passwordHash = await hashPassword(body.newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });

    return reply.send({ ok: true });
  });
}
