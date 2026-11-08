// Головна — прогрес (UI-03, FR-06): показники тижня, динаміка оцінки 1ПМ, підходи за групами мʼязів, підказка, останні тренування.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../lib/auth';
import { dayLabel, fmtNum, isoWeekKey, mondayOf, plural, setsText, toDisplay, tzOffsetMin, unitShort, weekRangeLabel, workoutTitle } from '../lib/format';
import { useExercises, useHint, useHistory, useMuscleGroups, useProgress, useStartWorkout } from '../lib/queries';
import type { Hint, WeightUnit } from '../lib/types';
import { EmptyState, ErrorState, Loading, PageHeader } from '../components/States';

const PERIODS = [
  { weeks: 4, label: 'Останні 4 тижні' },
  { weeks: 8, label: 'Останні 8 тижнів' },
  { weeks: 12, label: 'Останні 12 тижнів' },
  { weeks: 26, label: 'Останні 6 місяців' },
];

/** Найкраща оцінка 1ПМ за кожен тиждень (графік показує тижневі точки, як у макеті). */
export function weeklyBest(daily: Record<string, number>): { week: string; label: string; value: number }[] {
  const byWeek = new Map<string, { monday: Date; value: number }>();
  for (const [day, value] of Object.entries(daily)) {
    const [y, m, d] = day.split('-').map(Number);
    const monday = mondayOf(new Date(y, m - 1, d));
    const key = monday.toISOString();
    const cur = byWeek.get(key);
    if (!cur || value > cur.value) byWeek.set(key, { monday, value });
  }
  return [...byWeek.values()]
    .sort((a, b) => a.monday.getTime() - b.monday.getTime())
    .map(({ monday, value }) => ({
      week: monday.toISOString(),
      label: `${String(monday.getDate()).padStart(2, '0')}.${String(monday.getMonth() + 1).padStart(2, '0')}`,
      value: Math.round(value * 10) / 10,
    }));
}

function hintText(h: Hint, unit: WeightUnit): { title: string; body: string } | null {
  const w = (kg: number) => `${fmtNum(toDisplay(kg, unit))} ${unitShort(unit)}`;
  switch (h.kind) {
    case 'increase_weight':
      return { title: 'час додати вагу', body: `У двох останніх тренуваннях ви досягли верхньої межі діапазону з вагою ${w(h.fromKg)}. Спробуйте ${w(h.toKg)}.${h.exceedsRange ? ' Крок дисків більший за 10 % — за потреби залиште вагу й додайте повторення.' : ''}` };
    case 'increase_reps':
      return { title: 'додайте повторення', body: `Залишайтеся на ${w(h.weightKg)} і намагайтеся додати повторення, доки не досягнете верхньої межі діапазону.` };
    case 'keep_or_reduce':
      return { title: 'збережіть вагу', body: `Минулого разу повторень було менше за нижню межу діапазону. Залиште ${w(h.weightKg)} або трохи зменште вагу.` };
    default:
      return null;
  }
}

