import { BTN_SM } from '@/components/ui/btnClasses';
// The two-column "mail app" shell: a tinted rail of sections on the left, the
// chosen section's content on the right (Sep 2026, Wayan picked "opsi A" from a
// sheet of three rails, then "hp 3" for the phone).
//
// Shared because Our Company and My Trips are meant to be the same page shape.
// Keeping one copy of the strings is what stops them drifting apart, the same
// reason DetailHero and detailCardClasses exist.
//
// DESKTOP: one bordered box, cream rail + white content. The rail is a flex
// child with no height of its own, so it stretches to the box and the cream
// paints the full column; the menu inside it is what sticks.
// PHONE (<=992px): there is no room for a column, so the rail becomes the first
// screen - a full-width list - and a section opens over it with a back row.
// Only the CONTENTS carry over (icons, the About/Legal split, the section
// label), not the shape.

// --- page + frame -----------------------------------------------------------
// Near-full-width on purpose (Sep 2026, Wayan: "gua mau kontainer page yang punya
// side bar hampir full screen di layar, saat ini margin left right masih gede").
// It used to cap at 1180px, which left 394px of empty page on each side at 1920.
// 1800 is still a cap rather than no cap at all: below 1800 the box is the screen
// minus the site gutter, and above it the frame stops growing so an ultra-wide
// monitor does not get a 2500px row.
// WIDTH + GUTTER ONLY, and every block on a rail page is built from it (Sep 2026,
// Wayan: "kalo isi margin ya semua komponen yang makai dia harus isi margin juga").
// Vertical space belongs to the caller - stacking a `py-` next to a baked-in `pb-`
// would be two utilities of the same specificity, where the compile order decides.
//
// It is what stops a page from having two left edges: the guide articles used to put
// the rail frame here and the "Our tours" block in the 1200px container below it, so
// the same page started at 24px and then at 120px (measured @1440).
export const PAGE_WIDE = 'max-w-[1800px] mx-auto px-[var(--container-x)]';

// Split in two: the guide articles reuse the WIDTH half but open with a hero, so
// they set their own top padding instead of clearing the header.
export const RAIL_PAGE_BOX = `${PAGE_WIDE} pb-[var(--space-5)]`;

export const RAIL_PAGE = `${RAIL_PAGE_BOX} pt-[calc(var(--header-h-max,104px)+1.9rem)]`;

// Tighter margin, scrollContent pages only (Sep 2026, "100% this layout" -
// ported from the public site's My Trips/Settings/Our Company, which use this
// exact same 24px/24px split instead of RAIL_PAGE's own numbers). The top gap
// also clears the fixed navbar (DASHBOARD BRIEF #2). --header-h is measured and written by Navbar; 58px is its height
// before that first measurement lands.
export const RAIL_PAGE_SCROLL = `${PAGE_WIDE} pb-[var(--space-3)] pt-[calc(var(--header-h,58px)+var(--space-3))]`;

// overflow-CLIP, not overflow-hidden. Both clip the rail's cream to the rounded
// corner, but `hidden` also makes the frame a scroll container, and a sticky child
// sticks to its nearest scrolling ancestor - so the menu would scroll away with
// the page and never pin under the header. `clip` does not create one.
// (Pre-Safari-16 falls back to visible: the corner shows square, the page works.)
//
// The min-height is what makes the rail read as full screen (Wayan: "gua mau side
// bar stiky dan full screen"). It sits on the FRAME, never on the rail: the rail is
// a stretched flex child, so growing the box paints its cream all the way down,
// while an h-[100vh] on the rail itself is the old bug that punched a white hole
// into short pages. That matters here - an empty My Trips frame measures 176px.
// It reaches exactly the bottom of the first screen, so the page's own top padding
// and bottom padding are subtracted back out.
const FRAME_DESK =
  'flex items-stretch bg-white [border:1px_solid_var(--line)] rounded-[var(--r-lg)] ' +
  'min-[993px]:min-h-[calc(100dvh_-_var(--header-h-max,104px)_-_1.9rem_-_var(--space-5))] ' +
  'overflow-clip [box-shadow:var(--shadow-md)] max-[992px]:block';

