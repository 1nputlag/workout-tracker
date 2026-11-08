// Вхід і реєстрація (UI-05, FR-01). Некоректні дані перевіряються в браузері й не надсилаються на сервер.
import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { AuthResponse } from '../lib/types';
import { Logo } from '../components/Logo';
import { IconCheck } from '../components/Icons';

type Mode = 'login' | 'register';
type Errors = { email?: string; password?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validate(mode: Mode, email: string, password: string): Errors {
  const e: Errors = {};
  if (!email.trim()) e.email = 'Введіть електронну пошту';
  else if (!EMAIL_RE.test(email.trim())) e.email = 'Некоректна адреса, наприклад name@example.com';
  if (!password) e.password = 'Введіть пароль';
  else if (mode === 'register' && password.length < 8) e.password = 'Щонайменше 8 символів';
  else if (mode === 'register' && new TextEncoder().encode(password).length > 72) e.password = 'Пароль задовгий: не більше 72 байтів';
  return e;
}

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const submit = useMutation({
    mutationFn: () => api<AuthResponse>(`/auth/${mode}`, {
      method: 'POST',
      body: mode === 'register'
        ? { email: email.trim(), password, ...(displayName.trim() ? { displayName: displayName.trim() } : {}) }
        : { email: email.trim(), password },
    }),
    onSuccess: (r) => { signIn(r); navigate('/', { replace: true }); },
  });

  const onSubmit = (ev: FormEvent) => {
    ev.preventDefault();
    const e = validate(mode, email, password);
    setErrors(e);
    if (Object.keys(e).length === 0) submit.mutate();
  };

  const switchTo = (m: Mode) => { setMode(m); setErrors({}); submit.reset(); };

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <section className="flex flex-col justify-between gap-10 bg-ink px-6 py-8 text-white md:px-16 md:py-14">
        <Logo inverse />
        <div className="hidden lg:block">
          <p className="h-display text-[7rem] leading-[0.92]">
            Вага.<br />Повторення.<br /><span className="text-lime">Прогрес.</span>
          </p>
          <p className="mt-10 max-w-xl text-xl leading-relaxed text-white/85">
            Записуйте підходи прямо в браузері. Застосунок сам порахує тоннаж, тижневий обсяг і оцінку одноповторного максимуму.
          </p>
        </div>
        <ul className="hidden space-y-3 text-lg text-white/85 lg:block">
          {['Без встановлення: працює на комп’ютері, планшеті й смартфоні', 'Графіки динаміки навантаження та підказки прогресії', 'Інтерфейс українською, вага в кг або фунтах'].map((t) => (
            <li key={t} className="flex items-center gap-3"><IconCheck className="text-lime" />{t}</li>
          ))}
        </ul>
      </section>

      <section className="flex items-start justify-center px-4 py-10 md:items-center md:px-10">
        <div className="w-full max-w-lg">
          <div role="tablist" aria-label="Вхід або реєстрація" className="mb-8 grid grid-cols-2 gap-1 rounded-md bg-sand p-1">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                aria-controls="auth-panel"
                className={`min-h-11 rounded-sm text-lg font-semibold ${mode === m ? 'bg-white text-ink shadow-sm' : 'text-slate'}`}
                onClick={() => switchTo(m)}
              >
                {m === 'login' ? 'Вхід' : 'Реєстрація'}
              </button>
            ))}
          </div>

          <div id="auth-panel" role="tabpanel">
            <h1 className="h-display text-5xl">{mode === 'login' ? 'З поверненням' : 'Створіть акаунт'}</h1>
            <p className="mt-2 text-lg text-slate">
              {mode === 'login' ? 'Увійдіть, щоб продовжити тренування.' : 'Кілька секунд — і можна записувати перше тренування.'}
            </p>

            <form noValidate onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
              {mode === 'register' && (
                <div className="flex flex-col gap-2">
                  <label htmlFor="displayName" className="font-semibold">Імʼя <span className="font-normal text-slate">(необовʼязково)</span></label>
                  <input id="displayName" className="field min-h-14" autoComplete="name" maxLength={60} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Як до вас звертатися" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label htmlFor="email" className="font-semibold">Електронна пошта</label>
                <input
                  id="email" type="email" inputMode="email" autoComplete="email" className="field min-h-14"
                  placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined}
                />
                {errors.email && <p id="email-error" className="text-sm font-medium text-danger">{errors.email}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="password" className="font-semibold">Пароль</label>
                <input
                  id="password" type="password" className="field min-h-14"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder={mode === 'register' ? 'Не менше 8 символів' : 'Ваш пароль'}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'password-error' : undefined}
                />
                {errors.password && <p id="password-error" className="text-sm font-medium text-danger">{errors.password}</p>}
              </div>

              {submit.isError && (
                <p role="alert" className="rounded-sm border border-danger/40 bg-danger/5 px-4 py-3 font-medium text-danger">
                  {errorMessage(submit.error)}
                </p>
              )}

              <button type="submit" className="btn-dark min-h-14 text-lg" disabled={submit.isPending}>
                {mode === 'login' ? 'Увійти' : 'Зареєструватися'}
              </button>
            </form>

            <p className="mt-6 text-center text-slate">
              {mode === 'login' ? 'Немає акаунта? ' : 'Уже є акаунт? '}
              <button type="button" className="font-semibold text-ink underline underline-offset-4" onClick={() => switchTo(mode === 'login' ? 'register' : 'login')}>
                {mode === 'login' ? 'Створити акаунт' : 'Увійти'}
              </button>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
