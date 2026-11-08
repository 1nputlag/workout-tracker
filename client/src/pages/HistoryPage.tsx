// Історія тренувань (FR-07): фільтри за періодом, вправою й групою мʼязів, групування за тижнями, пагінація.
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { dayLabel, durationText, fmtNum, mondayOf, plural, setsText, toDisplay, unitShort, weekRangeLabel, workoutTitle, workoutsText } from '../lib/format';
import { useExercises, useHistory, useMuscleGroups, useStartWorkout } from '../lib/queries';
import type { WeightUnit, WorkoutSummary } from '../lib/types';
import { EmptyState, ErrorState, Loading, PageHeader } from '../components/States';
import { IconChevron } from '../components/Icons';

const PAGE_SIZE = 10;
const PERIODS = [
  { value: '7', label: 'Останні 7 днів' },
  { value: '30', label: 'Останні 30 днів' },
  { value: '90', label: 'Останні 90 днів' },
  { value: 'all', label: 'Увесь час' },
];

/** Тренування сторінки, згруповані за тижнями (від понеділка). */
export function groupByWeek(items: WorkoutSummary[]) {
  const out: { monday: Date; items: WorkoutSummary[] }[] = [];
  for (const w of items) {
    const monday = mondayOf(new Date(w.startedAt));
    const last = out.at(-1);
    if (last && last.monday.getTime() === monday.getTime()) last.items.push(w);
    else out.push({ monday, items: [w] });
  }
  return out;
}