export function DashboardPage() {
  const { user } = useAuth();
  const unit = user?.weightUnit ?? 'kg';
  const [weeks, setWeeks] = useState(8);
  const [pickedExercise, setPickedExercise] = useState<string>();
  const start = useStartWorkout();
  const groups = useMuscleGroups();
  const exercises = useExercises();
  const tz = tzOffsetMin();

  const from = useMemo(() => {
    const d = mondayOf(new Date()); d.setDate(d.getDate() - 7 * (weeks - 1)); return d.toISOString();
  }, [weeks]);

  const recent = useHistory({ page: 1, pageSize: 3, status: 'completed' });
  // За замовчуванням — вправа з найбільшою кількістю підходів в останньому завершеному тренуванні (або «Жим лежачи»)
  const defaultExercise = useMemo(() => {
    const last = recent.data?.items[0]?.exercises ?? [];
    const top = [...last].sort((a, b) => b.sets - a.sets)[0];
    return top?.exerciseId ?? exercises.data?.find((e) => e.name === 'Жим лежачи')?.id ?? exercises.data?.[0]?.id;
  }, [recent.data, exercises.data]);
  const exerciseId = pickedExercise ?? defaultExercise;
  const exerciseName = exercises.data?.find((e) => e.id === exerciseId)?.name ?? '';

  const progress = useProgress({ from, tzOffsetMin: tz, exerciseId });
  const thisWeek = useHistory({ page: 1, pageSize: 1, status: 'completed', from: mondayOf(new Date()).toISOString() });
  const hint = useHint(exerciseId);

  if (progress.isPending) return <Loading />;
  if (progress.isError) return <ErrorState error={progress.error} onRetry={() => progress.refetch()} />;

  const p = progress.data;
  const nowKey = isoWeekKey(new Date());
  const prev = new Date(); prev.setDate(prev.getDate() - 7);
  const tonnageNow = p.weeklyTonnage[nowKey] ?? 0;
  const tonnagePrev = p.weeklyTonnage[isoWeekKey(prev)] ?? 0;
  const delta = tonnagePrev > 0 ? Math.round(((tonnageNow - tonnagePrev) / tonnagePrev) * 100) : null;
  const volume = Object.entries(p.weeklyVolume)
    .filter(([k]) => k.startsWith(`${nowKey}|`))
    .map(([k, n]) => ({ groupId: Number(k.split('|')[1]), sets: n }))
    .sort((a, b) => b.sets - a.sets);
  const setsNow = volume.reduce((s, v) => s + v.sets, 0);
  const maxSets = Math.max(1, ...volume.map((v) => v.sets));
  const series = weeklyBest(p.oneRepMax).map((x) => ({ ...x, value: toDisplay(x.value, unit) }));
  const best = series.length ? Math.max(...series.map((s) => s.value)) : null;
  const h = hint.data ? hintText(hint.data.hint, unit) : null;

  const header = (
    <PageHeader
      title="Прогрес"
      subtitle={`Тиждень ${weekRangeLabel(mondayOf(new Date()))}`}
      actions={
        <label className="flex items-center gap-3">
          <span className="label">Період</span>
          <select className="field w-auto pr-10" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
            {PERIODS.map((x) => <option key={x.weeks} value={x.weeks}>{x.label}</option>)}
          </select>
        </label>
      }
    />
  );

  if (p.workouts === 0) {
    return (
      <>
        {header}
        <EmptyState
          testId="empty-state"
          title="Ще немає завершених тренувань"
          text="Завершіть перше тренування — і застосунок порахує тоннаж, тижневий обсяг за групами мʼязів та оцінку одноповторного максимуму."
          action={<button type="button" className="btn-lime" onClick={() => start.mutate(undefined)} disabled={start.isPending}>Розпочати тренування</button>}
        />
      </>
    );
  }

  return (
    <>
      {header}

      <section aria-label="Показники тижня" className="grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-4">
        <Kpi testId="kpi-tonnage" label="Тоннаж за тиждень" value={fmtNum(toDisplay(tonnageNow, unit), 0)} unit={unitShort(unit)}
          note={delta === null ? 'минулого тижня тренувань не було' : `${delta >= 0 ? '+' : '−'}${Math.abs(delta)} % до минулого тижня`} good={delta !== null && delta >= 0} />
        <Kpi label="Тренувань" value={String(thisWeek.data?.total ?? 0)} note="цього тижня" />
        <Kpi label="Підходів" value={String(setsNow)} note={`у ${volume.length} ${plural(volume.length, ['групі', 'групах', 'групах'])} мʼязів`} />
        <div className="rounded-lg bg-ink p-4 text-white sm:p-5 md:p-8">
          <p className="text-white/80">Найкращий 1ПМ (оцінка)</p>
          <p className="mt-2 font-display text-4xl font-bold text-lime sm:text-5xl md:text-6xl">
            {best === null ? '—' : fmtNum(best, 0)} <span className="text-2xl text-white">{unitShort(unit)}</span>
          </p>
          <p className="mt-1 truncate text-white/80">{exerciseName}</p>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="card p-5 md:p-8" data-testid="chart-1rm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="h-display text-3xl md:text-4xl">Динаміка оцінки 1ПМ</h2>
            <label className="flex items-center gap-3">
              <span className="label">Вправа</span>
              <select className="field w-auto max-w-64 pr-10" value={exerciseId ?? ''} onChange={(e) => setPickedExercise(e.target.value)}>
                {(exercises.data ?? []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </label>
          </div>
          {series.length === 0 ? (
            <p className="mt-10 text-slate">За вибраний період немає підходів цієї вправи до 10 повторень — оцінку 1ПМ ще не пораховано.</p>
          ) : (
            <div className="mt-6 h-72" role="img" aria-label={`Графік оцінки 1ПМ: ${series.map((s) => `${s.label} — ${fmtNum(s.value)}`).join(', ')}`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 24, right: 24, bottom: 0, left: -8 }}>
                  <CartesianGrid stroke="#E7E3D9" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#4B5058', fontSize: 14 }} dy={8} />
                  <YAxis domain={['dataMin - 5', 'dataMax + 5']} tickLine={false} axisLine={false} tick={{ fill: '#4B5058', fontSize: 14 }} allowDecimals={false} width={48} />
                  <Tooltip formatter={(v) => [`${fmtNum(Number(v))} ${unitShort(unit)}`, 'Оцінка 1ПМ']} labelFormatter={(l) => `Тиждень від ${l}`} />
                  <Line type="linear" dataKey="value" stroke="#15171A" strokeWidth={3} dot={{ r: 6, fill: '#fff', stroke: '#15171A', strokeWidth: 2.5 }} activeDot={{ r: 8, fill: '#C8F13C', stroke: '#15171A' }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-4 text-sm text-slate">Найкраща оцінка 1ПМ за тиждень; розрахунок за підходами до 10 повторень.</p>
        </section>

        <section className="card p-5 md:p-8" data-testid="chart-volume">
          <h2 className="h-display text-3xl md:text-4xl">Підходи за тиждень</h2>
          <p className="mt-1 text-slate">За групами мʼязів</p>
          {volume.length === 0 ? (
            <p className="mt-8 text-slate">Цього тижня завершених тренувань ще немає.</p>
          ) : (
            <ul className="mt-6 space-y-4">
              {volume.map((v) => (
                <li key={v.groupId} className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-3">
                  <span>{groups.map.get(v.groupId)}</span>
                  <span className="h-4 overflow-hidden rounded-full bg-sand" aria-hidden>
                    <span className="block h-full rounded-full bg-ink" style={{ width: `${(v.sets / maxSets) * 100}%` }} />
                  </span>
                  <span className="text-right font-display text-xl font-bold">{v.sets}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.35fr]">
        <section className="rounded-lg bg-ink p-6 text-white md:p-8">
          <span className="inline-flex rounded-full bg-lime px-3 py-1 text-sm font-semibold text-ink">Підказка прогресії</span>
          {h ? (
            <>
              <h2 className="h-display mt-4 text-3xl md:text-4xl">{exerciseName}: {h.title}</h2>
              <p className="mt-3 text-lg leading-relaxed text-white/90">{h.body}</p>
            </>
          ) : (
            <p className="mt-4 text-lg leading-relaxed text-white/90">
              Для вправи «{exerciseName}» потрібні щонайменше два завершені тренування — тоді зʼявиться порада, коли додавати вагу.
            </p>
          )}
          <p className="mt-4 text-white/70">Це лише підказка: рішення про навантаження залишається за вами.</p>
        </section>

        <section className="card p-5 md:p-8">
          <div className="flex items-center justify-between gap-4 border-b border-line pb-4">
            <h2 className="h-display text-3xl md:text-4xl">Останні тренування</h2>
            <Link to="/history" className="font-semibold underline underline-offset-4">Уся історія</Link>
          </div>
          <ul>
            {(recent.data?.items ?? []).map((w) => (
              <li key={w.id} className="border-b border-line/70 last:border-0">
                <Link to={`/workout/${w.id}`} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 py-4 md:grid-cols-[5rem_1fr_auto_auto] md:gap-6">
                  <span className="font-display text-2xl font-bold">{dayLabel(new Date(w.startedAt))}</span>
                  <span className="truncate font-semibold">{workoutTitle(w.muscleGroupIds, groups.map)}</span>
                  <span className="hidden text-slate md:inline">{setsText(w.setCount)}</span>
                  <span className="font-semibold">{fmtNum(toDisplay(w.tonnageKg, unit), 0)} {unitShort(unit)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function Kpi({ label, value, unit, note, good, testId }: { label: string; value: string; unit?: string; note: string; good?: boolean; testId?: string }) {
  return (
    <div className="card p-4 sm:p-5 md:p-8" data-testid={testId}>
      <p className="text-slate">{label}</p>
      <p className="mt-2 font-display text-4xl font-bold sm:text-5xl md:text-6xl">
        {value}{unit && <span className="ml-1 text-xl md:text-2xl">{unit}</span>}
      </p>
      <p className={`mt-1 text-sm ${good ? 'font-semibold text-ok' : 'text-slate'}`}>{note}</p>
    </div>
  );
}
