import { useEffect, useState } from 'react';

// Тимчасова сторінка: перевіряє зв'язок із сервером. Екрани з docs/ui_screens реалізуються на етапах 6–9.
export function App() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setStatus(d.status === 'ok' ? 'ok' : 'error'))
      .catch(() => setStatus('error'));
  }, []);

  return (
    <main style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>Workout Tracker</h1>
      <p data-testid="server-status">
        Сервер: {status === 'loading' ? 'перевірка…' : status === 'ok' ? 'працює' : 'недоступний'}
      </p>
    </main>
  );
}
