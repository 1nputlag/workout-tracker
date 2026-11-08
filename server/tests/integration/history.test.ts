import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { bearer, exerciseId, registerUser, setup, type App } from './helpers';

type Summary = { id: string; status: string; setCount: number; tonnageKg: number; muscleGroupIds: number[]; durationMin: number | null; exercises: { name: string; sets: number; best: { weightKg: number; reps: number } }[] };

async function workoutWith(app: App, token: string, sets: { exerciseId: string; weightKg: number; reps: number }[], finish = true) {
  const id = (await request(app).post('/api/workouts').set(bearer(token))).body.id as string;
  for (const s of sets) await request(app).post(`/api/workouts/${id}/sets`).set(bearer(token)).send(s);
  if (finish) await request(app).post(`/api/workouts/${id}/finish`).set(bearer(token));
  return id;
}
const history = async (app: App, token: string, query: Record<string, string | number> = {}) =>
  (await request(app).get('/api/workouts').query(query).set(bearer(token))).body as { total: number; items: Summary[] };

describe('Історія тренувань: фільтри та підсумки (FR-07)', () => {
  it('TC-API-39: фільтри за вправою та групою мʼязів відбирають лише тренування з такими підходами', async () => {
    const { app } = setup(); const u = await registerUser(app);
    const bench = await exerciseId(app, u.token, 'Жим лежачи');
    const squat = await exerciseId(app, u.token, 'Присідання зі штангою');
    const curl = await exerciseId(app, u.token, 'Згинання на біцепс зі штангою');
    const chest = await workoutWith(app, u.token, [{ exerciseId: bench, weightKg: 80, reps: 8 }]);
    const legs = await workoutWith(app, u.token, [{ exerciseId: squat, weightKg: 100, reps: 5 }]);
    const mixed = await workoutWith(app, u.token, [{ exerciseId: bench, weightKg: 60, reps: 10 }, { exerciseId: curl, weightKg: 30, reps: 10 }]);

    const byExercise = await history(app, u.token, { exerciseId: bench });
    expect(byExercise.items.map((w) => w.id).sort()).toEqual([chest, mixed].sort());
    const byGroup = await history(app, u.token, { muscleGroupId: 3 });
    expect(byGroup.items.map((w) => w.id)).toEqual([legs]);
    // Комбінація: жим лежачи І група «Біцепс» — лише змішане тренування
    const both = await history(app, u.token, { exerciseId: bench, muscleGroupId: 5 });
    expect(both.items.map((w) => w.id)).toEqual([mixed]);
    expect((await history(app, u.token, { exerciseId: squat, muscleGroupId: 1 })).total).toBe(0);
  });

  it('TC-API-40: фільтри поєднуються з періодом і пагінацією', async () => {
    const { app } = setup(); const u = await registerUser(app);
    const bench = await exerciseId(app, u.token, 'Жим лежачи');
    for (let i = 0; i < 7; i++) await workoutWith(app, u.token, [{ exerciseId: bench, weightKg: 50 + i, reps: 5 }]);
    await workoutWith(app, u.token, []);
    const p2 = await history(app, u.token, { exerciseId: bench, page: 2, pageSize: 3 });
    expect(p2.total).toBe(7); expect(p2.items).toHaveLength(3);
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect((await history(app, u.token, { exerciseId: bench, from: past, page: 3, pageSize: 3 })).items).toHaveLength(1);
    expect((await history(app, u.token, { exerciseId: bench, to: past })).total).toBe(0);
    expect((await history(app, u.token, { status: 'in_progress' })).total).toBe(1);
  });

  it('TC-API-41: некоректні фільтри дають 400', async () => {
    const { app } = setup(); const u = await registerUser(app);
    for (const q of ['muscleGroupId=abc', 'muscleGroupId=0', 'status=done', `exerciseId=${'x'.repeat(65)}`]) {
      expect((await request(app).get(`/api/workouts?${q}`).set(bearer(u.token))).status).toBe(400);
    }
  });

  it('TC-API-42: підсумок тренування: підходи, тоннаж, групи мʼязів, найкращий підхід кожної вправи', async () => {
    const { app } = setup(); const u = await registerUser(app);
    const bench = await exerciseId(app, u.token, 'Жим лежачи');
    const dips = await exerciseId(app, u.token, 'Віджимання на брусах');
    await workoutWith(app, u.token, [
      { exerciseId: bench, weightKg: 80, reps: 8 }, { exerciseId: bench, weightKg: 80, reps: 7 },
      { exerciseId: bench, weightKg: 82.5, reps: 5 }, { exerciseId: dips, weightKg: 0, reps: 12 },
    ]);
    const [w] = (await history(app, u.token)).items;
    expect(w).toMatchObject({ status: 'completed', setCount: 4, tonnageKg: 80 * 8 + 80 * 7 + 82.5 * 5, muscleGroupIds: [1] });
    expect(w.durationMin).toBe(0);
    expect(w.exercises).toEqual([
      { exerciseId: bench, name: 'Жим лежачи', sets: 3, best: { weightKg: 82.5, reps: 5 } },
      { exerciseId: dips, name: 'Віджимання на брусах', sets: 1, best: { weightKg: 0, reps: 12 } },
    ]);
  });
});

