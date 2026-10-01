import { fmtTime } from '@/lib/time';

// One booking, the way a booking actually exists: `inquiries` holds one row per
// day, so a three-day trip is three rows sharing a booking_ref. The API groups
// them; this draws the group.

const CARD =
  'p-[1.1rem] rounded-[var(--r-md)] bg-white [border:1px_solid_var(--line)] mb-[var(--space-2)]';
const HEAD = 'flex items-baseline flex-wrap gap-x-[0.6rem] gap-y-[0.3rem] mb-[0.55rem]';
const REF = 'font-body text-h3 font-semibold text-gold m-0';
const WHO = 'font-body text-body text-green m-0';
const META = 'font-body text-small text-muted m-0 mt-[0.15rem]';
const LINE =
  'flex items-baseline flex-wrap gap-x-[0.5rem] gap-y-[0.15rem] py-[0.45rem] ' +
  '[&:not(:last-child)]:[border-bottom:1px_solid_var(--line)]';
const WHEN = 'font-body text-small font-semibold text-green whitespace-nowrap';
const WHAT = 'font-body text-body text-green';
const NOTE = 'font-body text-small text-muted';
const FOOT = 'mt-[0.6rem] pt-[0.6rem] [border-top:1px_solid_var(--line)] font-body text-body text-green';
const WHY = 'mt-[0.55rem] font-body text-small text-err m-0';

const PILL =
  'inline-flex items-center px-[0.5rem] py-[0.15rem] rounded-sm font-body text-label ' +
  'font-semibold tracking-[0.06em] uppercase';
// Colour says what the status MEANS for the owner, not what it is called:
// money in or nothing owed = calm, money in flight = warm, money wrong = red.
const PILL_TONE = {
  paid: 'bg-cream text-ok [border:1px_solid_var(--color-ok)]',
  new: 'bg-cream text-ok [border:1px_solid_var(--color-ok)]',
  pending: 'bg-cream text-gold [border:1px_solid_var(--line)]',
  mismatch: 'bg-cream text-err [border:1px_solid_var(--color-err)]',
  unresolved: 'bg-cream text-err [border:1px_solid_var(--color-err)]',
  test: 'bg-cream text-muted [border:1px_solid_var(--line)]',
};
// "new" is the database's word for a booking that was never charged online -
// most of them, and all of them from before online payment existed. On screen
// it has to say what it means, or it reads like something still to be done.
const STATUS_WORD = { new: 'Confirmed' };

function day(d) {
  if (!d) return null;
  // The API hands back YYYY-MM-DD. Parsing it with `new Date` would apply the
  // browser's timezone and can show the day before.
  const [y, m, dd] = String(d).slice(0, 10).split('-');
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1];
  return month ? `${Number(dd)} ${month} ${y}` : String(d);
}

function money(g) {
  if (g.payment) {
    const { currency, amountDisplay, option, status } = g.payment;
    if (amountDisplay == null) return null;
    const amount = `${currency || ''} ${amountDisplay.toLocaleString('en-US')}`.trim();
    const what = option === 'deposit' ? 'deposit' : option === 'referral' ? 'with referral' : 'in full';
    return { amount, note: `${what}${status ? ` - ${status}` : ''}` };
  }
  if (g.serverTotal) {
    const t = g.serverTotal;
    const amount = t.usd ? `USD ${t.usd.toLocaleString('en-US')}` : `IDR ${Number(t.idr).toLocaleString('en-US')}`;
    // Never dress this up as money received. Nothing was charged online, so this
    // is our own price for the trip and nothing more.
    return { amount, note: 'our price - not charged online' };
  }
  return null;
}

export default function BookingCard({ g }) {
  const total = money(g);
  const tone = PILL_TONE[g.status] || PILL_TONE.test;

  return (
    <article className={CARD}>
      <div className={HEAD}>
        <h3 className={REF}>{g.ref || `#${g.id}`}</h3>
        <span className={`${PILL} ${tone}`}>{STATUS_WORD[g.status] || g.status}</span>
      </div>

      <p className={WHO}>
        {g.name || 'No name'}
        {g.guests ? ` - ${g.guests} guest${g.guests > 1 ? 's' : ''}` : ''}
      </p>
      <p className={META}>
        {[g.phone, g.email].filter(Boolean).join('  |  ') || 'No contact details'}
        {g.referral ? `  |  ref ${g.referral}` : ''}
      </p>

      <div className="mt-[0.7rem]">
        {g.lines.map((l, i) => (
          <div key={i} className={LINE}>
            <span className={WHEN}>
              {day(l.date) || 'No date'}
              {l.time ? ` - ${fmtTime(l.time)}` : ''}
            </span>
            <span className={WHAT}>{l.service || l.type || 'Unnamed item'}</span>
            {l.pickup && <span className={NOTE}>from {l.pickup}</span>}
            {l.dropoff && <span className={NOTE}>to {l.dropoff}</span>}
            {l.flightNumber && <span className={NOTE}>flight {l.flightNumber}</span>}
            {/* Brief #7: who drives it, and whether they said yes. */}
            {l.driver && (
              <span className={NOTE} data-line-driver>
                driver {l.driver.name || '?'}{l.driver.status === 'accepted' ? ' (accepted)' : ' (waiting)'}
              </span>
            )}
          </div>
        ))}
      </div>

      {total && (
        <p className={FOOT}>
          <strong>{total.amount}</strong> <span className={NOTE}>{total.note}</span>
        </p>
      )}

      {g.why && <p className={WHY}>{g.why}</p>}
    </article>
  );
}
