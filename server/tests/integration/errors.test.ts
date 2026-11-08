// Єдиний обробник помилок: збої сховища не повинні розкривати подробиць і давати незрозумілі статуси.
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import { createMemoryRepo } from '../../src/repo/memory';
import { SECRET, bearer, registerUser } from './helpers';

function appWithFailingGroups(error: unknown) {
  const repo = createMemoryRepo();
  repo.listMuscleGroups = async () => { throw error; };
  return createApp({ repo, jwtSecret: SECRET, bcryptCost: 4 });
}

describe('Обробка помилок сервера', () => {
  it.each([
    ['P2025', 404, 'not_found'],
    ['P2002', 409, 'conflict'],
    ['P2003', 409, 'conflict'],
  ])('TC-API-49: помилка Prisma %s (одночасні запити) перетворюється на %i', async (code, status, error) => {
    const app = appWithFailingGroups(Object.assign(new Error('prisma'), { code }));
    const u = await registerUser(app);
    const res = await request(app).get('/api/muscle-groups').set(bearer(u.token));
    expect(res.status).toBe(status); expect(res.body).toEqual({ error });
  });

  it('TC-API-50: непередбачена помилка дає 500 без подробиць', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = appWithFailingGroups(new Error('connection refused: password=secret'));
    const u = await registerUser(app);
    const res = await request(app).get('/api/muscle-groups').set(bearer(u.token));
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/secret|refused/);
    spy.mockRestore();
  });

  it('TC-API-51: завеликий запит (понад 100 КБ) відхиляється з кодом 413', async () => {
    const app = appWithFailingGroups(new Error());
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.ua', password: 'x'.repeat(200_000) });
    expect(res.status).toBe(413);
  });
});
