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

/** Параметри історії тренувань: сторінка, розмір сторінки, період. */
export const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  from: dateParam.optional(),
  to: dateParam.optional(),
});

/** Параметри статистики: період і зсув часового поясу користувача (хвилини від UTC). */
export const statsQuery = z.object({
  from: dateParam.optional(),
  to: dateParam.optional(),
  tzOffsetMin: z.coerce.number().int().min(-720).max(840).default(0),
});
