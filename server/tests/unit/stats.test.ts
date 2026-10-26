import { describe, expect, it } from 'vitest';
import {
  dailyBestOneRepMax, estimatedOneRepMax, isoWeekKey, kgToLb, lbToKg, tonnage, weeklyTonnage, weeklyVolume, type SetRow,
} from '../../src/services/stats';

const row = (iso: string, weightKg: number, reps: number, muscleGroupId = 1): SetRow => ({ weightKg, reps, date: new Date(iso), muscleGroupId });

describe('Розрахунок показників навантаження (підрозділ 4.8.1)', () => {
  it('TC-ALG-01: тоннаж підходу = вага × повторення', () => {
    expect(tonnage({ weightKg: 80, reps: 8 })).toBe(640);
  });
  it('TC-ALG-02: вправа з вагою тіла (0 кг) дає нульовий тоннаж, але не помилку', () => {
    expect(tonnage({ weightKg: 0, reps: 12 })).toBe(0);
  });
  it('TC-ALG-03: оцінка 1ПМ за Еплі для 80 кг × 8 дорівнює 101,3 кг (значення з макета екрана)', () => {
    expect(estimatedOneRepMax({ weightKg: 80, reps: 8 })).toBeCloseTo(101.33, 2);
  });
  it('TC-ALG-04: для одного повторення оцінка трохи перевищує вагу: w·(1+1/30)', () => {
    expect(estimatedOneRepMax({ weightKg: 100, reps: 1 })).toBeCloseTo(103.33, 2);
  });
  it('TC-ALG-05: межа 10 повторень — 9 враховується, 10 не враховується', () => {
    expect(estimatedOneRepMax({ weightKg: 60, reps: 9 })).not.toBeNull();
    expect(estimatedOneRepMax({ weightKg: 60, reps: 10 })).toBeNull();
    expect(estimatedOneRepMax({ weightKg: 60, reps: 15 })).toBeNull();
  });
  it.each([0, -1, 1.5, Number.NaN])('TC-ALG-06: некоректна кількість повторень (%s) не дає оцінки', (reps) => {
    expect(estimatedOneRepMax({ weightKg: 60, reps })).toBeNull();
  });
});

describe('Тижневі агрегати', () => {
  it('TC-ALG-07: понеділок і неділя одного тижня мають однаковий ключ, наступний понеділок — інший', () => {
    expect(isoWeekKey(new Date('2026-10-12T10:00:00Z'))).toBe('2026-W42');
    expect(isoWeekKey(new Date('2026-10-18T10:00:00Z'))).toBe('2026-W42');
    expect(isoWeekKey(new Date('2026-10-19T10:00:00Z'))).toBe('2026-W43');
  });
  it('TC-ALG-08: на межі років ISO-тиждень належить до року, у якому припадає його четвер', () => {
    expect(isoWeekKey(new Date('2026-01-01T12:00:00Z'))).toBe('2026-W01');
    expect(isoWeekKey(new Date('2024-12-30T12:00:00Z'))).toBe('2025-W01');
    expect(isoWeekKey(new Date('2021-01-03T12:00:00Z'))).toBe('2020-W53');
  });
  it('TC-ALG-09: підхід у ніч з неділі на понеділок за київським часом потрапляє в новий тиждень', () => {
    const d = new Date('2026-10-18T22:30:00Z'); // 01:30 понеділка 19.10 у Києві (UTC+3)
    expect(isoWeekKey(d, 0)).toBe('2026-W42');
    expect(isoWeekKey(d, 180)).toBe('2026-W43');
  });
  it('TC-ALG-10: тижневий обсяг рахує підходи окремо за групами м’язів і тижнями', () => {
    const sets = [row('2026-10-12T10:00:00Z', 80, 8, 1), row('2026-10-12T10:05:00Z', 80, 8, 1), row('2026-10-14T10:00:00Z', 100, 5, 2), row('2026-10-20T10:00:00Z', 80, 8, 1)];
    const v = weeklyVolume(sets);
    expect(v.get('2026-W42|1')).toBe(2);
    expect(v.get('2026-W42|2')).toBe(1);
    expect(v.get('2026-W43|1')).toBe(1);
    expect(v.size).toBe(3);
  });
  it('TC-ALG-11: тижневий тоннаж — сума тоннажів підходів тижня', () => {
    const sets = [row('2026-10-12T10:00:00Z', 80, 8), row('2026-10-14T10:00:00Z', 100, 5), row('2026-10-20T10:00:00Z', 50, 10)];
    const t = weeklyTonnage(sets);
    expect(t.get('2026-W42')).toBe(640 + 500);
    expect(t.get('2026-W43')).toBe(500);
  });
  it('TC-ALG-12: для дня береться найкраща оцінка 1ПМ, підходи з ≥10 повторень пропускаються', () => {
    const sets = [row('2026-10-12T09:00:00Z', 80, 8), row('2026-10-12T09:10:00Z', 85, 5), row('2026-10-12T09:20:00Z', 60, 15)];
    const best = dailyBestOneRepMax(sets);
    expect(best.size).toBe(1);
    expect(best.get('2026-10-12')).toBeCloseTo(80 * (1 + 8 / 30), 5); // 101,33 > 85×5 → 99,17; 60×15 пропущено
  });
  it('TC-ALG-13: порожній набір підходів дає порожні результати', () => {
    expect(weeklyVolume([]).size).toBe(0);
    expect(weeklyTonnage([]).size).toBe(0);
    expect(dailyBestOneRepMax([]).size).toBe(0);
  });
  it('TC-ALG-14: перерахунок кг ↔ фунти узгоджений у обидва боки', () => {
    expect(kgToLb(100)).toBeCloseTo(220.46, 2);
    expect(lbToKg(kgToLb(82.5))).toBeCloseTo(82.5, 10);
  });
});
