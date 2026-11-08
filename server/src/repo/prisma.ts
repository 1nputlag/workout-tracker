// Реалізація інтерфейсу Repo на PostgreSQL через Prisma ORM (INF-01).
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../generated/prisma/client.js';
import type { Exercise, LastSet, Program, Repo, SetRec, User, Workout, WorkoutFilter } from './types.js';

export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// Підходи завжди читаються разом із групою м'язів вправи — вона потрібна для фільтрів і статистики
const setsInclude = {
  sets: { orderBy: { setNumber: 'asc' }, include: { exercise: { select: { muscleGroupId: true } } } },
} satisfies Prisma.WorkoutInclude;
type WorkoutRow = Prisma.WorkoutGetPayload<{ include: typeof setsInclude }>;
type SetRow = WorkoutRow['sets'][number];

const programInclude = { exercises: { orderBy: { position: 'asc' } } } satisfies Prisma.ProgramInclude;
type ProgramRow = Prisma.ProgramGetPayload<{ include: typeof programInclude }>;

const toSet = (s: SetRow): SetRec => ({
  id: s.id, workoutId: s.workoutId, exerciseId: s.exerciseId, muscleGroupId: s.exercise.muscleGroupId,
  setNumber: s.setNumber, weightKg: s.weightKg.toNumber(), reps: s.reps, createdAt: s.createdAt,
});
const toWorkout = (w: WorkoutRow): Workout => ({
  id: w.id, userId: w.userId, programId: w.programId, status: w.status,
  startedAt: w.startedAt, finishedAt: w.finishedAt, sets: w.sets.map(toSet),
});
const toProgram = (p: ProgramRow): Program => ({
  id: p.id, userId: p.userId, name: p.name,
  items: p.exercises.map((i) => ({ exerciseId: i.exerciseId, position: i.position, targetSets: i.targetSets, targetReps: i.targetReps })),
});
const toUser = (u: User & Record<string, unknown>): User => ({
  id: u.id, email: u.email, passwordHash: u.passwordHash, displayName: u.displayName, weightUnit: u.weightUnit,
});
const toExercise = (e: Exercise): Exercise => ({ id: e.id, name: e.name, muscleGroupId: e.muscleGroupId, ownerId: e.ownerId });

function workoutWhere(userId: string, f: WorkoutFilter): Prisma.WorkoutWhereInput {
  const setConds: Prisma.WorkoutSetWhereInput[] = [];
  if (f.exerciseId) setConds.push({ exerciseId: f.exerciseId });
  if (f.muscleGroupId !== undefined) setConds.push({ exercise: { muscleGroupId: f.muscleGroupId } });
  return {
    userId,
    status: f.status,
    startedAt: f.from || f.to ? { gte: f.from, lte: f.to } : undefined,
    // Кожна умова — окреме «є хоча б один підхід», як і в сховищі в пам'яті
    AND: setConds.map((c) => ({ sets: { some: c } })),
  };
}

