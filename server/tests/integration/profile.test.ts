import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { bearer, exerciseId, registerUser, setup } from './helpers';

describe('Профіль і одиниці ваги (FR-02)', () => {
  it('TC-API-20: профіль повертає дані користувача без хешу пароля; одиниці за замовчуванням — кг', async () => {
    const { app } = setup(); const u = await registerUser(app);
    const res = await request(app).get('/api/profile').set(bearer(u.token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: u.id, email: u.email, displayName: u.email.split('@')[0], weightUnit: 'kg' });
  });

  it('TC-API-21: зміна одиниць на фунти змінює відображення ваги, а збережене значення в кг — ні', async () => {
    const { app } = setup(); const u = await registerUser(app);
    const bench = await exerciseId(app, u.token, 'Жим лежачи');
    const w = (await request(app).post('/api/workouts').set(bearer(u.token))).body.id as string;
    await request(app).post(`/api/workouts/${w}/sets`).set(bearer(u.token)).send({ exerciseId: bench, weightKg: 100, reps: 5 });

    const patch = await request(app).patch('/api/profile').set(bearer(u.token)).send({ weightUnit: 'lb', displayName: '  Михайло ' });
    expect(patch.status).toBe(200);
    expect(patch.body).toMatchObject({ weightUnit: 'lb', displayName: 'Михайло' });

    const detail = await request(app).get(`/api/workouts/${w}`).set(bearer(u.token));
    expect(detail.body.weightUnit).toBe('lb');
    expect(detail.body.sets[0].weightKg).toBe(100);
    expect(detail.body.sets[0].displayWeight).toBe(220.5);

    await request(app).patch('/api/profile').set(bearer(u.token)).send({ weightUnit: 'kg' });
    const back = await request(app).get(`/api/workouts/${w}`).set(bearer(u.token));
    expect(back.body.sets[0].displayWeight).toBe(100);
  });

  it.each([
    [{}, 'порожнє тіло'],
    [{ weightUnit: 'stone' }, 'невідомі одиниці'],
    [{ displayName: '   ' }, 'імʼя з пробілів'],
    [{ email: 'x@y.ua' }, 'поле, яке не можна змінювати'],
  ])('TC-API-22: некоректна зміна профілю (%j — %s) дає 400', async (body, _why) => {
    const { app } = setup(); const u = await registerUser(app);
    const res = await request(app).patch('/api/profile').set(bearer(u.token)).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect((await request(app).get('/api/profile').set(bearer(u.token))).body.weightUnit).toBe('kg');
  });

  it('TC-API-23: без токена профіль недоступний; токен видаленого користувача не працює', async () => {
    const { app } = setup();
    expect((await request(app).get('/api/profile')).status).toBe(401);
    const jwt = await import('jsonwebtoken');
    const ghost = jwt.default.sign({ sub: '00000000-0000-0000-0000-000000000000' }, 'test-secret');
    expect((await request(app).get('/api/profile').set(bearer(ghost))).status).toBe(401);
    expect((await request(app).patch('/api/profile').set(bearer(ghost)).send({ weightUnit: 'lb' })).status).toBe(401);
  });

  it('TC-API-24: невідомий маршрут API дає 404 у форматі JSON', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404); expect(res.body.error).toBe('not_found');
  });
});
