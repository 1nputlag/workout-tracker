import { expect, test, type Page } from '@playwright/test';
import { addSetViaUi, registerViaUi } from './helpers';

/** Створення програми через редактор: назва і перелік вправ у заданому порядку. */
async function createProgram(page: Page, name: string, exercises: string[]) {
  await page.goto('/programs');
  await page.getByRole('link', { name: 'Створити програму' }).click();
  await page.getByLabel('Назва програми').fill(name);
  for (const ex of exercises) {
    await page.getByLabel('Додати вправу').selectOption({ label: ex });
    await page.getByRole('button', { name: 'Додати до програми' }).click();
  }
  await expect(page.getByTestId('program-item')).toHaveCount(exercises.length);
}

// Вимоги: UI-06, FR-04
test.describe('Тренувальні програми', () => {
  test('E2E-19: програма створюється з упорядкованим переліком вправ і цілями', async ({ page }) => {
    await registerViaUi(page);
    await page.goto('/programs');
    await expect(page.getByTestId('programs-empty')).toBeVisible();

    await createProgram(page, 'Верх тіла А', ['Жим лежачи — Груди', 'Тяга штанги в нахилі — Спина']);
    await page.getByLabel('Підходів').first().fill('4');
    await page.getByLabel('Повторень').first().fill('6');
    await page.getByRole('button', { name: 'Зберегти програму' }).click();

    await expect(page).toHaveURL(/\/programs$/);
    const card = page.getByTestId('program-card');
    await expect(card).toHaveCount(1);
    await expect(card).toContainText('Верх тіла А');
    await expect(card).toContainText('2 вправи');
    await expect(card.getByRole('listitem').first()).toContainText('Жим лежачи');
    await expect(card.getByRole('listitem').first()).toContainText('4 × 6');
  });

  test('E2E-20: програму без назви або без вправ зберегти не можна', async ({ page }) => {
    await registerViaUi(page);
    await page.goto('/programs/new');
    await page.getByRole('button', { name: 'Зберегти програму' }).click();
    await expect(page.getByLabel('Назва програми')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Додайте хоча б одну вправу')).toBeVisible();
    await expect(page).toHaveURL(/\/programs\/new$/);

    await page.getByLabel('Назва програми').fill('Ноги');
    await page.getByRole('button', { name: 'Додати до програми' }).click();
    await page.getByLabel('Підходів').fill('0');
    await page.getByRole('button', { name: 'Зберегти програму' }).click();
    await expect(page.getByLabel('Підходів')).toHaveAttribute('aria-invalid', 'true');
    await expect(page).toHaveURL(/\/programs\/new$/);
  });

  test('E2E-21: тренування за програмою показує її вправи як план', async ({ page }) => {
    await registerViaUi(page);
    await createProgram(page, 'Ноги', ['Присідання зі штангою — Ноги', 'Жим ногами — Ноги']);
    await page.getByRole('button', { name: 'Зберегти програму' }).click();
    await page.getByTestId('program-card').getByRole('button', { name: 'Почати тренування' }).click();

    await expect(page).toHaveURL(/\/workout\//);
    await expect(page.getByText('за програмою «Ноги»')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Жим ногами' })).toBeVisible();
    // Перша вправа програми вже вибрана у формі підходу
    await expect(page.getByLabel('Вправа')).toHaveValue(/.+/);
    await expect(page.getByLabel('Вправа').locator('option:checked')).toHaveText('Присідання зі штангою');
    await addSetViaUi(page, 'Присідання зі штангою', '100', '5');
    await expect(page.getByTestId('set-row')).toHaveCount(1);

    // Програма доступна й у меню «Нове тренування»
    await page.goto('/');
    await page.getByRole('button', { name: 'Нове тренування' }).click();
    await expect(page.getByRole('menuitem', { name: 'За програмою «Ноги»' })).toBeVisible();
  });

  test('E2E-22: програму можна перейменувати, змінити порядок вправ і видалити', async ({ page }) => {
    await registerViaUi(page);
    await createProgram(page, 'Спина', ['Станова тяга — Спина', 'Підтягування — Спина']);
    await page.getByRole('button', { name: 'Зберегти програму' }).click();

    await page.getByRole('link', { name: 'Змінити програму «Спина»' }).click();
    await expect(page.getByLabel('Назва програми')).toHaveValue('Спина');
    await page.getByLabel('Назва програми').fill('Спина Б');
    await page.getByRole('button', { name: 'Перемістити нижче: Станова тяга' }).click();
    await expect(page.getByTestId('program-item').first()).toContainText('Підтягування');
    await page.getByRole('button', { name: 'Зберегти програму' }).click();

    const card = page.getByTestId('program-card');
    await expect(card).toContainText('Спина Б');
    await expect(card.getByRole('listitem').first()).toContainText('Підтягування');

    await page.getByRole('button', { name: 'Видалити програму «Спина Б»' }).click();
    await page.getByRole('button', { name: 'Так, видалити' }).click();
    await expect(page.getByTestId('programs-empty')).toBeVisible();
  });

  test('E2E-25: програми на смартфоні: розділ доступний із нижньої навігації @mobile', async ({ page }) => {
    await registerViaUi(page);
    await page.getByRole('navigation', { name: 'Основна навігація' }).getByRole('link', { name: 'Програми' }).click();
    await expect(page.getByRole('heading', { name: 'Програми' })).toBeVisible();
    await createProgram(page, 'Мобільна', ['Жим лежачи — Груди']);
    await page.getByRole('button', { name: 'Зберегти програму' }).click();
    await expect(page.getByTestId('program-card')).toContainText('Мобільна');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
});

// Вимога: FR-02
test.describe('Профіль', () => {
  test('E2E-23: зміна імені оновлює ініціали в меню акаунта; порожнє імʼя не зберігається', async ({ page }) => {
    await registerViaUi(page);
    await page.getByRole('button', { name: /^Акаунт/ }).click();
    await page.getByRole('menuitem', { name: 'Профіль' }).click();
    await expect(page.getByRole('heading', { name: 'Профіль' })).toBeVisible();

    await page.getByLabel('Імʼя').fill('   ');
    await page.getByRole('button', { name: 'Зберегти' }).click();
    await expect(page.getByLabel('Імʼя')).toHaveAttribute('aria-invalid', 'true');

    await page.getByLabel('Імʼя').fill('Михайло Парандій');
    await page.getByRole('button', { name: 'Зберегти' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Зміни збережено' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Акаунт: Михайло Парандій' })).toHaveText('МП');
    await page.reload();
    await expect(page.getByLabel('Імʼя')).toHaveValue('Михайло Парандій');
  });

  test('E2E-24: одиниці ваги з профілю діють у журналі тренування; вихід повертає на сторінку входу', async ({ page }) => {
    await registerViaUi(page);
    await page.goto('/profile');
    await page.getByRole('radio', { name: 'Фунти' }).check();
    await expect(page.getByRole('radio', { name: 'Фунти' })).toBeChecked();

    await page.getByRole('button', { name: 'Нове тренування' }).click();
    await page.getByRole('menuitem', { name: 'Швидкий старт' }).click();
    await expect(page.getByLabel('Вага, фунти')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Одиниці: фунти' })).toBeVisible();

    await page.goto('/profile');
    await page.getByRole('button', { name: 'Вийти з акаунта' }).click();
    await expect(page.getByRole('button', { name: 'Увійти' })).toBeVisible();
  });
});
