// Довідкові дані: групи м'язів і загальна бібліотека вправ (екран «Вправи» в макетах).
// Записуються в базу під час запуску сервера (seed.ts) і використовуються сховищем у пам'яті.
import type { MuscleGroup } from './types.js';

export const MUSCLE_GROUPS: MuscleGroup[] = [
  { id: 1, name: 'Груди' },
  { id: 2, name: 'Спина' },
  { id: 3, name: 'Ноги' },
  { id: 4, name: 'Плечі' },
  { id: 5, name: 'Біцепс' },
  { id: 6, name: 'Трицепс' },
  { id: 7, name: 'Прес' },
];

/** key — стабільний ідентифікатор для сховища в пам'яті (у PostgreSQL ідентифікатори — UUID). */
export const DEFAULT_EXERCISES: { key: string; name: string; muscleGroupId: number }[] = [
  { key: 'bench', name: 'Жим лежачи', muscleGroupId: 1 },
  { key: 'incline-db-press', name: 'Жим гантелей на похилій лаві', muscleGroupId: 1 },
  { key: 'dips', name: 'Віджимання на брусах', muscleGroupId: 1 },
  { key: 'row', name: 'Тяга штанги в нахилі', muscleGroupId: 2 },
  { key: 'deadlift', name: 'Станова тяга', muscleGroupId: 2 },
  { key: 'pull-up', name: 'Підтягування', muscleGroupId: 2 },
  { key: 'squat', name: 'Присідання зі штангою', muscleGroupId: 3 },
  { key: 'leg-press', name: 'Жим ногами', muscleGroupId: 3 },
  { key: 'ohp', name: 'Жим штанги стоячи', muscleGroupId: 4 },
  { key: 'lateral-raise', name: 'Махи гантелями в сторони', muscleGroupId: 4 },
  { key: 'curl', name: 'Згинання на біцепс зі штангою', muscleGroupId: 5 },
  { key: 'pushdown', name: 'Розгинання на трицепс (блок)', muscleGroupId: 6 },
  { key: 'cable-crunch', name: 'Скручування на блоці', muscleGroupId: 7 },
];
