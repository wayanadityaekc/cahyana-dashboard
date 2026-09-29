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

// A small stand-in for the legal pages so the demo can show the editor without
// touching the real repo. Two pages, a few blocks - enough to see how it works.
// The demo fixture, per kind. It never reaches the API and it cannot publish.
// The six kinds the generic renderer draws. Each carries the SAME fields/lists
// the API sends for it, because what the demo teaches has to be what the live
// panel does - a demo with a friendlier rule than the server is a demo that
// lies about which boxes exist.
const ATTRACTION_FIELDS = [
  'heading', 'desc', 'metaTitle', 'metaDesc', 'cta', 'stopsTitle',
  'stops.name', 'stops.descHtml', 'stops.alt',
  'hooks.value', 'facts.value', 'heroSlides.title',
  'included', 'excluded',
];
const LISTS_INC = { included: [1, 20], excluded: [1, 20] };

const DEMO_KINDS = {
  experiences: {
    label: 'Experience pages',
    path: 'content/attractions/attractions.json',
    fields: ATTRACTION_FIELDS,
    lists: LISTS_INC,
    live: {
      'atv-ride': {
        type: 'experience',
        title: 'ATV Quad Bike Ride',
        bookItem: 'ATV Ride',
        heading: 'ATV Quad Bike Ride: Jungle Tracks, a River Crossing and a Cave Tunnel',
        desc: 'A two-hour quad bike ride through jungle tracks, working rice fields, a shallow river crossing and a hand-carved cave tunnel near Ubud.',
        metaTitle: 'ATV Quad Bike Ride Ubud | Jungle Tracks and Cave Tunnel',
        metaDesc: 'Ride a quad bike through jungle tracks and a cave tunnel near Ubud. No licence needed, gear and briefing included.',
        cta: 'Book this program',
        stopsTitle: 'Quad Biking Through Ubud\u2019s Countryside',
        hooks: [{ label: 'Duration', value: '~2 hours riding' }, { label: 'Area', value: 'Ubud' }],
        stops: [{ img: 'atv.webp', w: 1200, name: 'The jungle track', descHtml: 'Mud, and plenty of it.', alt: 'A quad bike splashing through a muddy track' }],
        included: ['Gear, helmet and briefing', 'Guide riding with you'],
        excluded: ['Meals and drinks'],
      },
    },
  },
  destinations: {
    label: 'Destination pages',
    path: 'content/attractions/attractions.json',
    fields: ATTRACTION_FIELDS,
    lists: LISTS_INC,
    live: {
      'monkey-forest': {
        type: 'destination',
        title: 'Monkey Forest',
        bookItem: 'Monkey Forest',
        heading: 'Sacred Monkey Forest Sanctuary: Temples Under the Canopy',
        desc: 'Three temples and around 1,200 long-tailed macaques in a patch of jungle in the middle of Ubud.',
        metaTitle: 'Sacred Monkey Forest Ubud | Temples and Macaques',
        metaDesc: 'Visit the Sacred Monkey Forest in Ubud: three temples, mossy stone and around 1,200 macaques.',
        cta: 'Book this program',
        stopsTitle: 'Inside the Sanctuary',
        hooks: [{ label: 'Time here', value: '~1 hour' }],
        stops: [{ img: 'monkey.webp', w: 1200, name: 'The main temple', descHtml: 'Moss, stone and banyan roots.', alt: 'A mossy temple gate in the Monkey Forest' }],
        included: ['Entrance ticket'],
        excluded: ['Food to feed the monkeys'],
      },
    },
  },
  guides: {
    label: 'Guide articles',
    path: 'content/guides/guides.json',
    fields: ['heading', 'sub', 'metaTitle', 'metaDesc', 'body.html'],
    lists: {},
    live: {
      ubud: {
        title: 'Ubud',
        heading: 'Ubud: Rice Terraces, Temples and the Monkey Forest',
        sub: 'What the town is actually like, what sits within half an hour of it, and when to go where.',
        metaTitle: 'Ubud Travel Guide | What to Do and Where to Stay',
        metaDesc: 'A plain guide to Ubud: what the town is like, what is worth the trip, and how long things take.',
        tags: ['About the Island'],
        body: [
          { type: 'crumb', html: '<a href="/bali-guide.html">Bali Guide</a> &rsaquo; About the Island' },
          { type: 'para', html: 'Ubud sits in the uplands, about an hour and a half from the airport.' },
          { type: 'para', html: 'The town itself is walkable; most of what people come for is a short drive out.' },
        ],
      },
    },
  },
  charter: {
    label: 'Charter page',
    path: 'content/shared/charter.json',
    single: true,
    fields: [
      'title', 'sub', 'boxTitle', 'metaTitle', 'metaDesc',
      'durations.name', 'durations.sub', 'durations.badge',
      'info.html', 'info.items.title', 'info.items.paras', 'info.items.list',
      'info.items.stack.title', 'info.items.stack.paras',
    ],
    lists: { list: [1, 20], paras: [1, 12] },
    live: {
      title: 'Private Car Charter in Bali',
      sub: 'Your own car and local driver for the day. You choose the route, your driver knows the roads.',
      boxId: 'charter',
      boxTitle: 'Build your charter',
      metaTitle: 'Private Car Charter Bali | Half and Full Day',
      metaDesc: 'Charter a private car with driver in Bali from Ubud: five, ten or twelve hours, petrol included.',
      durations: [
        { dur: 'full', badge: 'Popular', name: 'Full Day', sub: '10 hours \u00b7 around 120 km \u00b7 per car up to 5' },
        { dur: 'half', name: 'Half Day', sub: '5 hours \u00b7 around 60 km \u00b7 per car up to 5' },
      ],
      info: [{ type: 'boxes', items: [
        { title: 'What\u2019s included', variant: 'yes', list: ['Private car and fuel', 'English-speaking driver'] },
        { title: 'Not included', variant: 'no', list: ['Meals and drinks', 'Entrance tickets'] },
      ] }],
    },
  },
  transfer: {
    label: 'Transfer page',
    path: 'content/shared/transfer.json',
    single: true,
    fields: [
      'title', 'desc', 'routesTitle', 'routesNote', 'metaTitle', 'metaDesc',
      'routes.name', 'routes.meta',
      'tinfo.facts.value', 'tinfo.included', 'tinfo.excluded',
    ],
    lists: LISTS_INC,
    live: {
      title: 'Private Car Transfers in Bali',
      desc: 'Fixed price per car, professional local drivers, door to door.',
      routesTitle: 'Popular routes',
      routesNote: 'All prices per car \u00b7 max 5 passengers',
      metaTitle: 'Bali Private Car Transfers | Ubud to Canggu, Kuta, Amed',
      metaDesc: 'Fixed price private car transfers between Ubud and Canggu, Seminyak, Kuta, Kintamani and Amed.',
      routes: [
        { key: 'Canggu Area', bg: 'canggu.webp', name: 'Canggu \u2192 Ubud', meta: '~1.25 hrs \u00b7 per car', priceName: 'Canggu Area \u2013 Ubud', priceFallback: '$25' },
        { key: 'Amed Area', bg: 'amed.webp', name: 'Amed \u2192 Ubud', meta: '~2.5 hrs \u00b7 per car', priceName: 'Amed Area \u2013 Ubud', priceFallback: '$40' },
      ],
      tinfo: {
        facts: [{ label: 'Availability', value: '24 / 7' }, { label: 'Capacity', value: 'Up to 5 pax' }],
        included: ['Private air-conditioned car and fuel', 'Professional English-speaking driver'],
        excluded: ['Meals and drinks'],
      },
    },
  },
  airport: {
    label: 'Airport transfer page',
    path: 'content/shared/airport.json',
    single: true,
    fields: [
      'title', 'sub', 'boxTitle', 'metaTitle', 'metaDesc',
      'info.items.title', 'info.items.paras',
      'tinfo.facts.value', 'tinfo.included', 'tinfo.excluded',
    ],
    lists: LISTS_INC,
    live: {
      title: 'Bali Airport Transfer',
      sub: 'Private car to or from Ngurah Rai Airport (DPS), fixed price. Add your flight number and time.',
      boxId: 'airport-transfer',
      boxTitle: 'Book Your Airport Transfer',
      metaTitle: 'Bali Airport Transfer to Ubud | Private Car, Fixed Price',
      metaDesc: 'Private car between Ngurah Rai airport and Ubud at a fixed price per car, with flight tracking.',
      info: [{ type: 'boxes', items: [
        { title: 'Why we ask for flight details', paras: ['Delays happen, and your flight number lets your driver track the actual landing time.'] },
        { title: 'How it works', paras: ['Fill in the direction, date and guests, then your address and flight details.'] },
      ] }],
      tinfo: {
        facts: [{ label: 'Availability', value: '24 / 7' }, { label: 'Meet & greet', value: 'Meet & greet at arrivals' }],
        included: ['Meet and greet with a name board', 'Flight tracking'],
        excluded: ['Meals and drinks'],
      },
    },
  },
};

