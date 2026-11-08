import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { bearer, defaultExercises, registerUser, setup } from './helpers';

let BENCH = '';
let SQUAT = '';
beforeAll(async () => {
  const ids = await defaultExercises();
  BENCH = ids['Жим лежачи']; SQUAT = ids['Присідання зі штангою'];
});

async function startWorkout(app: ReturnType<typeof setup>['app'], token: string) {
  const res = await request(app).post('/api/workouts').set(bearer(token));
  return res.body.id as string;
}
const addSet = (app: ReturnType<typeof setup>['app'], token: string, id: string, body: object) =>
  request(app).post(`/api/workouts/${id}/sets`).set(bearer(token)).send(body);

describe('API тренувань і підходів (діаграма послідовності 4.8)', () => {
  it('TC-API-08: підхід зберігається, нумерація підходів зростає', async () => {
    const { app } = setup(); const u = await registerUser(app); const id = await startWorkout(app, u.token);
    const a = await addSet(app, u.token, id, { exerciseId: BENCH, weightKg: 80, reps: 8 });
    const b = await addSet(app, u.token, id, { exerciseId: BENCH, weightKg: 82.5, reps: 6 });
    expect(a.status).toBe(201); expect(a.body.setNumber).toBe(1);
    expect(b.body.setNumber).toBe(2);
    expect(b.body.muscleGroupId).toBe(1); // група м'язів визначається за вправою
  });

  it('TC-API-09: некоректний підхід дає 400 і не потрапляє у сховище', async () => {
    const { app, repo } = setup(); const u = await registerUser(app); const id = await startWorkout(app, u.token);
    const res = await addSet(app, u.token, id, { exerciseId: BENCH, weightKg: -5, reps: 0 });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d: { path: string }) => d.path).sort()).toEqual(['reps', 'weightKg']);
    expect((await repo.getWorkout(id))!.sets).toHaveLength(0);
  });

  it('TC-API-10: невідома вправа дає 400', async () => {
    const { app } = setup(); const u = await registerUser(app); const id = await startWorkout(app, u.token);
    expect((await addSet(app, u.token, id, { exerciseId: 'nope', weightKg: 10, reps: 5 })).status).toBe(400);
  });

  it('TC-API-11: чуже тренування недоступне: 404, і підхід не додається власнику', async () => {
    const { app, repo } = setup();
    const owner = await registerUser(app); const stranger = await registerUser(app);
    const id = await startWorkout(app, owner.token);
    const res = await addSet(app, stranger.token, id, { exerciseId: BENCH, weightKg: 80, reps: 8 });
    expect(res.status).toBe(404);
    expect((await repo.getWorkout(id))!.sets).toHaveLength(0);
    expect((await request(app).post(`/api/workouts/${id}/finish`).set(bearer(stranger.token))).status).toBe(404);
  });

  it('TC-API-12: тренування без підходів завершити не можна (409), із підходом — можна', async () => {
    const { app } = setup(); const u = await registerUser(app); const id = await startWorkout(app, u.token);
    const empty = await request(app).post(`/api/workouts/${id}/finish`).set(bearer(u.token));
    expect(empty.status).toBe(409); expect(empty.body.error).toBe('invalid_transition');
    await addSet(app, u.token, id, { exerciseId: SQUAT, weightKg: 100, reps: 5 });
    const ok = await request(app).post(`/api/workouts/${id}/finish`).set(bearer(u.token));
    expect(ok.status).toBe(200); expect(ok.body.status).toBe('completed');
  });

  it('TC-API-13: до завершеного тренування підхід додати не можна (409)', async () => {
    const { app } = setup(); const u = await registerUser(app); const id = await startWorkout(app, u.token);
    await addSet(app, u.token, id, { exerciseId: SQUAT, weightKg: 100, reps: 5 });
    await request(app).post(`/api/workouts/${id}/finish`).set(bearer(u.token));
    const res = await addSet(app, u.token, id, { exerciseId: SQUAT, weightKg: 100, reps: 5 });
    expect(res.status).toBe(409); expect(res.body.error).toBe('workout_not_in_progress');
  });

  it('TC-API-14: пагінація історії: 12 тренувань, сторінки по 5; інший користувач бачить порожню історію', async () => {
    const { app } = setup(); const u = await registerUser(app); const other = await registerUser(app);
    for (let i = 0; i < 12; i++) await startWorkout(app, u.token);
    const p3 = await request(app).get('/api/workouts?page=3&pageSize=5').set(bearer(u.token));
    expect(p3.body.total).toBe(12); expect(p3.body.items).toHaveLength(2);
    const p1 = await request(app).get('/api/workouts?page=1&pageSize=5').set(bearer(u.token));
    expect(p1.body.items).toHaveLength(5);
    const none = await request(app).get('/api/workouts').set(bearer(other.token));
    expect(none.body.total).toBe(0);
  });

  it('TC-API-15: фільтр історії за періодом відсікає тренування поза періодом', async () => {
    const { app } = setup(); const u = await registerUser(app);
    await startWorkout(app, u.token);
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const res = await request(app).get(`/api/workouts?from=${encodeURIComponent(future)}`).set(bearer(u.token));
    expect(res.body.total).toBe(0);
  });

  it('TC-API-16: показники прогресу рахуються лише із завершених тренувань', async () => {
    const { app } = setup(); const u = await registerUser(app);
    const done = await startWorkout(app, u.token);
    await addSet(app, u.token, done, { exerciseId: BENCH, weightKg: 80, reps: 8 });
    await addSet(app, u.token, done, { exerciseId: BENCH, weightKg: 80, reps: 8 });
    await request(app).post(`/api/workouts/${done}/finish`).set(bearer(u.token));
    const open = await startWorkout(app, u.token); // не завершене — у статистику не входить
    await addSet(app, u.token, open, { exerciseId: BENCH, weightKg: 200, reps: 1 });
    const res = await request(app).get('/api/stats/progress').set(bearer(u.token));
    expect(res.status).toBe(200);
    const tonnage = Object.values(res.body.weeklyTonnage) as number[];
    expect(tonnage).toEqual([1280]);
    expect(Object.values(res.body.weeklyVolume)).toEqual([2]);
    expect(Object.values(res.body.oneRepMax)[0]).toBeCloseTo(101.33, 2);
  });

  it('TC-API-17: пошкоджений JSON у тілі запиту дає 400, а не 500', async () => {
    const { app } = setup(); const u = await registerUser(app); const id = await startWorkout(app, u.token);
    const res = await request(app).post(`/api/workouts/${id}/sets`).set(bearer(u.token)).set('Content-Type', 'application/json').send('{"weightKg": 80,');
    expect(res.status).toBe(400);
  });

  it('TC-API-18: некоректні параметри пагінації (page=abc, pageSize=-1) дають 400', async () => {
    const { app } = setup(); const u = await registerUser(app);
    expect((await request(app).get('/api/workouts?page=abc').set(bearer(u.token))).status).toBe(400);
    expect((await request(app).get('/api/workouts?pageSize=-1').set(bearer(u.token))).status).toBe(400);
  });

  it('TC-API-19: некоректна дата в параметрах періоду дає 400, а не порожній або хибний результат', async () => {
    const { app } = setup(); const u = await registerUser(app);
    expect((await request(app).get('/api/workouts?from=not-a-date').set(bearer(u.token))).status).toBe(400);
    expect((await request(app).get('/api/stats/progress?to=2026-13-45').set(bearer(u.token))).status).toBe(400);
  });
});
