import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { isNetworkError, retryDelay } from './online';

describe('Стійкість до втрати зʼєднання', () => {
  it('TC-UI-11: повторюються лише мережеві збої, а не помилки сервера чи валідації', () => {
    expect(isNetworkError(new ApiError(0, 'network_error'))).toBe(true);
    expect(isNetworkError(new ApiError(400, 'validation_error'))).toBe(false);
    expect(isNetworkError(new ApiError(409, 'workout_not_in_progress'))).toBe(false);
    expect(isNetworkError(new Error('x'))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
  it('TC-UI-12: затримка повтору зростає вдвічі й обмежена 10 секундами', () => {
    expect([0, 1, 2, 3, 4, 10].map(retryDelay)).toEqual([1000, 2000, 4000, 8000, 10000, 10000]);
  });
});
