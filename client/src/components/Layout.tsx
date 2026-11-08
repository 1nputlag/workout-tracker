// Каркас застосунку: верхня панель із навігацією (комп'ютер) і нижня навігація (смартфон, UI-01).
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { initials } from '../lib/format';
import { usePrograms, useStartWorkout } from '../lib/queries';
import { errorMessage } from '../lib/api';
import { Logo } from './Logo';
import { Menu } from './Menu';
import { IconChart, IconClock, IconDumbbell, IconList, IconPlus } from './Icons';

const NAV = [
  { to: '/', label: 'Головна', icon: IconChart, end: true },
  { to: '/workout', label: 'Тренування', icon: IconDumbbell, end: false },
  { to: '/history', label: 'Історія', icon: IconClock, end: false },
  { to: '/exercises', label: 'Вправи', icon: IconList, end: false },
];

/** Кнопка «Нове тренування» з меню: швидкий старт або тренування за програмою. */
export function NewWorkoutButton() {
  const start = useStartWorkout();
  const programs = usePrograms();
  const items = [
    { label: 'Швидкий старт', hint: 'Порожнє тренування — вправи додаєте по ходу', onSelect: () => start.mutate(undefined) },
    ...(programs.data ?? []).map((p) => ({
      label: `За програмою «${p.name}»`,
      hint: `${p.items.length} вправ`,
      onSelect: () => start.mutate(p.id),
    })),
  ];
  return (
    <div>
      <Menu
        items={items}
        button={(props) => (
          <button type="button" className="btn-lime px-4 md:px-5" disabled={start.isPending} {...props}>
            <IconPlus width={20} height={20} strokeWidth={2.6} />
            Нове тренування
          </button>
        )}
      />
      {start.isError && <p role="alert" className="mt-2 text-sm text-danger">{errorMessage(start.error)}</p>}
    </div>
  );
}

function AccountMenu() {
  const { user, signOut } = useAuth();
  const name = user?.displayName ?? '';
  return (
    <Menu
      items={[{ label: 'Вийти', onSelect: signOut }]}
      header={user && (
        <div className="mb-1 border-b border-line px-3 pb-3 pt-1">
          <p className="font-semibold">{user.displayName}</p>
          <p className="text-sm text-slate">{user.email}</p>
        </div>
      )}
      button={(props) => (
        <button type="button" aria-label={`Акаунт: ${name}`} className="grid size-12 place-items-center rounded-full bg-ink font-display text-lg font-bold text-lime" {...props}>
          {initials(name || '?')}
        </button>
      )}
    />
  );
}

export function Layout() {
  return (
    <div className="min-h-dvh pb-24 md:pb-0">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 md:h-20 md:gap-8 md:px-10">
          <NavLink to="/" aria-label="Workout — на головну"><Logo compactOnMobile /></NavLink>
          <nav aria-label="Основна навігація" className="hidden h-full items-stretch gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) => `flex items-center border-b-4 px-4 pt-1 text-lg font-medium transition-colors ${isActive ? 'border-lime font-semibold text-ink' : 'border-transparent text-slate hover:text-ink'}`}
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 md:gap-6">
            <NewWorkoutButton />
            <AccountMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-10 md:py-12">
        <Outlet />
      </main>

      <nav aria-label="Основна навігація" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => `flex min-h-16 flex-col items-center justify-center gap-1 border-t-4 text-sm ${isActive ? 'border-lime font-semibold text-ink' : 'border-transparent text-slate'}`}
          >
            <n.icon />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
