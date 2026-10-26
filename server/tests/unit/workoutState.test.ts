import { describe, expect, it } from 'vitest';
import { InvalidTransitionError, transition, type WorkoutEvent, type WorkoutStatus } from '../../src/domain/workoutState';

describe('Життєвий цикл тренування (підрозділ 4.6)', () => {
  it('TC-STA-01: заплановане тренування можна розпочати або скасувати', () => {
    expect(transition('planned', 'start', { setCount: 0 })).toBe('in_progress');
    expect(transition('planned', 'cancel', { setCount: 0 })).toBe('cancelled');
  });
  it('TC-STA-02: тренування з підходом можна завершити', () => {
    expect(transition('in_progress', 'finish', { setCount: 1 })).toBe('completed');
  });
  it('TC-STA-03: тренування без підходів завершити не можна', () => {
    expect(() => transition('in_progress', 'finish', { setCount: 0 })).toThrow(InvalidTransitionError);
    expect(() => transition('in_progress', 'finish', { setCount: 0 })).toThrow(/принаймні одним підходом/);
  });
  it('TC-STA-04: завершене тренування можна повернути до редагування', () => {
    expect(transition('completed', 'reopen', { setCount: 3 })).toBe('in_progress');
  });
  it('TC-STA-05: тренування, що виконується, можна скасувати', () => {
    expect(transition('in_progress', 'cancel', { setCount: 2 })).toBe('cancelled');
  });

  // Повний перебір 4×4 комбінацій: дозволені лише переходи з діаграми 4.11
  const states: WorkoutStatus[] = ['planned', 'in_progress', 'completed', 'cancelled'];
  const events: WorkoutEvent[] = ['start', 'finish', 'cancel', 'reopen'];
  const allowed = new Set(['planned:start', 'planned:cancel', 'in_progress:finish', 'in_progress:cancel', 'completed:reopen']);
  const cases = states.flatMap((s) => events.map((e) => [s, e] as const));
  it.each(cases)('TC-STA-06: перехід «%s» → подія «%s» відповідає діаграмі станів', (s, e) => {
    const run = () => transition(s, e, { setCount: 5 });
    if (allowed.has(`${s}:${e}`)) expect(run).not.toThrow();
    else expect(run).toThrow(InvalidTransitionError);
  });
});
