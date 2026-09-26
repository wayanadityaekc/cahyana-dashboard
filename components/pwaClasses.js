// App mode, in one string, written out IN FULL.
//
// It has to be spelled out: Tailwind scans source TEXT, so a class assembled by
// interpolation is never generated. That exact mistake shipped silently on the
// public site first - the bar stayed display:none in app mode with no error
// anywhere - so the site's copy of this file carries the same warning.
//
// Phone width only. A desktop install keeps the rail, which is the better
// navigation when there is room for it.
export const APP_ONLY = 'hidden standalone:max-[993px]:flex';
