// Перетворення записів сховища на відповіді API. Чисті функції — перевіряються модульними тестами.
import type { Exercise, LastSet, Program, User, WeightUnit, Workout } from '../repo/types.js';
import { estimatedOneRepMax, kgToLb, tonnage } from './stats.js';

const round1 = (x: number) => Math.round(x * 10) / 10;
const round2 = (x: number) => Math.round(x * 100) / 100;

/** Вага для відображення в одиницях користувача (FR-02): у базі завжди кілограми. */
export const displayWeight = (kg: number, unit: WeightUnit): number => (unit === 'lb' ? round1(kgToLb(kg)) : round2(kg));

export const userView = (u: User) => ({ id: u.id, email: u.email, displayName: u.displayName, weightUnit: u.weightUnit });

export function exerciseView(e: Exercise, userId: string, groups: Map<number, string>, last?: LastSet) {
  const orm = last ? estimatedOneRepMax(last) : null;
  return {
    id: e.id,
    name: e.name,
    muscleGroupId: e.muscleGroupId,
    muscleGroup: groups.get(e.muscleGroupId) ?? '',
    own: e.ownerId === userId,
    lastSet: last ? { weightKg: last.weightKg, reps: last.reps, date: last.createdAt } : null,
    oneRepMax: orm === null ? null : round1(orm),
  };
}

export function programView(p: Program, exercises: Map<string, Exercise>) {
  return {
    id: p.id,
    name: p.name,
    items: p.items.map((i) => ({
      ...i,
      exerciseName: exercises.get(i.exerciseId)?.name ?? '',
      muscleGroupId: exercises.get(i.exerciseId)?.muscleGroupId ?? null,
    })),
  };
}

/** Повне тренування для екрана журналу. */
export function workoutView(w: Workout, names: Map<string, string>, unit: WeightUnit, programName: string | null = null) {
  return {
    id: w.id,
    status: w.status,
    startedAt: w.startedAt,
    finishedAt: w.finishedAt,
    programId: w.programId,
    programName,
    weightUnit: unit,
    sets: w.sets.map((s) => {
      const orm = estimatedOneRepMax(s);
      return {
        ...s,
        exerciseName: names.get(s.exerciseId) ?? '',
        displayWeight: displayWeight(s.weightKg, unit),
        oneRepMax: orm === null ? null : round1(orm),
      };
    }),
  };
}

/** Короткий підсумок тренування для історії (FR-07): кількість підходів, тоннаж, тривалість, розбивка за вправами. */
export function workoutSummary(w: Workout, names: Map<string, string>) {
  const byExercise = new Map<string, { exerciseId: string; name: string; sets: number; best: { weightKg: number; reps: number } }>();
  for (const s of w.sets) {
    const cur = byExercise.get(s.exerciseId);
    if (!cur) {
      byExercise.set(s.exerciseId, { exerciseId: s.exerciseId, name: names.get(s.exerciseId) ?? '', sets: 1, best: { weightKg: s.weightKg, reps: s.reps } });
      continue;
    }
    cur.sets += 1;
    // Найкращий підхід — з більшою вагою, а за рівної ваги — з більшою кількістю повторень
    if (s.weightKg > cur.best.weightKg || (s.weightKg === cur.best.weightKg && s.reps > cur.best.reps)) {
      cur.best = { weightKg: s.weightKg, reps: s.reps };
    }
  }
  return {
    id: w.id,
    status: w.status,
    startedAt: w.startedAt,
    finishedAt: w.finishedAt,
    programId: w.programId,
    durationMin: w.finishedAt ? Math.round((w.finishedAt.getTime() - w.startedAt.getTime()) / 60_000) : null,
    setCount: w.sets.length,
    tonnageKg: round2(w.sets.reduce((sum, s) => sum + tonnage(s), 0)),
    muscleGroupIds: [...new Set(w.sets.map((s) => s.muscleGroupId))].sort((a, b) => a - b),
    exercises: [...byExercise.values()],
  };
}
