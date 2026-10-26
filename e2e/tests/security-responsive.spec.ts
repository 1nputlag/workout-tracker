import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { addSetViaUi, registerViaUi } from './helpers';

// Вимоги: FR-09, UI-01, UI-08, NFR-03
test('E2E-15: користувач не бачить чужого тренування за прямим посиланням', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  await registerViaUi(a);
  await a.getByRole('button', { name: 'Нове тренування' }).click();
  await a.getByRole('menuitem', { name: 'Швидкий старт' }).click();
  await addSetViaUi(a, 'Жим лежачи', '80', '8');
  const url = a.url();

  const b = await (await browser.newContext()).newPage();
  await registerViaUi(b);
  await b.goto(url);
  await expect(b.getByText('Тренування не знайдено')).toBeVisible();
});

test('E2E-16: екран входу не має серйозних порушень доступності (контраст, підписи полів)', async ({ page }) => {
  await page.goto('/');
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});

test('E2E-17: головний екран не має серйозних порушень доступності', async ({ page }) => {
  await registerViaUi(page);
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});

test('E2E-18 @mobile: журнал на смартфоні — без горизонтальної прокрутки, нижня навігація видима', async ({ page }) => {
  await registerViaUi(page);
  await page.getByRole('button', { name: 'Нове тренування' }).click();
  await page.getByRole('menuitem', { name: 'Швидкий старт' }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  await expect(page.getByRole('navigation', { name: 'Основна навігація' })).toBeVisible();
});
