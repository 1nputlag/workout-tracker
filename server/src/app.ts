import express, { type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import type { Repo } from './repo/memory.js';
import { listQuery, loginInput, registerInput, setInput, statsQuery } from './validation/schemas.js';
import { InvalidTransitionError, transition } from './domain/workoutState.js';
import { dailyBestOneRepMax, weeklyTonnage, weeklyVolume, type SetRow } from './services/stats.js';

export type AppOptions = { repo: Repo; jwtSecret: string; bcryptCost?: number };
type AuthedRequest = Request & { userId?: string };

export function createApp({ repo, jwtSecret, bcryptCost = 10 }: AppOptions) {
  const app = express();
  app.use(express.json());

  // Перевірка працездатності для Docker Compose та CI
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  const sign = (userId: string) => jwt.sign({ sub: userId }, jwtSecret, { expiresIn: '7d' });

  // --- Автентифікація (сервіс автентифікації з діаграми 4.9)
  app.post('/api/auth/register', async (req, res, next) => {
    try {
      const body = registerInput.parse(req.body);
      if (await repo.findUserByEmail(body.email)) return res.status(409).json({ error: 'email_taken' });
      const user = await repo.createUser({
        email: body.email,
        displayName: body.displayName ?? body.email.split('@')[0],
        passwordHash: await bcrypt.hash(body.password, bcryptCost),
      });
      res.status(201).json({ token: sign(user.id), user: { id: user.id, email: user.email, displayName: user.displayName } });
    } catch (e) { next(e); }
  });

  app.post('/api/auth/login', async (req, res, next) => {
    try {
      const body = loginInput.parse(req.body);
      const user = await repo.findUserByEmail(body.email);
      // Однакова відповідь для невідомої пошти й неправильного пароля — користувач не може дізнатися, чи зареєстровано пошту
      const ok = user ? await bcrypt.compare(body.password, user.passwordHash) : false;
      if (!user || !ok) return res.status(401).json({ error: 'invalid_credentials' });
      res.json({ token: sign(user.id), user: { id: user.id, email: user.email, displayName: user.displayName } });
    } catch (e) { next(e); }
  });

  // --- Проміжний шар перевірки токена
  const auth = (req: AuthedRequest, res: Response, next: NextFunction) => {
    const h = req.header('authorization');
    const token = h?.startsWith('Bearer ') ? h.slice(7) : undefined;
    if (!token) return res.status(401).json({ error: 'unauthorized' });
    try {
      const p = jwt.verify(token, jwtSecret) as jwt.JwtPayload;
      req.userId = String(p.sub);
      next();
    } catch { res.status(401).json({ error: 'unauthorized' }); }
  };

  // --- Тренування
  app.post('/api/workouts', auth, async (req: AuthedRequest, res, next) => {
    try { res.status(201).json(await repo.createWorkout(req.userId!)); } catch (e) { next(e); }
  });

  // Чуже або неіснуюче тренування — однакова відповідь 404, щоб не розкривати існування записів
  const ownWorkout = async (req: AuthedRequest, res: Response) => {
    const w = await repo.getWorkout(String(req.params.id));
    if (!w || w.userId !== req.userId) { res.status(404).json({ error: 'not_found' }); return undefined; }
    return w;
  };

  app.post('/api/workouts/:id/sets', auth, async (req: AuthedRequest, res, next) => {
    try {
      const w = await ownWorkout(req, res); if (!w) return;
      const body = setInput.parse(req.body);
      if (w.status !== 'in_progress') return res.status(409).json({ error: 'workout_not_in_progress' });
      const mg = await repo.muscleGroupOf(body.exerciseId);
      if (mg === undefined) return res.status(400).json({ error: 'validation_error', details: [{ path: 'exerciseId', message: 'Невідома вправа' }] });
      const rec = { id: randomUUID(), workoutId: w.id, exerciseId: body.exerciseId, muscleGroupId: mg, setNumber: w.sets.length + 1, weightKg: body.weightKg, reps: body.reps, createdAt: new Date() };
      w.sets.push(rec); await repo.saveWorkout(w);
      res.status(201).json(rec);
    } catch (e) { next(e); }
  });

  app.post('/api/workouts/:id/finish', auth, async (req: AuthedRequest, res, next) => {
    try {
      const w = await ownWorkout(req, res); if (!w) return;
      w.status = transition(w.status, 'finish', { setCount: w.sets.length });
      w.finishedAt = new Date(); await repo.saveWorkout(w);
      res.json({ id: w.id, status: w.status });
    } catch (e) { next(e); }
  });

  // Історія з фільтром за періодом і пагінацією
  app.get('/api/workouts', auth, async (req: AuthedRequest, res, next) => {
    try {
      const { page, pageSize, from, to } = listQuery.parse(req.query);
      const all = (await repo.listWorkouts(req.userId!, from, to)).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
      res.json({ total: all.length, page, pageSize, items: all.slice((page - 1) * pageSize, page * pageSize).map((w) => ({ id: w.id, status: w.status, startedAt: w.startedAt, sets: w.sets.length })) });
    } catch (e) { next(e); }
  });

  // Показники прогресу (діаграма 4.10): рахуються на сервері з завершених тренувань
  app.get('/api/stats/progress', auth, async (req: AuthedRequest, res, next) => {
    try {
      const { from, to, tzOffsetMin: tz } = statsQuery.parse(req.query);
      const done = (await repo.listWorkouts(req.userId!, from, to)).filter((w) => w.status === 'completed');
      const rows: SetRow[] = done.flatMap((w) => w.sets.map((s) => ({ weightKg: s.weightKg, reps: s.reps, date: s.createdAt, muscleGroupId: s.muscleGroupId })));
      res.json({
        weeklyVolume: Object.fromEntries(weeklyVolume(rows, tz)),
        weeklyTonnage: Object.fromEntries(weeklyTonnage(rows, tz)),
        oneRepMax: Object.fromEntries(dailyBestOneRepMax(rows, tz)),
      });
    } catch (e) { next(e); }
  });

  // --- Єдиний обробник помилок
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'validation_error', details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
    }
    if ((err as { type?: string }).type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_json' });
    if (err instanceof InvalidTransitionError) return res.status(409).json({ error: 'invalid_transition', message: err.message });
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}
