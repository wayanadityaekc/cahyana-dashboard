// The chat's look, shared by the guest chat (ChatPanel) and the two driver
// chats (DASHBOARD BRIEF #7: the owner's Drivers threads, and the driver app's
// one thread with the owner). Moved here unchanged from ChatPanel so the three
// conversations are one shape, not three copies drifting apart.
import { BTN_SM } from '@/components/ui/btnClasses';
import { fmtTime, fmtDate } from '@/lib/time';

export const WRAP = 'flex gap-[var(--space-2)] min-[769px]:h-[min(620px,calc(100dvh-260px))]';
export const LIST = 'flex flex-col gap-[0.4rem] overflow-y-auto min-[769px]:w-[280px] min-[769px]:flex-none flex-1';
export const listRow = (on, unread) =>
  'w-full text-left p-[0.6rem_0.7rem] rounded-[var(--r-md)] cursor-pointer ' +
  '[transition:background-color_var(--dur)_var(--ease),scale_var(--dur-fast)_var(--ease)] ' +
  (on ? 'bg-white [border:1px_solid_var(--line)] [box-shadow:var(--shadow-sm)]'
      : `bg-transparent border-none hover:bg-cream ${unread ? '' : ''}`);
export const ROW_TOP = 'flex items-baseline gap-[0.4rem]';
export const ROW_WHO = 'flex-1 min-w-0 font-body text-small font-semibold text-gold truncate';
export const ROW_WHEN = 'flex-none font-body text-label text-muted tabular-nums';
export const ROW_LAST = 'block mt-[0.15rem] font-body text-label text-muted truncate';
export const BADGE =
  'inline-flex items-center justify-center min-w-[18px] h-[18px] px-[5px] rounded-[var(--r-pill)] ' +
  'bg-cta text-white font-body text-label font-semibold tabular-nums';

export const CONV = 'flex-1 min-w-0 flex flex-col rounded-[var(--r-md)] [border:1px_solid_var(--line)] overflow-hidden';
export const CONV_HEAD = 'flex items-center gap-[0.5rem] flex-none px-[0.8rem] py-[0.6rem] [border-bottom:1px_solid_var(--line)] bg-cream';
export const CONV_WHO = 'flex-1 min-w-0 font-body text-small font-semibold text-gold truncate';
export const CONV_MAIL = 'block font-body text-label font-normal text-muted truncate';
export const CONV_BODY =
  'flex-[1_1_auto] min-h-[220px] overflow-y-auto p-[0.8rem] flex flex-col gap-[0.5rem] bg-white';
export const BUB_GUEST =
  'self-start max-w-[80%] px-[0.75rem] py-[0.5rem] rounded-[var(--r-md)] bg-cream [border:1px_solid_var(--line)] ' +
  'font-body text-body leading-[var(--lh-body)] text-ink [overflow-wrap:anywhere]';
export const BUB_OWNER =
  'self-end max-w-[80%] px-[0.75rem] py-[0.5rem] rounded-[var(--r-md)] bg-cta ' +
  'font-body text-body leading-[var(--lh-body)] text-white [overflow-wrap:anywhere]';
export const STAMP = 'font-body text-label text-muted mt-[0.1rem]';
export const FOOT = 'flex-none flex items-center gap-[0.5rem] p-[0.6rem] [border-top:1px_solid_var(--line)] bg-white';
export const SEND_BTN =
  'flex-none inline-flex items-center justify-center w-[var(--btn-h)] h-[var(--btn-h)] rounded-[var(--r-sm)] ' +
  'bg-cta text-white border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ' +
  '[&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)] ' +
  '[transition:background-color_var(--dur)_var(--ease),scale_var(--dur-fast)_var(--ease)] hover:bg-cta-d';
export const GHOST =
  `inline-flex ${BTN_SM} gap-[0.4rem] bg-white text-gold [border:1px_solid_var(--line)] cursor-pointer ` +
  '[&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)] [&>svg]:shrink-0 ' +
  '[transition:background-color_var(--dur)_var(--ease),scale_var(--dur-fast)_var(--ease)] hover:bg-cream';
export const EMPTY = 'font-body text-body text-muted m-0 py-[var(--space-3)]';
// The guest is typing. Same bubble shape as theirs, on their side of the
// conversation, so it reads as coming from them.
export const TYPING =
  'self-start flex items-center gap-[0.45rem] px-[0.75rem] py-[0.5rem] rounded-[var(--r-md)] ' +
  'bg-cream [border:1px_solid_var(--line)] font-body text-label text-muted';
export const TDOT = (i) =>
  'w-[5px] h-[5px] rounded-[50%] bg-muted motion-safe:animate-[chatdot_1.1s_ease-in-out_infinite] ' +
  `[animation-delay:${i * 0.15}s]`;

export const when = (v) => {
  if (!v) return '';
  const d = new Date(v);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay ? fmtTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`) : fmtDate(v);
};
