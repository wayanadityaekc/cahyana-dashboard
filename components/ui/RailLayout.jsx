'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, ChevronLeft, PanelLeft } from 'lucide-react';
import Breadcrumb from './Breadcrumb';
import { readLocal, writeLocal } from '@/lib/storage';
import {
  RAIL_FRAME, RAIL_ASIDE, RAIL_ASIDE_COLLAPSED, RAIL_STICK, RAIL_STICK_COLLAPSED,
  RAIL_LABEL, railItem, RAIL_SPLIT,
  RAIL_MAIN, RAIL_MLIST, RAIL_MLABEL, railMobileItem, RAIL_MCHEV, RAIL_BACK,
  RAIL_HEADER, RAIL_TRIGGER, RAIL_HEADER_SEP, RAIL_HEADER_PAD,
  RAIL_FRAME_SCROLL, RAIL_MAIN_SCROLL, RAIL_SCROLL_BODY,
} from './railClasses';

// Collapse is a chrome preference, not per-section - collapsing the rail on
// one visit should still read collapsed the next.
const COLLAPSE_KEY = 'cahyana_dash_rail_collapsed';

// The "mail app" shell shared with the public site's Our Company, My Trips
// and Settings (Sep 2026, Wayan: "use this layout in our dashboard admin,
// 100% this layout"). Ported rather than reinvented, same component and same
// props, so the two apps' shells cannot drift into two different shapes.
//
// State lives with the caller: Dashboard drives the section from its own
// `tab` state. This only renders.
//
// `reading` is the phone's two screens: false = the list of sections, true =
// one section open with a back row. Desktop ignores it entirely (CSS decides
// there).
//
// THREE things are allowed to differ between callers, and nothing else:
//  - an item carrying `href` renders as a LINK instead of a tab.
//  - `frameClass` / `mainClass` swap only the PHONE half of the shell.
//  - `mobileNav` replaces the phone list screen with the caller's own control.
// The rail - width, cream, border, sticky, rows, active pill - is one piece
// of code, same as the public site's.
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
  // Both opt-in, same as the public site: a caller that doesn't pass these
  // renders exactly as before.
  collapsible = false,
  breadcrumb = null,
  // Opt-in (ported verbatim from the public site's scrollContent: "focus on
  // bottom border of the container wrapper, I want that container shows at
  // the screen" - only the content column scrolls, not the whole page, so
  // the frame's own bottom border never scrolls out of view). Overrides
  // frameClass/mainClass with the capped-height variants when true.
  scrollContent = false,
}) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (collapsible) setCollapsed(readLocal(COLLAPSE_KEY, '') === '1');
  }, [collapsible]);
  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    writeLocal(COLLAPSE_KEY, next ? '1' : '0');
  };
  const railCollapsed = collapsible && collapsed;
  const effectiveFrameClass = scrollContent ? RAIL_FRAME_SCROLL : frameClass;
  const effectiveMainClass = scrollContent ? RAIL_MAIN_SCROLL : mainClass;

  const rows = (mobile) =>
    items.map((t) => {
      const on = active === t.id;
      const cls = mobile ? railMobileItem(on) : railItem(on, railCollapsed);
      const inner = (
        <>
          {t.Icon && <t.Icon strokeWidth={1.7} aria-hidden="true" />}
          {(!railCollapsed || mobile) && t.label}
          {mobile && <ChevronRight className={RAIL_MCHEV} strokeWidth={1.7} aria-hidden="true" />}
        </>
      );
      // Collapsed: the label is still the accessible name (title + aria-label),
      // it just isn't painted - a screen reader or a hover tooltip still gets
      // it. `t.label` can be a JSX fragment (a count badge riding along), so
      // this only fires the a11y attrs when it's plain text.
      const titleLabel = typeof t.label === 'string' ? t.label : undefined;
      const a11y = !mobile && railCollapsed && titleLabel ? { title: titleLabel, 'aria-label': titleLabel } : {};
      return (
        <div key={t.id} className="contents">
          {t.split && <span className={RAIL_SPLIT} aria-hidden="true" />}
          {t.href ? (
            <a href={t.href} className={`${cls} no-underline`} aria-current={on || undefined} {...a11y}>
              {inner}
            </a>
          ) : (
            <button
              type="button"
              {...(mobile ? {} : { role: 'tab', 'aria-selected': on })}
              onClick={() => onSelect(t.id)}
              className={cls}
              {...a11y}
            >
              {inner}
            </button>
          )}
        </div>
      );
    });

  return (
    <div className={effectiveFrameClass}>
      {/* Desktop rail. It carries no height of its own: the flex row stretches
          it so the cream fills the box, and the menu inside it is what sticks. */}
      <aside className={railCollapsed ? RAIL_ASIDE_COLLAPSED : RAIL_ASIDE} aria-label={label}>
        <div className={railCollapsed ? RAIL_STICK_COLLAPSED : RAIL_STICK}>
          {!railCollapsed && <p className={RAIL_LABEL}>{label}</p>}
          <nav className="flex flex-col" {...(items.some((t) => t.href) ? {} : { role: 'tablist' })} aria-label={label}>
            {rows(false)}
          </nav>
          {!railCollapsed && help}
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

      <main className={`${effectiveMainClass} ${mobileNav || reading ? '' : 'max-[992px]:hidden'}`}>
        {/* Header row: collapse trigger + breadcrumb (desktop only - mobile
            never had a sidebar to collapse, and its own back row already
            names the section). In scroll mode <main> carries no padding of
            its own, so the header brings its own (RAIL_HEADER_PAD) instead
            of inheriting it. */}
        {(collapsible || breadcrumb) && (
          <div className={scrollContent ? `${RAIL_HEADER} ${RAIL_HEADER_PAD}` : RAIL_HEADER}>
            {collapsible && (
              <button
                type="button"
                className={RAIL_TRIGGER}
                onClick={toggleCollapsed}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-expanded={!collapsed}
              >
                <PanelLeft strokeWidth={1.7} aria-hidden="true" />
              </button>
            )}
            {collapsible && breadcrumb && <span className={RAIL_HEADER_SEP} aria-hidden="true" />}
            {breadcrumb && <Breadcrumb items={breadcrumb} className="m-0" />}
          </div>
        )}
        {mobileNav || (
          <button type="button" className={RAIL_BACK} onClick={onBack}>
            <ChevronLeft strokeWidth={1.7} aria-hidden="true" />
            {label}
          </button>
        )}
        {/* Only this piece scrolls in scroll mode - the header above stays
            put. Plain children otherwise, unchanged from before. */}
        {scrollContent ? <div className={RAIL_SCROLL_BODY}>{children}</div> : children}
      </main>
    </div>
  );
}
