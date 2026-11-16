// Редактор програми (UI-06, FR-04): назва, впорядкований перелік вправ, цільові підходи й повторення.
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, errorMessage } from '../lib/api';
import { MAX_PROGRAM_ITEMS, hasErrors, moveItem, validateProgram, type DraftItem, type ProgramErrors } from '../lib/programForm';
import { useExercises, useProgram, useSaveProgram } from '../lib/queries';
import type { Exercise, Program } from '../lib/types';
import { EmptyState, ErrorState, Loading, PageHeader } from '../components/States';
import { IconArrowDown, IconArrowUp, IconBack, IconPlus, IconTrash } from '../components/Icons';

export function ProgramEditorPage() {
  const { id } = useParams();
  const program = useProgram(id);
  const exercises = useExercises();

  if (exercises.isPending || (id && program.isPending)) return <Loading />;
  if (program.isError) {
    if (program.error instanceof ApiError && program.error.status === 404) {
      return <EmptyState title="Програму не знайдено" text="Можливо, її видалено або посилання належить іншому користувачу." action={<Link to="/programs" className="btn-dark">До програм</Link>} />;
    }
    return <ErrorState error={program.error} onRetry={() => program.refetch()} />;
  }
  if (exercises.isError) return <ErrorState error={exercises.error} onRetry={() => exercises.refetch()} />;
  // key — щоб форма створилася заново, коли відкривають іншу програму
  return <Editor key={id ?? 'new'} program={id ? program.data : undefined} exercises={exercises.data} />;
}

