// Типи записів та інтерфейс сховища. Реалізації: PostgreSQL через Prisma (prisma.ts) і пам'ять для швидких тестів (memory.ts).
import type { WorkoutStatus } from '../domain/workoutState.js';

export type WeightUnit = 'kg' | 'lb';

export type User = { id: string; email: string; passwordHash: string; displayName: string; weightUnit: WeightUnit };
export type MuscleGroup = { id: number; name: string };
/** ownerId = null — загальна вправа бібліотеки; інакше — власна вправа користувача. */
export type Exercise = { id: string; name: string; muscleGroupId: number; ownerId: string | null };

export type ProgramItem = { exerciseId: string; position: number; targetSets: number; targetReps: number };
export type Program = { id: string; userId: string; name: string; items: ProgramItem[] };
export type ProgramItemInput = Omit<ProgramItem, 'position'>; // позиція визначається порядком у масиві

export type SetRec = {
  id: string; workoutId: string; exerciseId: string; muscleGroupId: number;
  setNumber: number; weightKg: number; reps: number; createdAt: Date;
};
export type Workout = {
  id: string; userId: string; programId: string | null; status: WorkoutStatus;
  startedAt: Date; finishedAt: Date | null; sets: SetRec[];
};

/** Фільтри історії (FR-07): комбінуються між собою. */
export type WorkoutFilter = {
  from?: Date; to?: Date; exerciseId?: string; muscleGroupId?: number; status?: WorkoutStatus;
};
export type Page = { page: number; pageSize: number };
export type LastSet = { weightKg: number; reps: number; createdAt: Date };

export interface Repo {
  // Користувачі та профіль
  findUserByEmail(email: string): Promise<User | undefined>;
  findUserById(id: string): Promise<User | undefined>;
  createUser(u: Omit<User, 'id' | 'weightUnit'> & { weightUnit?: WeightUnit }): Promise<User>;
  updateUser(id: string, patch: Partial<Pick<User, 'displayName' | 'weightUnit'>>): Promise<User>;

  // Групи м'язів і вправи
  listMuscleGroups(): Promise<MuscleGroup[]>;
  /** Загальні вправи та власні вправи користувача; q — пошук за назвою без урахування регістру. */
  listExercises(userId: string, filter?: { q?: string; muscleGroupId?: number }): Promise<Exercise[]>;
  getExercise(id: string): Promise<Exercise | undefined>;
  createExercise(e: Omit<Exercise, 'id'>): Promise<Exercise>;
  updateExercise(id: string, patch: Partial<Pick<Exercise, 'name' | 'muscleGroupId'>>): Promise<Exercise>;
  /** 'in_use' — вправа вже є в підходах або програмах, і видалення порушило б історію. */
  deleteExercise(id: string): Promise<'deleted' | 'in_use'>;
  /** Останній підхід користувача для кожної вправи (для карток бібліотеки вправ). */
  lastSets(userId: string): Promise<Map<string, LastSet>>;

  // Програми
  listPrograms(userId: string): Promise<Program[]>;
  getProgram(id: string): Promise<Program | undefined>;
  createProgram(userId: string, p: { name: string; items: ProgramItemInput[] }): Promise<Program>;
  updateProgram(id: string, patch: { name?: string; items?: ProgramItemInput[] }): Promise<Program>;
  deleteProgram(id: string): Promise<void>;

  // Тренування та підходи
  createWorkout(userId: string, programId?: string | null): Promise<Workout>;
  getWorkout(id: string): Promise<Workout | undefined>;
  setWorkoutStatus(id: string, status: WorkoutStatus, finishedAt: Date | null): Promise<Workout>;
  /** Додає підхід із наступним номером у межах тренування. */
  addSet(workoutId: string, s: { exerciseId: string; weightKg: number; reps: number }): Promise<SetRec>;
  deleteSet(workoutId: string, setId: string): Promise<boolean>;
  deleteWorkout(id: string): Promise<void>;
  /** Тренування користувача, від нових до старих; без page — усі, що відповідають фільтру. */
  listWorkouts(userId: string, filter?: WorkoutFilter, page?: Page): Promise<{ total: number; items: Workout[] }>;
}
