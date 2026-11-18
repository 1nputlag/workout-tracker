#!/usr/bin/env node
// Навантажувальний тест часу відгуку сервера (вимога NFR-01).
//
// Сценарій: кілька користувачів, у кожного — історія тренувань приблизно за пів року.
// Потім вони одночасно зберігають підходи й переглядають історію та статистику.
// Критерій прийняття: 95-й процентиль збереження підходу й історії ≤ 300 мс.
//
// Запуск (застосунок має працювати, наприклад, `docker compose up -d`):
//   node perf/load-test.mjs                         # http://localhost:8080
//   node perf/load-test.mjs --base http://localhost:3000 --users 10 --requests 300
//
// Залежностей немає: потрібен лише Node.js 22 (вбудований fetch).
import { appendFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const BASE = (args.base ?? process.env.BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '');
const USERS = Number(args.users ?? 5); // одночасних користувачів
const WORKOUTS = Number(args.workouts ?? 75); // історія на користувача: ~3 тренування на тиждень за пів року
const SETS = Number(args.sets ?? 16); // підходів у тренуванні
const REQUESTS = Number(args.requests ?? 200); // вимірювань кожної операції на користувача
const LIMIT_MS = Number(args.limit ?? 300);

async function call(method, path, token, body) {
  const t0 = performance.now();
  const res = await fetch(BASE + '/api' + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const ms = performance.now() - t0;
  const data = res.status === 204 ? null : await res.json();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(data)}`);
  return { data, ms };
}

/** Виконує завдання з обмеженою кількістю одночасних запитів. */
async function pool(tasks, concurrency) {
  const out = [];
  let next = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < tasks.length) { const i = next++; out[i] = await tasks[i](); }
  }));
  return out;
}

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];

async function prepareUser(n) {
  const { data } = await call('POST', '/auth/register', null, { email: `load-${randomUUID()}@example.com`, password: 'load-test-password', displayName: `Навантаження ${n}` });
  const token = data.token;
  const exercises = (await call('GET', '/exercises', token)).data.slice(0, 8).map((e) => e.id);
  // Історія: завершені тренування з підходами (наповнюються через API, як у справжнього користувача)
  for (let w = 0; w < WORKOUTS; w++) {
    const id = (await call('POST', '/workouts', token, {})).data.id;
    await pool(Array.from({ length: SETS }, (_, s) => () =>
      call('POST', `/workouts/${id}/sets`, token, { exerciseId: exercises[s % exercises.length], weightKg: 40 + ((w + s) % 30) * 2.5, reps: 5 + (s % 8) })), 4);
    await call('POST', `/workouts/${id}/finish`, token);
  }
  const active = (await call('POST', '/workouts', token, {})).data.id;
  return { token, exercises, active };
}

const OPERATIONS = {
  'Збереження підходу': (u, i) => call('POST', `/workouts/${u.active}/sets`, u.token, { exerciseId: u.exercises[i % u.exercises.length], weightKg: 80, reps: 8 }),
  'Історія (сторінка 1)': (u) => call('GET', '/workouts?page=1&pageSize=10', u.token),
  'Історія з фільтром за вправою': (u, i) => call('GET', `/workouts?page=1&pageSize=10&exerciseId=${u.exercises[i % u.exercises.length]}`, u.token),
  'Статистика прогресу (8 тижнів)': (u) => call('GET', `/stats/progress?from=${new Date(Date.now() - 56 * 86_400_000).toISOString()}&tzOffsetMin=120`, u.token),
  'Бібліотека вправ': (u) => call('GET', '/exercises', u.token),
};
const CHECKED = ['Збереження підходу', 'Історія (сторінка 1)', 'Історія з фільтром за вправою']; // предмет критерію NFR-01

console.log(`Сервер: ${BASE}`);
console.log(`Підготовка: ${USERS} користувачів × ${WORKOUTS} тренувань × ${SETS} підходів = ${USERS * WORKOUTS * SETS} підходів в історії…`);
const t0 = performance.now();
const users = await Promise.all(Array.from({ length: USERS }, (_, n) => prepareUser(n + 1)));
console.log(`Готово за ${((performance.now() - t0) / 1000).toFixed(1)} с. Вимірювання: ${USERS} одночасних користувачів, по ${REQUESTS} запитів кожної операції.\n`);

// Прогрів: перші запити після запуску повільніші (JIT, пул з'єднань) і не відображають усталеної роботи
await Promise.all(users.map((u) => Promise.all(Object.values(OPERATIONS).map((op) => op(u, 0)))));

const rows = [];
let failed = false;
for (const [name, op] of Object.entries(OPERATIONS)) {
  // Кожен користувач надсилає запити послідовно, а всі користувачі — одночасно
  const times = (await Promise.all(users.map(async (u) => {
    const own = [];
    for (let i = 0; i < REQUESTS; i++) own.push((await op(u, i)).ms);
    return own;
  }))).flat().sort((a, b) => a - b);
  const p95 = pct(times, 95);
  const checked = CHECKED.includes(name);
  const ok = !checked || p95 <= LIMIT_MS;
  if (!ok) failed = true;
  rows.push({ name, n: times.length, p50: pct(times, 50), p95, p99: pct(times, 99), max: times.at(-1), verdict: checked ? (ok ? '✅' : '❌') : '—' });
}

const f = (x) => x.toFixed(1);
const table = [
  `| Операція | Запитів | p50, мс | p95, мс | p99, мс | Макс., мс | p95 ≤ ${LIMIT_MS} мс |`,
  '|---|---:|---:|---:|---:|---:|:---:|',
  ...rows.map((r) => `| ${r.name} | ${r.n} | ${f(r.p50)} | ${f(r.p95)} | ${f(r.p99)} | ${f(r.max)} | ${r.verdict} |`),
].join('\n');
console.log(table);
console.log(`\nДані: ${USERS * WORKOUTS * SETS} підходів в історії, ${USERS} одночасних користувачів.`);
console.log(failed ? `\nNFR-01 НЕ виконано: 95-й процентиль перевищує ${LIMIT_MS} мс.` : '\nNFR-01 виконано.');

// У GitHub Actions таблиця з'являється на сторінці запуску конвеєра
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Навантажувальний тест (NFR-01)\n\n${USERS} одночасних користувачів, ${USERS * WORKOUTS * SETS} підходів в історії.\n\n${table}\n`);
}
process.exit(failed ? 1 : 0);
