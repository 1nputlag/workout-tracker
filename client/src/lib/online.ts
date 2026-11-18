// Стан мережі для інтерфейсу (NFR-04). Джерело — onlineManager TanStack Query: саме він призупиняє
// запити й мутації без мережі та відновлює їх, тож банер і черга підходів показують ту саму картину.
import { useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';

export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
    () => true,
  );
}

/** Повторюємо лише мережеві збої (сервер недоступний), а не помилки валідації чи доступу. */
export const isNetworkError = (err: unknown) => (err as { code?: string } | null)?.code === 'network_error';

/** Затримка перед повтором: 1 с, 2 с, 4 с… але не більше 10 с. */
export const retryDelay = (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000);
