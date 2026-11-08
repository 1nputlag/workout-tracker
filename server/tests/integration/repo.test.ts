// Контрактні тести сховища: обидві реалізації інтерфейсу Repo (у пам'яті та PostgreSQL) мають поводитися однаково.
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createMemoryRepo } from '../../src/repo/memory';
import { createPrismaRepo } from '../../src/repo/prisma';
import { seedDefaults } from '../../src/repo/seed';
import { DEFAULT_EXERCISES, MUSCLE_GROUPS } from '../../src/repo/defaults';
import type { Repo } from '../../src/repo/types';
import { DB_URL, prismaClient } from './helpers';

const impls: [string, () => Repo][] = [['пам’ять', createMemoryRepo]];
if (DB_URL) impls.push(['PostgreSQL', () => createPrismaRepo(prismaClient())]);

async function fixture(repo: Repo) {
  const user = await repo.createUser({ email: `Repo-${randomUUID()}@Example.com`, passwordHash: 'x', displayName: 'R' });
  const general = await repo.listExercises(user.id);
  const id = (name: string) => general.find((e) => e.name === name)!.id;
  return { user, bench: id('Жим лежачи'), squat: id('Присідання зі штангою') };
}

describe.each(impls)('Контракт сховища: %s', (_name, make) => {
  it('TC-REP-01: пошта зберігається в нижньому регістрі, користувача знаходить за id і поштою', async () => {
    const repo = make(); const { user } = await fixture(repo);
    expect(user.email).toBe(user.email.toLowerCase());
    expect(user.weightUnit).toBe('kg');
    expect((await repo.findUserByEmail(user.email.toUpperCase()))?.id).toBe(user.id);
    expect((await repo.findUserById(user.id))?.email).toBe(user.email);
    expect(await repo.findUserById(randomUUID())).toBeUndefined();
    expect((await repo.updateUser(user.id, { weightUnit: 'lb' })).weightUnit).toBe('lb');
  });

  it('TC-REP-02: довідники містять сім груп мʼязів і загальну бібліотеку вправ', async () => {
    const repo = make(); const { user } = await fixture(repo);
    expect(await repo.listMuscleGroups()).toEqual(MUSCLE_GROUPS);
    const general = (await repo.listExercises(user.id)).filter((e) => e.ownerId === null);
    expect(general.map((e) => e.name).sort()).toEqual(DEFAULT_EXERCISES.map((e) => e.name).sort());
    expect(await repo.getExercise(randomUUID())).toBeUndefined();
  });

  it('TC-REP-03: зміна групи власної вправи відбивається на групі її підходів', async () => {
    const repo = make(); const { user } = await fixture(repo);
    const own = await repo.createExercise({ name: 'Власна', muscleGroupId: 1, ownerId: user.id });
    const w = await repo.createWorkout(user.id);
    await repo.addSet(w.id, { exerciseId: own.id, weightKg: 10, reps: 10 });
    await repo.updateExercise(own.id, { muscleGroupId: 2 });
    expect((await repo.getWorkout(w.id))!.sets[0].muscleGroupId).toBe(2);
    expect(await repo.deleteExercise(own.id)).toBe('in_use');
  });

  it('TC-REP-04: вправу з програми видалити не можна; програма зберігає порядок і замінює перелік', async () => {
    const repo = make(); const { user, bench, squat } = await fixture(repo);
    const own = await repo.createExercise({ name: 'У програмі', muscleGroupId: 3, ownerId: user.id });
    const p = await repo.createProgram(user.id, { name: 'Б', items: [{ exerciseId: own.id, targetSets: 3, targetReps: 5 }, { exerciseId: bench, targetSets: 4, targetReps: 8 }] });
    expect(await repo.deleteExercise(own.id)).toBe('in_use');
    expect(p.items.map((i) => [i.position, i.exerciseId])).toEqual([[0, own.id], [1, bench]]);
    const upd = await repo.updateProgram(p.id, { items: [{ exerciseId: squat, targetSets: 5, targetReps: 5 }] });
    expect(upd.items).toEqual([{ exerciseId: squat, position: 0, targetSets: 5, targetReps: 5 }]);
    expect((await repo.updateProgram(p.id, { name: 'В' })).items).toHaveLength(1);
    await repo.createProgram(user.id, { name: 'А', items: [] });
    expect((await repo.listPrograms(user.id)).map((x) => x.name)).toEqual(['А', 'В']);
    expect(await repo.deleteExercise(own.id)).toBe('deleted');
  });

  it('TC-REP-05: останній підхід для кожної вправи та фільтри історії', async () => {
    const repo = make(); const { user, bench, squat } = await fixture(repo);
    const w1 = await repo.createWorkout(user.id);
    await repo.addSet(w1.id, { exerciseId: bench, weightKg: 70, reps: 8 });
    await new Promise((r) => setTimeout(r, 5));
    await repo.addSet(w1.id, { exerciseId: bench, weightKg: 72.5, reps: 6 });
    const w2 = await repo.createWorkout(user.id);
    await repo.addSet(w2.id, { exerciseId: squat, weightKg: 100, reps: 5 });
    await repo.setWorkoutStatus(w2.id, 'completed', new Date());

    const last = await repo.lastSets(user.id);
    expect(last.get(bench)).toMatchObject({ weightKg: 72.5, reps: 6 });
    expect(last.get(squat)).toMatchObject({ weightKg: 100, reps: 5 });

    expect((await repo.listWorkouts(user.id, { status: 'completed' })).items.map((w) => w.id)).toEqual([w2.id]);
    expect((await repo.listWorkouts(user.id, { exerciseId: bench, muscleGroupId: 1 })).items.map((w) => w.id)).toEqual([w1.id]);
    expect((await repo.listWorkouts(user.id, {}, { page: 2, pageSize: 1 })).items).toHaveLength(1);
    expect((await repo.listWorkouts(user.id)).total).toBe(2);
    expect(await repo.deleteSet(randomUUID(), randomUUID())).toBe(false);
  });

  it('TC-REP-06: після видалення програми тренування лишається без посилання на неї', async () => {
    const repo = make(); const { user } = await fixture(repo);
    const p = await repo.createProgram(user.id, { name: 'Тимчасова', items: [] });
    const w = await repo.createWorkout(user.id, p.id);
    await repo.deleteProgram(p.id);
    expect((await repo.getWorkout(w.id))!.programId).toBeNull();
    expect(await repo.getProgram(p.id)).toBeUndefined();
  });
});

describe.runIf(DB_URL)('Довідкові дані в PostgreSQL', () => {
  it('TC-REP-07: заповнення довідників ідемпотентне — повторний запуск не створює дублів', async () => {
    const db = prismaClient();
    await seedDefaults(db);
    await seedDefaults(db);
    expect(await db.muscleGroup.count()).toBe(MUSCLE_GROUPS.length);
    expect(await db.exercise.count({ where: { ownerId: null } })).toBe(DEFAULT_EXERCISES.length);
  });
});
