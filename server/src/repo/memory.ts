// Сховище в пам'яті з тією самою поведінкою, що й PrismaRepo. Використовується в швидких тестах
// і для запуску сервера без бази даних (npm run dev без DATABASE_URL).
import { randomUUID } from 'node:crypto';
import { DEFAULT_EXERCISES, MUSCLE_GROUPS } from './defaults.js';
import type { Exercise, LastSet, Program, Repo, SetRec, User, Workout, WorkoutFilter } from './types.js';

export type * from './types.js';

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'uk');

export function matchesFilter(w: Workout, f: WorkoutFilter): boolean {
  return (!f.from || w.startedAt >= f.from)
    && (!f.to || w.startedAt <= f.to)
    && (!f.status || w.status === f.status)
    && (!f.exerciseId || w.sets.some((s) => s.exerciseId === f.exerciseId))
    && (f.muscleGroupId === undefined || w.sets.some((s) => s.muscleGroupId === f.muscleGroupId));
}

export function createMemoryRepo(): Repo {
  const users = new Map<string, User>();
  const exercises = new Map<string, Exercise>(
    DEFAULT_EXERCISES.map((e) => [e.key, { id: e.key, name: e.name, muscleGroupId: e.muscleGroupId, ownerId: null }]),
  );
  const programs = new Map<string, Program>();
  const workouts = new Map<string, Workout>();

  const must = <T>(x: T | undefined, what: string): T => {
    if (x === undefined) throw new Error(`${what} не знайдено`);
    return x;
  };
  // Повертаємо копії, щоб код застосунку не міг змінити «базу» в обхід сховища
  const copyW = (w: Workout): Workout => ({ ...w, sets: w.sets.map((s) => ({ ...s })) });
  const copyP = (p: Program): Program => ({ ...p, items: p.items.map((i) => ({ ...i })) });

  return {
    async findUserByEmail(email) { return [...users.values()].find((u) => u.email === email.toLowerCase()); },
    async findUserById(id) { return users.get(id); },
    async createUser(u) {
      const x: User = { weightUnit: 'kg', ...u, email: u.email.toLowerCase(), id: randomUUID() };
      users.set(x.id, x); return { ...x };
    },
    async updateUser(id, patch) {
      const u = { ...must(users.get(id), 'Користувача'), ...patch }; users.set(id, u); return { ...u };
    },

    async listMuscleGroups() { return MUSCLE_GROUPS.map((g) => ({ ...g })); },
    async listExercises(userId, f = {}) {
      const q = f.q?.trim().toLowerCase();
      return [...exercises.values()]
        .filter((e) => (e.ownerId === null || e.ownerId === userId)
          && (f.muscleGroupId === undefined || e.muscleGroupId === f.muscleGroupId)
          && (!q || e.name.toLowerCase().includes(q)))
        .sort(byName).map((e) => ({ ...e }));
    },
    async getExercise(id) { const e = exercises.get(id); return e && { ...e }; },
    async createExercise(e) { const x = { ...e, id: randomUUID() }; exercises.set(x.id, x); return { ...x }; },
    async updateExercise(id, patch) {
      const e = { ...must(exercises.get(id), 'Вправу'), ...patch }; exercises.set(id, e);
      for (const w of workouts.values()) for (const s of w.sets) if (s.exerciseId === id) s.muscleGroupId = e.muscleGroupId;
      return { ...e };
    },
    async deleteExercise(id) {
      const used = [...workouts.values()].some((w) => w.sets.some((s) => s.exerciseId === id))
        || [...programs.values()].some((p) => p.items.some((i) => i.exerciseId === id));
      if (used) return 'in_use';
      exercises.delete(id); return 'deleted';
    },
    async lastSets(userId) {
      const out = new Map<string, LastSet>();
      for (const w of workouts.values()) {
        if (w.userId !== userId) continue;
        for (const s of w.sets) {
          const cur = out.get(s.exerciseId);
          if (!cur || s.createdAt >= cur.createdAt) out.set(s.exerciseId, { weightKg: s.weightKg, reps: s.reps, createdAt: s.createdAt });
        }
      }
      return out;
    },

    async listPrograms(userId) { return [...programs.values()].filter((p) => p.userId === userId).sort(byName).map(copyP); },
    async getProgram(id) { const p = programs.get(id); return p && copyP(p); },
    async createProgram(userId, p) {
      const x: Program = { id: randomUUID(), userId, name: p.name, items: p.items.map((i, position) => ({ ...i, position })) };
      programs.set(x.id, x); return copyP(x);
    },
    async updateProgram(id, patch) {
      const p = must(programs.get(id), 'Програму');
      const x: Program = { ...p, name: patch.name ?? p.name, items: patch.items ? patch.items.map((i, position) => ({ ...i, position })) : p.items };
      programs.set(id, x); return copyP(x);
    },
    async deleteProgram(id) {
      programs.delete(id);
      for (const w of workouts.values()) if (w.programId === id) w.programId = null; // як ON DELETE SET NULL
    },

    async createWorkout(userId, programId = null) {
      const w: Workout = { id: randomUUID(), userId, programId, status: 'in_progress', startedAt: new Date(), finishedAt: null, sets: [] };
      workouts.set(w.id, w); return copyW(w);
    },
    async getWorkout(id) { const w = workouts.get(id); return w && copyW(w); },
    async setWorkoutStatus(id, status, finishedAt) {
      const w = must(workouts.get(id), 'Тренування'); w.status = status; w.finishedAt = finishedAt; return copyW(w);
    },
    async addSet(workoutId, s) {
      const w = must(workouts.get(workoutId), 'Тренування');
      const e = must(exercises.get(s.exerciseId), 'Вправу');
      const rec: SetRec = {
        id: randomUUID(), workoutId, exerciseId: s.exerciseId, muscleGroupId: e.muscleGroupId,
        setNumber: Math.max(0, ...w.sets.map((x) => x.setNumber)) + 1, weightKg: s.weightKg, reps: s.reps, createdAt: new Date(),
      };
      w.sets.push(rec); return { ...rec };
    },
    async deleteSet(workoutId, setId) {
      const w = workouts.get(workoutId); if (!w) return false;
      const before = w.sets.length; w.sets = w.sets.filter((s) => s.id !== setId);
      return w.sets.length < before;
    },
    async deleteWorkout(id) { workouts.delete(id); },
    async listWorkouts(userId, f = {}, page) {
      const all = [...workouts.values()]
        .filter((w) => w.userId === userId && matchesFilter(w, f))
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
      const items = page ? all.slice((page.page - 1) * page.pageSize, page.page * page.pageSize) : all;
      return { total: all.length, items: items.map(copyW) };
    },
  };
}
