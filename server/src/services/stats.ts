// Еталонна реалізація алгоритмів з підрозділу 4.8 (розрахунок показників і підказка прогресії).
// Усі функції чисті: не звертаються до бази даних, тому перевіряються модульними тестами.

export type SetRow = { weightKg: number; reps: number; date: Date; muscleGroupId: number };

/** Підходи з такою кількістю повторень і більше не враховуються в оцінці 1ПМ (підрозділ 4.8.1). */
export const ONE_RM_REPS_LIMIT = 10;
const KG_PER_LB = 0.45359237;

export function tonnage(s: Pick<SetRow, 'weightKg' | 'reps'>): number {
  return s.weightKg * s.reps;
}

/** Формула Епли: 1ПМ = w · (1 + r / 30). Для r ≥ 10 та некоректних r повертає null. */
export function estimatedOneRepMax(s: Pick<SetRow, 'weightKg' | 'reps'>): number | null {
  if (!Number.isInteger(s.reps) || s.reps < 1 || s.reps >= ONE_RM_REPS_LIMIT) return null;
  return s.weightKg * (1 + s.reps / 30);
}

/** Ключ ISO-тижня («2026-W42») з урахуванням часового зсуву користувача в хвилинах від UTC. */
export function isoWeekKey(d: Date, tzOffsetMin = 0): string {
  const local = new Date(d.getTime() + tzOffsetMin * 60_000);
  const t = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
  const day = t.getUTCDay() || 7; // понеділок = 1 … неділя = 7
  t.setUTCDate(t.getUTCDate() + 4 - day); // четвер того ж тижня визначає рік ISO
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Тижневий обсяг: кількість підходів за ключем «тиждень|група м'язів». */
export function weeklyVolume(sets: SetRow[], tzOffsetMin = 0): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of sets) {
    const key = `${isoWeekKey(s.date, tzOffsetMin)}|${s.muscleGroupId}`;
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}

/** Сумарний тоннаж за ключем тижня. */
export function weeklyTonnage(sets: SetRow[], tzOffsetMin = 0): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of sets) {
    const key = isoWeekKey(s.date, tzOffsetMin);
    out.set(key, (out.get(key) ?? 0) + tonnage(s));
  }
  return out;
}

/** Найкраща оцінка 1ПМ за кожен день («YYYY-MM-DD»); підходи без оцінки пропускаються. */
export function dailyBestOneRepMax(sets: SetRow[], tzOffsetMin = 0): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of sets) {
    const e = estimatedOneRepMax(s);
    if (e === null) continue;
    const day = new Date(s.date.getTime() + tzOffsetMin * 60_000).toISOString().slice(0, 10);
    out.set(day, Math.max(out.get(day) ?? 0, e));
  }
  return out;
}

export const kgToLb = (kg: number): number => kg / KG_PER_LB;
export const lbToKg = (lb: number): number => lb * KG_PER_LB;

// ---------------- Підказка щодо збільшення навантаження (підрозділ 4.8.2) ----------------

export type SessionSets = { date: Date; sets: { weightKg: number; reps: number }[] };
export type RepRange = { lo: number; hi: number };
export type Hint =
  | { kind: 'insufficient_data' }
  | { kind: 'increase_weight'; fromKg: number; toKg: number; exceedsRange: boolean }
  | { kind: 'increase_reps'; weightKg: number }
  | { kind: 'keep_or_reduce'; weightKg: number };

const MIN_STEP = 0.02; // +2 %
const MAX_STEP = 0.1; // +10 %

/** Робоча вага тренування — найбільша вага; R — найменша кількість повторень у підходах з цією вагою. */
function working(session: SessionSets): { w: number; r: number } | null {
  if (session.sets.length === 0) return null;
  const w = Math.max(...session.sets.map((s) => s.weightKg));
  const r = Math.min(...session.sets.filter((s) => s.weightKg === w).map((s) => s.reps));
  return { w, r };
}

const round = (x: number): number => Math.round(x * 100) / 100;

export function progressionHint(sessions: SessionSets[], range: RepRange, plateStepKg = 2.5): Hint {
  const last2 = [...sessions].sort((a, b) => a.date.getTime() - b.date.getTime()).slice(-2);
  const ws = last2.map(working);
  if (last2.length < 2 || ws.some((x) => x === null)) return { kind: 'insufficient_data' };
  const [prev, cur] = ws as { w: number; r: number }[];

  // Збільшення ваги — лише коли обидва тренування виконано з тією самою вагою (уточнення до схеми 4.19, див. п. 5.8)
  if (prev.w === cur.w && prev.r >= range.hi && cur.r >= range.hi) {
    const W = cur.w;
    const lowest = Math.ceil((W * (1 + MIN_STEP)) / plateStepKg) * plateStepKg;
    if (lowest <= W * (1 + MAX_STEP) + 1e-9) {
      return { kind: 'increase_weight', fromKg: W, toKg: round(lowest), exceedsRange: false };
    }
    // Найменший крок дисків перевищує 10 % (легкі ваги): пропонуємо один крок і позначаємо це прапорцем
    return { kind: 'increase_weight', fromKg: W, toKg: round(W + plateStepKg), exceedsRange: true };
  }
  if (cur.r < range.lo) return { kind: 'keep_or_reduce', weightKg: cur.w };
  return { kind: 'increase_reps', weightKg: cur.w };
}
