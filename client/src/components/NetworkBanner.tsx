// Банер стану мережі (NFR-04): без зʼєднання пояснює, що введене не загубиться; після відновлення — коротко підтверджує.
import { useEffect, useRef, useState } from 'react';
import { useOnline } from '../lib/online';

export function NetworkBanner() {
  const online = useOnline();
  const wasOffline = useRef(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (!online) { wasOffline.current = true; setRestored(false); return; }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    setRestored(true);
    const t = setTimeout(() => setRestored(false), 4000);
    return () => clearTimeout(t);
  }, [online]);

  // Область role="status" існує завжди, щоб читач екрана оголосив зміну її вмісту
  return (
    <div role="status" aria-live="polite" data-testid="network-banner">
      {!online && (
        <p className="bg-ink px-4 py-3 text-center font-medium text-white">
          <span className="mr-2 inline-block size-2.5 rounded-full bg-lime align-middle" aria-hidden />
          Немає зʼєднання з інтернетом. Введені підходи не загубляться — їх буде надіслано, щойно зʼєднання відновиться.
        </p>
      )}
      {online && restored && (
        <p className="bg-lime px-4 py-3 text-center font-semibold text-ink">Зʼєднання відновлено</p>
      )}
    </div>
  );
}
