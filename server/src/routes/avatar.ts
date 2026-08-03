import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'avatars');

export default async function avatarRoutes(app: FastifyInstance): Promise<void> {
  app.post('/me/avatar', { preHandler: app.authenticate }, async (request, reply) => {
    // Un token válido no basta: mientras el usuario arrastre una contraseña temporal
    // (`mustChangePassword`) no puede ejecutar acciones más allá de `GET /auth/me` y
    // `POST /auth/change-password`. El frontend ya redirige, pero la regla se aplica
    // también aquí para que no dependa del cliente.
    const currentUser = await prisma.user.findUnique({ where: { id: request.user.userId } });
    if (currentUser?.mustChangePassword) {
      return reply
        .code(403)
        .send({ error: 'You must change your temporary password before uploading an avatar' });
    }

    const file = await request.file();

    if (!file) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    const extension = ALLOWED_MIME_TYPES[file.mimetype];
    if (!extension) {
      return reply.code(400).send({ error: 'Unsupported image type, use PNG, JPEG or WEBP' });
    }

    const buffer = await file.toBuffer();
    const filename = `${request.user.userId}.${extension}`;

    await mkdir(UPLOADS_DIR, { recursive: true });
    await writeFile(path.join(UPLOADS_DIR, filename), buffer);

    const avatarUrl = `/uploads/avatars/${filename}`;
    await prisma.user.update({ where: { id: request.user.userId }, data: { avatarUrl } });

    return reply.send({ avatarUrl });
  });
}
