// Журнал тренування (UI-02, FR-05): підхід вноситься однією дією, значення попереднього підходу підставляються автоматично.
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useIsMutating, useQuery } from '@tanstack/react-query';
import { ApiError, api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { clock, dateWithWeekday, durationText, fmtNum, setsText, toDisplay, toKg, unitLabel, unitShort, workoutTitle } from '../lib/format';
import {
  useAddSet, useDeleteSet, useExercises, useHint, useHistory, useMuscleGroups, useSetUnit, useStartWorkout, useWorkout, useWorkoutTransition,
} from '../lib/queries';
import type { Exercise, Hint, Program, WeightUnit, WorkoutDetail, WorkoutSet } from '../lib/types';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { Menu } from '../components/Menu';
import { IconCheck, IconMinus, IconPlus, IconTrash } from '../components/Icons';

const STATUS: Record<WorkoutDetail['status'], { label: string; cls: string }> = {
  in_progress: { label: 'Виконується', cls: 'bg-lime text-ink' },
  completed: { label: 'Завершене', cls: 'bg-ink text-white' },
  cancelled: { label: 'Скасоване', cls: 'bg-sand text-slate' },
  planned: { label: 'Заплановане', cls: 'bg-sand text-ink' },
};

/** /workout — відкриває поточне тренування або пропонує почати нове. */
export function WorkoutStartPage() {
  const active = useHistory({ page: 1, pageSize: 1, status: 'in_progress' });
  const start = useStartWorkout();
  if (active.isPending) return <Loading />;
  if (active.isError) return <ErrorState error={active.error} onRetry={() => active.refetch()} />;
  const current = active.data.items[0];
  if (current) return <Navigate to={`/workout/${current.id}`} replace />;
  return (
    <EmptyState
      title="Немає активного тренування"
      text="Почніть нове тренування — і записуйте підходи прямо під час виконання. Значення попереднього підходу підставляться автоматично."
      action={<button type="button" className="btn-lime" onClick={() => start.mutate(undefined)} disabled={start.isPending}>Розпочати тренування</button>}
    />
  );
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/** Підходи, згруповані за вправами в порядку першого підходу. */
function groupSets(sets: WorkoutSet[]) {
  const out = new Map<string, WorkoutSet[]>();
  for (const s of sets) out.set(s.exerciseId, [...(out.get(s.exerciseId) ?? []), s]);
  return out;
}

export function WorkoutPage() {
  const { id = '' } = useParams();
  const workout = useWorkout(id);
  if (workout.isPending) return <Loading />;
  if (workout.isError) {
    if (workout.error instanceof ApiError && workout.error.status === 404) {
      return (
        <EmptyState
          title="Тренування не знайдено"
          text="Можливо, його видалено або посилання належить іншому користувачу."
          action={<Link to="/history" className="btn-dark">До історії тренувань</Link>}
        />
      );
    }
    return <ErrorState error={workout.error} onRetry={() => workout.refetch()} />;
  }
  return <WorkoutView w={workout.data} />;
}

function WorkoutView({ w }: { w: WorkoutDetail }) {
  const { user } = useAuth();
  const unit: WeightUnit = user?.weightUnit ?? w.weightUnit;
  const navigate = useNavigate();
  const groups = useMuscleGroups();
  const exercises = useExercises();
  const transition = useWorkoutTransition(w.id);
  // Поки підхід зберігається, завершувати не можна — інакше тренування завершилося б без нього
  const savingSet = useIsMutating({ mutationKey: ['add-set', w.id] }) > 0;
  const [finishError, setFinishError] = useState<string | null>(null);
  const active = w.status === 'in_progress';
  const now = useNow(active);
  const program = useQuery({
    queryKey: ['program', w.programId],
    queryFn: () => api<Program>(`/programs/${w.programId}`),
    enabled: Boolean(w.programId),
  });

  const grouped = groupSets(w.sets);
  // Вправи програми без підходів теж показуємо — як план на тренування
  const planned = (program.data?.items ?? []).filter((i) => !grouped.has(i.exerciseId));
  const tonnageKg = w.sets.reduce((s, x) => s + x.weightKg * x.reps, 0);
  const groupIds = [...new Set(w.sets.map((s) => s.muscleGroupId))];
  const [current, setCurrent] = useState<string | undefined>(() => w.sets.at(-1)?.exerciseId ?? program.data?.items[0]?.exerciseId);
  const exerciseId = current ?? program.data?.items[0]?.exerciseId ?? exercises.data?.find((e) => e.name === 'Жим лежачи')?.id;

  const finish = () => {
    setFinishError(null);
    // Клієнтська перевірка дублює серверну (409): зрозуміле повідомлення без зайвого запиту
    if (w.sets.length === 0) { setFinishError('Щоб завершити тренування, додайте підхід або скасуйте тренування.'); return; }
    transition.mutate('finish', { onSuccess: () => navigate('/history'), onError: (e) => setFinishError(errorMessage(e)) });
  };
  const elapsed = (w.finishedAt ? new Date(w.finishedAt).getTime() : now) - new Date(w.startedAt).getTime();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="h-display text-4xl md:text-6xl">{workoutTitle(groupIds, groups.map)}</h1>
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS[w.status].cls}`}>{STATUS[w.status].label}</span>
          </div>
          <p className="mt-2 text-slate md:text-lg">
            {dateWithWeekday(new Date(w.startedAt))}{w.programName ? ` · за програмою «${w.programName}»` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-right">
            <p className="label">Тривалість</p>
            <p className="font-display text-4xl font-bold" aria-live="off">{active ? clock(elapsed) : durationText(Math.round(elapsed / 60_000))}</p>
          </div>
          {active && (
            <button type="button" className="btn-dark min-h-14 px-6 text-lg" onClick={finish} disabled={transition.isPending || savingSet}>Завершити тренування</button>
          )}
          {w.status === 'completed' && (
            <button type="button" className="btn-ghost min-h-14" onClick={() => transition.mutate('reopen')} disabled={transition.isPending}>Повернути до редагування</button>
          )}
        </div>
      </div>
      {finishError && <p role="alert" className="mb-6 rounded-md border border-danger/40 bg-danger/5 px-4 py-3 font-medium text-danger">{finishError}</p>}

      <div className="grid gap-6 lg:grid-cols-[1.75fr_1fr]">
        <div className="flex flex-col gap-6">
          {active && (
            <AddSetForm
              workout={w} unit={unit} exercises={exercises.data ?? []}
              exerciseId={exerciseId} onExerciseChange={setCurrent}
            />
          )}
          {w.sets.length === 0 && planned.length === 0 && (
            <p className="card p-6 text-slate">Підходів ще немає. Виберіть вправу, введіть вагу й повторення та натисніть «Зберегти підхід».</p>
          )}
          {[...grouped.entries()].reverse().map(([exId, sets]) => (
            <ExerciseCard key={exId} sets={sets} unit={unit} group={groups.map.get(sets[0].muscleGroupId) ?? ''} workoutId={w.id} editable={active} />
          ))}
          {planned.map((i) => (
            <section key={i.exerciseId} className="card flex flex-wrap items-center justify-between gap-3 p-5 md:p-8">
              <div>
                <h2 className="h-display text-2xl md:text-3xl">{i.exerciseName}</h2>
                <p className="mt-1 text-slate">Підходів ще немає · ціль {i.targetSets} × {i.targetReps}</p>
              </div>
              {active && <button type="button" className="btn-ghost" onClick={() => setCurrent(i.exerciseId)}>Обрати</button>}
            </section>
          ))}
          {active && <CancelWorkout onCancel={() => transition.mutate('cancel', { onSuccess: () => navigate('/history') })} busy={transition.isPending} />}
        </div>

        <aside className="flex flex-col gap-6">
          <section className="rounded-lg bg-ink p-6 text-white md:p-8" aria-labelledby="summary-title">
            <h2 id="summary-title" className="h-display text-3xl text-white/90">Підсумок тренування</h2>
            <div className="mt-4 flex gap-10">
              <div>
                <p className="text-white/75">Тоннаж</p>
                <p data-testid="workout-tonnage" className="font-display text-5xl font-bold text-lime">
                  {fmtNum(toDisplay(tonnageKg, unit), 0)} <span className="text-2xl text-white">{unitShort(unit)}</span>
                </p>
              </div>
              <div>
                <p className="text-white/75">Підходів</p>
                <p className="font-display text-5xl font-bold">{w.sets.length}</p>
              </div>
            </div>
            {groupIds.length > 0 && (
              <p className="mt-4 text-white/80">
                {groupIds.map((g) => `${groups.map.get(g)}: ${setsText(w.sets.filter((s) => s.muscleGroupId === g).length)}`).join('. ')}.
              </p>
            )}
          </section>
          <HintCard exerciseId={exerciseId} exercise={exercises.data?.find((e) => e.id === exerciseId)} unit={unit} />
          <UnitsCard unit={unit} />
        </aside>
      </div>
    </>
  );
}

/** Скасування — двома кроками, без системного діалогу підтвердження. */
function CancelWorkout({ onCancel, busy }: { onCancel: () => void; busy: boolean }) {
  const [ask, setAsk] = useState(false);
  if (!ask) {
    return <button type="button" className="btn-ghost w-full border-dashed text-slate" onClick={() => setAsk(true)}>Скасувати тренування</button>;
  }
  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 border-danger/50 p-5">
      <p className="font-medium">Скасувати тренування? Воно залишиться в історії зі статусом «Скасоване» і не враховуватиметься в статистиці.</p>
      <div className="flex gap-2">
        <button type="button" className="btn-ghost" onClick={() => setAsk(false)}>Ні</button>
        <button type="button" className="btn bg-danger text-white" onClick={onCancel} disabled={busy}>Так, скасувати</button>
      </div>
    </div>
  );
}

function AddSetForm({ workout, unit, exercises, exerciseId, onExerciseChange }: {
  workout: WorkoutDetail; unit: WeightUnit; exercises: Exercise[]; exerciseId?: string; onExerciseChange: (id: string) => void;
}) {
  const add = useAddSet(workout.id);
  const exercise = exercises.find((e) => e.id === exerciseId);
  const lastHere = [...workout.sets].reverse().find((s) => s.exerciseId === exerciseId);
  // Підстановка: попередній підхід цієї вправи в тренуванні, інакше — останній підхід з історії
  const prefill = useMemo(() => {
    const src = lastHere ?? (exercise?.lastSet ? { weightKg: exercise.lastSet.weightKg, reps: exercise.lastSet.reps } : undefined);
    return src ? { weight: String(toDisplay(src.weightKg, unit)), reps: String(src.reps) } : { weight: '', reps: '' };
  }, [lastHere, exercise, unit]);
  const [weight, setWeight] = useState(prefill.weight);
  const [reps, setReps] = useState(prefill.reps);
  const [errors, setErrors] = useState<{ weight?: string; reps?: string }>({});
  useEffect(() => { setWeight(prefill.weight); setReps(prefill.reps); setErrors({}); }, [prefill]);

  const step = unit === 'lb' ? 5 : 2.5;
  const nextNumber = (lastHere ? workout.sets.filter((s) => s.exerciseId === exerciseId).length : 0) + 1;

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const w = Number(weight.replace(',', '.'));
    const r = Number(reps);
    const e: typeof errors = {};
    const kg = toKg(w, unit);
    if (weight.trim() === '' || !Number.isFinite(w) || kg < 0 || kg > 1000) e.weight = `Вага від 0 до ${unit === 'lb' ? '2204' : '1000'} ${unitShort(unit)}`;
    if (!Number.isInteger(r) || r < 1 || r > 100) e.reps = 'Ціле число від 1 до 100';
    setErrors(e);
    if (!exerciseId || Object.keys(e).length > 0) return;
    add.mutate({ exerciseId, weightKg: kg, reps: r });
  };

  const bump = (value: string, delta: number, min: number) => String(Math.max(min, Math.round((Number(value.replace(',', '.')) || 0) * 10 + delta * 10) / 10));

  return (
    <form noValidate onSubmit={submit} className="card border-2 border-ink bg-lime-soft p-5 md:p-8" aria-labelledby="add-set-title">
      <h2 id="add-set-title" className="h-display text-2xl md:text-3xl">Підхід {nextNumber}{exercise ? ` · ${exercise.name}` : ''}</h2>
      <div className="mt-4 flex flex-col gap-2">
        <label htmlFor="set-exercise" className="label">Вправа</label>
        <select id="set-exercise" className="field" value={exerciseId ?? ''} onChange={(e) => onExerciseChange(e.target.value)}>
          {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-start md:gap-5">
        <Stepper id="set-weight" label={`Вага, ${unitLabel(unit)}`} value={weight} onChange={setWeight} error={errors.weight}
          inputMode="decimal" onDec={() => setWeight(bump(weight, -step, 0))} onInc={() => setWeight(bump(weight, step, 0))} decLabel="Зменшити вагу" incLabel="Збільшити вагу" />
        <Stepper id="set-reps" label="Повторення" value={reps} onChange={setReps} error={errors.reps}
          inputMode="numeric" onDec={() => setReps(bump(reps, -1, 1))} onInc={() => setReps(bump(reps, 1, 1))} decLabel="Менше повторень" incLabel="Більше повторень" />
        <button type="submit" className="btn-lime col-span-2 min-h-14 text-lg md:col-span-1 md:mt-7" disabled={add.isPending || !exerciseId}>Зберегти підхід</button>
      </div>
      {add.isError && <p role="alert" className="mt-3 font-medium text-danger">{errorMessage(add.error)}</p>}
      <p className="mt-3 text-sm text-slate">Поля заповнені значеннями попереднього підходу — вводьте лише зміни.</p>
    </form>
  );
}

function Stepper({ id, label, value, onChange, error, inputMode, onDec, onInc, decLabel, incLabel }: {
  id: string; label: string; value: string; onChange: (v: string) => void; error?: string;
  inputMode: 'decimal' | 'numeric'; onDec: () => void; onInc: () => void; decLabel: string; incLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="label">{label}</label>
      <div className="flex gap-1.5 md:gap-2">
        <button type="button" className="btn-ghost min-h-14 w-11 shrink-0 px-0 md:w-14" aria-label={decLabel} onClick={onDec}><IconMinus /></button>
        <input
          id={id} className="field min-h-14 min-w-0 px-1 text-center font-display text-2xl font-bold" inputMode={inputMode} value={value}
          onChange={(e) => onChange(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
        />
        <button type="button" className="btn-ghost min-h-14 w-11 shrink-0 px-0 md:w-14" aria-label={incLabel} onClick={onInc}><IconPlus /></button>
      </div>
      {error && <p id={`${id}-error`} className="text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}

function ExerciseCard({ sets, unit, group, workoutId, editable }: { sets: WorkoutSet[]; unit: WeightUnit; group: string; workoutId: string; editable: boolean }) {
  const del = useDeleteSet(workoutId);
  return (
    <section className="card p-5 md:p-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="h-display text-2xl md:text-3xl">{sets[0].exerciseName}</h2>
        <span className="badge">{group}</span>
      </div>
      <table className="mt-4 w-full text-left">
        <thead className="text-sm text-slate">
          <tr className="border-b border-line">
            <th scope="col" className="py-2 font-semibold">№</th>
            <th scope="col" className="py-2 font-semibold">Вага, {unitShort(unit)}</th>
            <th scope="col" className="py-2 font-semibold">Повторення</th>
            <th scope="col" className="py-2 font-semibold">1ПМ, {unitShort(unit)}</th>
            <th scope="col" className="py-2 text-right font-semibold"><span className="sr-only">Дії</span></th>
          </tr>
        </thead>
        <tbody>
          {sets.map((s, i) => (
            <tr key={s.id} data-testid="set-row" className="border-b border-line/70 last:border-0">
              <td className="py-3">{i + 1}</td>
              <td className="py-3 font-display text-2xl font-bold">{fmtNum(s.displayWeight, 2)}</td>
              <td className="py-3 font-display text-2xl font-bold">{s.reps}</td>
              <td className="py-3 text-slate">{s.oneRepMax === null ? '—' : fmtNum(toDisplay(s.oneRepMax, unit))}</td>
              <td className="py-3 text-right">
                {editable ? (
                  <button type="button" className="inline-grid size-11 place-items-center rounded-sm text-slate hover:bg-sand hover:text-danger"
                    aria-label={`Видалити підхід ${i + 1}`} onClick={() => del.mutate(s.id)} disabled={del.isPending}>
                    <IconTrash />
                  </button>
                ) : <IconCheck className="ml-auto" aria-label="Виконано" />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sets.some((s) => s.reps >= 10) && (
        <p className="mt-3 text-sm text-slate">«—» означає, що підхід із 10 і більше повторень не враховується в оцінці 1ПМ, але входить у тоннаж та обсяг.</p>
      )}
    </section>
  );
}

function hintSentence(h: Hint, unit: WeightUnit): string {
  const w = (kg: number) => `${fmtNum(toDisplay(kg, unit))} ${unitShort(unit)}`;
  switch (h.kind) {
    case 'increase_weight': return `Два тренування поспіль ви досягли верхньої межі повторень з ${w(h.fromKg)}. Сьогодні спробуйте ${w(h.toKg)}.`;
    case 'increase_reps': return `Залишайтеся на ${w(h.weightKg)} і додайте повторення.`;
    case 'keep_or_reduce': return `Минулого разу повторень було замало — залиште ${w(h.weightKg)} або трохи зменште.`;
    default: return 'Після двох завершених тренувань з цією вправою тут зʼявиться порада щодо ваги.';
  }
}

function HintCard({ exerciseId, exercise, unit }: { exerciseId?: string; exercise?: Exercise; unit: WeightUnit }) {
  const hint = useHint(exerciseId);
  if (!exercise) return null;
  return (
    <section className="card p-6 md:p-8">
      <span className="inline-flex rounded-full bg-lime px-3 py-1 text-sm font-semibold">Підказка</span>
      <h2 className="h-display mt-3 text-2xl">
        {exercise.lastSet ? `Минулого разу: ${fmtNum(toDisplay(exercise.lastSet.weightKg, unit))} ${unitShort(unit)} × ${exercise.lastSet.reps}` : exercise.name}
      </h2>
      <p className="mt-2 text-slate">{hint.data ? hintSentence(hint.data.hint, unit) : 'Завантаження підказки…'}</p>
    </section>
  );
}

function UnitsCard({ unit }: { unit: WeightUnit }) {
  const setUnit = useSetUnit();
  return (
    <section className="card p-6 md:p-8">
      <h2 className="h-display text-2xl">Одиниці виміру</h2>
      <p className="mt-1 text-sm text-slate">У базі вага завжди зберігається в кілограмах.</p>
      <div className="mt-4">
        <Menu
          align="left"
          items={[
            { label: 'кг', onSelect: () => setUnit.mutate('kg') },
            { label: 'фунти', onSelect: () => setUnit.mutate('lb') },
          ]}
          button={(props) => (
            <button type="button" className="btn-ghost" disabled={setUnit.isPending} {...props}>Одиниці: {unitLabel(unit)}</button>
          )}
        />
      </div>
      {setUnit.isError && <p role="alert" className="mt-2 text-danger">{errorMessage(setUnit.error)}</p>}
    </section>
  );
}
