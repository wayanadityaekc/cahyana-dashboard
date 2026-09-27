'use client';

import { AlertTriangle, CalendarDays, TrendingDown, TrendingUp, UserRound } from 'lucide-react';

// The row of numbers above the bookings.
//
// PORTED FROM shadcn's `dashboard-01` block (section-cards.tsx), read from the
// source at shadcn-ui/ui@98a1fe6 - the DESIGN was copied, none of the code was.
// Running `npx shadcn@latest add dashboard-01` here would not have worked: that
// block ships .tsx into this .js app, needs 13 design tokens we do not define
// (--background, --foreground, --border, --ring, --radius, ...), assumes Tailwind
// preflight is ON while ours is deliberately off, and pulls ~12 npm packages
// (recharts, @tanstack/react-table, 4x @dnd-kit, zod, sonner, ...) into an app
// that has four. Its own numbers are hardcoded fakes - $1,250.00, 1,234.
//
// What was worth taking, and what is rebuilt here on our tokens:
//   - the card anatomy: quiet label, then the number as the loudest thing in the
//     card, then the meaning under it. The number is the content; everything
//     else is scaffolding around it.
//   - `tabular-nums`. Digits get equal width, so a number does not jiggle
//     sideways when it changes on refresh. Cheap, and the kind of thing nobody
//     notices until it is missing.
//   - container queries, not viewport ones. The cards size themselves off the
//     WIDTH THEY GOT (@container/cards), so this row does not need to know it
//     sits next to a 248px rail - it just fits. That is the clever part of the
//     original and the reason it survives being dropped into a narrower column.
//
// NO INVENTED NUMBERS. Every figure below is counted from what /api/bookings
// already returns, so there is no new endpoint and nothing to go stale. A trend
// badge is only drawn where a trend can honestly be computed (this week against
// last week, both from created_at); the other three cards get no badge rather
// than a decorative one.

// A container query can only be asked by a DESCENDANT of the container, never by
// the container itself - so the wrapper owns @container/cards and the grid inside
// it does the asking. Putting both on one element silently gives you one column
// forever: the rules generate, nothing matches them. Measured, not assumed.
const SHELL = '@container/cards mb-[var(--space-3)]';
const GRID =
  'grid grid-cols-1 gap-[var(--space-2)] ' +
  '@[34rem]/cards:grid-cols-2 @[56rem]/cards:grid-cols-4';

const CARD =
  '@container/card p-[1.1rem] rounded-[var(--r-md)] bg-white ' +
  '[border:1px_solid_var(--line)] flex flex-col';

const LABEL = 'font-body text-small text-muted m-0 flex items-center gap-[0.4rem] [&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)]';

// The number carries the card, so it is the only thing here that grows with the
// card's own width. 1.75rem is already bigger than anything else on the page.
const VALUE =
  'font-body font-semibold text-gold tabular-nums leading-none ' +
  'mt-[0.55rem] text-[1.75rem] @[15rem]/card:text-[2.1rem]';

const FOOT = 'font-body text-small text-muted m-0 mt-[0.5rem]';

const BADGE =
  'inline-flex items-center gap-[0.25rem] px-[0.5rem] py-[0.15rem] rounded-sm ' +
  'font-body text-label font-semibold tracking-[0.06em] uppercase ' +
  '[&>svg]:w-[0.7rem] [&>svg]:h-[0.7rem]';

// Red is reserved for the one card that means "go and look at this now".
const ALERT_VALUE = VALUE.replace('text-gold', 'text-err');

const DAY = 86400000;

function since(groups, from, to) {
  return groups.filter((g) => {
    if (!g.createdAt) return false;
    const t = Date.parse(g.createdAt);
    return Number.isFinite(t) && t >= from && t < to;
  }).length;
}

export default function StatCards({ data }) {
  if (!data) return null;

  const attention = data.attention || [];
  const upcoming = data.upcoming || [];
  const all = [...attention, ...upcoming, ...(data.past || []), ...(data.undated || [])];

  // Guests, not bookings: one booking can be five people, and the car it needs
  // is decided by the people.
  const guests = upcoming.reduce((n, g) => n + (Number(g.guests) || 0), 0);

  const now = Date.now();
  const week = since(all, now - 7 * DAY, now);
  const prev = since(all, now - 14 * DAY, now - 7 * DAY);

  // A percentage against a week with nothing in it is a division by zero dressed
  // up as growth, so that case says what actually happened instead.
  const trend =
    prev === 0
      ? week > 0
        ? { word: 'new', up: true }
        : null
      : { word: `${week >= prev ? '+' : ''}${Math.round(((week - prev) / prev) * 100)}%`, up: week >= prev };

  const Arrow = trend?.up ? TrendingUp : TrendingDown;

  return (
    <div className={SHELL}><div className={GRID}>
      <div className={CARD} data-stat>
        <p className={LABEL}>
          <AlertTriangle strokeWidth={1.7} aria-hidden="true" />
          Needs attention
        </p>
        <p className={attention.length ? ALERT_VALUE : VALUE}>{attention.length}</p>
        <p className={FOOT}>
          {attention.length
            ? 'Payment went wrong or is stuck. Open these first.'
            : 'Nothing stuck. Every payment landed where it should.'}
        </p>
      </div>

      <div className={CARD} data-stat>
        <p className={LABEL}>
          <CalendarDays strokeWidth={1.7} aria-hidden="true" />
          Upcoming trips
        </p>
        <p className={VALUE}>{upcoming.length}</p>
        <p className={FOOT}>
          {data.today ? `Still to run, counted from ${data.today} in Bali.` : 'Still to run.'}
        </p>
      </div>

      <div className={CARD} data-stat>
        <p className={LABEL}>
          <UserRound strokeWidth={1.7} aria-hidden="true" />
          Guests upcoming
        </p>
        <p className={VALUE}>{guests}</p>
        <p className={FOOT}>Across those bookings, not the number of bookings.</p>
      </div>

      <div className={CARD} data-stat>
        <p className={LABEL}>
          <TrendingUp strokeWidth={1.7} aria-hidden="true" />
          Booked this week
        </p>
        {/* The badge sits beside the NUMBER, not beside the label. Beside the
            label it competes with the words for a 217px card and wraps them onto
            two lines (measured); beside the number it has the row to itself. */}
        <div className="flex items-baseline gap-[0.5rem]">
          <p className={VALUE}>{week}</p>
          {trend && (
            <span
              className={`${BADGE} ${trend.up ? 'bg-[rgba(46,125,84,0.12)] text-ok' : 'bg-cream text-muted'}`}
            >
              <Arrow strokeWidth={2.2} aria-hidden="true" />
              {trend.word}
            </span>
          )}
        </div>
        <p className={FOOT}>
          {prev === 0 ? 'Nothing came in the week before.' : `${prev} came in the week before.`}
        </p>
      </div>
    </div></div>
  );
}