export function HistoryPage() {
  const { user } = useAuth();
  const unit = user?.weightUnit ?? 'kg';
  const [params, setParams] = useSearchParams();
  const period = params.get('period') ?? '30';
  const exerciseId = params.get('exercise') ?? '';
  const group = params.get('group') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);

  // Чернетка фільтрів застосовується кнопкою «Застосувати» (як у макеті)
  const [draft, setDraft] = useState({ period, exerciseId, group });
  const groups = useMuscleGroups();
  const exercises = useExercises();
  const start = useStartWorkout();

  const from = period === 'all' ? undefined : new Date(Date.now() - Number(period) * 86_400_000).toISOString();
  const history = useHistory({ page, pageSize: PAGE_SIZE, from, exerciseId: exerciseId || undefined, muscleGroupId: group ? Number(group) : undefined });

  const apply = (e: FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams();
    if (draft.period !== '30') next.set('period', draft.period);
    if (draft.exerciseId) next.set('exercise', draft.exerciseId);
    if (draft.group) next.set('group', draft.group);
    setParams(next);
  };
  const goPage = (p: number) => { const next = new URLSearchParams(params); next.set('page', String(p)); setParams(next); window.scrollTo({ top: 0 }); };
  const filtered = Boolean(exerciseId || group || period !== '30');

  return (
    <>
      <PageHeader title="Історія тренувань" />

      <form onSubmit={apply} className="card mb-8 grid gap-4 p-5 md:grid-cols-[1fr_1.2fr_1fr_auto] md:items-end md:p-8" aria-label="Фільтри історії">
        <label className="flex flex-col gap-2">
          <span className="label">Період</span>
          <select className="field" value={draft.period} onChange={(e) => setDraft({ ...draft, period: e.target.value })}>
            {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="label">Вправа</span>
          <select className="field" value={draft.exerciseId} onChange={(e) => setDraft({ ...draft, exerciseId: e.target.value })}>
            <option value="">Усі вправи</option>
            {(exercises.data ?? []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="label">Група мʼязів</span>
          <select className="field" value={draft.group} onChange={(e) => setDraft({ ...draft, group: e.target.value })}>
            <option value="">Усі групи</option>
            {(groups.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
        <button type="submit" className="btn-dark">Застосувати</button>
      </form>

      {history.isPending ? <Loading /> : history.isError ? <ErrorState error={history.error} onRetry={() => history.refetch()} /> : history.data.total === 0 ? (
        filtered ? (
          <EmptyState title="Нічого не знайдено" text="За вибраними фільтрами тренувань немає. Змініть період, вправу або групу мʼязів."
            action={<button type="button" className="btn-ghost" onClick={() => { setDraft({ period: '30', exerciseId: '', group: '' }); setParams(new URLSearchParams()); }}>Скинути фільтри</button>} />
        ) : (
          <EmptyState title="Історія порожня" text="Тут зʼявлятимуться ваші тренування з підходами, тоннажем і тривалістю."
            action={<button type="button" className="btn-lime" onClick={() => start.mutate(undefined)}>Розпочати тренування</button>} />
        )
      ) : (
        <>
          {groupByWeek(history.data.items).map(({ monday, items }) => (
            <section key={monday.toISOString()} className="mb-8" aria-label={`Тиждень ${weekRangeLabel(monday)}`}>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="h-display text-3xl">{weekRangeLabel(monday)}</h2>
                <p className="text-slate">
                  {workoutsText(items.length)} · {fmtNum(toDisplay(items.reduce((s, w) => s + w.tonnageKg, 0), unit), 0)} {unitShort(unit)}
                </p>
              </div>
              <ul className="flex flex-col gap-3">
                {items.map((w) => <HistoryItem key={w.id} w={w} unit={unit} title={workoutTitle(w.muscleGroupIds, groups.map)} />)}
              </ul>
            </section>
          ))}
          <nav aria-label="Сторінки історії" className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-slate">
              Показано {(page - 1) * PAGE_SIZE + history.data.items.length} з {history.data.total} {plural(history.data.total, ['тренування', 'тренувань', 'тренувань'])}
            </p>
            <div className="flex gap-3">
              <button type="button" className="btn-ghost" disabled={page <= 1} onClick={() => goPage(page - 1)}>Назад</button>
              <button type="button" className="btn-dark" disabled={page * PAGE_SIZE >= history.data.total} onClick={() => goPage(page + 1)}>Далі</button>
            </div>
          </nav>
        </>
      )}
    </>
  );
}

function HistoryItem({ w, unit, title }: { w: WorkoutSummary; unit: WeightUnit; title: string }) {
  const [open, setOpen] = useState(false);
  const inProgress = w.status === 'in_progress';
  const panelId = `w-${w.id}`;
  const cells = (
    <>
      <span className="font-display text-2xl font-bold md:text-3xl">{dayLabel(new Date(w.startedAt))}</span>
      <span className="min-w-0 truncate text-lg font-semibold">{title}</span>
      <span className="hidden text-slate md:inline">
        {inProgress ? <span className="rounded-full bg-lime px-3 py-1 text-sm font-semibold text-ink">Виконується</span>
          : w.status === 'cancelled' ? <span className="badge text-slate">Скасоване</span>
            : w.durationMin !== null ? durationText(w.durationMin) : ''}
      </span>
      <span className="hidden text-slate sm:inline">{setsText(w.setCount)}</span>
      <span className="text-right font-semibold">{fmtNum(toDisplay(w.tonnageKg, unit), 0)} {unitShort(unit)}</span>
    </>
  );
  const grid = 'grid w-full grid-cols-[4rem_1fr_auto] items-center gap-3 px-5 py-5 text-left md:grid-cols-[5.5rem_1fr_auto_auto_7rem_1.5rem] md:gap-6 md:px-8';

  if (inProgress) {
    return (
      <li data-testid="history-item" className="rounded-lg border-2 border-ink bg-lime-soft">
        <Link to={`/workout/${w.id}`} className={grid}>{cells}<span className="hidden md:block" /></Link>
      </li>
    );
  }
  return (
    <li data-testid="history-item" className="card">
      <button type="button" className={grid} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
        {cells}
        <IconChevron className={`hidden transition-transform md:block ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div id={panelId} className="px-5 pb-5 md:pl-[8.5rem] md:pr-8">
          <ul className="border-t border-line">
            {w.exercises.map((e) => (
              <li key={e.exerciseId} className="flex flex-wrap justify-between gap-2 border-b border-line/70 py-3">
                <span>{e.name}</span>
                <span className="text-slate">
                  {setsText(e.sets)} · {e.best.weightKg > 0
                    ? `найкращий ${fmtNum(toDisplay(e.best.weightKg, unit))} × ${e.best.reps}`
                    : `${e.best.reps} ${plural(e.best.reps, ['повторення', 'повторення', 'повторень'])}`}
                </span>
              </li>
            ))}
          </ul>
          <Link to={`/workout/${w.id}`} className="mt-4 inline-block font-semibold underline underline-offset-4">Відкрити тренування</Link>
        </div>
      )}
    </li>
  );
}
