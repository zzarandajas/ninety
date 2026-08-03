import fastifyCors from '@fastify/cors';
import fp from 'fastify-plugin';

export default fp(async (app) => {
  await app.register(fastifyCors, { origin: true });
});
