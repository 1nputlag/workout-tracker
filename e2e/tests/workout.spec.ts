import { expect, test } from '@playwright/test';
import { addSetViaUi, registerViaUi } from './helpers';

// Флов проведення тренування (рис. 4.5). Вимоги: FR-05, FR-06, FR-07, UI-02
test.describe('Журналювання тренування', () => {
  test.beforeEach(async ({ page }) => { await registerViaUi(page); });

  test('E2E-07: швидкий старт → підхід → підсумок оновлюється без перезавантаження', async ({ page }) => {
    await page.getByRole('button', { name: 'Нове тренування' }).click();
    await page.getByRole('menuitem', { name: 'Швидкий старт' }).click();
    await addSetViaUi(page, 'Жим лежачи', '80', '8');
    await expect(page.getByTestId('set-row')).toHaveCount(1);
    await expect(page.getByTestId('workout-tonnage')).toHaveText(/640/);
    await addSetViaUi(page, 'Жим лежачи', '80', '8');
    await expect(page.getByTestId('workout-tonnage')).toHaveText(/1\s?280/);
  });

  test('E2E-08: завершити тренування без підходів не можна', async ({ page }) => {
    await page.getByRole('button', { name: 'Нове тренування' }).click();
    await page.getByRole('menuitem', { name: 'Швидкий старт' }).click();
    await page.getByRole('button', { name: 'Завершити тренування' }).click();
    await expect(page.getByRole('alert')).toContainText('додайте підхід або скасуйте');
    await expect(page).toHaveURL(/workout/);
  });

  test('E2E-09: завершене тренування з’являється в історії', async ({ page }) => {
    await page.getByRole('button', { name: 'Нове тренування' }).click();
    await page.getByRole('menuitem', { name: 'Швидкий старт' }).click();
    await addSetViaUi(page, 'Присідання', '100', '5');
    await page.getByRole('button', { name: 'Завершити тренування' }).click();
    await expect(page).toHaveURL(/history/);
    await expect(page.getByTestId('history-item')).toHaveCount(1);
  });

  test('E2E-10: некоректне значення повторень показує помилку біля поля, підхід не додається', async ({ page }) => {
    await page.getByRole('button', { name: 'Нове тренування' }).click();
    await page.getByRole('menuitem', { name: 'Швидкий старт' }).click();
    await addSetViaUi(page, 'Жим лежачи', '80', '0');
    await expect(page.getByLabel('Повторення')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByTestId('set-row')).toHaveCount(0);
  });

  test('E2E-11: перемикання одиниць на фунти змінює відображення ваги, але не збережене значення', async ({ page }) => {
    await page.getByRole('button', { name: 'Нове тренування' }).click();
    await page.getByRole('menuitem', { name: 'Швидкий старт' }).click();
    await addSetViaUi(page, 'Жим лежачи', '100', '5');
    await page.getByRole('button', { name: 'Одиниці: кг' }).click();
    await page.getByRole('menuitem', { name: 'фунти' }).click();
    await expect(page.getByTestId('set-row').first()).toContainText('220,5');
    await page.getByRole('button', { name: /Одиниці/ }).click();
    await page.getByRole('menuitem', { name: 'кг' }).click();
    await expect(page.getByTestId('set-row').first()).toContainText('100');
  });
});
