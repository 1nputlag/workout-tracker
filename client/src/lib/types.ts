// Типи відповідей REST API (docs/api.md)
export type WeightUnit = 'kg' | 'lb';
export type WorkoutStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export type User = { id: string; email: string; displayName: string; weightUnit: WeightUnit };
export type AuthResponse = { token: string; user: User };

export type MuscleGroup = { id: number; name: string };

export type Exercise = {
  id: string;
  name: string;
  muscleGroupId: number;
  muscleGroup: string;
  own: boolean;
  lastSet: { weightKg: number; reps: number; date: string } | null;
  oneRepMax: number | null;
};

export type ProgramItem = {
  exerciseId: string; exerciseName: string; muscleGroupId: number | null;
  position: number; targetSets: number; targetReps: number;
};
export type Program = { id: string; name: string; items: ProgramItem[] };

export type WorkoutSet = {
  id: string; exerciseId: string; exerciseName: string; muscleGroupId: number;
  setNumber: number; weightKg: number; displayWeight: number; reps: number;
  oneRepMax: number | null; createdAt: string;
};

export type WorkoutDetail = {
  id: string; status: WorkoutStatus; startedAt: string; finishedAt: string | null;
  programId: string | null; programName: string | null; weightUnit: WeightUnit; sets: WorkoutSet[];
};

export type WorkoutSummary = {
  id: string; status: WorkoutStatus; startedAt: string; finishedAt: string | null; programId: string | null;
  durationMin: number | null; setCount: number; tonnageKg: number; muscleGroupIds: number[];
  exercises: { exerciseId: string; name: string; sets: number; best: { weightKg: number; reps: number } }[];
};
export type HistoryPage = { total: number; page: number; pageSize: number; items: WorkoutSummary[] };

export type Progress = {
  workouts: number;
  sets: number;
  weeklyVolume: Record<string, number>; // «2026-W42|1» → підходів
  weeklyTonnage: Record<string, number>; // «2026-W42» → кг
  oneRepMax: Record<string, number>; // «2026-10-16» → кг
};

export type Hint =
  | { kind: 'insufficient_data' }
  | { kind: 'increase_weight'; fromKg: number; toKg: number; exceedsRange: boolean }
  | { kind: 'increase_reps'; weightKg: number }
  | { kind: 'keep_or_reduce'; weightKg: number };
export type HintResponse = { exerciseId: string; range: { lo: number; hi: number }; hint: Hint };