export function createPrismaRepo(db: PrismaClient): Repo {
  return {
    async findUserByEmail(email) {
      const u = await db.user.findUnique({ where: { email: email.toLowerCase() } });
      return u ? toUser(u) : undefined;
    },
    async findUserById(id) {
      const u = await db.user.findUnique({ where: { id } });
      return u ? toUser(u) : undefined;
    },
    async createUser(u) {
      return toUser(await db.user.create({ data: { ...u, email: u.email.toLowerCase() } }));
    },
    async updateUser(id, patch) {
      return toUser(await db.user.update({ where: { id }, data: patch }));
    },

    async listMuscleGroups() {
      return db.muscleGroup.findMany({ orderBy: { id: 'asc' } });
    },
    async listExercises(userId, f = {}) {
      const rows = await db.exercise.findMany({
        where: { OR: [{ ownerId: null }, { ownerId: userId }], muscleGroupId: f.muscleGroupId },
      });
      // Пошук без урахування регістру та сортування за українським алфавітом робимо в коді:
      // поведінка ILIKE і ORDER BY для кирилиці залежить від локалі бази (у локалі C «Ж» ≠ «ж»).
      // Вправ у бібліотеці користувача — десятки, тож це не впливає на швидкодію.
      const q = f.q?.trim().toLowerCase();
      return rows.map(toExercise)
        .filter((e) => !q || e.name.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name, 'uk'));
    },
    async getExercise(id) {
      const e = await db.exercise.findUnique({ where: { id } });
      return e ? toExercise(e) : undefined;
    },
    async createExercise(e) {
      return toExercise(await db.exercise.create({ data: e }));
    },
    async updateExercise(id, patch) {
      return toExercise(await db.exercise.update({ where: { id }, data: patch }));
    },
    async deleteExercise(id) {
      const [sets, items] = await Promise.all([
        db.workoutSet.count({ where: { exerciseId: id } }),
        db.programExercise.count({ where: { exerciseId: id } }),
      ]);
      if (sets + items > 0) return 'in_use';
      await db.exercise.delete({ where: { id } });
      return 'deleted';
    },
    async lastSets(userId) {
      const rows = await db.workoutSet.findMany({
        where: { workout: { userId } },
        orderBy: [{ exerciseId: 'asc' }, { createdAt: 'desc' }],
        distinct: ['exerciseId'],
        select: { exerciseId: true, weightKg: true, reps: true, createdAt: true },
      });
      return new Map<string, LastSet>(rows.map((r) => [r.exerciseId, { weightKg: r.weightKg.toNumber(), reps: r.reps, createdAt: r.createdAt }]));
    },

    async listPrograms(userId) {
      const rows = await db.program.findMany({ where: { userId }, include: programInclude });
      return rows.map(toProgram).sort((a, b) => a.name.localeCompare(b.name, 'uk'));
    },
    async getProgram(id) {
      const p = await db.program.findUnique({ where: { id }, include: programInclude });
      return p ? toProgram(p) : undefined;
    },
    async createProgram(userId, p) {
      return toProgram(await db.program.create({
        data: { userId, name: p.name, exercises: { create: p.items.map((i, position) => ({ ...i, position })) } },
        include: programInclude,
      }));
    },
    async updateProgram(id, patch) {
      // Перелік вправ замінюється повністю в одній транзакції, щоб порядок позицій лишався цілісним
      return toProgram(await db.$transaction(async (tx) => {
        if (patch.items) {
          await tx.programExercise.deleteMany({ where: { programId: id } });
          await tx.programExercise.createMany({ data: patch.items.map((i, position) => ({ ...i, position, programId: id })) });
        }
        return tx.program.update({ where: { id }, data: { name: patch.name }, include: programInclude });
      }));
    },
    async deleteProgram(id) {
      await db.program.delete({ where: { id } });
    },

    async createWorkout(userId, programId = null) {
      return toWorkout(await db.workout.create({ data: { userId, programId }, include: setsInclude }));
    },
    async getWorkout(id) {
      const w = await db.workout.findUnique({ where: { id }, include: setsInclude });
      return w ? toWorkout(w) : undefined;
    },
    async setWorkoutStatus(id, status, finishedAt) {
      return toWorkout(await db.workout.update({ where: { id }, data: { status, finishedAt }, include: setsInclude }));
    },
    async addSet(workoutId, s) {
      // Номер підходу рахується в транзакції; унікальний індекс (workoutId, setNumber) захищає від дублів
      const row = await db.$transaction(async (tx) => {
        const last = await tx.workoutSet.aggregate({ where: { workoutId }, _max: { setNumber: true } });
        return tx.workoutSet.create({
          data: { workoutId, exerciseId: s.exerciseId, weightKg: s.weightKg, reps: s.reps, setNumber: (last._max.setNumber ?? 0) + 1 },
          include: { exercise: { select: { muscleGroupId: true } } },
        });
      });
      return toSet(row);
    },
    async deleteSet(workoutId, setId) {
      const r = await db.workoutSet.deleteMany({ where: { id: setId, workoutId } });
      return r.count > 0;
    },
    async deleteWorkout(id) {
      await db.workout.delete({ where: { id } });
    },
    async listWorkouts(userId, f = {}, page) {
      const where = workoutWhere(userId, f);
      const [total, rows] = await Promise.all([
        db.workout.count({ where }),
        db.workout.findMany({
          where, include: setsInclude,
          orderBy: [{ startedAt: 'desc' }, { id: 'asc' }],
          skip: page ? (page.page - 1) * page.pageSize : undefined,
          take: page?.pageSize,
        }),
      ]);
      return { total, items: rows.map(toWorkout) };
    },
  };
}
