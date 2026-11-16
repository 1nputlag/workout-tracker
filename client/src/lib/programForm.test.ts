import { describe, expect, it } from 'vitest';
import { hasErrors, moveItem, totalSets, validateProgram } from './programForm';

const item = (sets = '3', reps = '8') => ({ exerciseId: 'x', targetSets: sets, targetReps: reps });

describe('Редактор програм', () => {
  it('TC-UI-07: переміщення вправи вгору й униз; на межах список не змінюється', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    const list = ['a', 'b'];
    expect(moveItem(list, 0, -1)).toBe(list);
    expect(moveItem(list, 1, 1)).toBe(list);
  });

  it('TC-UI-08: коректна програма не має помилок', () => {
    const e = validateProgram('Верх тіла А', [item(), item('20', '100'), item('1', '1')]);
    expect(hasErrors(e)).toBe(false);
  });

  it('TC-UI-09: порожня назва, відсутність вправ і значення поза межами дають помилки біля відповідних полів', () => {
    expect(validateProgram('   ', [item()]).name).toBeDefined();
    expect(validateProgram('x'.repeat(81), [item()]).name).toBeDefined();
    expect(validateProgram('А', []).items).toBeDefined();
    expect(validateProgram('А', Array.from({ length: 31 }, () => item())).items).toBeDefined();
    const e = validateProgram('А', [item('0', '8'), item('3', '101'), item('2.5', 'abc'), item()]);
    expect(e.rows).toEqual({ 0: { sets: 'Від 1 до 20' }, 1: { reps: 'Від 1 до 100' }, 2: { sets: 'Від 1 до 20', reps: 'Від 1 до 100' } });
    expect(hasErrors(e)).toBe(true);
  });

  it('TC-UI-10: загальна кількість підходів програми', () => {
    expect(totalSets([{ targetSets: 4 }, { targetSets: 3 }, { targetSets: 3 }])).toBe(10);
    expect(totalSets([])).toBe(0);
  });
});