export function demoContent(kind = 'legal') {
  if (kind === 'tours') return demoTours();
  const k = DEMO_KINDS[kind];
  if (k) {
    return {
      status: 'ok',
      kind,
      label: k.label,
      path: k.path,
      sha: 'demo',
      branch: 'main',
      base: 'main',
      deploys: true,
      compareUrl: null,
      fields: k.fields,
      lists: k.lists || {},
      single: !!k.single,
      live: JSON.parse(JSON.stringify(k.live)),
      draft: null,
      changed: [],
      stale: false,
      lastPublish: null,
      build: null,
      demo: true,
    };
  }
  const live = {
    'terms-conditions': {
      heroClass: 'subhero subhero--overlap',
      title: 'Terms & Conditions',
      text: 'The simple ground rules for booking and travelling with us.',
      metaTitle: 'Terms &amp; Conditions | Cahyana Ubud Experience',
      metaDesc: 'The terms for booking tours, transfers and experiences with Cahyana Ubud Experience in Ubud, Bali.',
      body: [
        { type: 'para', html: 'These Terms &amp; Conditions apply to every booking made with Cahyana Ubud Experience.' },
        { type: 'heading', html: '1. Who we are' },
        { type: 'para', html: 'Cahyana Ubud Experience is a local travel service based in Ubud, Bali.' },
      ],
    },
    'cancellation-policy': {
      heroClass: 'subhero subhero--overlap',
      title: 'Cancellation Policy',
      text: 'Free cancellation up to 24 hours before pick-up.',
      metaTitle: 'Cancellation Policy | Cahyana Ubud Experience',
      metaDesc: 'How to cancel or change a booking with Cahyana Ubud Experience, and what happens to your deposit.',
      body: [
        { type: 'para', html: 'You can cancel free of charge up to <strong>24 hours</strong> before your pick-up time.' },
        { type: 'heading', html: 'Deposits' },
        { type: 'para', html: 'The $10 deposit is not refunded if you cancel inside 24 hours.' },
      ],
    },
  };
  return {
    status: 'ok',
    kind: 'legal',
    label: 'Legal pages',
    path: 'content/shared/legal.json',
    sha: 'demo',
    branch: 'main',
    base: 'main',
    deploys: true,
    compareUrl: null,
    live,
    draft: null,
    changed: [],
    stale: false,
    lastPublish: null,
    build: null,
    demo: true,
  };
}

