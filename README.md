# Workout Tracker

Вебзастосунок для трекінгу тренувань: журналювання підходів, повторень і ваги, автоматичний розрахунок
тоннажу, тижневого обсягу та оцінки одноповторного максимуму, графіки прогресу й підказки щодо збільшення навантаження.

Курсова робота «Розробка web застосунку для трекінгу тренувань (workout tracker)», ЛНУ імені Івана Франка.

![CI](https://github.com/<ваш-логін>/workout-tracker/actions/workflows/ci.yml/badge.svg)

## Стек

| Частина | Технології |
|---|---|
| Сервер | Node.js, Express, TypeScript, Zod, JWT, bcrypt; Prisma + PostgreSQL (підключається на етапі 6) |
| Клієнт | React, Vite, TypeScript; Tailwind, TanStack Query, Recharts (додаються на етапах 7–8) |
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

Розробка без Docker (два термінали):

```bash
cd server && npm ci && JWT_SECRET=dev npm run dev    # http://localhost:3000
cd client && npm ci && npm run dev                   # http://localhost:5173
```

## Тести

```bash
cd server && npm test             # модульні та API-тести
cd server && npm run test:cov     # з покриттям (пороги в vitest.config.ts)
cd e2e && npm ci && npx playwright install && npm test   # потрібен запущений застосунок
```

## Документація

- [Вимоги та беклог](docs/requirements.md)
- [Як працювати з Git у цьому репозиторії](docs/GIT_GUIDE.md)
- Діаграми й макети: `docs/diagrams`, `docs/ui_screens`