export const RAIL_FRAME =
  `${FRAME_DESK} max-[992px]:border-none ` +
  'max-[992px]:rounded-none max-[992px]:shadow-none max-[992px]:bg-transparent';

// Guide articles keep their phone shape exactly as it was - a white bordered card,
// --r-md corners, no shadow (Wayan asked for the rail on DESKTOP only). The desktop
// half is the same string, so the two pages cannot drift apart.
export const RAIL_FRAME_CARD = `${FRAME_DESK} max-[992px]:rounded-md max-[992px]:shadow-none`;

// Capped, not just a minimum (Sep 2026, "100% this layout" - ported from the
// public site's My Trips/Settings/Our Company: "focus on bottom border of the
// container wrapper, I want that container shows at the screen"). `h-`
// instead of `min-h-` so the frame never grows past the first screen and its
// own bottom border never scrolls out of view.
//
// A SEPARATE constant from FRAME_DESK, not a change to it, same reasoning as
// the public site: this app has no long-form page that needs the frame to
// keep growing.
//
// Subtracts the navbar (--header-h) and RAIL_PAGE_SCROLL's own top/bottom
// padding. No fixed-footer term: AppBottomNav is phone-only
// (`max-[993px]`), below where this rule applies.
//
// PHONES keep the border, so the frame pads its own content (DASHBOARD BRIEF #3:
// the title used to touch the card's left edge). Same inset and no shadow, as
// the public site's RAIL_FRAME_SCROLL / guide card (RAIL_MAIN_CARD): 24px,
// 16px under 560. Desktop is unchanged.
export const RAIL_FRAME_SCROLL =
  'flex items-stretch bg-white [border:1px_solid_var(--line)] rounded-[var(--r-lg)] ' +
  'min-[993px]:h-[calc(100dvh_-_var(--header-h,58px)_-_var(--space-3)_-_var(--space-3))] ' +
  'overflow-clip [box-shadow:var(--shadow-md)] max-[992px]:[box-shadow:none] ' +
  'max-[992px]:block max-[992px]:px-6 max-[992px]:pt-6 max-[992px]:pb-8 ' +
  'max-[560px]:px-4 max-[560px]:pt-5 max-[560px]:pb-[1.6rem]';

// --- desktop rail -----------------------------------------------------------
export const RAIL_ASIDE =
  'max-[992px]:hidden flex-none w-[248px] bg-cream [border-right:1px_solid_var(--line)] ' +
  'transition-[width] duration-200 ease-[ease]';

// Collapsed rail (Sep 2026, "100% this layout" - ported from the public
// site's "make it like shadcn's sidebar-08"). 64px, same base string as
// RAIL_ASIDE otherwise - only the width differs, so a collapsed rail never
// drifts from the expanded one in anything but that one number.
export const RAIL_ASIDE_COLLAPSED =
  'max-[992px]:hidden flex-none w-[64px] bg-cream [border-right:1px_solid_var(--line)] ' +
  'transition-[width] duration-200 ease-[ease]';

// top-0, not top-[header-h] (unlike the public site's version): this app has
// no fixed navbar for the rail to clear.
export const RAIL_STICK =
  'sticky top-0 flex flex-col p-[1.35rem_0.9rem] max-h-[100dvh] overflow-y-auto';

// Collapsed: no side padding (a 64px column has no room to spare) - the icon
// centers itself instead.
export const RAIL_STICK_COLLAPSED =
  'sticky top-0 flex flex-col items-center p-[1.35rem_0.5rem] max-h-[100dvh] overflow-y-auto';

export const RAIL_LABEL =
  'font-body text-label font-medium tracking-[0.14em] uppercase text-muted m-0 mb-[var(--space-2)] px-[0.75rem]';