// One tour, with the two lists the owner may add to and the fields they may not
// touch (bookItem is the pricing catalog key) so the demo shows both.
// Six more, thin on purpose. The picker turns from a row of tabs into a list
// once there are more than six pages, and in production there are seventeen
// tours - so a one-entry fixture would leave the branch the owner actually sees
// completely untested. They repeat one body because a fixture that repeats
// itself is obviously a fixture; the names are our real tours.
const MORE = [
  'Mount Batur Sunrise Trekking',
  'East Bali: Lempuyang, Besakih & Tirta Gangga',
  'Ubud Culture Day',
  'Nusa Penida Day Trip',
  'Jatiluwih & Tanah Lot Sunset Tour',
  'Ubud ATV Adventure',
];

function demoTours() {
  const extra = {};
  MORE.forEach((title, i) => {
    extra[`demo-tour-${i}`] = {
      title,
      bookItem: title,
      desc: 'Demo entry, so the page list behaves the way it does on the real site.',
      metaDesc: 'Demo entry. The real text for this tour lives on the site and is edited the same way.',
      items: [{ type: 'stop', refId: 'demo', img: 'demo.jpg', num: 'Stop 1', name: 'First stop', highlight: 'Demo text.' }],
      included: ['Private air-conditioned car and fuel', 'Friendly English-speaking driver'],
      excluded: ['Meals and drinks'],
    };
  });
  return {
    status: 'ok',
    kind: 'tours',
    label: 'Tour details',
    path: 'content/tours/tours.json',
    sha: 'demo',
    branch: 'main',
    base: 'main',
    deploys: true,
    compareUrl: null,
    live: {
      'ubud-tour': {
        title: 'Ubud Highlights Tour',
        bookItem: 'Ubud Tour',
        desc: 'Rice terraces, a water temple and a waterfall in one unhurried day, at your own pace.',
        metaDesc: 'Private Ubud tour with your own driver. Rice terraces, Tirta Empul and Tegenungan. Only a $10 deposit to book.',
        items: [
          {
            type: 'stop',
            refId: 'tegalalang-rice-terrace',
            img: 'tegalalang-rice-terrace-hero.jpg',
            num: 'Stop 1',
            name: 'Tegalalang Rice Terrace & Coffee Plantation',
            highlight: 'The stepped rice fields north of Ubud, still watered by the thousand-year-old subak system. Tastings at the coffee plantation next door are free.',
          },
          {
            type: 'stop',
            refId: 'tirta-empul',
            img: 'tirta-empul-hero.jpg',
            num: 'Stop 2',
            name: 'Tirta Empul Water Temple',
            highlight: 'A spring-fed bathing temple where Balinese families still come to pray. Bring a change of clothes if you want to join the ritual.',
          },
        ],
        included: [
          'Private air-conditioned car and fuel',
          'Friendly English-speaking driver',
          'Hotel or villa pick-up and drop-off',
        ],
        excluded: ['Entrance tickets to attractions', 'Meals and drinks'],
      },
      ...extra,
    },
    draft: null,
    changed: [],
    stale: false,
    lastPublish: null,
    build: null,
    demo: true,
  };
}


