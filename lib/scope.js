// Which dashboard is asking (DASHBOARD BRIEF #8): the CUE tours dashboard or the
// Villas one. Checked against a list, never forwarded as typed - the value
// reaches a SQL branch upstream. Anything else means "no scope" (the old,
// unfiltered answer), which only the tests and old bookmarks ever use.
export const SCOPES = ['cue', 'villa'];
export function scopeOf(req) {
  const v = new URL(req.url).searchParams.get('scope') || '';
  return SCOPES.includes(v) ? v : '';
}
export const withScope = (path, scope) => (scope ? `${path}${path.includes('?') ? '&' : '?'}scope=${scope}` : path);
