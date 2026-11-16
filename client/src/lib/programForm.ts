// Чиста логіка редактора програм (FR-04): порядок вправ, перевірка полів, підсумки. Покрита тестами (programForm.test.ts).
export const MAX_PROGRAM_ITEMS = 30;

export type DraftItem = { exerciseId: string; targetSets: string; targetReps: string };
export type ProgramErrors = { name?: string; items?: string; rows: Record<number, { sets?: string; reps?: string }> };

/** Переміщує елемент на одну позицію вгору (-1) або вниз (+1); за межами списку нічого не змінює. */
export function moveItem<T>(items: T[], index: number, dir: -1 | 1): T[] {
  const to = index + dir;
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

const intIn = (v: string, lo: number, hi: number) => /^\d+$/.test(v.trim()) && Number(v) >= lo && Number(v) <= hi;

/** Ті самі межі, що й у схемі сервера (programInput): назва 1–80, підходи 1–20, повторення 1–100, до 30 вправ. */
export function validateProgram(name: string, items: DraftItem[]): ProgramErrors {
  const e: ProgramErrors = { rows: {} };
  const n = name.trim();
  if (!n) e.name = 'Введіть назву програми';
  else if (n.length > 80) e.name = 'Назва — не довша за 80 символів';
  if (items.length === 0) e.items = 'Додайте хоча б одну вправу';
  else if (items.length > MAX_PROGRAM_ITEMS) e.items = `У програмі може бути не більше ${MAX_PROGRAM_ITEMS} вправ`;
  items.forEach((it, i) => {
    const row: { sets?: string; reps?: string } = {};
    if (!intIn(it.targetSets, 1, 20)) row.sets = 'Від 1 до 20';
    if (!intIn(it.targetReps, 1, 100)) row.reps = 'Від 1 до 100';
    if (row.sets || row.reps) e.rows[i] = row;
  });
  return e;
}

export const hasErrors = (e: ProgramErrors) => Boolean(e.name || e.items || Object.keys(e.rows).length);

/** Загальна кількість запланованих підходів у програмі. */
export const totalSets = (items: { targetSets: number }[]) => items.reduce((s, i) => s + i.targetSets, 0);