// Sample reviews for the demo. Deliberately includes one that a person would
// actually want to take down, because a moderation screen with nothing worth
// moderating does not show what it is for.
export function demoReviews(status = '') {
  const all = [
      { id: 101, booking_ref: 'CUE-041', name: 'Ben', country: 'GB', service: 'Ubud Tour', rating: 1,
        message: 'Not about the tour at all - buy cheap followers at example.com',
        status: 'approved', source: 'cahyana', created_at: '2026-09-24T09:12:00Z' },
      { id: 102, booking_ref: 'CUE-039', name: 'Anna', country: 'AU', service: 'Ubud Tour', rating: 5,
        message: 'Wayan picked us up on time and let us set the pace. The coffee plantation stop was a highlight.',
        status: 'approved', source: 'cahyana', created_at: '2026-09-21T02:40:00Z' },
      { id: 103, booking_ref: 'CUE-036', name: 'Cara', country: 'US', service: 'Mount Batur Trekking', rating: 4,
        message: 'Cold at the summit and the 2am start is real, but worth it. Bring a jacket.',
        status: 'approved', source: 'cahyana', created_at: '2026-09-15T21:05:00Z' },
    { id: 104, booking_ref: 'CUE-030', name: 'Dee', country: 'SG', service: 'Kecak Dance', rating: 2,
      message: 'Left a phone number and full address in here by mistake.',
      status: 'hidden', source: 'cahyana', created_at: '2026-09-02T11:30:00Z' },
  ];
  const counts = {};
  for (const r of all) counts[r.status] = (counts[r.status] || 0) + 1;
  // The filter is honoured here too. A demo that ignores it would show every
  // review under the "Hidden" tab, which teaches the screen wrong.
  return {
    status: 'ok',
    demo: true,
    counts,
    reviews: status ? all.filter((r) => r.status === status) : all,
  };
}

