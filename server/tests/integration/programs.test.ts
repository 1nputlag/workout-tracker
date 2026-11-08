import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { bearer, exerciseId, registerUser, setup, type App } from './helpers';

const createProgram = (app: App, token: string, body: object) => request(app).post('/api/programs').set(bearer(token)).send(body);

async function upperBody(app: App, token: string) {
  const bench = await exerciseId(app, token, 'Жим лежачи');
  const incline = await exerciseId(app, token, 'Жим гантелей на похилій лаві');
  const pushdown = await exerciseId(app, token, 'Розгинання на трицепс (блок)');
  return { bench, incline, pushdown };
}

describe('Тренувальні програми (FR-04)', () => {
  it('TC-API-33: програма зберігає впорядкований перелік вправ із цілями', async () => {
    const { app } = setup(); const u = await registerUser(app);
    const ex = await upperBody(app, u.token);
    const res = await createProgram(app, u.token, {
      name: 'Верх тіла А',
      items: [
        { exerciseId: ex.bench, targetSets: 4, targetReps: 8 },
        { exerciseId: ex.incline, targetSets: 3, targetReps: 10 },
        { exerciseId: ex.pushdown, targetSets: 3, targetReps: 12 },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.items.map((i: { position: number; exerciseName: string }) => [i.position, i.exerciseName])).toEqual([
      [0, 'Жим лежачи'], [1, 'Жим гантелей на похилій лаві'], [2, 'Розгинання на трицепс (блок)'],
    ]);
    const all = await request(app).get('/api/programs').set(bearer(u.token));
    expect(all.body).toHaveLength(1);
  });

  it('TC-API-34: редагування замінює перелік і порядок вправ; назву можна змінити окремо', async () => {
    const { app } = setup(); const u = await registerUser(app);
    const ex = await upperBody(app, u.token);
    const id = (await createProgram(app, u.token, { name: 'А', items: [{ exerciseId: ex.bench, targetSets: 3, targetReps: 5 }] })).body.id;
    const upd = await request(app).patch(`/api/programs/${id}`).set(bearer(u.token)).send({
      items: [{ exerciseId: ex.pushdown, targetSets: 2, targetReps: 15 }, { exerciseId: ex.bench, targetSets: 5, targetReps: 5 }],
    });
    expect(upd.status).toBe(200);
    expect(upd.body.items.map((i: { exerciseId: string }) => i.exerciseId)).toEqual([ex.pushdown, ex.bench]);
    const renamed = await request(app).patch(`/api/programs/${id}`).set(bearer(u.token)).send({ name: 'Верх тіла Б' });
    expect(renamed.body.name).toBe('Верх тіла Б');
    expect(renamed.body.items).toHaveLength(2);
  });

  it('TC-API-35: чужу програму не можна переглянути, змінити чи видалити (404)', async () => {
    const { app } = setup(); const a = await registerUser(app); const b = await registerUser(app);
    const id = (await createProgram(app, a.token, { name: 'Приватна' })).body.id;
    expect((await request(app).get(`/api/programs/${id}`).set(bearer(b.token))).status).toBe(404);
    expect((await request(app).patch(`/api/programs/${id}`).set(bearer(b.token)).send({ name: 'Моя' })).status).toBe(404);
    expect((await request(app).delete(`/api/programs/${id}`).set(bearer(b.token))).status).toBe(404);
    expect((await request(app).get('/api/programs').set(bearer(b.token))).body).toEqual([]);
    expect((await request(app).get(`/api/programs/${id}`).set(bearer(a.token))).body.name).toBe('Приватна');
  });

  it('TC-API-36: програма з чужою або невідомою вправою чи некоректними цілями відхиляється (400)', async () => {
    const { app } = setup(); const a = await registerUser(app); const b = await registerUser(app);
    const foreign = (await request(app).post('/api/exercises').set(bearer(b.token)).send({ name: 'Чужа вправа', muscleGroupId: 1 })).body.id;
    const res = await createProgram(app, a.token, { name: 'X', items: [{ exerciseId: foreign, targetSets: 3, targetReps: 8 }] });
    expect(res.status).toBe(400); expect(res.body.details[0].path).toBe('items.0.exerciseId');
    const bench = await exerciseId(app, a.token, 'Жим лежачи');
    expect((await createProgram(app, a.token, { name: 'X', items: [{ exerciseId: bench, targetSets: 0, targetReps: 8 }] })).status).toBe(400);
    expect((await createProgram(app, a.token, { name: '', items: [] })).status).toBe(400);
    const id = (await createProgram(app, a.token, { name: 'Y' })).body.id;
    expect((await request(app).patch(`/api/programs/${id}`).set(bearer(a.token)).send({ items: [{ exerciseId: 'nope', targetSets: 1, targetReps: 1 }] })).status).toBe(400);
    expect((await request(app).patch(`/api/programs/${id}`).set(bearer(a.token)).send({})).status).toBe(400);
  });

  it('TC-API-37: тренування створюється за програмою; після видалення програми воно лишається в історії', async () => {
    const { app } = setup(); const u = await registerUser(app);
    const ex = await upperBody(app, u.token);
    const p = (await createProgram(app, u.token, { name: 'Верх тіла А', items: [{ exerciseId: ex.bench, targetSets: 3, targetReps: 8 }] })).body;
    const w = await request(app).post('/api/workouts').set(bearer(u.token)).send({ programId: p.id });
    expect(w.status).toBe(201);
    expect(w.body).toMatchObject({ programId: p.id, programName: 'Верх тіла А', status: 'in_progress', sets: [] });

    expect((await request(app).delete(`/api/programs/${p.id}`).set(bearer(u.token))).status).toBe(204);
    const after = await request(app).get(`/api/workouts/${w.body.id}`).set(bearer(u.token));
    expect(after.status).toBe(200);
    expect(after.body.programId).toBeNull();
  });

  it('TC-API-38: тренування за чужою програмою створити не можна (400)', async () => {
    const { app } = setup(); const a = await registerUser(app); const b = await registerUser(app);
    const p = (await createProgram(app, a.token, { name: 'Чужа' })).body.id;
    const res = await request(app).post('/api/workouts').set(bearer(b.token)).send({ programId: p });
    expect(res.status).toBe(400); expect(res.body.details[0].path).toBe('programId');
    expect((await request(app).get('/api/workouts').set(bearer(b.token))).body.total).toBe(0);
  });
});
