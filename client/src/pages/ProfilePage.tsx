// Профіль користувача (FR-02): імʼя, одиниці ваги, вихід з акаунта.
import { useState, type FormEvent } from 'react';
import { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { initials } from '../lib/format';
import { useSetUnit, useUpdateProfile } from '../lib/queries';
import type { WeightUnit } from '../lib/types';
import { Loading, PageHeader } from '../components/States';

const UNITS: { value: WeightUnit; label: string; hint: string }[] = [
  { value: 'kg', label: 'Кілограми', hint: 'кг' },
  { value: 'lb', label: 'Фунти', hint: '1 фунт ≈ 0,454 кг' },
];

export function ProfilePage() {
  const { user, signOut } = useAuth();
  const update = useUpdateProfile();
  const setUnit = useSetUnit();
  const [name, setName] = useState(user?.displayName ?? '');
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [picked, setPicked] = useState<WeightUnit>();

  if (!user) return <Loading />;
  // Вибір показуємо одразу, не чекаючи відповіді сервера; у разі помилки повертається збережене значення
  const unit: WeightUnit = picked ?? user.weightUnit;
  const chooseUnit = (u: WeightUnit) => {
    if (u === unit) return;
    setPicked(u);
    setUnit.mutate(u, { onError: () => setPicked(undefined) });
  };

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    setSaved(false);
    const n = name.trim();
    if (!n) { setError('Введіть імʼя'); return; }
    if (n.length > 60) { setError('Імʼя — не довше за 60 символів'); return; }
    setError(undefined);
    update.mutate(n, { onSuccess: (u) => { setName(u.displayName); setSaved(true); } });
  };

  return (
    <>
      <PageHeader title="Профіль" />
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <section className="card p-5 md:p-8" aria-labelledby="profile-data-title">
          <div className="flex items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-full bg-ink font-display text-2xl font-bold text-lime" aria-hidden>{initials(user.displayName)}</span>
            <div className="min-w-0">
              <h2 id="profile-data-title" className="h-display text-3xl">Особисті дані</h2>
              <p className="truncate text-slate">{user.email}</p>
            </div>
          </div>
          <form noValidate onSubmit={submit} className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="profile-name" className="font-semibold">Імʼя</label>
              <input id="profile-name" className="field min-h-14" maxLength={60} autoComplete="name" value={name}
                onChange={(e) => { setName(e.target.value); setSaved(false); }}
                aria-invalid={Boolean(error)} aria-describedby={error ? 'profile-name-error' : undefined} />
              {error && <p id="profile-name-error" className="text-sm font-medium text-danger">{error}</p>}
              <p className="text-sm text-slate">Імʼя відображається в меню акаунта; з нього складаються ініціали.</p>
            </div>
            {update.isError && <p role="alert" className="font-medium text-danger">{errorMessage(update.error)}</p>}
            <div className="flex flex-wrap items-center gap-4">
              <button type="submit" className="btn-dark" disabled={update.isPending || name.trim() === user.displayName}>Зберегти</button>
              {saved && <p role="status" className="font-medium text-ok">Зміни збережено</p>}
            </div>
          </form>
        </section>

        <div className="flex flex-col gap-6">
          <section className="card p-5 md:p-8">
            <fieldset>
              <legend className="h-display text-3xl">Одиниці ваги</legend>
              <p className="mt-1 text-slate">Змінюється лише відображення: у базі вага завжди зберігається в кілограмах, тож історія не перераховується й не втрачає точності.</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {UNITS.map((u) => (
                  <label key={u.value} className={`flex min-h-16 cursor-pointer flex-col justify-center rounded-md border-2 px-4 py-2 ${unit === u.value ? 'border-ink bg-lime-soft' : 'border-line bg-white'}`}>
                    <span className="flex items-center gap-2 font-semibold">
                      <input type="radio" name="weight-unit" className="size-5 accent-ink" value={u.value} checked={unit === u.value}
                        onChange={() => chooseUnit(u.value)} />
                      {u.label}
                    </span>
                    <span className="pl-7 text-sm text-slate">{u.hint}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {setUnit.isError && <p role="alert" className="mt-3 font-medium text-danger">{errorMessage(setUnit.error)}</p>}
          </section>

          <section className="card flex flex-wrap items-center justify-between gap-4 p-5 md:p-8">
            <div>
              <h2 className="h-display text-3xl">Акаунт</h2>
              <p className="mt-1 text-slate">Вихід на цьому пристрої. Дані залишаться збереженими.</p>
            </div>
            <button type="button" className="btn-ghost" onClick={signOut}>Вийти з акаунта</button>
          </section>
        </div>
      </div>
    </>
  );
}
