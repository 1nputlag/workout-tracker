# REST API

Базова адреса — `/api`. Тіла запитів і відповідей — JSON. Усі маршрути, крім `/api/health` і `/api/auth/*`,
потребують заголовка `Authorization: Bearer <токен>`; без нього або з недійсним токеном — `401 { "error": "unauthorized" }`.

Вага в запитах і в базі — **завжди в кілограмах**. Для відображення сервер додає `displayWeight` в одиницях користувача (FR-02).

## Помилки

| Статус | `error` | Коли |
|---|---|---|
| 400 | `validation_error` + `details: [{ path, message }]` | некоректне тіло або параметри (Zod) |
| 400 | `invalid_json` | пошкоджений JSON |
| 401 | `unauthorized`, `invalid_credentials` | немає токена; хибна пошта або пароль |
| 403 | `forbidden` | спроба змінити загальну вправу |
| 404 | `not_found` | запису немає або він чужий (однакова відповідь) |
| 409 | `email_taken`, `exercise_exists`, `exercise_in_use`, `workout_not_in_progress`, `invalid_transition`, `conflict` | конфлікт стану |
| 413 | `payload_too_large` | тіло понад 100 КБ |
| 500 | `internal_error` | непередбачена помилка (подробиці лише в журналі сервера) |

## Автентифікація та профіль

| Метод і шлях | Тіло / параметри | Відповідь |
|---|---|---|
| `POST /auth/register` | `{ email, password (8–72 байти), displayName? }` | `201 { token, user }` |
| `POST /auth/login` | `{ email, password }` | `200 { token, user }` |
| `GET /profile` | — | `{ id, email, displayName, weightUnit: "kg" \| "lb" }` |
| `PATCH /profile` | `{ displayName?, weightUnit? }` | оновлений профіль |

## Групи м'язів і вправи (FR-03)

| Метод і шлях | Тіло / параметри | Відповідь |
|---|---|---|
| `GET /muscle-groups` | — | `[{ id, name }]` — 7 груп |
| `GET /exercises` | `?q=&muscleGroupId=` (комбінуються) | `[Exercise]` — загальні + власні, за абеткою |
| `GET /exercises/:id` | — | `Exercise` |
| `POST /exercises` | `{ name, muscleGroupId }` | `201 Exercise` (власна) |
| `PATCH /exercises/:id` | `{ name?, muscleGroupId? }` | `Exercise`; лише власна |
| `DELETE /exercises/:id` | — | `204`; `409 exercise_in_use`, якщо є підходи або програми |
| `GET /exercises/:id/hint` | `?lo=6&hi=8&plateStepKg=2.5` | `{ exerciseId, range, hint }` — підказка прогресії (4.8.2) |

`Exercise = { id, name, muscleGroupId, muscleGroup, own, lastSet: { weightKg, reps, date } | null, oneRepMax }`.

## Програми (FR-04)

| Метод і шлях | Тіло | Відповідь |
|---|---|---|
| `GET /programs` | — | `[Program]` |
| `GET /programs/:id` | — | `Program` |
| `POST /programs` | `{ name, items: [{ exerciseId, targetSets, targetReps }] }` | `201 Program` |
| `PATCH /programs/:id` | `{ name?, items? }` — `items` замінює перелік повністю | `Program` |
| `DELETE /programs/:id` | — | `204`; тренування за програмою лишаються (`programId = null`) |

`Program = { id, name, items: [{ exerciseId, exerciseName, muscleGroupId, position, targetSets, targetReps }] }`.

## Тренування (FR-05, FR-07)

| Метод і шлях | Тіло / параметри | Відповідь |
|---|---|---|
| `POST /workouts` | `{}` або `{ programId }` | `201 WorkoutDetail` (статус `in_progress`) |
| `GET /workouts` | `?page=1&pageSize=10&from=&to=&exerciseId=&muscleGroupId=&status=` | `{ total, page, pageSize, items: [WorkoutSummary] }` |
| `GET /workouts/:id` | — | `WorkoutDetail` |
| `DELETE /workouts/:id` | — | `204` |
| `POST /workouts/:id/sets` | `{ exerciseId, weightKg (0–1000), reps (1–100) }` | `201` підхід; `409`, якщо тренування не виконується |
| `DELETE /workouts/:id/sets/:setId` | — | `204` (лише поки тренування виконується) |
| `POST /workouts/:id/finish` | — | `{ id, status, finishedAt }`; потрібен ≥ 1 підхід |
| `POST /workouts/:id/cancel` | — | те саме; скасоване — кінцевий стан |
| `POST /workouts/:id/reopen` | — | повернення завершеного до редагування |

`WorkoutDetail = { id, status, startedAt, finishedAt, programId, programName, weightUnit, sets: [{ id, exerciseId, exerciseName, muscleGroupId, setNumber, weightKg, displayWeight, reps, oneRepMax, createdAt }] }`.

`WorkoutSummary = { id, status, startedAt, finishedAt, programId, durationMin, setCount, tonnageKg, muscleGroupIds, exercises: [{ exerciseId, name, sets, best: { weightKg, reps } }] }`.

## Статистика (FR-06)

`GET /stats/progress?from=&to=&tzOffsetMin=&exerciseId=` — лише завершені тренування:

```json
{
  "workouts": 3, "sets": 66,
  "weeklyVolume":  { "2026-W42|1": 14 },
  "weeklyTonnage": { "2026-W42": 14820 },
  "oneRepMax":     { "2026-10-16": 101.33 }
}
```

`tzOffsetMin` — зсув часового поясу в хвилинах від UTC (для Києва взимку `120`); `exerciseId` обмежує лише `oneRepMax`.
