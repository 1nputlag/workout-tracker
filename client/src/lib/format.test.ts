import { describe, expect, it } from 'vitest';
import { clock, durationText, fmtNum, initials, isoWeekKey, mondayOf, plural, toDisplay, toKg, weekRangeLabel, workoutTitle } from './format';

describe('Форматування для інтерфейсу', () => {
  it('TC-UI-01: числа у форматі uk-UA: кома в дробах, пробіл між тисячами', () => {
    expect(fmtNum(101.333)).toBe('101,3');
    expect(fmtNum(14820).replace(/\s/g, ' ')).toBe('14 820');
  });
  it('TC-UI-02: перерахунок ваги збігається із сервером; фунти → кг для збереження', () => {
    expect(toDisplay(100, 'lb')).toBe(220.5);
    expect(toDisplay(82.5, 'kg')).toBe(82.5);
    expect(toKg(220.5, 'lb')).toBe(100.02);
    expect(toKg(80, 'kg')).toBe(80);
  });
  it('TC-UI-03: українська множина', () => {
    expect([1, 2, 5, 11, 21, 22, 25, 112].map((n) => plural(n, ['підхід', 'підходи', 'підходів'])))
      .toEqual(['підхід', 'підходи', 'підходів', 'підходів', 'підхід', 'підходи', 'підходів', 'підходів']);
  });
  it('TC-UI-04: тижні: понеділок, ключ ISO-тижня, підпис діапазону', () => {
    const sun = new Date(2026, 9, 18); // неділя, 18 жовтня 2026
    expect(mondayOf(sun).getDate()).toBe(12);
    expect(isoWeekKey(sun)).toBe('2026-W42');
    expect(isoWeekKey(new Date(2027, 0, 1))).toBe('2026-W53');
    expect(weekRangeLabel(new Date(2026, 9, 12))).toBe('12–18 жовтня');
    expect(weekRangeLabel(new Date(2026, 8, 28))).toBe('28 вересня – 4 жовтня');
  });
  it('TC-UI-05: тривалість і таймер', () => {
    expect(durationText(72)).toBe('1 г 12 хв');
    expect(durationText(45)).toBe('45 хв');
    expect(clock(42 * 60_000 + 15_000)).toBe('00:42:15');
  });
  it('TC-UI-06: назва тренування з груп мʼязів та ініціали', () => {
    const g = new Map([[1, 'Груди'], [4, 'Плечі'], [5, 'Біцепс'], [6, 'Трицепс']]);
    expect(workoutTitle([1, 6], g)).toBe('Груди й трицепс');
    expect(workoutTitle([4, 5, 1], g)).toBe('Плечі, біцепс й груди');
    expect(workoutTitle([], g)).toBe('Тренування');
    expect(initials('Михайло Парандій')).toBe('МП');
    expect(initials('misha')).toBe('M');
  });
});
