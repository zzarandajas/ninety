import type {} from 'vitest/config';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Mirrors nginx's edge routing (nginx/nginx.conf) for local dev without
      // Docker: strip the /api prefix and forward to the local Fastify server.
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // vitest's default exclude list doesn't cover a generated coverage/
    // report directory sitting at the project root — without this, the file
    // discovery glob walks into it too (and can hit locked files while a
    // coverage run is still writing there).
    exclude: [...configDefaults.exclude, 'coverage/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/components/**', 'src/store/**', 'src/pages/**', 'src/lib/**'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
});
