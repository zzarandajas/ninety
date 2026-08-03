import fastifyMultipart from '@fastify/multipart';
import fp from 'fastify-plugin';

export default fp(async (app) => {
  await app.register(fastifyMultipart, {
    limits: { fileSize: 2 * 1024 * 1024 },
  });
});
