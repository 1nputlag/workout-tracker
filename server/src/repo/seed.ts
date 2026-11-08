// Заповнення довідкових даних. Ідемпотентне: можна запускати при кожному старті сервера.
import type { PrismaClient } from '../generated/prisma/client.js';
import { DEFAULT_EXERCISES, MUSCLE_GROUPS } from './defaults.js';

export async function seedDefaults(db: PrismaClient): Promise<void> {
  for (const g of MUSCLE_GROUPS) {
    await db.muscleGroup.upsert({ where: { id: g.id }, update: { name: g.name }, create: g });
  }
  // У загальних вправ ownerId = null, тому унікальний індекс тут не допоможе — перевіряємо наявність за назвою
  const existing = new Set(
    (await db.exercise.findMany({ where: { ownerId: null }, select: { name: true } })).map((e) => e.name),
  );
  const missing = DEFAULT_EXERCISES.filter((e) => !existing.has(e.name));
  if (missing.length > 0) {
    await db.exercise.createMany({ data: missing.map((e) => ({ name: e.name, muscleGroupId: e.muscleGroupId, ownerId: null })) });
  }
}