// One row of the rail. The active row is a raised white pill - the rail is
// already cream, so "lifted out of the tint" is what reads as selected here.
// `collapsed` centers the icon and drops the row to a square instead of a
// full-width bar - the label stays in the DOM (title/aria-label carry it for
// a hover tooltip and screen readers), just not painted.
export const railItem = (active, collapsed = false) =>
  `flex items-center ${collapsed ? 'justify-center w-9 h-9 p-0' : 'w-full text-left p-[0.55rem_0.75rem] gap-[0.65rem]'} ` +
  'rounded-[var(--r-md)] bg-transparent border-none cursor-pointer font-body text-body leading-[1.35] ' +
  '[&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)] [&>svg]:shrink-0 ' +
  (active
    ? `font-semibold text-gold bg-white [border:1px_solid_var(--line)] [box-shadow:var(--shadow-sm)] ${collapsed ? '' : 'p-[calc(0.55rem-1px)_calc(0.75rem-1px)]'}`
    : 'text-muted [&>svg]:opacity-75 hover:text-gold');

// --- header row: collapse trigger + breadcrumb (Sep 2026) -------------------
// Desktop only, same as the rest of the rail chrome - mobile never had a
// sidebar to collapse. Sits above `children` inside <main>, same place the
// public site's own header row lives.
export const RAIL_HEADER =
  'max-[992px]:hidden flex items-center gap-3 pb-4 mb-[1.2rem] [border-bottom:1px_solid_var(--line)]';
export const RAIL_TRIGGER =
  'flex items-center justify-center w-8 h-8 -ml-1 rounded-[var(--r-md)] bg-transparent border-none cursor-pointer ' +
  'text-muted hover:bg-white hover:text-gold [&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)]';
export const RAIL_HEADER_SEP = 'w-px h-4 bg-line shrink-0';
// Only needed in scroll mode: normally the header sits inside <main>, which
// carries its own padding (RAIL_MAIN) and pushes every child in from the
// edge for free. Scroll mode moves that padding OFF <main> and onto the
// header + the scrolling body individually (RAIL_MAIN_SCROLL/RAIL_SCROLL_BODY
// below), so the header has to bring its own horizontal inset here instead.
export const RAIL_HEADER_PAD = 'min-[993px]:px-[2.1rem] min-[993px]:pt-[1.6rem]';

// Splits one group of rail items from the next - the booking buckets from
// Prices, and Prices from the rest (this rail carries two of these).
export const RAIL_SPLIT = 'block h-px bg-line my-[var(--space-2)] mx-[0.75rem]';

// --- content column ---------------------------------------------------------
export const RAIL_MAIN = 'flex-1 min-w-0 p-[1.6rem_2.1rem] max-[992px]:p-0';
// Same column, but below 993px it keeps the guide card's own padding instead of
// dropping to zero (that padding is what draws the card on a phone).
export const RAIL_MAIN_CARD =
  'flex-1 min-w-0 p-[1.6rem_2.1rem] max-[992px]:px-6 max-[992px]:pt-6 max-[992px]:pb-8 ' +
  'max-[560px]:px-4 max-[560px]:pt-5 max-[560px]:pb-[1.6rem]';

// --- scroll mode (Sep 2026, "100% this layout") ------------------------------
// <main> itself carries NO padding here (that moved to the header and the
// body wrapper below) and becomes a flex column that is not allowed to grow
// past its parent frame (`overflow-hidden` + `min-h-0`) - the frame is what
// is actually capped (RAIL_FRAME_SCROLL), this just stops <main> from
// silently re-introducing the overflow the frame was capped to prevent.
export const RAIL_MAIN_SCROLL =
  'flex-1 min-w-0 min-[993px]:flex min-[993px]:flex-col min-[993px]:min-h-0 ' +
  'min-[993px]:overflow-hidden max-[992px]:p-0';
