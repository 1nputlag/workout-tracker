import { randomUUID } from 'node:crypto';
import type { WorkoutStatus } from '../domain/workoutState.js';

export type User = { id: string; email: string; passwordHash: string; displayName: string };
export type SetRec = { id: string; workoutId: string; exerciseId: string; muscleGroupId: number; setNumber: number; weightKg: number; reps: number; createdAt: Date };
export type Workout = { id: string; userId: string; status: WorkoutStatus; startedAt: Date; finishedAt: Date | null; sets: SetRec[] };

/** Інтерфейс сховища. У справжньому застосунку його реалізує Prisma (PostgreSQL), у тестах — пам'ять. */
export interface Repo {
  findUserByEmail(email: string): Promise<User | undefined>;
  createUser(u: Omit<User, 'id'>): Promise<User>;
  createWorkout(userId: string): Promise<Workout>;
  getWorkout(id: string): Promise<Workout | undefined>;
  saveWorkout(w: Workout): Promise<void>;
  listWorkouts(userId: string, from?: Date, to?: Date): Promise<Workout[]>;
  muscleGroupOf(exerciseId: string): Promise<number | undefined>;
}

export function createMemoryRepo(exercises: Record<string, number> = { bench: 1, squat: 2, row: 3 }): Repo {
  const users = new Map<string, User>();
  const workouts = new Map<string, Workout>();
  return {
    async findUserByEmail(email) { return [...users.values()].find((u) => u.email === email.toLowerCase()); },
    async createUser(u) { const x = { ...u, email: u.email.toLowerCase(), id: randomUUID() }; users.set(x.id, x); return x; },
    async createWorkout(userId) {
      const w: Workout = { id: randomUUID(), userId, status: 'in_progress', startedAt: new Date(), finishedAt: null, sets: [] };
      workouts.set(w.id, w); return w;
    },
    async getWorkout(id) { return workouts.get(id); },
    async saveWorkout(w) { workouts.set(w.id, w); },
    async listWorkouts(userId, from, to) {
      return [...workouts.values()].filter((w) => w.userId === userId && (!from || w.startedAt >= from) && (!to || w.startedAt <= to));
    },
    async muscleGroupOf(exerciseId) { return exercises[exerciseId]; },
  };
}
