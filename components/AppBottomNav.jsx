'use client';

import { AlertTriangle, CalendarDays, MessageCircle, Tag } from 'lucide-react';
import { APP_ONLY } from '@/components/pwaClasses';

// The bottom bar an installed dashboard gets. Four of the six rail sections -
// the ones an owner opens daily. Past and No date stay in the rail list, which
// is still there and still holds everything.
//
// Unlike the public site there is nothing to yield to: this app has no sticky
// bar of its own, so the bar is simply present on every phone screen in app
// mode. In a browser tab, and on desktop, nothing changes.
const BAR =
  `${APP_ONLY} fixed inset-x-0 bottom-0 z-[95] items-stretch ` +
  'pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] ' +
  'bg-white [border-top:1px_solid_var(--line)] [box-shadow:0_-6px_22px_rgba(0,0,0,0.08)]';

const CELL =
  'flex-1 flex flex-col items-center justify-center gap-[3px] ' +
  'py-[0.3rem] px-1 bg-transparent border-none cursor-pointer ' +
  'font-body text-[0.62rem] font-medium leading-none text-center ' +
  '[transition:color_var(--dur)_var(--ease),scale_var(--dur-fast)_var(--ease)]';

const DOT =
  'absolute top-[-6px] right-[-8px] bg-gold text-white rounded-[999px] ' +
  'min-w-[16px] h-4 px-1 text-[0.58rem] font-semibold leading-4 text-center tabular-nums';

const ITEMS = [
  { id: 'attention', label: 'Attention', Icon: AlertTriangle },
  { id: 'upcoming', label: 'Upcoming', Icon: CalendarDays },
  { id: 'chat', label: 'Chat', Icon: MessageCircle },
  { id: 'prices', label: 'Prices', Icon: Tag },
];

export default function AppBottomNav({ active, onPick, counts = {} }) {
  return (
    <nav className={BAR} aria-label="Sections" data-appnav>
      {ITEMS.map(({ id, label, Icon }) => {
        const on = active === id;
        const n = counts[id];
        return (
          <button
            key={id}
            type="button"
            className={`${CELL} ${on ? 'text-gold' : 'text-muted'}`}
            aria-current={on ? 'page' : undefined}
            onClick={() => onPick(id)}
          >
            <span className="relative">
              <Icon className="w-[22px] h-[22px]" strokeWidth={on ? 2 : 1.7} aria-hidden="true" />
              <span className={DOT} hidden={!n}>{n}</span>
            </span>
            {label}
          </button>
        );
      })}
    </nav>
  );
}