// The part that actually scrolls. `min-h-0` on a flex child is REQUIRED for
// overflow-y-auto to ever kick in - without it, a flex item defaults to a
// minimum height of its content's natural size, so it just grows the parent
// instead of scrolling.
export const RAIL_SCROLL_BODY =
  'min-[993px]:flex-1 min-[993px]:min-h-0 min-[993px]:overflow-y-auto ' +
  'min-[993px]:px-[2.1rem] min-[993px]:pb-[1.6rem]';

// Prose is capped for line length but sits flush left, the same compromise the
// guide articles make: the left edge lines up with everything else on the page,
// the lines stay readable.
export const RAIL_READ = 'max-w-[var(--container-read)]';

// --- phone ------------------------------------------------------------------
export const RAIL_MLIST = 'min-[993px]:hidden';
export const RAIL_MLABEL =
  'font-body text-label font-medium tracking-[0.14em] uppercase text-muted m-0 mb-[var(--space-1)] px-[0.75rem]';

// The GEOMETRY of one menu row: flex, gap, padding, radius, full width. Shared
// with the navbar drawer (Sep 2026, Wayan picked "B" from a sheet of three) - its
// rows used to be plain text with a colour-only hover while these already had a
// pill, so one site had two kinds of menu row. One string is what stops them
// drifting apart again, the same reason DetailHero and FormHero exist.
//
// Only the SHAPE travels. Each side keeps its own type and colours: the rail's
// rows are muted body text, the drawer's are --fs-strong in soft black.
// The DESKTOP rail row is deliberately NOT built from this - it runs a tighter
// 0.55rem padding, and a drawer row has to stay thumb-sized.
// The icon sizing lives here too, because a Lucide icon with no explicit size
// renders at its 24px attribute - so "a menu row" and "how big its icon is" are
// one decision, not two places to forget.
export const MENU_ROW_BOX =
  'flex items-center gap-[0.65rem] w-full text-left p-[0.7rem_0.75rem] rounded-[var(--r-md)] ' +
  '[&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)] [&>svg]:shrink-0';

export const railMobileItem = (active) =>
  `${MENU_ROW_BOX} ` +
  'bg-transparent border-none cursor-pointer font-body text-body leading-[1.35] ' +
  (active ? 'font-semibold text-gold bg-cream' : 'text-muted [&>svg]:opacity-75');


export const RAIL_BACK =
  'min-[993px]:hidden flex items-center gap-[var(--space-1)] mb-[var(--space-2)] p-0 ' +
  'bg-transparent border-none cursor-pointer font-body text-body font-semibold text-gold ' +
  '[&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)] [&>svg]:shrink-0';

// --- help card --------------------------------------------------------------
// The rail runs out well before the fold. Rather than pad it with nothing, it
// ends on the one thing a guest reading policies most often wants next.
export const RAIL_HELP =
  'mt-[var(--space-3)] mx-[0.75rem] p-[0.9rem] rounded-[var(--r-md)] bg-white ' +
  '[border:1px_solid_var(--line)] max-[992px]:mt-[var(--space-4)]';
export const RAIL_HELP_TEXT = 'font-body text-body leading-[1.45] text-muted m-0 mb-[0.6rem]';
export const RAIL_HELP_BTN =
  // Full width inside the rail: the label is 16 characters in a 248px column,
  // so any inline size is one font tweak away from poking out of the card.
  // Stretching it removes the failure mode instead of tuning around it.
  'flex w-full max-[992px]:inline-flex max-[992px]:w-auto ' +
  `${BTN_SM} gap-[0.4rem] no-underline font-body ` +
  'text-white bg-cta ' +
  '[&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)] [&>svg]:shrink-0 whitespace-nowrap ' +
  '[transition:background-color_var(--dur)_var(--ease),scale_var(--dur-fast)_var(--ease)] hover:bg-cta-d';
