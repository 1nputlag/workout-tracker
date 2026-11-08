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
docs/     вимоги, опис API, діаграми (етап 4), знімки макетів
scripts/  допоміжні скрипти (створення issues)
```

## Запуск

Вимоги: Docker, Node.js 22.

```bash
cp .env.example .env              # задайте JWT_SECRET і POSTGRES_PASSWORD (openssl rand -hex 32)
docker compose up -d --build      # база, сервер і клієнт у фоні: http://localhost:8080
docker compose stop               # зупинити; docker compose up -d — запустити знову
```

Після оновлення коду (`git pull`) запускайте з `--build`, щоб образи перезібралися.

Розробка (база в Docker, сервер і клієнт — локально з автоперезавантаженням):

```bash
cp .env.example .env                      # задайте JWT_SECRET; DATABASE_URL уже вказує на localhost
docker compose up -d db                   # лише PostgreSQL на 127.0.0.1:5433

# термінал 1 — сервер: http://localhost:3000 (довідники заповнюються автоматично)
cd server && npm ci && npm run db:deploy && npm run dev

# термінал 2 — клієнт з автоперезавантаженням: http://localhost:5173
cd client && npm ci && npm run dev
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
- [Макети UI/UX у Figma](https://www.figma.com/design/akYq5DlUrpRdkYPWbryUO1) — 18 екранів для комп'ютера і 9 мобільних
- Діаграми етапу 4: `docs/diagrams` (джерела — `docs/sources`), знімки основних екранів: `docs/ui_screens`

## Стан реалізації

| Фаза | Що зроблено |
|---|---|
| Фаза 1 — сервер | Prisma + PostgreSQL, профіль і одиниці ваги, вправи, програми, фільтри історії; 133 тести на PostgreSQL |
| Фаза 2 — клієнт | Вхід і реєстрація, «Прогрес» із графіками, журнал тренування, історія, бібліотека вправ; 18 e2e-сценаріїв |
| Фаза 3 | Сторінки програм і профілю |
| Фаза 4 | e2e у всіх браузерах у CI, час відгуку, робота при втраті зв'язку, доступність |
| Етап 12 | Розгортання з HTTPS, інструкції з розгортання й для користувача |

Деталі за кожною вимогою — у [docs/requirements.md](docs/requirements.md).
