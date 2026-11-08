// Бібліотека вправ (FR-03): загальні вправи бачать усі, власні — лише автор; змінювати можна тільки власні.
import { Router } from 'express';
import { HttpError, h, invalidField, notFound, uid, type AuthedRequest, type Deps } from '../http.js';
import { exerciseInput, exercisePatch, exercisesQuery, hintQuery } from '../validation/schemas.js';
import { exerciseView } from '../services/views.js';
import { progressionHint } from '../services/stats.js';
import type { Exercise, Repo } from '../repo/types.js';

export async function groupNames(repo: Repo): Promise<Map<number, string>> {
  return new Map((await repo.listMuscleGroups()).map((g) => [g.id, g.name]));
}

/** Вправа, доступна користувачу (загальна або власна); інакше — 404, щоб не розкривати чужі записи. */
export async function visibleExercise(repo: Repo, id: string, userId: string): Promise<Exercise> {
  const e = await repo.getExercise(id);
  if (!e || (e.ownerId !== null && e.ownerId !== userId)) throw notFound();
  return e;
}

export function muscleGroupRoutes({ repo }: Deps) {
  const r = Router();
  r.get('/', h(async (_req, res) => { res.json(await repo.listMuscleGroups()); }));
  return r;
}

export function exerciseRoutes({ repo }: Deps) {
  const r = Router();

  const ownExercise = async (req: AuthedRequest) => {
    const e = await visibleExercise(repo, String(req.params.id), uid(req));
    if (e.ownerId !== uid(req)) throw new HttpError(403, 'forbidden'); // загальну вправу змінювати не можна
    return e;
  };
  const checkGroup = async (id: number | undefined) => {
    if (id !== undefined && !(await groupNames(repo)).has(id)) throw invalidField('muscleGroupId', 'Невідома група мʼязів');
  };
  const checkUniqueName = async (userId: string, name: string, exceptId?: string) => {
    const same = (await repo.listExercises(userId, { q: name }))
      .find((e) => e.id !== exceptId && e.name.toLowerCase() === name.toLowerCase());
    if (same) throw new HttpError(409, 'exercise_exists');
  };

  r.get('/', h(async (req, res) => {
    const f = exercisesQuery.parse(req.query);
    const [list, groups, last] = await Promise.all([repo.listExercises(uid(req), f), groupNames(repo), repo.lastSets(uid(req))]);
    res.json(list.map((e) => exerciseView(e, uid(req), groups, last.get(e.id))));
  }));

  r.get('/:id', h(async (req, res) => {
    const e = await visibleExercise(repo, String(req.params.id), uid(req));
    const [groups, last] = await Promise.all([groupNames(repo), repo.lastSets(uid(req))]);
    res.json(exerciseView(e, uid(req), groups, last.get(e.id)));
  }));

  r.post('/', h(async (req, res) => {
    const body = exerciseInput.parse(req.body);
    await checkGroup(body.muscleGroupId);
    await checkUniqueName(uid(req), body.name);
    const e = await repo.createExercise({ ...body, ownerId: uid(req) });
    res.status(201).json(exerciseView(e, uid(req), await groupNames(repo)));
  }));

  r.patch('/:id', h(async (req, res) => {
    const patch = exercisePatch.parse(req.body);
    const e = await ownExercise(req);
    await checkGroup(patch.muscleGroupId);
    if (patch.name) await checkUniqueName(uid(req), patch.name, e.id);
    const updated = await repo.updateExercise(e.id, patch);
    res.json(exerciseView(updated, uid(req), await groupNames(repo), (await repo.lastSets(uid(req))).get(e.id)));
  }));

  r.delete('/:id', h(async (req, res) => {
    const e = await ownExercise(req);
    // Вправу з історією не видаляємо: інакше зникли б підходи й зламалася статистика
    if ((await repo.deleteExercise(e.id)) === 'in_use') throw new HttpError(409, 'exercise_in_use');
    res.status(204).end();
  }));

  // Підказка щодо збільшення навантаження (підрозділ 4.8.2) за двома останніми завершеними тренуваннями з цією вправою
  r.get('/:id/hint', h(async (req, res) => {
    const e = await visibleExercise(repo, String(req.params.id), uid(req));
    const q = hintQuery.parse(req.query);
    const { items } = await repo.listWorkouts(uid(req), { exerciseId: e.id, status: 'completed' }, { page: 1, pageSize: 2 });
    const sessions = items.map((w) => ({ date: w.startedAt, sets: w.sets.filter((s) => s.exerciseId === e.id) }));
    res.json({ exerciseId: e.id, range: { lo: q.lo, hi: q.hi }, hint: progressionHint(sessions, q, q.plateStepKg) });
  }));

  return r;
}
