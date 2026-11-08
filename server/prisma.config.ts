// Налаштування Prisma CLI (generate, migrate). Адреса бази — зі змінної середовища DATABASE_URL.
// Для локальної розробки змінні підхоплюються з файлу .env у корені репозиторію (якщо він є).
import { defineConfig } from 'prisma/config';

try {
  process.loadEnvFile('../.env');
} catch {
  // файлу немає (CI, контейнер) — змінні задані середовищем
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
