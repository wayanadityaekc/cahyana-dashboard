// The same breadcrumb the public site uses (Sep 2026, Wayan: "use this layout
// in our dashboard admin, 100% this layout"). Ported rather than reinvented so
// the two apps never drift into two different-looking trails.
//
//  - a real <nav> + <ol>, so it is a list to a screen reader rather than a line
//    of text with slashes in it;
//  - 12.8px (--fs-small);
//  - the page/section you are ON is the last item, never a link, and carries
//    aria-current="page".
//
// No isHiddenTour equivalent here - this app has no tours, every item either
// carries an href or doesn't.
export const CRUMB_NAV = 'font-body text-small text-muted';
export const CRUMB_OL = 'flex flex-wrap items-center gap-0 m-0 p-0 list-none';
export const CRUMB_LINK = 'text-muted no-underline hover:text-gold hover:underline';
export const CRUMB_HERE = 'text-gold font-medium';
export const CRUMB_SEP = 'mx-[0.4rem] opacity-[0.55]';

export default function Breadcrumb({ items = [], className = '' }) {
  if (!items.length) return null;
  return (
    <nav className={`${CRUMB_NAV} ${className}`} aria-label="Breadcrumb">
      <ol className={CRUMB_OL}>
        {items.map((it, i) => {
          const last = i === items.length - 1;
          const linkable = !last && it.href;
          return (
            <li key={`${it.label}-${i}`} className="flex items-center">
              {linkable ? (
                <a className={CRUMB_LINK} href={it.href}>{it.label}</a>
              ) : (
                <span className={last ? CRUMB_HERE : undefined} aria-current={last ? 'page' : undefined}>
                  {it.label}
                </span>
              )}
              {!last && <span className={CRUMB_SEP} aria-hidden="true">›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
