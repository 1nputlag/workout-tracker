import { z } from 'zod';

export const MAX_WEIGHT_KG = 1000;
export const MAX_REPS = 100;

export const setInput = z.object({
  exerciseId: z.string().min(1),
  weightKg: z.number().min(0).max(MAX_WEIGHT_KG),
  reps: z.number().int().min(1).max(MAX_REPS),
});

export const registerInput = z.object({
  email: z.string().email().max(254),
  // bcrypt обробляє лише перші 72 байти, тому довший пароль відхиляємо явно
  password: z.string().min(8).refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'Пароль занадто довгий'),
  displayName: z.string().min(1).max(60).optional(),
});

export const loginInput = z.object({ email: z.string().email(), password: z.string().min(1) });

export type SetInput = z.infer<typeof setInput>;

const dateParam = z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), 'Некоректна дата').transform((v) => new Date(v));

const idParam = z.string().trim().min(1).max(64);
const groupParam = z.coerce.number().int().min(1);

/** Параметри історії тренувань (FR-07): сторінка, розмір сторінки, період, вправа, група м'язів — комбінуються. */
export const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  from: dateParam.optional(),
  to: dateParam.optional(),
  exerciseId: idParam.optional(),
  muscleGroupId: groupParam.optional(),
  status: z.enum(['planned', 'in_progress', 'completed', 'cancelled']).optional(),
});

/** Параметри статистики: період, зсув часового поясу користувача (хвилини від UTC) і вправа для графіка 1ПМ. */
export const statsQuery = z.object({
  from: dateParam.optional(),
  to: dateParam.optional(),
  tzOffsetMin: z.coerce.number().int().min(-720).max(840).default(0),
  exerciseId: idParam.optional(),
});

/** Параметри підказки прогресії: діапазон повторень і крок дисків. */
export const hintQuery = z.object({
  lo: z.coerce.number().int().min(1).max(MAX_REPS).default(6),
  hi: z.coerce.number().int().min(1).max(MAX_REPS).default(8),
  plateStepKg: z.coerce.number().positive().max(25).default(2.5),
}).refine((q) => q.lo <= q.hi, { message: 'Нижня межа більша за верхню', path: ['lo'] });

// ---------------- Профіль (FR-02) ----------------

const nonEmpty = (o: object) => Object.values(o).some((v) => v !== undefined);

export const profilePatch = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  weightUnit: z.enum(['kg', 'lb']).optional(),
}).strict().refine(nonEmpty, 'Немає полів для зміни');

// ---------------- Вправи (FR-03) ----------------

const exerciseName = z.string().trim().min(2).max(80);

export const exerciseInput = z.object({ name: exerciseName, muscleGroupId: groupParam.pipe(z.number().max(1000)) }).strict();
export const exercisePatch = exerciseInput.partial().strict().refine(nonEmpty, 'Немає полів для зміни');
export const exercisesQuery = z.object({
  q: z.string().trim().max(80).optional(),
  muscleGroupId: groupParam.optional(),
});

// ---------------- Програми (FR-04) ----------------

export const MAX_PROGRAM_ITEMS = 30;
const programItem = z.object({
  exerciseId: idParam,
  targetSets: z.number().int().min(1).max(20),
  targetReps: z.number().int().min(1).max(MAX_REPS),
}).strict();

export const programInput = z.object({
  name: z.string().trim().min(1).max(80),
  items: z.array(programItem).max(MAX_PROGRAM_ITEMS).default([]),
}).strict();
export const programPatch = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  items: z.array(programItem).max(MAX_PROGRAM_ITEMS).optional(),
}).strict().refine(nonEmpty, 'Немає полів для зміни');

/** Початок тренування: порожнє тіло або тренування за програмою. */
export const startWorkoutInput = z.object({ programId: idParam.optional() }).strict();
