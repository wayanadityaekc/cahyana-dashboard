// Sample data for the public demo login. Nothing here has ever been a real
// guest: the names are placeholders, the phone numbers are the reserved
// "no real subscriber" ranges, and the email domain is example.com, which
// exists precisely so documentation can use it.
//
// Dates are built RELATIVE to today, so the demo never drifts into a state
// where every trip is in the past and the Upcoming tab reads empty.

const DAY = 86400000;

function baliToday(now) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Makassar',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

const iso = (now, offsetDays) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(now.getTime() + offsetDays * DAY));

const at = (now, offsetDays) => new Date(now.getTime() + offsetDays * DAY).toISOString();

export function demoBookings(now = new Date()) {
  const today = baliToday(now);

  // Paid, two days, one booking_ref - the case the grouping exists for.
  const twoDay = {
    ref: 'DEMO-004', id: 4004,
    name: 'Sample Guest (Amelia R.)', phone: '+61 400 000 000',
    email: 'amelia@example.com', guests: 2, referral: null,
    status: 'paid', createdAt: at(now, -3),
    payment: { option: 'deposit', currency: 'USD', amountDisplay: 10, status: 'paid' },
    lines: [
      { dayNo: 1, type: 'tour', service: 'Ubud Tour', date: iso(now, 4), time: '08:30',
        pickup: 'Ubud', dropoff: null, flightNumber: null, flightDatetime: null,
        items: 'Tegalalang, Tirta Empul, Tegenungan', priceUsd: 40, priceIdr: 700000 },
      { dayNo: 2, type: 'tour', service: 'East Bali Tour', date: iso(now, 5), time: '03:00',
        pickup: 'Ubud', dropoff: null, flightNumber: null, flightDatetime: null,
        items: 'Lempuyang, Besakih, Tirta Gangga', priceUsd: 62, priceIdr: 1080000 },
    ],
    firstDate: iso(now, 4), lastDate: iso(now, 5),
  };

  const airport = {
    ref: 'DEMO-005', id: 4005,
    name: 'Sample Guest (Tom H.)', phone: '+44 7700 900000',
    email: 'tom@example.com', guests: 3, referral: null,
    status: 'new', createdAt: at(now, -1),
    payment: null,
    lines: [
      { dayNo: 1, type: 'transfer', service: 'Airport - Ubud', date: iso(now, 2), time: '14:35',
        pickup: 'Ngurah Rai Airport', dropoff: 'Ubud', flightNumber: 'GA 845',
        flightDatetime: `${iso(now, 2)}T14:35`, items: null, priceUsd: 26, priceIdr: 450000 },
    ],
    firstDate: iso(now, 2), lastDate: iso(now, 2),
    serverTotal: { usd: 26, idr: 450000 },
  };

  const charter = {
    ref: 'DEMO-003', id: 4003,
    name: 'Sample Guest (Priya N.)', phone: '+61 400 000 001',
    email: 'priya@example.com', guests: 4, referral: 'DEMOCODE',
    status: 'paid', createdAt: at(now, -12),
    payment: { option: 'full', currency: 'IDR', amountDisplay: 1120000, status: 'paid' },
    lines: [
      { dayNo: 1, type: 'charter', service: 'Charter 12 Hours', date: iso(now, -6), time: '07:00',
        pickup: 'Canggu', dropoff: null, flightNumber: null, flightDatetime: null,
        items: null, priceUsd: 64, priceIdr: 1120000 },
    ],
    firstDate: iso(now, -6), lastDate: iso(now, -6),
  };

  const past = {
    ref: 'DEMO-002', id: 4002,
    name: 'Sample Guest (Marco L.)', phone: '+39 350 000 0000',
    email: 'marco@example.com', guests: 2, referral: null,
    status: 'new', createdAt: at(now, -30),
    payment: null,
    lines: [
      { dayNo: 1, type: 'place', service: 'Mount Batur Trekking', date: iso(now, -21), time: '02:00',
        pickup: 'Ubud', dropoff: null, flightNumber: null, flightDatetime: null,
        items: null, priceUsd: 74, priceIdr: 1300000 },
    ],
    firstDate: iso(now, -21), lastDate: iso(now, -21),
    serverTotal: { usd: 74, idr: 1300000 },
  };

  // The two states the owner is meant to act on. A payment that started and
  // never finished, and money that arrived at the wrong amount.
  const stuck = {
    ref: 'DEMO-006', id: 4006,
    name: 'Sample Guest (Dana K.)', phone: '+1 555 0100',
    email: 'dana@example.com', guests: 2, referral: null,
    status: 'pending', createdAt: at(now, -0.2),
    payment: { option: 'deposit', currency: 'USD', amountDisplay: 10, status: 'pending' },
    lines: [
      { dayNo: 1, type: 'tour', service: 'Ubud Culture Day', date: iso(now, 9), time: '09:00',
        pickup: 'Seminyak', dropoff: null, flightNumber: null, flightDatetime: null,
        items: null, priceUsd: 49, priceIdr: 850000 },
    ],
    firstDate: iso(now, 9), lastDate: iso(now, 9),
    why: 'Payment started over 60 min ago and never completed.',
  };

  const mismatch = {
    ref: 'DEMO-001', id: 4001,
    name: 'Sample Guest (Rui S.)', phone: '+351 910 000 000',
    email: 'rui@example.com', guests: 5, referral: null,
    status: 'mismatch', createdAt: at(now, -2),
    payment: { option: 'full', currency: 'USD', amountDisplay: 132, status: 'mismatch' },
    lines: [
      { dayNo: 1, type: 'tour', service: 'Ulun Danu Beratan & Handara Gate Instagram Tour',
        date: iso(now, 14), time: '08:00', pickup: 'Canggu', dropoff: null,
        flightNumber: null, flightDatetime: null, items: null, priceUsd: 66, priceIdr: 1150000 },
    ],
    firstDate: iso(now, 14), lastDate: iso(now, 14),
    why: 'Money arrived but the amount did not match - never auto-retried, needs a human.',
  };

  const undated = {
    ref: 'DEMO-007', id: 4007,
    name: 'Sample Guest (Yuki T.)', phone: '+81 90 0000 0000',
    email: 'yuki@example.com', guests: 2, referral: null,
    status: 'new', createdAt: at(now, -5),
    payment: null,
    lines: [
      { dayNo: 1, type: 'tour', service: 'Ubud Tour', date: null, time: null,
        pickup: 'Ubud', dropoff: null, flightNumber: null, flightDatetime: null,
        items: null, priceUsd: 40, priceIdr: 700000 },
    ],
    firstDate: null, lastDate: null,
    serverTotal: { usd: 40, idr: 700000 },
  };

  return {
    today,
    attention: [mismatch, stuck],
    upcoming: [airport, twoDay],   // soonest first, the way splitWindows sorts it
    past: [charter, past],
    undated: [undated],
  };
}


