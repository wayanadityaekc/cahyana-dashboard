'use client';

import { ChevronRight, ChevronLeft } from 'lucide-react';
import {
  RAIL_FRAME, RAIL_ASIDE, RAIL_STICK, RAIL_LABEL, railItem, RAIL_SPLIT,
  RAIL_MAIN, RAIL_MLIST, RAIL_MLABEL, railMobileItem, RAIL_MCHEV, RAIL_BACK,
} from './railClasses';

// The "mail app" shell shared by Our Company, My Trips and the guide articles
// (Sep 2026, Wayan: "page my trip dan our company akan menggunakan layout yang
// sama ... kayak page email di desktop", then "reuse komponen container dan side
// bar di our company dan pakai container dan side bar di guide"). A component, not
// just a bag of class strings, because what has to stay the same between the pages
// is the ORDER and the BEHAVIOUR - rail then content, the rail's sticky, the page's
// own gutter - and shared strings cannot hold that. Same reasoning as DetailHero
// and FormHero.
//
// State lives with the caller: Our Company drives the section from the URL hash,
// My Trips just keeps a tab, the guide articles have no state at all (their rows
// are links). This only renders.
//
// `reading` is the phone's two screens: false = the list of sections, true = one
// section open with a back row. Desktop ignores it entirely (CSS decides there),
// so it is safe for the pages to start it differently - Our Company opens on the
// list, My Trips opens straight on the cart, because that page has an obvious
// default and Our Company does not.
//
// THREE things are allowed to differ between callers, and nothing else:
//  - an item carrying `href` renders as a LINK instead of a tab. Our Company
//    switches a section in place; a guide category navigates to the hub. The row
//    itself is the same either way, so it cannot drift.
//  - `frameClass` / `mainClass` swap only the PHONE half of the shell, so the guide
//    articles keep the white card they have always had below 993px.
//  - `mobileNav` replaces the phone list screen with the caller's own control. A
//    guide article has to show the article on arrival, not a menu, so it passes its
//    dropdown and the list + back row are skipped.
// The rail - width, cream, border, sticky, rows, active pill - is one piece of code
// for all three pages.
export default function RailLayout({
  label,
  items,
  active,
  onSelect,
  reading,
  onBack,
  help = null,
  children,
  frameClass = RAIL_FRAME,
  mainClass = RAIL_MAIN,
  mobileNav = null,
}) {
  const rows = (mobile) =>
    items.map((t) => {
      const on = active === t.id;
      const cls = mobile ? railMobileItem(on) : railItem(on);
      const inner = (
        <>
          {t.Icon && <t.Icon strokeWidth={1.7} aria-hidden="true" />}
          {t.label}
          {mobile && <ChevronRight className={RAIL_MCHEV} strokeWidth={1.7} aria-hidden="true" />}
        </>
      );
      return (
        <div key={t.id} className="contents">
          {t.split && <span className={RAIL_SPLIT} aria-hidden="true" />}
          {t.href ? (
            // no-underline is the only thing added on top of railItem: that string
            // never sets a decoration, so an <a> would otherwise arrive underlined.
            <a href={t.href} className={`${cls} no-underline`} aria-current={on || undefined}>
              {inner}
            </a>
          ) : (
            <button
              type="button"
              {...(mobile ? {} : { role: 'tab', 'aria-selected': on })}
              onClick={() => onSelect(t.id)}
              className={cls}
            >
              {inner}
            </button>
          )}
        </div>
      );
    });

  return (
    <div className={frameClass}>
      {/* Desktop rail. It carries no height of its own: the flex row stretches
          it so the cream fills the box, and the menu inside is what sticks. */}
      <aside className={RAIL_ASIDE} aria-label={label}>
        <div className={RAIL_STICK}>
          <p className={RAIL_LABEL}>{label}</p>
          <nav className="flex flex-col" {...(items.some((t) => t.href) ? {} : { role: 'tablist' })} aria-label={label}>
            {rows(false)}
          </nav>
          {help}
        </div>
      </aside>

      {/* Phone: the same sections as a full-width list. Hidden outright once one
          is open, and never shown at all on desktop. Skipped completely when the
          caller brings its own phone control. */}
      {!mobileNav && (
        <div className={reading ? 'hidden' : RAIL_MLIST}>
          <p className={RAIL_MLABEL}>{label}</p>
          {rows(true)}
          {help}
        </div>
      )}

      <main className={`${mainClass} ${mobileNav || reading ? '' : 'max-[992px]:hidden'}`}>
        {mobileNav || (
          <button type="button" className={RAIL_BACK} onClick={onBack}>
            <ChevronLeft strokeWidth={1.7} aria-hidden="true" />
            {label}
          </button>
        )}
        {children}
      </main>
    </div>
  );
}
