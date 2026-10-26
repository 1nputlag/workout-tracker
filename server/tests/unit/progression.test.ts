import { describe, expect, it } from 'vitest';
import { progressionHint, type SessionSets } from '../../src/services/stats';

const S = (iso: string, ...sets: [number, number][]): SessionSets => ({ date: new Date(iso), sets: sets.map(([weightKg, reps]) => ({ weightKg, reps })) });
const RANGE = { lo: 6, hi: 8 };

describe('Підказка щодо збільшення навантаження (підрозділ 4.8.2)', () => {
  it('TC-PRG-01: менше двох тренувань — «недостатньо даних»', () => {
    expect(progressionHint([], RANGE)).toEqual({ kind: 'insufficient_data' });
    expect(progressionHint([S('2026-10-12', [80, 8])], RANGE)).toEqual({ kind: 'insufficient_data' });
  });
  it('TC-PRG-02: у двох тренуваннях досягнуто верхньої межі — пропонується 82,5 кг замість 80 кг', () => {
    const h = progressionHint([S('2026-10-09', [80, 8], [80, 8], [80, 8]), S('2026-10-12', [80, 8], [80, 8], [80, 8])], RANGE);
    expect(h).toEqual({ kind: 'increase_weight', fromKg: 80, toKg: 82.5, exceedsRange: false });
  });
  it('TC-PRG-03: верхню межу досягнуто лише в останньому тренуванні — збільшувати повторення, а не вагу', () => {
    const h = progressionHint([S('2026-10-09', [80, 7]), S('2026-10-12', [80, 8])], RANGE);
    expect(h).toEqual({ kind: 'increase_reps', weightKg: 80 });
  });
  it('TC-PRG-04: в останньому тренуванні повторень менше за нижню межу — залишити або знизити вагу', () => {
    const h = progressionHint([S('2026-10-09', [80, 7]), S('2026-10-12', [80, 5])], RANGE);
    expect(h).toEqual({ kind: 'keep_or_reduce', weightKg: 80 });
  });
  it('TC-PRG-05: для легкої ваги найменший крок дисків перевищує 10 % — пропонується один крок із прапорцем', () => {
    const h = progressionHint([S('2026-10-09', [20, 8]), S('2026-10-12', [20, 8])], RANGE);
    expect(h).toEqual({ kind: 'increase_weight', fromKg: 20, toKg: 22.5, exceedsRange: true });
  });
  it('TC-PRG-06: якщо робоча вага в тренуваннях різна, вагу не збільшуємо', () => {
    const h = progressionHint([S('2026-10-09', [77.5, 8]), S('2026-10-12', [80, 8])], RANGE);
    expect(h).toEqual({ kind: 'increase_reps', weightKg: 80 });
  });
  it('TC-PRG-07: береться два останні тренування за датою, навіть якщо вхідний масив невпорядкований', () => {
    const h = progressionHint(
      [S('2026-10-12', [100, 8]), S('2026-09-01', [60, 3]), S('2026-10-09', [100, 8])],
      RANGE,
    );
    expect(h).toEqual({ kind: 'increase_weight', fromKg: 100, toKg: 102.5, exceedsRange: false });
  });
  it('TC-PRG-08: тренування без підходів не враховується як дані', () => {
    expect(progressionHint([S('2026-10-09', [80, 8]), S('2026-10-12')], RANGE)).toEqual({ kind: 'insufficient_data' });
  });
  it('TC-PRG-09: робоча вага — найбільша, повторення — мінімум серед підходів із цією вагою', () => {
    const h = progressionHint(
      [S('2026-10-09', [80, 8], [80, 7], [60, 12]), S('2026-10-12', [80, 8], [80, 8], [60, 12])],
      RANGE,
    );
    // у першому тренуванні R = 7 < hi, тому ваги не збільшуємо
    expect(h).toEqual({ kind: 'increase_reps', weightKg: 80 });
  });
});
