# Як працювати з Git у цьому репозиторії

Інструкція крок за кроком: від створення репозиторію до першого релізу. Усі команди виконуються з кореня проєкту
(`workout-tracker/`). Замість `<логін>` підставте ваш логін на GitHub.

## 0. Одноразове налаштування

```bash
git config --global user.name "Ім'я Прізвище"
git config --global user.email "пошта-вашого-акаунта-GitHub@example.com"   # саме ця пошта додана в GitHub → Settings → Emails
git config --global init.defaultBranch main
gh auth login          # GitHub CLI: потрібен для створення репозиторію, issues і pull request-ів з терміналу
```

Автором кожного коміту стає людина, на яку налаштовано `user.name` і `user.email`. Якщо пошта не додана до акаунта,
GitHub не зв'яже коміти з вашим профілем і вони не потраплять до графіка активності.

## 1. Створення репозиторію

Є два шляхи; оберіть один.

**Через сайт.** github.com → New repository → назва `workout-tracker`, **Private**, без README, `.gitignore` і ліцензії
(вони вже є в проєкті). Далі:

```bash
git init
git branch -M main
git remote add origin git@github.com:<логін>/workout-tracker.git
```

**Через GitHub CLI.** Одна команда замість трьох:

```bash
git init
git branch -M main
gh repo create workout-tracker --private --source=. --remote=origin
```

Якщо працюєте через HTTPS замість SSH, адреса буде `https://github.com/<логін>/workout-tracker.git`.

## 2. Стартова послідовність комітів

Не комітьте весь каркас одним махом: історія з кількох невеликих змістовних комітів показує, як росте проєкт, її легко
читати керівнику й легко відкотити частину. Кожен коміт — одна логічна зміна; код іде разом зі своїми тестами.
Перед кожним комітом корисно виконати `git status` і переконатися, що в нього потрапить лише потрібне.

Спочатку чотири коміти прямо в `main` (службові файли й документація):

**Коміт 1.** `chore: initial project setup`  
Спершу правила гри: що ігнорується, як форматувати, як запускати. `.env.example` — шаблон без секретів.

```bash
git add .gitignore .editorconfig .env.example README.md
git commit -m "chore: initial project setup"
```

**Коміт 2.** `docs: add stage 4 design diagrams and UI mockups`  
Результати 4 етапу — окремим комітом, щоб керівник бачив їх в історії як документацію проєкту.

```bash
git add docs/diagrams docs/ui_screens docs/sources
git commit -m "docs: add stage 4 design diagrams and UI mockups"
```

**Коміт 3.** `docs: add requirements and Git guide`  
Вимоги FR/UI/NFR з ідентифікаторами; на них посилатимуться issues, тести й pull request-и.

```bash
git add docs/requirements.md docs/GIT_GUIDE.md
git commit -m "docs: add requirements and Git guide"
```

**Коміт 4.** `chore: add issue and PR templates and backlog script`  
Шаблони й скрипт створення issues. Це службові файли, тому окремий коміт.

```bash
git add .github/ISSUE_TEMPLATE .github/pull_request_template.md scripts
git commit -m "chore: add issue and PR templates and backlog script"
```


Відправте `main` і створіть гілку `develop`, у якій відбуватиметься вся подальша робота:

```bash
git push -u origin main
git switch -c develop
git push -u origin develop
```

Далі кожна група комітів іде у власній гілці, а в `develop` потрапляє через pull request (див. розділ 3). Це та сама
послідовність, яку ви повторюватимете для всіх наступних завдань.

### Гілка `feature/server-core` (коміти 5–8)

```bash
git switch -c feature/server-core
```

**Коміт 5.** `feat(server): add workload statistics and progression hint`  
Перша функціональність — алгоритми з розділу 4.8 разом із тестами й конфігурацією. Код і тести завжди йдуть в одному коміті.

```bash
git add server/package.json server/package-lock.json server/tsconfig.json server/tsconfig.build.json server/vitest.config.ts server/src/services server/tests/unit/stats.test.ts server/tests/unit/progression.test.ts
git commit -m "feat(server): add workload statistics and progression hint"
```

**Коміт 6.** `feat(server): add workout state machine and input validation`  
Життєвий цикл тренування (діаграма 4.11) і схеми Zod.

```bash
git add server/src/domain server/src/validation server/tests/unit/workoutState.test.ts server/tests/unit/schemas.test.ts
git commit -m "feat(server): add workout state machine and input validation"
```

**Коміт 7.** `feat(server): add auth and workouts REST API`  
API автентифікації й журналювання; сховище поки в пам'яті за інтерфейсом Repo.

