import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 10000,
    exclude: [...configDefaults.exclude, 'coverage/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/lib/**',
        'src/config/**',
        'src/plugins/**',
        'src/middleware/**',
        'src/routes/**',
        'src/repositories/**',
        'src/services/**',
        'src/app.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});
