import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import corsPlugin from './plugins/cors.js';
import jwtPlugin from './plugins/jwt.js';
import multipartPlugin from './plugins/multipart.js';
import staticFilesPlugin from './plugins/staticFiles.js';
import authRoutes from './routes/auth.js';
import avatarRoutes from './routes/avatar.js';
import issueRoutes from './routes/issues.js';
import l10Routes from './routes/l10.js';
import memberRoutes from './routes/members.js';
import rockRoutes from './routes/rocks.js';
import scorecardRoutes from './routes/scorecard.js';
import seatRoutes from './routes/seats.js';
import tenantRoutes from './routes/tenant.js';
import todoRoutes from './routes/todos.js';
import vtoRoutes from './routes/vto.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: error.issues.map((issue) => issue.message).join(', ') });
    }

    // Los 4xx legítimos (413 de @fastify/multipart, 401 de @fastify/jwt, etc.) ya traen
    // `statusCode` y un mensaje pensado para el cliente: se dejan pasar tal cual. Todo lo
    // que sea 5xx se registra en el log y se devuelve genérico, para no filtrar mensajes
    // internos de Prisma (nombres de tabla, fragmentos de query) al navegador.
    const statusCode = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    if (statusCode >= 500) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
    return reply.code(statusCode).send({ error: error.message });
  });

  await app.register(corsPlugin);
  await app.register(jwtPlugin);
  await app.register(multipartPlugin);
  await app.register(staticFilesPlugin);
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(avatarRoutes, { prefix: '/auth' });
  await app.register(tenantRoutes, { prefix: '/tenant' });
  await app.register(rockRoutes, { prefix: '/rocks' });
  await app.register(scorecardRoutes, { prefix: '/scorecard' });
  await app.register(issueRoutes, { prefix: '/issues' });
  await app.register(l10Routes, { prefix: '/l10' });
  await app.register(seatRoutes);
  await app.register(memberRoutes);
  await app.register(todoRoutes, { prefix: '/todos' });
  await app.register(vtoRoutes, { prefix: '/vto' });

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
