import fastifyJwt from '@fastify/jwt';
import fp from 'fastify-plugin';
import { env } from '../config/env.js';

export default fp(async (app) => {
  await app.register(fastifyJwt, { secret: env.JWT_SECRET, sign: { expiresIn: '12h' } });

  app.decorate('authenticate', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });
});
