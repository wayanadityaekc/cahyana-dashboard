// The card language the brief #7 panels (Dispatch, Drivers, the driver app)
// are built from. Same strings the Settings panel already uses - a card with a
// hairline, a small semibold heading, muted notes - so the new sections read as
// the same dashboard, not a new one.
import { BTN_SM } from './btnClasses';

export const CARD =
  'flex flex-col gap-[var(--space-2)] p-[var(--space-3)] max-[560px]:p-[var(--space-2)] rounded-[var(--r-md)] ' +
  'bg-white [border:1px_solid_var(--line)]';
export const STACK = 'flex flex-col gap-[var(--space-2)]';
export const HEAD =
  'flex items-center gap-[0.5rem] m-0 font-body text-strong font-semibold text-gold ' +
  '[&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)] [&>svg]:shrink-0';
export const H3 = 'font-body text-h3 font-semibold text-gold m-0';
export const BODY = 'font-body text-body text-green m-0';
export const NOTE = 'font-body text-small text-muted m-0';
export const ERR = 'font-body text-small text-err m-0';
export const OKMSG = 'font-body text-small text-ok m-0';
export const EMPTY = 'font-body text-body text-muted m-0 py-[var(--space-3)]';
export const BTNS = 'flex flex-wrap items-center gap-[var(--space-1)]';
export const ROW_RULE = '[&+&]:[border-top:1px_solid_var(--line)]';

const BTN_BASE =
  `inline-flex ${BTN_SM} gap-[0.4rem] font-body cursor-pointer ` +
  '[&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)] [&>svg]:shrink-0 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed ';
export const GHOST =
  `${BTN_BASE} bg-white text-gold [border:1px_solid_var(--line)] ` +
  '[transition:background-color_var(--dur)_var(--ease),scale_var(--dur-fast)_var(--ease)] hover:bg-cream';
export const CTA =
  `${BTN_BASE} bg-cta text-white border-none ` +
  '[transition:background-color_var(--dur)_var(--ease),scale_var(--dur-fast)_var(--ease)] hover:bg-cta-d';
export const DANGER =
  `${BTN_BASE} bg-white text-err [border:1px_solid_var(--line)] ` +
  '[transition:background-color_var(--dur)_var(--ease),scale_var(--dur-fast)_var(--ease)] hover:bg-cream';

// Status pills, same shape as BookingCard's.
export const PILL =
  'inline-flex items-center px-[0.5rem] py-[0.15rem] rounded-sm font-body text-label ' +
  'font-semibold tracking-[0.06em] uppercase whitespace-nowrap';
export const PILL_OK = 'bg-cream text-ok [border:1px_solid_var(--color-ok)]';
export const PILL_WAIT = 'bg-cream text-gold [border:1px_solid_var(--line)]';
export const PILL_BAD = 'bg-cream text-err [border:1px_solid_var(--color-err)]';

// "2026-10-12" -> "Sun 12 Oct". Parsed as a date string, never through the
// browser's timezone (the day before is what `new Date` would show in some).
export function dayLabel(d, withYear = false) {
  if (!d) return '';
  const [y, m, dd] = String(d).slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, dd));
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getUTCDay()];
  const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1];
  return `${wd} ${dd} ${mo}${withYear ? ` ${y}` : ''}`;
}

export const rupiah = (n) => `Rp ${Math.round(Number(n) || 0).toLocaleString('id-ID')}`;
