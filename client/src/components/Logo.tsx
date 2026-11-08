import { IconDumbbell } from './Icons';

/** Логотип: темна (на світлому фоні) або лаймова (на темному) плашка з гантеллю. */
export function Logo({ inverse = false, compactOnMobile = false }: { inverse?: boolean; compactOnMobile?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <span className={`grid size-10 place-items-center rounded-sm ${inverse ? 'bg-lime text-ink' : 'bg-ink text-lime'}`}>
        <IconDumbbell width={22} height={22} strokeWidth={2.6} />
      </span>
      <span className={`font-display text-2xl font-extrabold tracking-tight ${inverse ? 'text-white' : 'text-ink'} ${compactOnMobile ? 'hidden sm:inline' : ''}`}>WORKOUT</span>
    </span>
  );
}