// ---- demo Search Console --------------------------------------------------
// Same shape as GET /api/admin/gsc. Made up, deterministic (no Math.random, so
// a reload shows the same chart), and never sent to or read from Google.
const DEMO_QUERIES = [
  ['ubud tour', 41, 980, 7.2], ['bali private driver', 22, 1430, 12.8],
  ['ubud private tour', 19, 610, 6.1], ['bali airport transfer to ubud', 17, 720, 9.4],
  ['tegenungan waterfall', 11, 1650, 15.3], ['kecak dance ubud', 9, 540, 11.1],
  ['mount batur sunrise trek', 8, 1210, 18.6], ['bali car charter', 6, 380, 10.2],
];
const DEMO_PAGES = [
  ['/ubud-tour.html', 58, 1540, 7.9], ['/airport-transfer.html', 31, 1120, 9.6],
  ['/', 27, 2210, 13.4], ['/charter.html', 14, 690, 11.8],
  ['/attractions/tegenungan-waterfall.html', 12, 1720, 15.1], ['/guide/ubud.html', 9, 940, 17.2],
];

export function demoSearch(days = 28, now = new Date()) {
  const iso = (d) => d.toISOString().slice(0, 10);
  const end = new Date(now); end.setUTCDate(end.getUTCDate() - 3);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - (days - 1));
  const prevEnd = new Date(start); prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
  const prevStart = new Date(prevEnd); prevStart.setUTCDate(prevStart.getUTCDate() - (days - 1));
  const daily = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start); d.setUTCDate(d.getUTCDate() + i);
    const wave = 1 + 0.25 * Math.sin(i / 2.2) + i / (days * 3);
    const impressions = Math.round(180 * wave);
    const clicks = Math.round(impressions * (0.028 + 0.006 * Math.cos(i / 3)));
    daily.push({ date: iso(d), clicks, impressions, ctr: +(clicks / impressions).toFixed(4), position: +(12.5 - i / (days * 0.8)).toFixed(1) });
  }
  const sum = (k) => daily.reduce((n, r) => n + r[k], 0);
  const clicks = sum('clicks');
  const impressions = sum('impressions');
  const row = ([key, c, i, p]) => {
    const f = days / 28;
    const cc = Math.max(1, Math.round(c * f)); const ii = Math.round(i * f);
    return { key, clicks: cc, impressions: ii, ctr: +(cc / ii).toFixed(4), position: p };
  };
  return {
    status: 'ok',
    demo: true,
    site: 'sc-domain:cahyanaubudexperience.com',
    account: 'demo@example.iam.gserviceaccount.com',
    range: { start: iso(start), end: iso(end), days },
    prevRange: { start: iso(prevStart), end: iso(prevEnd) },
    totals: { clicks, impressions, ctr: +(clicks / impressions).toFixed(4), position: 11.4 },
    prevTotals: { clicks: Math.round(clicks * 0.82), impressions: Math.round(impressions * 0.9), ctr: +((clicks * 0.82) / (impressions * 0.9)).toFixed(4), position: 12.9 },
    daily,
    queries: DEMO_QUERIES.map(row),
    pages: DEMO_PAGES.map((p) => ({ ...row(p), path: p[0] })),
    countries: [['aus', 62, 2100, 10.3], ['usa', 31, 1900, 13.8], ['gbr', 24, 1100, 11.9], ['idn', 19, 1600, 9.2], ['nld', 8, 420, 12.4]].map(row),
    devices: [['MOBILE', 118, 5400, 11.9], ['DESKTOP', 29, 1500, 10.1], ['TABLET', 3, 160, 12.7]].map(row),
    sitemaps: [{ path: 'https://cahyanaubudexperience.com/sitemap.xml', lastSubmitted: iso(prevEnd) + 'T00:00:00Z', lastDownloaded: iso(end) + 'T00:00:00Z', isPending: false, errors: 0, warnings: 0, submitted: 89 }],
    sitemapsError: '',
    fetchedAt: now.toISOString(),
    cached: false,
  };
}
