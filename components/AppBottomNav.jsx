'use client';

import { AlertTriangle, CalendarDays, History, Tag } from 'lucide-react';
import { APP_ONLY } from '@/components/pwaClasses';

// The bottom bar an installed dashboard gets. Four of the rail sections - the
// ones an owner opens daily. Chat is NOT here: it has its own icon in the
// navbar (DASHBOARD BRIEF #2 Q3), so it was swapped for Past. Everything else
// stays reachable from the navbar's drawer.
//
// Unlike the public site there is nothing to yield to: this app has no sticky
// bar of its own, so the bar is simply present on every phone screen in app
// mode. In a browser tab, and on desktop, nothing changes.
// The public site's book-bar shell (BAR_SHELL in CUE's ui/stickyBar.jsx),
// DASHBOARD BRIEF #2 Q4: one 1px top line in --line, rounded top corners
// (--r-xl), safe-area bottom padding, NO shadow. The paddings are the site's
// own numbers, copied as-is so the two bars measure the same.
const BAR =
  `${APP_ONLY} fixed inset-x-0 bottom-0 z-[95] items-stretch ` +
  'pt-[0.55rem] pl-[1.1rem] pr-[0.9rem] pb-[max(0.55rem,env(safe-area-inset-bottom))] ' +
  'bg-white [border-top:1px_solid_var(--line)] rounded-t-[var(--r-xl)]';

const CELL =
  'flex-1 flex flex-col items-center justify-center gap-[3px] ' +
  'py-[0.3rem] px-1 bg-transparent border-none cursor-pointer ' +
  'font-body text-[0.62rem] font-medium leading-none text-center ' +
  '[transition:color_var(--dur)_var(--ease),scale_var(--dur-fast)_var(--ease)]';

// The site's app-bar badge, same string.
const DOT =
  'absolute top-[-6px] right-[-8px] bg-gold text-white rounded-[999px] ' +
  'min-w-[16px] h-4 px-1 text-[0.58rem] font-semibold leading-4 text-center';

const ITEMS = [
  { id: 'attention', label: 'Attention', Icon: AlertTriangle },
  { id: 'upcoming', label: 'Upcoming', Icon: CalendarDays },
  { id: 'past', label: 'Past', Icon: History },
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
