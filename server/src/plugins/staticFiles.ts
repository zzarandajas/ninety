import path from 'node:path';
import fastifyStatic from '@fastify/static';
import fp from 'fastify-plugin';

export default fp(async (app) => {
  await app.register(fastifyStatic, {
    root: path.join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  });
});
