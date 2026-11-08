// Бібліотека вправ (UI-04, FR-03): пошук і фільтр за групою мʼязів працюють разом; власні вправи можна додати, змінити, видалити.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { errorMessage } from '../lib/api';
import { fmtNum, plural, toDisplay, unitShort } from '../lib/format';
import { useDeleteExercise, useExercises, useMuscleGroups, useSaveExercise } from '../lib/queries';
import type { Exercise, MuscleGroup, WeightUnit } from '../lib/types';
import { ErrorState, Loading, PageHeader } from '../components/States';
import { IconEdit, IconPlus, IconTrash, IconX } from '../components/Icons';

function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function ExercisesPage() {
  const { user } = useAuth();
  const unit = user?.weightUnit ?? 'kg';
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<number | undefined>();
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null);
  const query = useDebounced(q.trim());
  const groups = useMuscleGroups();
  const list = useExercises(query, group);

  return (
    <>
      <PageHeader
        title="Вправи"
        subtitle="Загальна бібліотека та ваші власні вправи"
        actions={<button type="button" className="btn-dark" onClick={() => setEditing('new')}><IconPlus className="text-lime" />Додати власну вправу</button>}
      />

      <div className="card mb-6 p-5 md:p-8">
        <label htmlFor="exercise-search" className="label">Пошук за назвою</label>
        <input id="exercise-search" type="search" aria-label="Пошук вправи" className="field mt-2 min-h-14" placeholder="Наприклад, жим"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="mt-5 flex flex-wrap gap-3" role="group" aria-label="Група мʼязів">
          <button type="button" className="chip" aria-pressed={group === undefined} onClick={() => setGroup(undefined)}>Усі</button>
          {(groups.data ?? []).map((g) => (
            <button key={g.id} type="button" className="chip" aria-pressed={group === g.id} onClick={() => setGroup(g.id)}>{g.name}</button>
          ))}
        </div>
      </div>

      {list.isPending ? <Loading /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : (
        <>
          <p className="mb-4 text-slate" aria-live="polite">
            Знайдено {list.data.length} {plural(list.data.length, ['вправу', 'вправи', 'вправ'])}
          </p>
          {list.data.length === 0 ? (
            <div className="card p-8">
              <h2 className="h-display text-3xl">Нічого не знайдено</h2>
              <p className="mt-2 text-slate">Спробуйте іншу назву або групу мʼязів — чи додайте власну вправу.</p>
            </div>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {list.data.map((e) => <ExerciseCard key={e.id} e={e} unit={unit} onEdit={() => setEditing(e)} />)}
            </ul>
          )}
        </>
      )}

      {editing && (
        <ExerciseDialog
          groups={groups.data ?? []}
          exercise={editing === 'new' ? undefined : editing}
          defaultGroup={group}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function ExerciseCard({ e, unit, onEdit }: { e: Exercise; unit: WeightUnit; onEdit: () => void }) {
  const del = useDeleteExercise();
  return (
    <li data-testid="exercise-card" className={`flex flex-col rounded-lg border p-5 md:p-6 ${e.own ? 'border-ink bg-lime-soft' : 'border-line/70 bg-white'}`}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-xl font-semibold md:text-2xl">{e.name}</h2>
        {e.own && (
          <div className="-mr-2 -mt-2 flex">
            <button type="button" className="grid size-11 place-items-center rounded-sm text-slate hover:bg-sand hover:text-ink" aria-label={`Змінити вправу «${e.name}»`} onClick={onEdit}><IconEdit /></button>
            <button type="button" className="grid size-11 place-items-center rounded-sm text-slate hover:bg-sand hover:text-danger" aria-label={`Видалити вправу «${e.name}»`} onClick={() => del.mutate(e.id)} disabled={del.isPending}><IconTrash /></button>
          </div>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <span className="badge">{e.muscleGroup}</span>
        {e.own && <span className="badge bg-lime">Власна</span>}
      </div>
      {e.lastSet ? (
        <dl className="mt-5 grid grid-cols-2 gap-4">
          <div><dt className="text-sm text-slate">Останній підхід</dt><dd className="font-display text-3xl font-bold">{fmtNum(toDisplay(e.lastSet.weightKg, unit))} × {e.lastSet.reps}</dd></div>
          <div><dt className="text-sm text-slate">Оцінка 1ПМ</dt><dd className="font-display text-3xl font-bold">{e.oneRepMax === null ? '—' : `${fmtNum(toDisplay(e.oneRepMax, unit))} ${unitShort(unit)}`}</dd></div>
        </dl>
      ) : (
        <div className="mt-5"><p className="text-sm text-slate">Останній підхід</p><p className="font-display text-2xl font-bold">Ще не виконувалась</p></div>
      )}
      {del.isError && <p role="alert" className="mt-3 text-sm font-medium text-danger">{errorMessage(del.error)}</p>}
    </li>
  );
}

/** Модальне вікно створення або зміни власної вправи. Фокус утримується всередині, Esc закриває. */
function ExerciseDialog({ groups, exercise, defaultGroup, onClose }: { groups: MuscleGroup[]; exercise?: Exercise; defaultGroup?: number; onClose: () => void }) {
  const [name, setName] = useState(exercise?.name ?? '');
  const [groupId, setGroupId] = useState<number>(exercise?.muscleGroupId ?? defaultGroup ?? groups[0]?.id ?? 1);
  const [error, setError] = useState<string>();
  const save = useSaveExercise();
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLInputElement>('input')?.focus();
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
      if (ev.key === 'Tab' && dialog.current) {
        const f = [...dialog.current.querySelectorAll<HTMLElement>('input, select, button:not([disabled])')];
        if (ev.shiftKey && document.activeElement === f[0]) { ev.preventDefault(); f.at(-1)?.focus(); }
        else if (!ev.shiftKey && document.activeElement === f.at(-1)) { ev.preventDefault(); f[0]?.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus(); };
  }, [onClose]);

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    if (name.trim().length < 2) { setError('Назва — щонайменше 2 символи'); return; }
    setError(undefined);
    save.mutate({ id: exercise?.id, name: name.trim(), muscleGroupId: groupId }, { onSuccess: onClose });
  };

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-ink/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="exercise-dialog-title" className="w-full max-w-lg rounded-lg bg-white p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <h2 id="exercise-dialog-title" className="h-display text-3xl">{exercise ? 'Змінити вправу' : 'Нова вправа'}</h2>
          <button type="button" className="-mr-2 -mt-2 grid size-11 place-items-center rounded-sm hover:bg-sand" aria-label="Закрити" onClick={onClose}><IconX /></button>
        </div>
        <form noValidate onSubmit={submit} className="mt-6 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="exercise-name" className="font-semibold">Назва</label>
            <input id="exercise-name" className="field" maxLength={80} value={name} onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(error)} aria-describedby={error ? 'exercise-name-error' : undefined} placeholder="Наприклад, жим «Свенда»" />
            {error && <p id="exercise-name-error" className="text-sm font-medium text-danger">{error}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="exercise-group" className="font-semibold">Група мʼязів</label>
            <select id="exercise-group" className="field" value={groupId} onChange={(e) => setGroupId(Number(e.target.value))}>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          {save.isError && <p role="alert" className="font-medium text-danger">{errorMessage(save.error)}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-ghost" onClick={onClose}>Скасувати</button>
            <button type="submit" className="btn-dark" disabled={save.isPending}>Зберегти</button>
          </div>
        </form>
      </div>
    </div>
  );
}
