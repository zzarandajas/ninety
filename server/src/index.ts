import { buildApp } from './app.js';
import { env } from './config/env.js';

(async () => {
  const app = await buildApp();

  app.listen({ port: env.PORT, host: '0.0.0.0' }).catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
})();
