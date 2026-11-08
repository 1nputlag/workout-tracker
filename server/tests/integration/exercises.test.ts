import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { bearer, exerciseId, registerUser, setup, type App } from './helpers';

type Ex = { id: string; name: string; muscleGroupId: number; muscleGroup: string; own: boolean; lastSet: unknown; oneRepMax: number | null };

const list = async (app: App, token: string, query: Record<string, string | number> = {}) =>
  (await request(app).get('/api/exercises').query(query).set(bearer(token))).body as Ex[];
const create = (app: App, token: string, body: object) => request(app).post('/api/exercises').set(bearer(token)).send(body);

describe('Бібліотека вправ (FR-03, UI-04)', () => {
  it('TC-API-25: групи мʼязів — сім груп із макета', async () => {
    const { app } = setup(); const u = await registerUser(app);
    const res = await request(app).get('/api/muscle-groups').set(bearer(u.token));
    expect(res.body.map((g: { name: string }) => g.name)).toEqual(['Груди', 'Спина', 'Ноги', 'Плечі', 'Біцепс', 'Трицепс', 'Прес']);
  });

  it('TC-API-26: користувач бачить загальні й свої вправи, але не бачить чужих', async () => {
    const { app } = setup(); const a = await registerUser(app); const b = await registerUser(app);
    const created = await create(app, a.token, { name: 'Жим «Свенда»', muscleGroupId: 1 });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: 'Жим «Свенда»', muscleGroup: 'Груди', own: true, lastSet: null, oneRepMax: null });

    const mine = await list(app, a.token);
    const theirs = await list(app, b.token);
    expect(mine.some((e) => e.id === created.body.id)).toBe(true);
    expect(theirs.some((e) => e.id === created.body.id)).toBe(false);
    expect(mine.length).toBe(theirs.length + 1);
    expect((await request(app).get(`/api/exercises/${created.body.id}`).set(bearer(b.token))).status).toBe(404);
  });

  it('TC-API-27: пошук за назвою і фільтр за групою мʼязів комбінуються (без урахування регістру)', async () => {
    const { app } = setup(); const u = await registerUser(app);
    const chestPress = await list(app, u.token, { q: 'ЖИМ', muscleGroupId: 1 });
    // «жим» — підрядок і у «Віджимання»: пошук шукає входження в будь-якому місці назви
    expect(chestPress.map((e) => e.name)).toEqual(['Віджимання на брусах', 'Жим гантелей на похилій лаві', 'Жим лежачи']);
    expect(chestPress.every((e) => e.muscleGroupId === 1)).toBe(true);
    expect(await list(app, u.token, { q: 'жим', muscleGroupId: 7 })).toEqual([]);
    expect((await request(app).get('/api/exercises?muscleGroupId=abc').set(bearer(u.token))).status).toBe(400);
  });

  it('TC-API-28: некоректна вправа відхиляється: коротка назва, невідома група, дубль назви', async () => {
    const { app } = setup(); const u = await registerUser(app);
    expect((await create(app, u.token, { name: 'Ж', muscleGroupId: 1 })).status).toBe(400);
    const badGroup = await create(app, u.token, { name: 'Нова вправа', muscleGroupId: 99 });
    expect(badGroup.status).toBe(400); expect(badGroup.body.details[0].path).toBe('muscleGroupId');
    expect((await create(app, u.token, { name: 'жим лежачи', muscleGroupId: 1 })).status).toBe(409);
    await create(app, u.token, { name: 'Власна', muscleGroupId: 2 });
    expect((await create(app, u.token, { name: 'ВЛАСНА', muscleGroupId: 3 })).body.error).toBe('exercise_exists');
  });

  it('TC-API-29: власну вправу можна змінити; загальну — ні (403), чужу — не видно (404)', async () => {
    const { app } = setup(); const a = await registerUser(app); const b = await registerUser(app);
    const id = (await create(app, a.token, { name: 'Тяга до підборіддя', muscleGroupId: 4 })).body.id;
    const upd = await request(app).patch(`/api/exercises/${id}`).set(bearer(a.token)).send({ name: 'Тяга штанги до підборіддя', muscleGroupId: 4 });
    expect(upd.status).toBe(200); expect(upd.body.name).toBe('Тяга штанги до підборіддя');

    const bench = await exerciseId(app, a.token, 'Жим лежачи');
    const general = await request(app).patch(`/api/exercises/${bench}`).set(bearer(a.token)).send({ name: 'Мій жим' });
    expect(general.status).toBe(403);
    expect((await request(app).delete(`/api/exercises/${bench}`).set(bearer(a.token))).status).toBe(403);
    expect((await request(app).patch(`/api/exercises/${id}`).set(bearer(b.token)).send({ name: 'Злам' })).status).toBe(404);
    expect((await request(app).patch(`/api/exercises/${id}`).set(bearer(a.token)).send({})).status).toBe(400);
    expect((await request(app).patch(`/api/exercises/${id}`).set(bearer(a.token)).send({ muscleGroupId: 42 })).status).toBe(400);
    expect((await request(app).patch(`/api/exercises/${id}`).set(bearer(a.token)).send({ name: 'Жим лежачи' })).status).toBe(409);
  });

  it('TC-API-30: вправу з підходами видалити не можна (409), без підходів — можна (204)', async () => {
    const { app } = setup(); const u = await registerUser(app);
    const used = (await create(app, u.token, { name: 'Використана', muscleGroupId: 5 })).body.id;
    const unused = (await create(app, u.token, { name: 'Зайва', muscleGroupId: 5 })).body.id;
    const w = (await request(app).post('/api/workouts').set(bearer(u.token))).body.id;
    await request(app).post(`/api/workouts/${w}/sets`).set(bearer(u.token)).send({ exerciseId: used, weightKg: 20, reps: 10 });

    const blocked = await request(app).delete(`/api/exercises/${used}`).set(bearer(u.token));
    expect(blocked.status).toBe(409); expect(blocked.body.error).toBe('exercise_in_use');
    expect((await request(app).delete(`/api/exercises/${unused}`).set(bearer(u.token))).status).toBe(204);
    expect((await list(app, u.token)).some((e) => e.id === unused)).toBe(false);
  });

  it('TC-API-31: картка вправи містить останній підхід і оцінку 1ПМ за ним', async () => {
    const { app } = setup(); const u = await registerUser(app);
    const bench = await exerciseId(app, u.token, 'Жим лежачи');
    const w = (await request(app).post('/api/workouts').set(bearer(u.token))).body.id;
    await request(app).post(`/api/workouts/${w}/sets`).set(bearer(u.token)).send({ exerciseId: bench, weightKg: 70, reps: 10 });
    await request(app).post(`/api/workouts/${w}/sets`).set(bearer(u.token)).send({ exerciseId: bench, weightKg: 80, reps: 8 });
    const card = (await request(app).get(`/api/exercises/${bench}`).set(bearer(u.token))).body as Ex;
    expect(card.lastSet).toMatchObject({ weightKg: 80, reps: 8 });
    expect(card.oneRepMax).toBe(101.3);
    // Інший користувач бачить ту саму загальну вправу без чужих підходів
    const other = await registerUser(app);
    expect((await request(app).get(`/api/exercises/${bench}`).set(bearer(other.token))).body.lastSet).toBeNull();
  });

  it('TC-API-32: підказка прогресії за двома останніми завершеними тренуваннями', async () => {
    const { app } = setup(); const u = await registerUser(app);
    const bench = await exerciseId(app, u.token, 'Жим лежачи');
    const none = await request(app).get(`/api/exercises/${bench}/hint`).set(bearer(u.token));
    expect(none.body.hint).toEqual({ kind: 'insufficient_data' });

    for (let i = 0; i < 2; i++) {
      const w = (await request(app).post('/api/workouts').set(bearer(u.token))).body.id;
      for (let s = 0; s < 3; s++) {
        await request(app).post(`/api/workouts/${w}/sets`).set(bearer(u.token)).send({ exerciseId: bench, weightKg: 80, reps: 8 });
      }
      await request(app).post(`/api/workouts/${w}/finish`).set(bearer(u.token));
    }
    const res = await request(app).get(`/api/exercises/${bench}/hint?lo=6&hi=8`).set(bearer(u.token));
    expect(res.status).toBe(200);
    expect(res.body.hint).toEqual({ kind: 'increase_weight', fromKg: 80, toKg: 82.5, exceedsRange: false });
    expect((await request(app).get(`/api/exercises/${bench}/hint?lo=9&hi=8`).set(bearer(u.token))).status).toBe(400);
  });
});
