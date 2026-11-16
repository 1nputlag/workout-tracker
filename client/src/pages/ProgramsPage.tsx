// Тренувальні програми (UI-06, FR-04): перелік програм, старт тренування за програмою, видалення.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../lib/api';
import { plural, setsText } from '../lib/format';
import { totalSets } from '../lib/programForm';
import { useDeleteProgram, usePrograms, useStartWorkout } from '../lib/queries';
import type { Program } from '../lib/types';
import { EmptyState, ErrorState, Loading, PageHeader } from '../components/States';
import { IconEdit, IconPlus, IconTrash } from '../components/Icons';

export const exercisesText = (n: number) => `${n} ${plural(n, ['вправа', 'вправи', 'вправ'])}`;

export function ProgramsPage() {
  const programs = usePrograms();
  const create = (
    <Link to="/programs/new" className="btn-dark"><IconPlus className="text-lime" />Створити програму</Link>
  );

  return (
    <>
      <PageHeader title="Програми" subtitle="Набори вправ із цільовими підходами й повтореннями" actions={create} />
      {programs.isPending ? <Loading /> : programs.isError ? <ErrorState error={programs.error} onRetry={() => programs.refetch()} /> : programs.data.length === 0 ? (
        <EmptyState
          testId="programs-empty"
          title="Ще немає програм"
          text="Програма — це впорядкований перелік вправ із цілями. За нею тренування починається одним натисканням, а вправи вже чекають у журналі."
          action={<Link to="/programs/new" className="btn-lime">Створити першу програму</Link>}
        />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {programs.data.map((p) => <ProgramCard key={p.id} p={p} />)}
        </ul>
      )}
    </>
  );
}

function ProgramCard({ p }: { p: Program }) {
  const start = useStartWorkout();
  const del = useDeleteProgram();
  const [ask, setAsk] = useState(false);

  return (
    <li data-testid="program-card" className="card flex flex-col p-5 md:p-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="h-display text-3xl">{p.name}</h2>
          <p className="mt-1 text-slate">{exercisesText(p.items.length)} · {setsText(totalSets(p.items))}</p>
        </div>
        <div className="-mr-2 -mt-2 flex shrink-0">
          <Link to={`/programs/${p.id}`} className="grid size-11 place-items-center rounded-sm text-slate hover:bg-sand hover:text-ink" aria-label={`Змінити програму «${p.name}»`}><IconEdit /></Link>
          <button type="button" className="grid size-11 place-items-center rounded-sm text-slate hover:bg-sand hover:text-danger" aria-label={`Видалити програму «${p.name}»`} onClick={() => setAsk(true)}><IconTrash /></button>
        </div>
      </div>

      {p.items.length === 0 ? (
        <p className="mt-5 text-slate">У програмі ще немає вправ.</p>
      ) : (
        <ol className="mt-5 flex-1 border-t border-line">
          {p.items.map((i, n) => (
            <li key={`${i.exerciseId}-${i.position}`} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 border-b border-line/70 py-3">
              <span className="font-display text-xl font-bold text-slate">{n + 1}</span>
              <span className="font-medium">{i.exerciseName}</span>
              <span className="font-display text-xl font-bold">{i.targetSets} × {i.targetReps}</span>
            </li>
          ))}
        </ol>
      )}

      {ask ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-danger/50 p-4">
          <p className="font-medium">Видалити програму? Тренування за нею залишаться в історії.</p>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={() => setAsk(false)}>Ні</button>
            <button type="button" className="btn bg-danger text-white" onClick={() => del.mutate(p.id)} disabled={del.isPending}>Так, видалити</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn-lime mt-5 self-start" onClick={() => start.mutate(p.id)} disabled={start.isPending}>
          Почати тренування
        </button>
      )}
      {(start.isError || del.isError) && <p role="alert" className="mt-3 font-medium text-danger">{errorMessage(start.error ?? del.error)}</p>}
    </li>
  );
}
