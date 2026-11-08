import { defineConfig } from 'vitest/config';

// Без TEST_DATABASE_URL тести працюють зі сховищем у пам'яті, тож код доступу до PostgreSQL не виконується
// і не враховується в покритті. У CI база є, і покриття рахується разом із ним.
const withDb = Boolean(process.env.TEST_DATABASE_URL);

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts', // точка входу запускається лише в контейнері
        'src/generated/**', // згенерований клієнт Prisma
        ...(withDb ? [] : ['src/repo/prisma.ts', 'src/repo/seed.ts']),
      ],
      reporter: ['text', 'html', 'json-summary'],
      // Пороги контролюються в CI: якщо покриття нижче — збірка падає
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 },
    },
  },
});
