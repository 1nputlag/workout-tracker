import request from 'supertest';
import { createApp } from '../../src/app';
import { createMemoryRepo } from '../../src/repo/memory';

export const SECRET = 'test-secret';

export function setup() {
  const repo = createMemoryRepo();
  const app = createApp({ repo, jwtSecret: SECRET, bcryptCost: 4 }); // низька вартість bcrypt — лише для швидкості тестів
  return { app, repo };
}

let n = 0;
export async function registerUser(app: ReturnType<typeof createApp>, email = `user${++n}@example.com`) {
  const res = await request(app).post('/api/auth/register').send({ email, password: 'correct-horse-1' });
  return { token: res.body.token as string, id: res.body.user.id as string, email };
}

export const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