```bash
git add server/src/app.ts server/src/repo server/tests/integration
git commit -m "feat(server): add auth and workouts REST API"
```

**Коміт 8.** `build(server): add entry point and Dockerfile`  
Точка входу й образ сервера. Тип `build` — зміни, що стосуються збірки й упаковки.

```bash
git add server/src/index.ts server/Dockerfile server/.dockerignore
git commit -m "build(server): add entry point and Dockerfile"
```

Перевірте, що все зелене, відправте гілку й відкрийте pull request:

```bash
cd server && npm ci && npm run typecheck && npm test && cd ..
git push -u origin feature/server-core
gh pr create --base develop --title "feat(server): core algorithms and REST API" --body "Refs #1, #5, #6, #8, #9, #22"
```

Перевірок CI у репозиторії ще немає (пайплайн з'явиться в третьому pull request), тому переглянете зміни на вкладці **Files changed** і зливайте: кнопка **Merge pull request** на сайті або команда нижче. Потім оновіть локальний `develop`:

```bash
gh pr merge --merge --delete-branch
git switch develop && git pull
```

### Гілка `feature/client-skeleton` (коміт 9)

```bash
git switch -c feature/client-skeleton
```

**Коміт 9.** `feat(client): add Vite and React skeleton`  
Мінімальний клієнт, який звертається до /api/health. Макети з docs/ui_screens реалізуються на етапах 7–9.

```bash
git add client
git commit -m "feat(client): add Vite and React skeleton"
```

```bash
git push -u origin feature/client-skeleton
gh pr create --base develop --title "feat(client): Vite and React skeleton" --body "Каркас клієнта; екрани з docs/ui_screens реалізуються в окремих issues"
gh pr merge --merge --delete-branch
git switch develop && git pull
```

### Гілка `feature/docker-ci` (коміти 10–12)

```bash
git switch -c feature/docker-ci
```

**Коміт 10.** `build: add Docker Compose configuration`  
Увесь стек однією командою.

```bash
git add docker-compose.yml
git commit -m "build: add Docker Compose configuration"
```

**Коміт 11.** `ci: add GitHub Actions pipeline`  
Пайплайн. Цей pull request уже сам запустить його вперше.

```bash
git add .github/workflows
git commit -m "ci: add GitHub Actions pipeline"
```

**Коміт 12.** `test(e2e): add Playwright scenarios`  
Наскрізні сценарії; у CI вимкнені до появи інтерфейсу (змінна E2E_ENABLED).

```bash
git add e2e
git commit -m "test(e2e): add Playwright scenarios"
```

```bash
git push -u origin feature/docker-ci
gh pr create --base develop --title "build: Docker Compose, CI pipeline and e2e scenarios" --body "Refs #24"
```

Цей pull request вперше запустить пайплайн CI: на сторінці PR з'являться перевірки `server` і `client`. Дочекайтеся
зеленого результату, а потім зливайте.

> **Closes чи Refs.** Запис `Closes #5` у тексті pull request автоматично закриває issue після злиття; `Refs #5`
> лише додає посилання. Закривайте issue, тільки коли вимога виконана повністю. Каркас реалізує FR-01, FR-05 тощо на
> сховищі в пам'яті, тому тут вжито `Refs`; issue закривайте після підключення PostgreSQL (INF-01) та інтерфейсу.

Нарешті, перший реліз: злийте `develop` у `main` і поставте тег.

```bash
gh pr create --base main --head develop --title "Release v0.1.0" --body "Каркас: сервер, клієнт, Docker Compose, CI"
gh pr merge --merge
git switch main && git pull
git tag -a v0.1.0 -m "v0.1.0: project skeleton"
git push origin v0.1.0
```

Тег `v*` запускає ланку `publish` у CI: образи `server` і `client` з'являться на сторінці репозиторію в розділі Packages.

## 3. Щоденний цикл роботи над завданням

Для кожного issue повторюється той самий цикл:

```bash
git switch develop && git pull                     # 1. актуальна основа
git switch -c feature/fr-07-history-filters        # 2. гілка під issue (тип/номер-суть)
# ... пишете код і тести, час від часу:
git status                                         # 3. що змінилося
git diff                                           #    переглянути зміни перед додаванням
git add server/src/app.ts server/tests/...         # 4. додавайте файли поіменно, а не `git add .`
git commit -m "feat(server): filter history by exercise"
git push -u origin feature/fr-07-history-filters   # 5. відправити (-u лише вперше)
gh pr create --base develop --fill                 # 6. pull request; у тексті: Closes #7
# CI зелений → Merge; потім: git switch develop && git pull
```

Порада: `git add .` зручний, але легко затягує зайве (`.env`, згенеровані файли). Поки не звикнете, додавайте шляхи поіменно
і дивіться `git status` перед комітом.

## 4. Повідомлення комітів

Використовується формат Conventional Commits: `тип(область): короткий опис у наказовому способі`.

| Тип | Коли |
|---|---|
| `feat` | нова функціональність |
| `fix` | виправлення помилки |
| `test` | лише тести |
| `docs` | документація, діаграми, макети |
| `build` | збірка, Docker, залежності |
| `ci` | налаштування GitHub Actions |
| `refactor` | зміна структури коду без зміни поведінки |
| `chore` | службові дрібниці |

Область — `server`, `client`, `e2e` (необов'язкова). Приклади: `fix(server): return 400 for invalid JSON`,
`test(server): cover week boundary in timezone`, `feat(client): add workout log screen`. Один коміт — одна думка:
якщо в описі хочеться написати «і», це, ймовірно, два коміти. Довші пояснення можна додати в тілі коміту: другий `-m`.

## 5. Що можна й чого не можна комітити

- **Не можна:** `.env`, паролі, токени, ключі (вони в `.gitignore`); `node_modules`, `dist`, `coverage`. Якщо секрет усе
  ж потрапив у коміт, видалення файла наступним комітом не допоможе: секрет лишається в історії. Його треба негайно
  змінити (згенерувати новий `JWT_SECRET`, пароль бази тощо).
- **Можна й потрібно:** `package-lock.json` (CI використовує `npm ci`), `.env.example` (шаблон без значень), діаграми й макети.
- Перед кожним комітом: `git status` і `git diff --staged` (показує, що саме потрапить у коміт).

## 6. Issues, Projects і віхи

```bash
node scripts/create-issues.mjs            # пробний запуск: показує команди, нічого не створює
node scripts/create-issues.mjs --apply    # створює мітки, віхи (Етап 6–9) і 25 issues
```

Скрипт використовує GitHub CLI, тож потрібен `gh auth login`. Номери issues відповідають порядку в `docs/requirements.md`
(FR-01 → #1, …, FR-09 → #9, UI-01 → #10, …, NFR-01 → #18, …, INF-01 → #23), якщо в репозиторії раніше не було issues.
Віхи (milestones) відповідають етапам 6–9 графіка: перейменуйте їх відповідно до назв етапів у керівника.
Далі на вкладці Projects створіть дошку (Table або Board), додайте до неї issues і переводьте їх між колонками
Todo → In progress → Done. Pull request із `Closes #N` сам перенесе issue в Done.

## 7. CI і захист гілок

Пайплайн `.github/workflows/ci.yml` складається з ланок `server`, `client`, `e2e`, `publish`. Звіт покриття та
звіти Playwright зберігаються як артефакти на сторінці запуску.

- **Захист гілок.** Після першого запуску CI відкрийте Settings → Branches → Add branch ruleset для `main` і `develop`:
  вимагайте pull request і успішні перевірки `server` та `client`. Не вмикайте обов'язкове схвалення іншою людиною: у
  репозиторії ви один, і це заблокувало б вас самих. Ланки з'являються у списку перевірок лише після першого запуску
  пайплайна, тому правило створюють після першого pull request із CI.
- **Наскрізні тести.** Ланка `e2e` вимкнена. Коли інтерфейс готовий: Settings → Secrets and variables → Actions →
  Variables → New repository variable → `E2E_ENABLED` = `true`.
- **PostgreSQL у CI.** Після підключення Prisma розкоментуйте блок `services: postgres` у ланці `server`.

## 8. Типові ситуації

| Ситуація | Що робити |
|---|---|
| Закомітили в не ту гілку (ще не відправляли) | `git switch -c потрібна-гілка` (коміт переїде разом), потім у старій: `git switch стара && git reset --hard origin/стара` |
| Помилка в повідомленні останнього коміту (ще не відправляли) | `git commit --amend -m "нове повідомлення"` |
| Забули додати файл в останній коміт (ще не відправляли) | `git add файл && git commit --amend --no-edit` |
| Скасувати останній коміт, лишивши зміни | `git reset --soft HEAD~1` |
| `git push` відхилено («rejected») | `git pull --rebase`, вирішити конфлікти, `git push` |
| Конфлікт під час злиття | відкрити файл, залишити потрібне між `<<<<<<<` і `>>>>>>>`, `git add файл`, `git commit` |
| Випадково додали `node_modules` | `git rm -r --cached node_modules` і перевірити `.gitignore` |

Команди `reset --hard` і `--amend` після `git push` не застосовуйте: вони переписують історію, яку вже бачать інші.
