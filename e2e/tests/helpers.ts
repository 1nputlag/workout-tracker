import { expect, type Page } from '@playwright/test';

let counter = 0;
export const uniqueEmail = () => `e2e-${Date.now()}-${++counter}@example.com`;
export const PASSWORD = 'correct-horse-1';

/** Реєстрація нового користувача через інтерфейс; після успіху користувач потрапляє на головний екран. */
export async function registerViaUi(page: Page, email = uniqueEmail()) {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Реєстрація' }).click();
  await page.getByLabel('Електронна пошта').fill(email);
  await page.getByLabel('Пароль').fill(PASSWORD);
  await page.getByRole('button', { name: 'Зареєструватися' }).click();
  await expect(page.getByRole('heading', { name: 'Прогрес' })).toBeVisible();
  return email;
}

/** Швидкий старт тренування й додавання одного підходу. */
export async function addSetViaUi(page: Page, exercise: string, weight: string, reps: string) {
  await page.getByLabel('Вправа').selectOption({ label: exercise });
  await page.getByLabel('Вага, кг').fill(weight);
  await page.getByLabel('Повторення').fill(reps);
  await page.getByRole('button', { name: 'Зберегти підхід' }).click();
}