describe('Журнал тренування: перегляд, видалення підходу, життєвий цикл (FR-05)', () => {
  it('TC-API-43: тренування повертається з підходами, назвами вправ і оцінкою 1ПМ; чуже — 404', async () => {
    const { app } = setup(); const u = await registerUser(app); const other = await registerUser(app);
    const bench = await exerciseId(app, u.token, 'Жим лежачи');
    const id = await workoutWith(app, u.token, [{ exerciseId: bench, weightKg: 80, reps: 8 }, { exerciseId: bench, weightKg: 60, reps: 12 }], false);
    const res = await request(app).get(`/api/workouts/${id}`).set(bearer(u.token));
    expect(res.status).toBe(200);
    expect(res.body.sets.map((s: { setNumber: number; exerciseName: string; oneRepMax: number | null }) => [s.setNumber, s.exerciseName, s.oneRepMax]))
      .toEqual([[1, 'Жим лежачи', 101.3], [2, 'Жим лежачи', null]]);
    expect((await request(app).get(`/api/workouts/${id}`).set(bearer(other.token))).status).toBe(404);
  });

  it('TC-API-44: помилковий підхід можна видалити, поки тренування виконується; нумерація лишається неперервною', async () => {
    const { app } = setup(); const u = await registerUser(app);
    const bench = await exerciseId(app, u.token, 'Жим лежачи');
    const id = await workoutWith(app, u.token, [{ exerciseId: bench, weightKg: 80, reps: 8 }, { exerciseId: bench, weightKg: 800, reps: 8 }], false);
    const sets = (await request(app).get(`/api/workouts/${id}`).set(bearer(u.token))).body.sets;
    expect((await request(app).delete(`/api/workouts/${id}/sets/${sets[1].id}`).set(bearer(u.token))).status).toBe(204);
    expect((await request(app).delete(`/api/workouts/${id}/sets/${sets[1].id}`).set(bearer(u.token))).status).toBe(404);
    const next = await request(app).post(`/api/workouts/${id}/sets`).set(bearer(u.token)).send({ exerciseId: bench, weightKg: 80, reps: 7 });
    expect(next.body.setNumber).toBe(2);
    await request(app).post(`/api/workouts/${id}/finish`).set(bearer(u.token));
    expect((await request(app).delete(`/api/workouts/${id}/sets/${sets[0].id}`).set(bearer(u.token))).status).toBe(409);
  });

  it('TC-API-45: завершене тренування можна повернути до редагування, а виконуване — скасувати', async () => {
    const { app } = setup(); const u = await registerUser(app);
    const bench = await exerciseId(app, u.token, 'Жим лежачи');
    const id = await workoutWith(app, u.token, [{ exerciseId: bench, weightKg: 80, reps: 8 }]);
    const reopened = await request(app).post(`/api/workouts/${id}/reopen`).set(bearer(u.token));
    expect(reopened.body).toMatchObject({ status: 'in_progress', finishedAt: null });
    const add = await request(app).post(`/api/workouts/${id}/sets`).set(bearer(u.token)).send({ exerciseId: bench, weightKg: 80, reps: 6 });
    expect(add.status).toBe(201);
    const cancelled = await request(app).post(`/api/workouts/${id}/cancel`).set(bearer(u.token));
    expect(cancelled.body.status).toBe('cancelled');
    // Скасоване — кінцевий стан
    expect((await request(app).post(`/api/workouts/${id}/reopen`).set(bearer(u.token))).status).toBe(409);
    expect((await request(app).post(`/api/workouts/${id}/finish`).set(bearer(u.token))).status).toBe(409);
  });

  it('TC-API-46: тренування можна видалити; чуже — ні', async () => {
    const { app } = setup(); const u = await registerUser(app); const other = await registerUser(app);
    const id = await workoutWith(app, u.token, [], false);
    expect((await request(app).delete(`/api/workouts/${id}`).set(bearer(other.token))).status).toBe(404);
    expect((await request(app).delete(`/api/workouts/${id}`).set(bearer(u.token))).status).toBe(204);
    expect((await request(app).get(`/api/workouts/${id}`).set(bearer(u.token))).status).toBe(404);
  });

  it('TC-API-47: підхід із чужою власною вправою відхиляється як невідома вправа', async () => {
    const { app } = setup(); const u = await registerUser(app); const other = await registerUser(app);
    const foreign = (await request(app).post('/api/exercises').set(bearer(other.token)).send({ name: 'Секретна', muscleGroupId: 2 })).body.id;
    const id = await workoutWith(app, u.token, [], false);
    const res = await request(app).post(`/api/workouts/${id}/sets`).set(bearer(u.token)).send({ exerciseId: foreign, weightKg: 10, reps: 5 });
    expect(res.status).toBe(400); expect(res.body.details[0].path).toBe('exerciseId');
  });

  it('TC-API-48: статистика для графіка 1ПМ обмежується вибраною вправою', async () => {
    const { app } = setup(); const u = await registerUser(app);
    const bench = await exerciseId(app, u.token, 'Жим лежачи');
    const squat = await exerciseId(app, u.token, 'Присідання зі штангою');
    await workoutWith(app, u.token, [{ exerciseId: bench, weightKg: 80, reps: 8 }, { exerciseId: squat, weightKg: 140, reps: 3 }]);
    const all = (await request(app).get('/api/stats/progress').set(bearer(u.token))).body;
    const onlyBench = (await request(app).get(`/api/stats/progress?exerciseId=${bench}`).set(bearer(u.token))).body;
    expect(all).toMatchObject({ workouts: 1, sets: 2 });
    expect(Object.values(all.oneRepMax)[0]).toBe(154);
    expect(Object.values(onlyBench.oneRepMax)[0]).toBeCloseTo(101.33, 2);
    expect(onlyBench.weeklyTonnage).toEqual(all.weeklyTonnage); // тоннаж і обсяг рахуються за всіма вправами
  });
});
