import { createApp } from './app.js';
import { createMemoryRepo } from './repo/memory.js';
import type { Repo } from './repo/types.js';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  console.error('Змінна середовища JWT_SECRET обовʼязкова');
  process.exit(1);
}

// З DATABASE_URL — PostgreSQL через Prisma; без неї — сховище в пам'яті (лише для швидкої локальної розробки, дані зникають після перезапуску)
async function createRepo(): Promise<Repo> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn('DATABASE_URL не задано: використовується сховище в пам’яті');
    return createMemoryRepo();
  }
  const { createPrismaClient, createPrismaRepo } = await import('./repo/prisma.js');
  const { seedDefaults } = await import('./repo/seed.js');
  const db = createPrismaClient(url);
  await seedDefaults(db); // групи мʼязів і загальні вправи
  return createPrismaRepo(db);
}

const app = createApp({ repo: await createRepo(), jwtSecret });
const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Сервер запущено на порту ${port}`));
