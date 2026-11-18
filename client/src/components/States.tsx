import type { ReactNode } from 'react';
import { errorMessage } from '../lib/api';
import { useOnline } from '../lib/online';

export function Loading({ label = 'Завантаження…' }: { label?: string }) {
  // Без мережі запити призупинені: замість нескінченного «Завантаження» пояснюємо, що станеться далі
  const online = useOnline();
  if (!online) {
    return (
      <div role="status" className="card flex items-center gap-3 p-6 text-slate">
        <span className="size-2.5 rounded-full bg-danger" aria-hidden />
        Немає зʼєднання — дані завантажаться автоматично, щойно воно відновиться.
      </div>
    );
  }
  return (
    <div role="status" className="flex items-center gap-3 py-10 text-slate">
      <span className="size-5 animate-spin rounded-full border-2 border-line border-t-ink" aria-hidden />
      {label}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="card flex flex-wrap items-center justify-between gap-4 p-6">
      <p className="text-danger">{errorMessage(error)}</p>
      {onRetry && <button type="button" className="btn-ghost" onClick={onRetry}>Спробувати ще раз</button>}
    </div>
  );
}

export function EmptyState({ title, text, action, testId }: { title: string; text: string; action?: ReactNode; testId?: string }) {
  return (
    <div data-testid={testId} className="card flex flex-col items-start gap-4 p-8 md:p-10">
      <h2 className="h-display text-3xl">{title}</h2>
      <p className="max-w-xl text-slate">{text}</p>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
      <div>
        <h1 className="h-display text-[2.6rem] md:text-6xl">{title}</h1>
        {subtitle && <p className="mt-2 text-slate md:text-lg">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
