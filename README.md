# Workout Tracker

Вебзастосунок для трекінгу тренувань: журналювання підходів, повторень і ваги, автоматичний розрахунок
тоннажу, тижневого обсягу та оцінки одноповторного максимуму, графіки прогресу й підказки щодо збільшення навантаження.

Курсова робота «Розробка web застосунку для трекінгу тренувань (workout tracker)», ЛНУ імені Івана Франка.

![CI](https://github.com/1nputlag/workout-tracker/actions/workflows/ci.yml/badge.svg)

## Стек

| Частина | Технології |
|---|---|
| Сервер | Node.js, Express, TypeScript, Zod, JWT, bcrypt, Prisma 7 + PostgreSQL |
| Клієнт | React, Vite, TypeScript, Tailwind CSS 4, TanStack Query, React Router, Recharts |
| Тести | Vitest, Supertest (unit + API), Playwright (e2e) |
| Розгортання | Docker Compose, GitHub Actions |

## Структура

```
server/   REST API, алгоритми розрахунків, модульні й інтеграційні тести
client/   React-застосунок
e2e/      наскрізні тести Playwright
docs/     діаграми (4 етап), макети екранів, вимоги, інструкція з Git
scripts/  допоміжні скрипти (створення issues)
```

## Запуск

Вимоги: Docker, Node.js 22.

```bash
cp .env.example .env        # задайте JWT_SECRET і POSTGRES_PASSWORD
docker compose up --build   # застосунок: http://localhost:8080
```

Розробка (база в Docker, сервер і клієнт — локально з автоперезавантаженням):

```bash
cp .env.example .env                      # задайте JWT_SECRET; DATABASE_URL уже вказує на localhost
docker compose up -d db                   # лише PostgreSQL на 127.0.0.1:5433
cd server && npm ci && npm run db:deploy  # залежності, клієнт Prisma і міграції
npm run dev                               # http://localhost:3000 (довідники заповнюються автоматично)
cd client && npm ci && npm run dev        # у другому терміналі: http://localhost:5173
```

Без `DATABASE_URL` сервер працює зі сховищем у пам'яті (дані зникають після перезапуску).

Зміна схеми бази: відредагуйте `server/prisma/schema.prisma`, потім `npm run db:migrate -- --name <що_змінено>`
(створює нову міграцію в `server/prisma/migrations` — її комітять разом зі схемою).

## Тести

```bash
cd server && npm test             # модульні та API-тести (сховище в пам'яті)
cd server && npm run test:cov     # з покриттям (пороги в vitest.config.ts)

# ті самі тести на PostgreSQL (так їх запускає CI); база workout_test очищається перед запуском
docker compose exec db createdb -U app workout_test
cd server && DATABASE_URL=postgresql://app:<пароль>@localhost:5433/workout_test npm run db:deploy
TEST_DATABASE_URL=postgresql://app:<пароль>@localhost:5433/workout_test npm test
cd client && npm test             # модульні тести клієнта (форматування, одиниці, дати)
cd e2e && npm ci && npx playwright install && npm test   # потрібен запущений застосунок (docker compose up)
# або проти режиму розробки: BASE_URL=http://localhost:5173 npx playwright test --project=chromium
```

## Документація

- [Вимоги та беклог](docs/requirements.md)
- [Опис REST API](docs/api.md)
- Діаграми й макети: `docs/diagrams`, `docs/ui_screens`
