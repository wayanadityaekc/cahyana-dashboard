// Where the bottom tab bar shows, in one string, written out IN FULL.
//
// It has to be spelled out: Tailwind scans source TEXT, so a class assembled by
// interpolation is never generated. That exact mistake shipped silently on the
// public site first - the bar stayed display:none with no error anywhere.
//
// Phone width, installed or not (DASHBOARD BRIEF #3: the tab bar shows in a
// normal browser tab too; it used to be installed-app only). max-[993px] =
// below 993, the same line the navbar's hamburger uses (min-[993px]:hidden),
// so bar and burger switch together. Desktop keeps the rail.
export const PHONE_ONLY = 'hidden max-[993px]:flex';
