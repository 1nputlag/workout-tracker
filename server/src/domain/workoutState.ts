// Життєвий цикл тренування (діаграма станів, підрозділ 4.6).
export type WorkoutStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';
export type WorkoutEvent = 'start' | 'finish' | 'cancel' | 'reopen';

export class InvalidTransitionError extends Error {
  constructor(public from: WorkoutStatus, public event: WorkoutEvent, reason?: string) {
    super(reason ?? `Перехід «${event}» зі стану «${from}» неможливий`);
    this.name = 'InvalidTransitionError';
  }
}

export function transition(from: WorkoutStatus, event: WorkoutEvent, ctx: { setCount: number }): WorkoutStatus {
  switch (from) {
    case 'planned':
      if (event === 'start') return 'in_progress';
      if (event === 'cancel') return 'cancelled';
      break;
    case 'in_progress':
      if (event === 'finish') {
        if (ctx.setCount < 1) throw new InvalidTransitionError(from, event, 'Завершити можна лише тренування з принаймні одним підходом');
        return 'completed';
      }
      if (event === 'cancel') return 'cancelled';
      break;
    case 'completed':
      if (event === 'reopen') return 'in_progress';
      break;
    case 'cancelled':
      break; // кінцевий стан
  }
  throw new InvalidTransitionError(from, event);
}
