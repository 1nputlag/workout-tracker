// Журналювання тренувань (FR-05), історія з фільтрами (FR-07) і показники прогресу (FR-06, діаграма 4.10).
import { Router } from 'express';
import { HttpError, h, invalidField, notFound, uid, type AuthedRequest, type Deps } from '../http.js';
import { listQuery, setInput, startWorkoutInput, statsQuery } from '../validation/schemas.js';
import { transition, type WorkoutEvent } from '../domain/workoutState.js';
import { dailyBestOneRepMax, weeklyTonnage, weeklyVolume, type SetRow } from '../services/stats.js';
import { workoutSummary, workoutView } from '../services/views.js';
import type { Repo, WeightUnit, Workout } from '../repo/types.js';

const round2 = (x: number) => Math.round(x * 100) / 100;

async function exerciseNames(repo: Repo, userId: string): Promise<Map<string, string>> {
  return new Map((await repo.listExercises(userId)).map((e) => [e.id, e.name]));
}
async function unitOf(repo: Repo, userId: string): Promise<WeightUnit> {
  return (await repo.findUserById(userId))?.weightUnit ?? 'kg';
}

export function workoutRoutes({ repo }: Deps) {
  const r = Router();

  // Чуже або неіснуюче тренування — однакова відповідь 404, щоб не розкривати існування записів (FR-09)
  const ownWorkout = async (req: AuthedRequest) => {
    const w = await repo.getWorkout(String(req.params.id));
    if (!w || w.userId !== uid(req)) throw notFound();
    return w;
  };
  const detail = async (w: Workout, userId: string) => {
    const [names, unit, program] = await Promise.all([
      exerciseNames(repo, userId), unitOf(repo, userId), w.programId ? repo.getProgram(w.programId) : undefined,
    ]);
    return workoutView(w, names, unit, program?.name ?? null);
  };

  r.post('/', h(async (req, res) => {
    const { programId } = startWorkoutInput.parse(req.body ?? {});
    if (programId) {
      const p = await repo.getProgram(programId);
      if (!p || p.userId !== uid(req)) throw invalidField('programId', 'Невідома програма');
    }
    const w = await repo.createWorkout(uid(req), programId ?? null);
    res.status(201).json(await detail(w, uid(req)));
  }));

  // Історія: фільтри за періодом, вправою, групою мʼязів і статусом комбінуються; пагінація на боці бази
  r.get('/', h(async (req, res) => {
    const { page, pageSize, ...filter } = listQuery.parse(req.query);
    const [{ total, items }, names] = await Promise.all([
      repo.listWorkouts(uid(req), filter, { page, pageSize }), exerciseNames(repo, uid(req)),
    ]);
    res.json({ total, page, pageSize, items: items.map((w) => workoutSummary(w, names)) });
  }));

  r.get('/:id', h(async (req, res) => {
    res.json(await detail(await ownWorkout(req), uid(req)));
  }));

  r.delete('/:id', h(async (req, res) => {
    const w = await ownWorkout(req);
    await repo.deleteWorkout(w.id);
    res.status(204).end();
  }));

  r.post('/:id/sets', h(async (req, res) => {
    const w = await ownWorkout(req);
    const body = setInput.parse(req.body);
    if (w.status !== 'in_progress') throw new HttpError(409, 'workout_not_in_progress');
    const e = await repo.getExercise(body.exerciseId);
    if (!e || (e.ownerId !== null && e.ownerId !== uid(req))) throw invalidField('exerciseId', 'Невідома вправа');
    // Вага зберігається з точністю до 0,01 кг (тип DECIMAL(6,2) у базі)
    const rec = await repo.addSet(w.id, { exerciseId: e.id, weightKg: round2(body.weightKg), reps: body.reps });
    res.status(201).json({ ...rec, exerciseName: e.name });
  }));

  r.delete('/:id/sets/:setId', h(async (req, res) => {
    const w = await ownWorkout(req);
    if (w.status !== 'in_progress') throw new HttpError(409, 'workout_not_in_progress');
    if (!(await repo.deleteSet(w.id, String(req.params.setId)))) throw notFound();
    res.status(204).end();
  }));

  // Переходи життєвого циклу (діаграма станів 4.6); недопустимий перехід — 409 invalid_transition
  const lifecycle = (event: WorkoutEvent) => h(async (req, res) => {
    const w = await ownWorkout(req);
    const status = transition(w.status, event, { setCount: w.sets.length });
    const finishedAt = status === 'completed' ? new Date() : status === 'in_progress' ? null : w.finishedAt;
    const updated = await repo.setWorkoutStatus(w.id, status, finishedAt);
    res.json({ id: updated.id, status: updated.status, finishedAt: updated.finishedAt });
  });
  r.post('/:id/finish', lifecycle('finish'));
  r.post('/:id/cancel', lifecycle('cancel'));
  r.post('/:id/reopen', lifecycle('reopen'));

  return r;
}

export function statsRoutes({ repo }: Deps) {
  const r = Router();

  // Показники рахуються на сервері лише із завершених тренувань
  r.get('/progress', h(async (req, res) => {
    const { from, to, tzOffsetMin: tz, exerciseId } = statsQuery.parse(req.query);
    const { items: done } = await repo.listWorkouts(uid(req), { from, to, status: 'completed' });
    const rows: (SetRow & { exerciseId: string })[] = done.flatMap((w) => w.sets.map((s) => ({
      weightKg: s.weightKg, reps: s.reps, date: s.createdAt, muscleGroupId: s.muscleGroupId, exerciseId: s.exerciseId,
    })));
    const ormRows = exerciseId ? rows.filter((s) => s.exerciseId === exerciseId) : rows;
    res.json({
      workouts: done.length,
      sets: rows.length,
      weeklyVolume: Object.fromEntries(weeklyVolume(rows, tz)),
      weeklyTonnage: Object.fromEntries(weeklyTonnage(rows, tz)),
      oneRepMax: Object.fromEntries(dailyBestOneRepMax(ormRows, tz)),
    });
  }));

  return r;
}