function Editor({ program, exercises }: { program?: Program; exercises: Exercise[] }) {
  const navigate = useNavigate();
  const save = useSaveProgram();
  const [name, setName] = useState(program?.name ?? '');
  const [items, setItems] = useState<DraftItem[]>(() => (program?.items ?? []).map((i) => ({
    exerciseId: i.exerciseId, targetSets: String(i.targetSets), targetReps: String(i.targetReps),
  })));
  const [toAdd, setToAdd] = useState(exercises[0]?.id ?? '');
  const [errors, setErrors] = useState<ProgramErrors>({ rows: {} });
  const [touched, setTouched] = useState(false);
  const byId = new Map(exercises.map((e) => [e.id, e]));

  // Після першої спроби зберегти помилки оновлюються під час введення
  useEffect(() => { if (touched) setErrors(validateProgram(name, items)); }, [touched, name, items]);

  const patch = (i: number, p: Partial<DraftItem>) => setItems(items.map((it, n) => (n === i ? { ...it, ...p } : it)));
  const addItem = () => {
    if (!toAdd || items.length >= MAX_PROGRAM_ITEMS) return;
    const prev = items.at(-1);
    // Нова вправа отримує цілі попередньої — зазвичай вони однакові в межах програми
    setItems([...items, { exerciseId: toAdd, targetSets: prev?.targetSets ?? '3', targetReps: prev?.targetReps ?? '8' }]);
  };

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const e = validateProgram(name, items);
    setErrors(e); setTouched(true);
    if (hasErrors(e)) return;
    save.mutate({
      id: program?.id,
      name: name.trim(),
      items: items.map((i) => ({ exerciseId: i.exerciseId, targetSets: Number(i.targetSets), targetReps: Number(i.targetReps) })),
    }, { onSuccess: () => navigate('/programs') });
  };

  return (
    <>
      <Link to="/programs" className="mb-4 inline-flex min-h-11 items-center gap-1 font-semibold text-slate hover:text-ink"><IconBack width={20} height={20} />Усі програми</Link>
      <PageHeader title={program ? 'Редагування програми' : 'Нова програма'} />

      <form noValidate onSubmit={submit} className="grid gap-6 lg:grid-cols-[1.75fr_1fr] lg:items-start">
        <div className="flex flex-col gap-6">
          <section className="card p-5 md:p-8">
            <label htmlFor="program-name" className="font-semibold">Назва програми</label>
            <input id="program-name" className="field mt-2 min-h-14" maxLength={80} placeholder="Наприклад, Верх тіла А" value={name}
              onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'program-name-error' : undefined} />
            {errors.name && <p id="program-name-error" className="mt-2 text-sm font-medium text-danger">{errors.name}</p>}
          </section>

          <section className="card p-5 md:p-8" aria-labelledby="program-items-title">
            <h2 id="program-items-title" className="h-display text-3xl">Вправи програми</h2>
            <p className="mt-1 text-slate">Порядок у списку — це порядок вправ у тренуванні.</p>

            {items.length === 0 ? (
              <p className={`mt-5 ${errors.items ? 'font-medium text-danger' : 'text-slate'}`}>{errors.items ?? 'Вправ ще немає — додайте першу нижче.'}</p>
            ) : (
              <ol className="mt-5 flex flex-col gap-3">
                {items.map((it, i) => {
                  const ex = byId.get(it.exerciseId);
                  const title = ex?.name ?? 'Вправа';
                  const row = errors.rows[i];
                  return (
                    <li key={i} data-testid="program-item" className="rounded-md border border-line p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="flex items-baseline gap-3 text-lg font-semibold">
                          <span className="font-display text-2xl font-bold text-slate">{i + 1}</span>{title}
                        </p>
                        <div className="-mr-2 -mt-2 flex shrink-0">
                          <button type="button" className="grid size-11 place-items-center rounded-sm text-slate hover:bg-sand hover:text-ink disabled:opacity-30" aria-label={`Перемістити вище: ${title}`} disabled={i === 0} onClick={() => setItems(moveItem(items, i, -1))}><IconArrowUp /></button>
                          <button type="button" className="grid size-11 place-items-center rounded-sm text-slate hover:bg-sand hover:text-ink disabled:opacity-30" aria-label={`Перемістити нижче: ${title}`} disabled={i === items.length - 1} onClick={() => setItems(moveItem(items, i, 1))}><IconArrowDown /></button>
                          <button type="button" className="grid size-11 place-items-center rounded-sm text-slate hover:bg-sand hover:text-danger" aria-label={`Прибрати з програми: ${title}`} onClick={() => setItems(items.filter((_, n) => n !== i))}><IconTrash /></button>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-sm">
                        <NumberField id={`sets-${i}`} label="Підходів" value={it.targetSets} error={row?.sets} onChange={(v) => patch(i, { targetSets: v })} />
                        <NumberField id={`reps-${i}`} label="Повторень" value={it.targetReps} error={row?.reps} onChange={(v) => patch(i, { targetReps: v })} />
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            {items.length > 0 && errors.items && <p className="mt-3 font-medium text-danger">{errors.items}</p>}

            <div className="mt-6 grid gap-3 border-t border-line pt-6 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="flex flex-col gap-2">
                <label htmlFor="program-add" className="label">Додати вправу</label>
                <select id="program-add" className="field" value={toAdd} onChange={(e) => setToAdd(e.target.value)}>
                  {exercises.map((e) => <option key={e.id} value={e.id}>{e.name} — {e.muscleGroup}</option>)}
                </select>
              </div>
              <button type="button" className="btn-ghost" onClick={addItem} disabled={items.length >= MAX_PROGRAM_ITEMS}><IconPlus width={20} height={20} />Додати до програми</button>
            </div>
          </section>
        </div>

        <aside className="card flex flex-col gap-4 p-5 md:p-8 lg:sticky lg:top-28">
          <h2 className="h-display text-2xl">Підсумок</h2>
          <dl className="grid grid-cols-2 gap-4">
            <div><dt className="text-sm text-slate">Вправ</dt><dd className="font-display text-4xl font-bold">{items.length}</dd></div>
            <div><dt className="text-sm text-slate">Підходів</dt><dd className="font-display text-4xl font-bold">{items.reduce((s, i) => s + (Number(i.targetSets) || 0), 0)}</dd></div>
          </dl>
          {save.isError && <p role="alert" className="font-medium text-danger">{errorMessage(save.error)}</p>}
          <button type="submit" className="btn-dark min-h-14 text-lg" disabled={save.isPending}>Зберегти програму</button>
          <Link to="/programs" className="btn-ghost">Скасувати</Link>
        </aside>
      </form>
    </>
  );
}

function NumberField({ id, label, value, error, onChange }: { id: string; label: string; value: string; error?: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="label">{label}</label>
      <input id={id} className="field text-center font-display text-2xl font-bold" inputMode="numeric" value={value}
        onChange={(e) => onChange(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
      {error && <p id={`${id}-error`} className="text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}