// A small slice of the real catalogue shape, enough to show the panel working.
// IDR is the source of truth; USD is derived the same way the server derives it.
export const DEMO_RATE = 17600;
const deriveUsd = (idr) => Math.ceil(idr / DEMO_RATE);

const DEMO_BASE = [
  ['tour', 'Ubud Tour', 700000],
  ['tour', 'Ubud Culture Day', 850000],
  ['tour', 'East Bali Tour', 1080000],
  ['tour', 'Jatiluwih Tour', 1050000],
  ['place', 'Tegenungan Waterfall', 600000],
  ['place', 'Lempuyang Temple - Gates of Heaven', 1000000],
  ['place', 'Uluwatu Temple', 900000],
  ['performance', 'Kecak Dance', 150000],
  ['transfer', 'Airport - Ubud', 450000],
  ['transfer', 'Canggu - Ubud', 400000],
];

export function demoPrices(overrides = {}) {
  const items = DEMO_BASE.map(([category, name, baseIdr]) => {
    const over = Object.prototype.hasOwnProperty.call(overrides, name) ? overrides[name] : null;
    const idr = over == null ? baseIdr : over;
    return { name, category, baseIdr, overrideIdr: over, idr, usd: deriveUsd(idr) };
  }).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  const drift = items
    .filter((r) => r.overrideIdr != null && r.overrideIdr !== r.baseIdr)
    .map((r) => ({ name: r.name, wasIdr: r.baseIdr, nowIdr: r.idr, wasUsd: deriveUsd(r.baseIdr), nowUsd: r.usd }));

  return { status: 'ok', rate: DEMO_RATE, items, drift };
}

