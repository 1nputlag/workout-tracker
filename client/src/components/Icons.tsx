// Іконки з макета (контурні, 24×24). Декоративні — приховані від читачів екрана.
import type { SVGProps } from 'react';

const base = (props: SVGProps<SVGSVGElement>) => ({
  width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...props,
});

export const IconDumbbell = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" /></svg>
);
export const IconPlus = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>;
export const IconMinus = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M5 12h14" /></svg>;
export const IconCheck = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="m5 12 4.5 4.5L19 7" /></svg>;
export const IconChevron = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="m6 9 6 6 6-6" /></svg>;
export const IconBack = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="m15 5-7 7 7 7" /></svg>;
export const IconTrash = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
);
export const IconChart = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4 20h16M7 16v-5M11 16V8M15 16v-3M19 16V6" /></svg>;
export const IconClock = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>;
export const IconList = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M5 7h14M5 12h14M5 17h9" /></svg>;
export const IconEdit = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4 20h4L19 9l-4-4L4 16v4ZM13 7l4 4" /></svg>;
export const IconX = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>;
