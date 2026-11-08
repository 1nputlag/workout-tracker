import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/app';
import { createMemoryRepo } from '../../src/repo/memory';
import { createPrismaClient, createPrismaRepo } from '../../src/repo/prisma';
import type { Repo } from '../../src/repo/types';

export const SECRET = 'test-secret';

/**
 * Якщо задано TEST_DATABASE_URL — тести працюють зі справжньою PostgreSQL (так у CI),
 * інакше — зі сховищем у пам'яті. Ізоляція тестів — через нових користувачів з унікальною поштою.
 */
export const DB_URL = process.env.TEST_DATABASE_URL;
let shared: ReturnType<typeof createPrismaClient> | undefined;
export const prismaClient = () => (shared ??= createPrismaClient(DB_URL!));

export function makeRepo(): Repo {
  return DB_URL ? createPrismaRepo(prismaClient()) : createMemoryRepo();
}

export function setup() {
  const repo = makeRepo();
  const app = createApp({ repo, jwtSecret: SECRET, bcryptCost: 4 }); // низька вартість bcrypt — лише для швидкості тестів
  return { app, repo };
}

export type App = ReturnType<typeof setup>['app'];

export async function registerUser(app: App, email = `user-${randomUUID()}@example.com`) {
  const res = await request(app).post('/api/auth/register').send({ email, password: 'correct-horse-1' });
  return { token: res.body.token as string, id: res.body.user.id as string, email };
}

export const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

/** Ідентифікатор загальної вправи за назвою (у пам'яті це 'bench', у PostgreSQL — UUID). */
export async function exerciseId(app: App, token: string, name: string): Promise<string> {
  const res = await request(app).get('/api/exercises').query({ q: name }).set(bearer(token));
  const e = (res.body as { id: string; name: string }[]).find((x) => x.name === name);
  if (!e) throw new Error(`Вправу «${name}» не знайдено`);
  return e.id;
}

/** Ідентифікатори загальних вправ за назвою — для тестів, яким не потрібен окремий запит. */
export async function defaultExercises(): Promise<Record<string, string>> {
  const all = await makeRepo().listExercises('-');
  return Object.fromEntries(all.filter((e) => e.ownerId === null).map((e) => [e.name, e.id]));
}
