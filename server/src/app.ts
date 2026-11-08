import express, { type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import type { Repo } from './repo/types.js';
import { InvalidTransitionError } from './domain/workoutState.js';
import { HttpError } from './http.js';
import { authMiddleware, authRoutes, profileRoutes } from './routes/auth.js';
import { exerciseRoutes, muscleGroupRoutes } from './routes/exercises.js';
import { programRoutes } from './routes/programs.js';
import { statsRoutes, workoutRoutes } from './routes/workouts.js';

export type AppOptions = { repo: Repo; jwtSecret: string; bcryptCost?: number };

// Коди помилок Prisma, що виникають через одночасні запити (запис уже видалено, дубль, порушення зв'язку)
const PRISMA_STATUS: Record<string, [number, string]> = {
  P2025: [404, 'not_found'],
  P2002: [409, 'conflict'],
  P2003: [409, 'conflict'],
};

export function createApp({ repo, jwtSecret, bcryptCost = 10 }: AppOptions) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  // Перевірка працездатності для Docker Compose та CI
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  const deps = { repo };
  const auth = authMiddleware(jwtSecret);
  app.use('/api/auth', authRoutes({ ...deps, jwtSecret, bcryptCost }));
  app.use('/api/profile', auth, profileRoutes(deps));
  app.use('/api/muscle-groups', auth, muscleGroupRoutes(deps));
  app.use('/api/exercises', auth, exerciseRoutes(deps));
  app.use('/api/programs', auth, programRoutes(deps));
  app.use('/api/workouts', auth, workoutRoutes(deps));
  app.use('/api/stats', auth, statsRoutes(deps));

  app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

  // --- Єдиний обробник помилок
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'validation_error', details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
    }
    if (err instanceof HttpError) {
      return res.status(err.status).json(err.details ? { error: err.code, details: err.details } : { error: err.code });
    }
    if ((err as { type?: string }).type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_json' });
    if ((err as { type?: string }).type === 'entity.too.large') return res.status(413).json({ error: 'payload_too_large' });
    if (err instanceof InvalidTransitionError) return res.status(409).json({ error: 'invalid_transition', message: err.message });
    const prisma = PRISMA_STATUS[(err as { code?: string }).code ?? ''];
    if (prisma) return res.status(prisma[0]).json({ error: prisma[1] });
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}
