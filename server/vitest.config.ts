import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'], // точка входу запускається лише в контейнері
      reporter: ['text', 'html', 'json-summary'],
      // Пороги контролюються в CI: якщо покриття нижче — збірка падає
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 },
    },
  },
});
