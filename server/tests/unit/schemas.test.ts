import { describe, expect, it } from 'vitest';
import { MAX_REPS, MAX_WEIGHT_KG, registerInput, setInput } from '../../src/validation/schemas';

const ok = { exerciseId: 'bench', weightKg: 80, reps: 8 };

describe('Валідація вхідних даних (Zod)', () => {
  it('TC-VAL-01: коректний підхід приймається', () => {
    expect(setInput.safeParse(ok).success).toBe(true);
  });
  it('TC-VAL-02: нульова вага дозволена (вправи з вагою тіла)', () => {
    expect(setInput.safeParse({ ...ok, weightKg: 0 }).success).toBe(true);
  });
  it.each([-0.5, MAX_WEIGHT_KG + 1, Number.NaN, '80'])('TC-VAL-03: некоректна вага (%s) відхиляється', (weightKg) => {
    expect(setInput.safeParse({ ...ok, weightKg }).success).toBe(false);
  });
  it.each([0, -3, 1.5, MAX_REPS + 1, '8'])('TC-VAL-04: некоректні повторення (%s) відхиляються', (reps) => {
    expect(setInput.safeParse({ ...ok, reps }).success).toBe(false);
  });
  it('TC-VAL-05: межові значення 1 і 100 повторень та 1000 кг приймаються', () => {
    expect(setInput.safeParse({ ...ok, reps: 1 }).success).toBe(true);
    expect(setInput.safeParse({ ...ok, reps: MAX_REPS, weightKg: MAX_WEIGHT_KG }).success).toBe(true);
  });
  it('TC-VAL-06: порожній ідентифікатор вправи відхиляється', () => {
    expect(setInput.safeParse({ ...ok, exerciseId: '' }).success).toBe(false);
  });
  it('TC-VAL-07: некоректна адреса пошти відхиляється', () => {
    expect(registerInput.safeParse({ email: 'not-an-email', password: 'longenough1' }).success).toBe(false);
  });
  it('TC-VAL-08: пароль із 7 символів відхиляється, із 8 — приймається', () => {
    expect(registerInput.safeParse({ email: 'a@b.ua', password: '1234567' }).success).toBe(false);
    expect(registerInput.safeParse({ email: 'a@b.ua', password: '12345678' }).success).toBe(true);
  });
  it('TC-VAL-09: пароль довший за 72 байти (bcrypt) відхиляється, навіть якщо символів менше 72', () => {
    const cyr = 'ж'.repeat(40); // 40 символів = 80 байтів у UTF-8
    expect(cyr.length).toBeLessThan(72);
    expect(registerInput.safeParse({ email: 'a@b.ua', password: cyr }).success).toBe(false);
  });
});
