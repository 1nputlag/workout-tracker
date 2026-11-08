// Доступне спадне меню (шаблон WAI-ARIA «Menu Button»): Enter/Пробіл відкривають, стрілки переміщують, Esc закриває.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export type MenuItem = { label: string; onSelect: () => void; hint?: string; disabled?: boolean };

type Props = {
  button: (props: { 'aria-haspopup': 'menu'; 'aria-expanded': boolean; 'aria-controls': string; onClick: () => void; ref: React.Ref<HTMLButtonElement> }) => ReactNode;
  items: MenuItem[];
  align?: 'left' | 'right';
  header?: ReactNode;
};

export function Menu({ button, items, align = 'right', header }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    itemRefs.current.find((x) => x && !x.disabled)?.focus();
    const onDoc = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const close = () => { setOpen(false); btn.current?.focus(); };
  const onKey = (e: KeyboardEvent) => {
    const list = itemRefs.current.filter((x): x is HTMLButtonElement => Boolean(x && !x.disabled));
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus(); }
    if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div className="relative" ref={root} onKeyDown={onKey}>
      {button({ 'aria-haspopup': 'menu', 'aria-expanded': open, 'aria-controls': id, onClick: () => setOpen((o) => !o), ref: btn })}
      {open && (
        <div className={`absolute z-30 mt-2 min-w-64 rounded-md border border-line bg-white p-2 shadow-[0_12px_32px_rgba(21,23,26,0.16)] ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {header}
          <div role="menu" id={id} className="flex flex-col">
            {items.map((it, n) => (
              <button
                key={it.label}
                ref={(el) => { itemRefs.current[n] = el; }}
                role="menuitem"
                type="button"
                disabled={it.disabled}
                className="flex min-h-11 flex-col items-start justify-center rounded-sm px-3 py-2 text-left font-semibold hover:bg-sand/70 focus:bg-sand/70 focus:outline-none disabled:opacity-50"
                onClick={() => { setOpen(false); it.onSelect(); }}
              >
                {it.label}
                {it.hint && <span className="text-sm font-normal text-slate">{it.hint}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
