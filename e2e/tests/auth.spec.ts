import { expect, test } from '@playwright/test';
import { PASSWORD, registerViaUi, uniqueEmail } from './helpers';

// Флов автентифікації (рис. 4.4). Вимоги: FR-01, UI-05
test.describe('Автентифікація', () => {
  test('E2E-01: нова людина реєструється й потрапляє на головний екран', async ({ page }) => {
    await registerViaUi(page);
    await expect(page).toHaveURL(/\/$|\/dashboard/);
  });

  test('E2E-02: клієнтська валідація: короткий пароль не надсилається на сервер', async ({ page }) => {
    let apiCalls = 0;
    page.on('request', (r) => { if (r.url().includes('/api/auth/')) apiCalls++; });
    await page.goto('/');
    await page.getByRole('tab', { name: 'Реєстрація' }).click();
    await page.getByLabel('Електронна пошта').fill(uniqueEmail());
    await page.getByLabel('Пароль').fill('123');
    await page.getByRole('button', { name: 'Зареєструватися' }).click();
    await expect(page.getByText('Щонайменше 8 символів')).toBeVisible();
    expect(apiCalls).toBe(0);
  });

  test('E2E-03: неправильний пароль показує загальну помилку, не розкриваючи, чи існує пошта', async ({ page, context }) => {
    const email = await registerViaUi(page);
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.getByLabel('Електронна пошта').fill(email);
    await page.getByLabel('Пароль').fill('wrong-password');
    await page.getByRole('button', { name: 'Увійти' }).click();
    const known = await page.getByRole('alert').innerText();

    await page.getByLabel('Електронна пошта').fill(uniqueEmail());
    await page.getByRole('button', { name: 'Увійти' }).click();
    expect(await page.getByRole('alert').innerText()).toBe(known);
  });

  test('E2E-04: чинний токен пропускає екран входу', async ({ page }) => {
    await registerViaUi(page);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Прогрес' })).toBeVisible();
  });

  test('E2E-05: без входу сторінки застосунку недоступні — перенаправлення на вхід', async ({ page }) => {
    await page.goto('/history');
    await expect(page).toHaveURL(/login|\/$/);
    await expect(page.getByRole('button', { name: 'Увійти' })).toBeVisible();
  });

  test('E2E-06: повторний вхід звичайним шляхом працює', async ({ page }) => {
    const email = await registerViaUi(page);
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.getByLabel('Електронна пошта').fill(email);
    await page.getByLabel('Пароль').fill(PASSWORD);
    await page.getByRole('button', { name: 'Увійти' }).click();
    await expect(page.getByRole('heading', { name: 'Прогрес' })).toBeVisible();
  });
});
