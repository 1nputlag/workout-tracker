// Запити й мутації TanStack Query. Ключі кешу зібрані тут, щоб інвалідація була узгодженою.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from './api';
import type { Exercise, HintResponse, HistoryPage, MuscleGroup, Program, Progress, User, WeightUnit, WorkoutDetail, WorkoutSet } from './types';

export const keys = {
  groups: ['muscle-groups'] as const,
  exercises: (q = '', group?: number) => ['exercises', q, group ?? null] as const,
  programs: ['programs'] as const,
  workout: (id: string) => ['workout', id] as const,
  history: (params: object) => ['history', params] as const,
  progress: (params: object) => ['progress', params] as const,
  hint: (exerciseId: string) => ['hint', exerciseId] as const,
};

export function useMuscleGroups() {
  const q = useQuery({ queryKey: keys.groups, queryFn: () => api<MuscleGroup[]>('/muscle-groups'), staleTime: Infinity });
  return { ...q, map: new Map((q.data ?? []).map((g) => [g.id, g.name])) };
}

export function useExercises(q = '', muscleGroupId?: number) {
  return useQuery({
    queryKey: keys.exercises(q, muscleGroupId),
    queryFn: () => api<Exercise[]>('/exercises', { query: { q, muscleGroupId } }),
    placeholderData: keepPreviousData,
  });
}

export function usePrograms() {
  return useQuery({ queryKey: keys.programs, queryFn: () => api<Program[]>('/programs') });
}

export function useWorkout(id: string) {
  return useQuery({ queryKey: keys.workout(id), queryFn: () => api<WorkoutDetail>(`/workouts/${id}`) });
}

export type HistoryParams = { page: number; pageSize: number; from?: string; to?: string; exerciseId?: string; muscleGroupId?: number; status?: string };
export function useHistory(params: HistoryParams) {
  return useQuery({
    queryKey: keys.history(params),
    queryFn: () => api<HistoryPage>('/workouts', { query: params }),
    placeholderData: keepPreviousData,
  });
}

export function useProgress(params: { from?: string; tzOffsetMin: number; exerciseId?: string }) {
  return useQuery({
    queryKey: keys.progress(params),
    queryFn: () => api<Progress>('/stats/progress', { query: params }),
    placeholderData: keepPreviousData,
  });
}

export function useHint(exerciseId: string | undefined) {
  return useQuery({
    queryKey: keys.hint(exerciseId ?? ''),
    queryFn: () => api<HintResponse>(`/exercises/${exerciseId}/hint`),
    enabled: Boolean(exerciseId),
  });
}

/** Після будь-якої зміни тренування оновлюємо історію, статистику й картки вправ (останній підхід). */
function useInvalidateWorkoutData() {
  const qc = useQueryClient();
  return (id?: string) => Promise.all([
    id ? qc.invalidateQueries({ queryKey: keys.workout(id) }) : undefined,
    qc.invalidateQueries({ queryKey: ['history'] }),
    qc.invalidateQueries({ queryKey: ['progress'] }),
    qc.invalidateQueries({ queryKey: ['exercises'] }),
    qc.invalidateQueries({ queryKey: ['hint'] }),
  ]);
}

export function useStartWorkout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const invalidate = useInvalidateWorkoutData();
  return useMutation({
    mutationFn: (programId?: string) => api<WorkoutDetail>('/workouts', { method: 'POST', body: programId ? { programId } : {} }),
    onSuccess: (w) => {
      qc.setQueryData(keys.workout(w.id), w);
      void invalidate();
      navigate(`/workout/${w.id}`);
    },
  });
}

export function useAddSet(workoutId: string) {
  const qc = useQueryClient();
  const invalidate = useInvalidateWorkoutData();
  return useMutation({
    mutationKey: ['add-set', workoutId],
    mutationFn: (body: { exerciseId: string; weightKg: number; reps: number }) =>
      api<WorkoutSet>(`/workouts/${workoutId}/sets`, { method: 'POST', body }),
    // Миттєво показуємо підхід у таблиці й підсумку; повні дані (1ПМ, відображувана вага) приходять після оновлення
    onSuccess: (set) => {
      qc.setQueryData<WorkoutDetail>(keys.workout(workoutId), (w) => w && {
        ...w, sets: [...w.sets, { ...set, displayWeight: set.weightKg, oneRepMax: null }],
      });
      void invalidate(workoutId);
    },
  });
}

export function useDeleteSet(workoutId: string) {
  const invalidate = useInvalidateWorkoutData();
  return useMutation({
    mutationFn: (setId: string) => api<void>(`/workouts/${workoutId}/sets/${setId}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(workoutId),
  });
}

export function useWorkoutTransition(workoutId: string) {
  const invalidate = useInvalidateWorkoutData();
  return useMutation({
    mutationFn: (event: 'finish' | 'cancel' | 'reopen') => api<{ status: string }>(`/workouts/${workoutId}/${event}`, { method: 'POST' }),
    onSuccess: () => invalidate(workoutId),
  });
}

export function useSetUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (weightUnit: WeightUnit) => api<User>('/profile', { method: 'PATCH', body: { weightUnit } }),
    onSuccess: (u) => {
      qc.setQueryData(['profile'], u);
      void qc.invalidateQueries({ queryKey: ['workout'] }); // сервер перерахує displayWeight
    },
  });
}

export function useSaveExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id?: string; name: string; muscleGroupId: number }) =>
      api<Exercise>(id ? `/exercises/${id}` : '/exercises', { method: id ? 'PATCH' : 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
  });
}

export function useDeleteExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/exercises/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
  });
}
