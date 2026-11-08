// Підготовка PostgreSQL перед інтеграційними тестами (лише коли задано TEST_DATABASE_URL).
// Схему створює `npx prisma migrate deploy` (крок CI), тут — очищення даних і довідники.
import { createPrismaClient } from '../src/repo/prisma';
import { seedDefaults } from '../src/repo/seed';

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  const db = createPrismaClient(url);
  await db.$executeRawUnsafe('TRUNCATE "WorkoutSet", "Workout", "ProgramExercise", "Program", "Exercise", "User" CASCADE');
  await seedDefaults(db);
  await db.$disconnect();
}
