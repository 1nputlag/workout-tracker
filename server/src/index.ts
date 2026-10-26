import { createApp } from './app.js';
import { createMemoryRepo } from './repo/memory.js';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  console.error('Змінна середовища JWT_SECRET обовʼязкова');
  process.exit(1);
}

// Етап 6: createMemoryRepo() замінюється реалізацією на Prisma (PostgreSQL) за тим самим інтерфейсом Repo.
const app = createApp({ repo: createMemoryRepo(), jwtSecret });
const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Сервер запущено на порту ${port}`));
