// Форматування чисел, ваги й дат українською. Чисті функції — покриті тестами (format.test.ts).
import type { WeightUnit } from './types';

const KG_PER_LB = 0.45359237;

export function fmtNum(x: number, maxDigits = 1): string {
  return new Intl.NumberFormat('uk-UA', { maximumFractionDigits: maxDigits }).format(x);
}

/** Кілограми → одиниці користувача (так само, як рахує сервер: фунти до 0,1). */
export function toDisplay(kg: number, unit: WeightUnit): number {
  return unit === 'lb' ? Math.round((kg / KG_PER_LB) * 10) / 10 : Math.round(kg * 100) / 100;
}
/** Значення в одиницях користувача → кілограми для сервера. */
export function toKg(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? Math.round(value * KG_PER_LB * 100) / 100 : value;
}
export const unitLabel = (u: WeightUnit) => (u === 'lb' ? 'фунти' : 'кг');
export const unitShort = (u: WeightUnit) => (u === 'lb' ? 'lb' : 'кг');

/** Українська множина: plural(5, ['підхід', 'підходи', 'підходів']) → «підходів». */
export function plural(n: number, [one, few, many]: [string, string, string]): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
export const setsText = (n: number) => `${n} ${plural(n, ['підхід', 'підходи', 'підходів'])}`;
export const workoutsText = (n: number) => `${n} ${plural(n, ['тренування', 'тренування', 'тренувань'])}`;

const WEEKDAYS = ['НД', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];

/** «ПТ 16» */
export const dayLabel = (d: Date) => `${WEEKDAYS[d.getDay()]} ${d.getDate()}`;
/** «16 жовтня» */
export const dateLong = (d: Date) => `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
/** «Неділя, 18 жовтня» */
export function dateWithWeekday(d: Date): string {
  const w = d.toLocaleDateString('uk-UA', { weekday: 'long' });
  return `${w.charAt(0).toUpperCase()}${w.slice(1)}, ${dateLong(d)}`;
}

/** Понеділок тижня (місцевий час, 00:00). */
export function mondayOf(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}
/** «12–18 жовтня» або «29 вересня – 5 жовтня» */
export function weekRangeLabel(monday: Date): string {
  const sun = new Date(monday); sun.setDate(sun.getDate() + 6);
  return monday.getMonth() === sun.getMonth()
    ? `${monday.getDate()}–${sun.getDate()} ${MONTHS_GEN[sun.getMonth()]}`
    : `${dateLong(monday)} – ${dateLong(sun)}`;
}

/** Ключ ISO-тижня за місцевою датою — збігається з ключами сервера при tzOffsetMin = зсуву браузера. */
export function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const week = Math.ceil(((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
/** Зсув часового поясу браузера в хвилинах від UTC (для Києва: 120 взимку, 180 влітку). */
export const tzOffsetMin = () => -new Date().getTimezoneOffset();

/** «1 г 12 хв», «45 хв» */
export function durationText(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h} г ${String(m).padStart(2, '0')} хв` : `${m} хв`;
}
/** «00:42:15» */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((x) => String(x).padStart(2, '0')).join(':');
}

/** Назва тренування за групами мʼязів: «Груди й трицепс», «Спина, плечі й біцепс». */
export function workoutTitle(groupIds: number[], groups: Map<number, string>): string {
  const names = groupIds.map((id) => groups.get(id)).filter((x): x is string => Boolean(x))
    .map((n, i) => (i === 0 ? n : n.toLowerCase()));
  if (names.length === 0) return 'Тренування';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} й ${names[names.length - 1]}`;
}

/** Ініціали для аватара: «Михайло Парандій» → «МП», «mykhailo» → «M». */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0]?.[0] ?? '?')).toUpperCase();
}
