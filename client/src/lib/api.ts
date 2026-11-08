// Тонка обгортка над fetch: додає токен, розбирає помилки сервера у форматі { error, details }.
const TOKEN_KEY = 'wt.token';

export class ApiError extends Error {
  constructor(public status: number, public code: string, public details: { path: string; message: string }[] = []) {
    super(code);
  }
}

export const tokenStore = {
  get: (): string | null => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t: string) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* приватний режим */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* приватний режим */ } },
};

let onUnauthorized: () => void = () => {};
/** Викликається, коли сервер відповів 401 на запит із токеном (термін дії минув) — застосунок виходить із акаунта. */
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

type Query = Record<string, string | number | undefined | null>;

export async function api<T>(path: string, init: { method?: string; body?: unknown; query?: Query } = {}): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(init.query ?? {})) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(`/api${path}${qs.size ? `?${qs}` : ''}`, {
      method: init.method ?? 'GET',
      headers: {
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network_error');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized();
    throw new ApiError(res.status, data.error ?? 'unknown_error', data.details ?? []);
  }
  return data as T;
}

/** Повідомлення для користувача за кодом помилки сервера. */
export function errorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Щось пішло не так. Спробуйте ще раз.';
  switch (err.code) {
    case 'network_error': return 'Немає зʼєднання з сервером. Перевірте інтернет і спробуйте ще раз.';
    case 'invalid_credentials': return 'Неправильна пошта або пароль.';
    case 'email_taken': return 'Ця пошта вже зареєстрована. Увійдіть або використайте іншу.';
    case 'exercise_exists': return 'Вправа з такою назвою вже є в бібліотеці.';
    case 'exercise_in_use': return 'Вправу не можна видалити: вона вже є в тренуваннях або програмах.';
    case 'workout_not_in_progress': return 'Тренування вже не виконується — підходи змінити не можна.';
    case 'invalid_transition': return 'Цю дію не можна виконати для тренування в поточному стані.';
    case 'validation_error': return err.details[0]?.message ?? 'Перевірте введені дані.';
    case 'not_found': return 'Запис не знайдено.';
    default: return 'Помилка сервера. Спробуйте ще раз пізніше.';
  }
}
