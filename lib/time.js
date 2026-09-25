// Time and date labels, copied from CUE (content/shared/timeSlots.js) rather
// than shared: this repo stands on its own. Same rule as the design tokens -
// change one and you change both, on purpose, in the same commit.

// 12-hour, because that is how every time on the site and in the emails reads.
// The stored value stays 24-hour ("14:35") - that is what sorts correctly and
// what the server holds.
export function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function fmtDate(v) {
  if (!v) return '';
  const d = new Date(`${String(v).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
