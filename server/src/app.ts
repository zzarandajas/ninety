import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import corsPlugin from './plugins/cors.js';
import jwtPlugin from './plugins/jwt.js';
import multipartPlugin from './plugins/multipart.js';
import staticFilesPlugin from './plugins/staticFiles.js';
import websocketPlugin from './plugins/websocket.js';
import authRoutes from './routes/auth.js';
import avatarRoutes from './routes/avatar.js';
import issueRoutes from './routes/issues.js';
import l10Routes from './routes/l10.js';
import memberRoutes from './routes/members.js';
import rockRoutes from './routes/rocks.js';
import quarterRoutes from './routes/quarters.js';
import scorecardRoutes from './routes/scorecard.js';
import seatRoutes from './routes/seats.js';
import tenantRoutes from './routes/tenant.js';
import todoRoutes from './routes/todos.js';
import vtoRoutes from './routes/vto.js';
import adminRoutes from './routes/admin.js';
import impersonateRoutes from './routes/impersonate.js';
import { prisma } from './lib/prisma.js'; // Import the actual prisma client

function sanitizeLogBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  if (Array.isArray(body)) return body.map(sanitizeLogBody);

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (['password', 'token', 'secret', 'authorization', 'passwordhash'].includes(key.toLowerCase())) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogBody(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export async function buildApp(): Promise<FastifyInstance> {
  const isTest = process.env.NODE_ENV === 'test';
  const isDev = process.env.NODE_ENV !== 'production' && !isTest;

  const app = Fastify({
    disableRequestLogging: true,
    logger: isTest
      ? false
      : isDev
        ? {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:HH:MM:ss',
                ignore: 'pid,hostname',
                messageFormat: '{msg}',
              },
            },
            level: 'debug',
          }
        : { level: 'info' },
  });

  if (!isTest) {
    app.addHook('onRequest', async (request) => {
      const tenantId = (request.headers['x-tenant-id'] as string) || undefined;
      const queryKeys = Object.keys(request.query as object || {});
      const queryStr = queryKeys.length ? ` [query: ${JSON.stringify(request.query)}]` : '';
      const tenantStr = tenantId ? ` [tenant: ${tenantId}]` : '';

      request.log.info(`--> [${request.method}] ${request.url}${queryStr}${tenantStr}`);
    });

    app.addHook('preHandler', async (request) => {
      if (request.body && typeof request.body === 'object' && Object.keys(request.body as object).length > 0) {
        const sanitized = sanitizeLogBody(request.body);
        request.log.debug(`    [BODY] ${JSON.stringify(sanitized)}`);
      }
    });

    app.addHook('onResponse', async (request, reply) => {
      const responseTime = reply.getResponseTime().toFixed(2);
      const status = reply.statusCode;
      const logFn = status >= 500 ? request.log.error : status >= 400 ? request.log.warn : request.log.info;

      logFn.call(request.log, `<-- [${request.method}] ${request.url} [${status}] (${responseTime}ms)`);
    });
  }

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
  await app.register(websocketPlugin);
  await app.register(multipartPlugin);
  await app.register(staticFilesPlugin);
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(avatarRoutes, { prefix: '/auth' });
  await app.register(tenantRoutes, { prefix: '/tenant' });
  await app.register(rockRoutes, { prefix: '/rocks' });
  await app.register(quarterRoutes, { prefix: '/quarters' });
  await app.register(scorecardRoutes, { prefix: '/scorecard' });
  await app.register(issueRoutes, { prefix: '/issues' });
  await app.register(l10Routes, { prefix: '/l10' });
  await app.register(seatRoutes);
  await app.register(memberRoutes);
  await app.register(todoRoutes, { prefix: '/todos' });
  await app.register(vtoRoutes, { prefix: '/vto' });
  await app.register(adminRoutes, { prefix: '/admin' });
  await app.register(impersonateRoutes, { prefix: '/admin' });

  // Decorate app with the actual prisma client
  app.decorate('prisma', prisma);

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
