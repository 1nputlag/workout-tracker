import { expect, test } from '@playwright/test';
import { addSetViaUi, registerViaUi } from './helpers';

// Флов перегляду прогресу (рис. 4.6). Вимоги: UI-03, UI-04, FR-06
test.describe('Прогрес і бібліотека вправ', () => {
  test('E2E-12: порожній стан — замість графіка пропозиція почати тренування', async ({ page }) => {
    await registerViaUi(page);
    await expect(page.getByTestId('empty-state')).toContainText('Розпочати тренування');
  });

  test('E2E-13: після завершеного тренування на головному екрані з’являються показники й графіки', async ({ page }) => {
    await registerViaUi(page);
    await page.getByRole('button', { name: 'Нове тренування' }).click();
    await page.getByRole('menuitem', { name: 'Швидкий старт' }).click();
    await addSetViaUi(page, 'Жим лежачи', '80', '8');
    await page.getByRole('button', { name: 'Завершити тренування' }).click();
    await page.goto('/');
    await expect(page.getByTestId('kpi-tonnage')).toContainText('640');
    await expect(page.getByTestId('chart-1rm')).toBeVisible();
    await expect(page.getByTestId('chart-volume')).toBeVisible();
  });

  test('E2E-14: бібліотека вправ: пошук і фільтр за групою м’язів працюють разом', async ({ page }) => {
    await registerViaUi(page);
    await page.goto('/exercises');
    const cards = page.getByTestId('exercise-card');
    await expect(cards.first()).toBeVisible(); // count() не чекає завантаження списку
    const all = await cards.count();
    await page.getByRole('button', { name: 'Груди' }).click();
    await expect.poll(() => cards.count()).toBeLessThan(all);
    const chest = await cards.count();
    expect(chest).toBeGreaterThan(0);
    await page.getByRole('searchbox', { name: 'Пошук вправи' }).fill('жим');
    await expect.poll(() => cards.count()).toBeLessThanOrEqual(chest);
    for (const text of await cards.allInnerTexts()) {
      expect(text).toMatch(/жим/i);
      expect(text).toContain('Груди');
    }
  });
});
