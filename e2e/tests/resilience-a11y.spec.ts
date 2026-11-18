import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { addSetViaUi, registerViaUi } from './helpers';

async function startQuickWorkout(page: Page) {
  await page.getByRole('button', { name: 'Нове тренування' }).click();
  await page.getByRole('menuitem', { name: 'Швидкий старт' }).click();
  await expect(page).toHaveURL(/\/workout\//);
}

// Вимога: NFR-04
test.describe('Втрата зʼєднання', () => {
  test('E2E-26: підходи, введені без мережі, не губляться й надсилаються по черзі після відновлення', async ({ page, context }) => {
    await registerViaUi(page);
    await startQuickWorkout(page);
    await addSetViaUi(page, 'Жим лежачи', '80', '8');
    await expect(page.getByTestId('set-row')).toHaveCount(1);

    await context.setOffline(true);
    await expect(page.getByTestId('network-banner')).toContainText('Немає зʼєднання');
    await addSetViaUi(page, 'Жим лежачи', '80', '7');
    await addSetViaUi(page, 'Жим лежачи', '77,5', '6');
    await expect(page.getByTestId('pending-set')).toHaveCount(2);
    await expect(page.getByTestId('set-row')).toHaveCount(1);
    // Завершити тренування, поки підходи не надіслано, не можна — інакше вони б загубилися
    await expect(page.getByRole('button', { name: 'Завершити тренування' })).toBeDisabled();

    await context.setOffline(false);
    await expect(page.getByTestId('set-row')).toHaveCount(3);
    await expect(page.getByTestId('pending-set')).toHaveCount(0);
    await expect(page.getByTestId('network-banner')).toContainText('Зʼєднання відновлено');

    // Після перезавантаження видно, що всі три підходи збережено на сервері в порядку введення
    await page.reload();
    const rows = page.getByTestId('set-row');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(1)).toContainText('7');
    await expect(rows.nth(2)).toContainText('77,5');
  });

  test('E2E-27: сторінка, відкрита без мережі, пояснює стан і завантажується після відновлення', async ({ page, context }) => {
    await registerViaUi(page);
    await context.setOffline(true);
    await page.getByRole('navigation', { name: 'Основна навігація' }).getByRole('link', { name: 'Історія' }).click();
    await expect(page.getByText('дані завантажаться автоматично')).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByRole('heading', { name: 'Історія порожня' })).toBeVisible();
  });
});

// Вимога: UI-08 (WCAG 2.1 AA, перевірка axe-core на всіх екранах)
test.describe('Доступність усіх екранів', () => {
  async function expectNoSeriousViolations(page: Page, screen: string) {
    // Чекаємо, доки зникнуть індикатори завантаження, щоб перевіряти готовий екран
    await expect(page.getByText('Завантаження…')).toHaveCount(0);
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const serious = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${screen}: ${v.id} — ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join('; ')}`);
    expect(serious).toEqual([]);
  }

  test('E2E-28: усі екрани із заповненими даними не мають серйозних порушень доступності', async ({ page }) => {
    test.slow(); // десять екранів в одному сценарії
    await registerViaUi(page);

    // Дані: завершене тренування, програма, власна вправа
    await startQuickWorkout(page);
    await addSetViaUi(page, 'Жим лежачи', '80', '8');
    await addSetViaUi(page, 'Жим лежачи', '80', '7');
    await expectNoSeriousViolations(page, 'журнал тренування');
    await page.getByRole('button', { name: 'Завершити тренування' }).click();
    await expect(page).toHaveURL(/\/history/);
    await page.getByTestId('history-item').getByRole('button').first().click();
    await expectNoSeriousViolations(page, 'історія');

    await page.goto('/');
    await expect(page.getByTestId('kpi-tonnage')).toBeVisible();
    await expectNoSeriousViolations(page, 'прогрес');

    await page.goto('/exercises');
    await expect(page.getByTestId('exercise-card').first()).toBeVisible();
    await expectNoSeriousViolations(page, 'вправи');
    await page.getByRole('button', { name: 'Додати власну вправу' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectNoSeriousViolations(page, 'вправи: модальне вікно');
    await page.keyboard.press('Escape');

    await page.goto('/programs');
    await expectNoSeriousViolations(page, 'програми (порожньо)');
    await page.goto('/programs/new');
    await page.getByRole('button', { name: 'Зберегти програму' }).click(); // показати помилки — їх теж мають читати
    await expectNoSeriousViolations(page, 'редактор програми з помилками');
    await page.getByLabel('Назва програми').fill('Верх тіла');
    await page.getByRole('button', { name: 'Додати до програми' }).click();
    await page.getByRole('button', { name: 'Зберегти програму' }).click();
    await expect(page.getByTestId('program-card')).toBeVisible();
    await expectNoSeriousViolations(page, 'програми');

    await page.goto('/profile');
    await expectNoSeriousViolations(page, 'профіль');
    await page.goto('/workout/00000000-0000-0000-0000-000000000000');
    await expect(page.getByText('Тренування не знайдено')).toBeVisible();
    await expectNoSeriousViolations(page, 'тренування не знайдено');
  });

  test('E2E-29: головні дії доступні з клавіатури: меню «Нове тренування» і збереження підходу', async ({ page }) => {
    await registerViaUi(page);
    const button = page.getByRole('button', { name: 'Нове тренування' });
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name: 'Швидкий старт' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(button).toBeFocused();

    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter'); // «Швидкий старт»
    await expect(page).toHaveURL(/\/workout\//);
    await page.getByLabel('Вага, кг').fill('60');
    await page.getByLabel('Повторення').fill('10');
    await page.getByLabel('Повторення').press('Enter'); // форма надсилається клавішею Enter
    await expect(page.getByTestId('set-row')).toHaveCount(1);
  });

  test('E2E-30 @mobile: екрани на смартфоні не мають серйозних порушень доступності', async ({ page }) => {
    await registerViaUi(page);
    await expectNoSeriousViolations(page, 'прогрес (мобільний)');
    await startQuickWorkout(page);
    await expectNoSeriousViolations(page, 'журнал (мобільний)');
    await page.goto('/programs/new');
    await expectNoSeriousViolations(page, 'редактор програми (мобільний)');
  });
});