export function demoBaseIdr(name) {
  const row = DEMO_BASE.find(([, n]) => n === name);
  return row ? row[2] : null;
}

// ---- demo chat ----------------------------------------------------------
// Two conversations a real owner would recognise: one waiting for an answer,
// one already handled. Both are made up, and both are the kind of question the
// site's support panel hands over rather than answers - a situation, not a
// price lookup.
const DEMO_THREADS = [
  {
    id: 901,
    guest_name: 'Sample Guest (Hannah W.)',
    guest_email: 'hannah@example.com',
    page: '/mount-batur-trekking.html',
    status: 'open',
    minutesAgo: 14,
    messages: [
      ['guest', 'my mother is 71 and walks fine on flat ground but not much uphill. is the batur sunrise trek realistic for her, or is there something with the same view and less climbing?'],
    ],
  },
  {
    id: 902,
    guest_name: 'Sample Guest (Diego M.)',
    guest_email: 'diego@example.com',
    page: '/airport-transfer.html',
    status: 'open',
    minutesAgo: 190,
    messages: [
      ['guest', 'we land at 01:40 and there are four of us with two big cases and a surfboard. does that still fit one car?'],
      ['owner', 'A surfboard does not fit with four people and two large cases. I would send the van for that one - same price to Ubud, more room. Send me your flight number and I will set it up.'],
      ['guest', 'perfect, GA 845. thank you'],
    ],
  },
];

function stamp(now, minutesAgo) {
  return new Date(now.getTime() - minutesAgo * 60000).toISOString();
}

// `patch` holds the demo visitor's own replies, keyed by thread id.
export function demoChats(patch = {}, now = new Date()) {
  const threads = DEMO_THREADS.map((t) => {
    const extra = patch[t.id] || [];
    const all = [...t.messages.map(([sender, body]) => ({ sender, body })), ...extra];
    const last = all[all.length - 1];
    const lastAt = extra.length ? now.toISOString() : stamp(now, t.minutesAgo);
    return {
      id: t.id,
      public_id: `demo${t.id}`,
      guest_name: t.guest_name,
      guest_email: t.guest_email,
      page: t.page,
      status: t.status,
      created_at: stamp(now, t.minutesAgo + 5),
      last_message_at: lastAt,
      owner_seen_at: null,
      last_body: last.body,
      last_sender: last.sender,
      // Unread means "a guest message you have not answered". Once the demo
      // visitor replies, it clears - the same thing the real one does.
      unread: last.sender === 'guest' && !extra.length ? 1 : 0,
    };
  });
  threads.sort((a, b) => String(b.last_message_at).localeCompare(String(a.last_message_at)));
  return { status: 'ok', threads };
}

export function demoThread(id, patch = {}, now = new Date()) {
  const t = DEMO_THREADS.find((x) => String(x.id) === String(id));
  if (!t) return null;
  const extra = patch[t.id] || [];
  const base = t.messages.map(([sender, body], i) => ({
    id: t.id * 100 + i, sender, body, created_at: stamp(now, t.minutesAgo + (t.messages.length - i)),
  }));
  const mine = extra.map((m, i) => ({
    id: t.id * 100 + base.length + i, sender: m.sender || 'owner', body: m.body, created_at: m.created_at,
  }));
  return {
    id: t.id, public_id: `demo${t.id}`, guest_name: t.guest_name, guest_email: t.guest_email,
    page: t.page, status: t.status, created_at: stamp(now, t.minutesAgo + 5),
    last_message_at: (mine[mine.length - 1] || base[base.length - 1]).created_at,
    messages: [...base, ...mine],
  };
}

export function demoThreadExists(id) {
  return DEMO_THREADS.some((x) => String(x.id) === String(id));
}
