'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ExternalLink, MousePointerClick, Eye, Percent, ListOrdered, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { BTN_SM } from '@/components/ui/btnClasses';
import { Unauthorized } from '@/lib/api';

// How the site does in Google search, read from Search Console.
//
// Every number here comes from GET /api/admin/gsc (cahyana-api/gsc.js), which
// logs in as a service account and asks Search Console directly. Nothing is
// computed here except the change against the previous period, and that is
// two numbers Google already gave us.
//
// ONE chart, ONE axis. The four tiles pick which measure it draws. Clicks and
// impressions differ by ~30x and position runs the other way (lower is better),
// so drawing them together would need two scales - which is how a chart starts
// lying. Search Console itself does it with a second axis; this does not.

const SITE = 'https://cahyanaubudexperience.com';
const PERIODS = [
  { days: 7, label: '7 days' },
  { days: 28, label: '28 days' },
  { days: 90, label: '3 months' },
];

const METRICS = [
  { id: 'clicks', label: 'Clicks', Icon: MousePointerClick, fmt: (v) => int(v), foot: 'Visits from Google search.' },
  { id: 'impressions', label: 'Impressions', Icon: Eye, fmt: (v) => int(v), foot: 'Times the site showed in results.' },
  { id: 'ctr', label: 'Click rate', Icon: Percent, fmt: (v) => pct(v), foot: 'Clicks out of impressions.' },
  // Lower is better: position 1 is the top of the page. The tile says so,
  // because a number going DOWN reading as good is not obvious.
  { id: 'position', label: 'Avg. position', Icon: ListOrdered, fmt: (v) => (v == null ? '-' : v.toFixed(1)), foot: 'Lower is better - 1 is the top.', lowerIsBetter: true },
];

const int = (v) => Number(v || 0).toLocaleString('en-US');
const pct = (v) => `${(Number(v || 0) * 100).toFixed(1)}%`;
const day = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

// Search Console answers countries in ISO alpha-3. Intl names alpha-2 only, so
// the common ones are mapped; anything else shows its code rather than a guess.
const A3 = {
  aus: 'AU', usa: 'US', gbr: 'GB', idn: 'ID', nld: 'NL', deu: 'DE', fra: 'FR', sgp: 'SG', nzl: 'NZ',
  can: 'CA', che: 'CH', jpn: 'JP', mys: 'MY', hkg: 'HK', ind: 'IN', chn: 'CN', kor: 'KR', ita: 'IT',
  esp: 'ES', bel: 'BE', swe: 'SE', nor: 'NO', dnk: 'DK', irl: 'IE', aut: 'AT', pol: 'PL', rus: 'RU',
  are: 'AE', sau: 'SA', tha: 'TH', phl: 'PH', vnm: 'VN', twn: 'TW', bra: 'BR', mex: 'MX', isr: 'IL', prt: 'PT',
};
let regionNames = null;
function country(code) {
  const a2 = A3[String(code || '').toLowerCase()];
  if (!a2) return String(code || '').toUpperCase();
  try {
    regionNames = regionNames || new Intl.DisplayNames(['en'], { type: 'region' });
    return regionNames.of(a2);
  } catch { return a2; }
}
const DEVICE = { MOBILE: 'Phone', DESKTOP: 'Desktop', TABLET: 'Tablet' };

// ---- classes ----------------------------------------------------------------
const TOOLS = 'flex items-center gap-[var(--space-2)] mb-[var(--space-2)] flex-wrap';
const SEG = 'inline-flex p-[3px] rounded-[var(--r-md)] bg-cream [border:1px_solid_var(--line)]';
const SEG_BTN =
  `inline-flex ${BTN_SM} px-3 border-0 cursor-pointer bg-transparent text-muted ` +
  'aria-[checked=true]:bg-white aria-[checked=true]:text-gold aria-[checked=true]:[box-shadow:inset_0_0_0_1px_var(--line)]';
const GHOST =
  `inline-flex ${BTN_SM} gap-[0.4rem] bg-white text-gold [border:1px_solid_var(--line)] cursor-pointer hover:bg-cream ` +
  '[&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)]';
const META = 'font-body text-small text-muted m-0 mb-[var(--space-3)]';
const NOTE = 'font-body text-small text-muted m-0';
const BANNER =
  'flex items-start gap-[0.5rem] p-[0.7rem_0.9rem] mb-[var(--space-3)] rounded-[var(--r-md)] ' +
  'bg-cream [border:1px_solid_var(--line)] font-body text-small text-green ' +
  '[&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)] [&>svg]:shrink-0 [&>svg]:mt-[0.15rem]';

// Tile anatomy is StatCards' (label, loud number, meaning under it), so the two
// rows of numbers in this app read as one system. These tiles are also the
// chart's metric picker, so they are buttons.
const SHELL = '@container/cards mb-[var(--space-2)]';
const GRID = 'grid grid-cols-2 gap-[var(--space-2)] @[56rem]/cards:grid-cols-4';
const TILE =
  '@container/card text-left p-[1.1rem] rounded-[var(--r-md)] bg-white cursor-pointer ' +
  '[border:1px_solid_var(--line)] flex flex-col font-body ' +
  'aria-[pressed=true]:[border-color:var(--color-cta)] aria-[pressed=true]:[box-shadow:inset_0_0_0_1px_var(--color-cta)]';
const LABEL = 'text-small text-muted m-0 flex items-center gap-[0.4rem] [&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)]';
const VALUE = 'font-semibold text-gold tabular-nums leading-none mt-[0.55rem] text-[1.5rem] @[13rem]/card:text-[1.9rem]';
const FOOT = 'text-small text-muted m-0 mt-[0.5rem]';
const BADGE =
  'inline-flex items-center gap-[0.25rem] px-[0.45rem] py-[0.12rem] rounded-sm ' +
  'text-label font-semibold tracking-[0.04em] tabular-nums [&>svg]:w-[0.7rem] [&>svg]:h-[0.7rem]';

const CARD = 'p-[var(--space-2)] rounded-[var(--r-md)] bg-white [border:1px_solid_var(--line)] mb-[var(--space-2)]';
const H2 = 'font-body font-semibold text-h3 text-gold m-0 mb-[0.6rem] flex items-center gap-[0.5rem]';
const TWO = 'grid grid-cols-1 min-[1100px]:grid-cols-2 gap-[var(--space-2)]';
const TABLE = 'w-full border-collapse font-body text-small text-green';
const TH = 'text-left font-medium text-muted py-[0.45rem] px-[0.4rem] [border-bottom:1px_solid_var(--line)] whitespace-nowrap';
const THN = `${TH} text-right`;
const TD = 'py-[0.45rem] px-[0.4rem] [border-bottom:1px_solid_var(--line)] align-top break-words';
const TDN = `${TD} text-right tabular-nums whitespace-nowrap`;
const MORE = 'mt-[0.6rem] bg-transparent border-0 p-0 cursor-pointer font-body text-small text-gold underline';

// ---- data -------------------------------------------------------------------

async function fetchReport(days, refresh) {
  const res = await fetch(`/api/search?days=${days}${refresh ? '&refresh=1' : ''}`, { credentials: 'same-origin' });
  if (res.status === 401) throw new Unauthorized('Session expired.');
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(j.detail || `Server answered ${res.status}.`);
    e.hint = j.hint || '';
    e.notConnected = res.status === 503;
    throw e;
  }
  return j;
}

// ---- pieces -----------------------------------------------------------------

function Delta({ now, before, lowerIsBetter }) {
  if (now == null || before == null) return null;
  if (!before) return now ? <span className={`${BADGE} bg-cream text-muted`}>new</span> : null;
  // Position moves in PLACES, not percent: "11.4 -> 9.9" is "1.5 places up",
  // and "-13%" of a rank means nothing to anyone.
  const change = lowerIsBetter ? now - before : (now - before) / before;
  if (Math.abs(change) < (lowerIsBetter ? 0.05 : 0.005)) return <span className={`${BADGE} bg-cream text-muted`}>no change</span>;
  const up = change > 0;
  const good = lowerIsBetter ? !up : up;
  const Arrow = up ? TrendingUp : TrendingDown;
  return (
    <span className={`${BADGE} ${good ? 'bg-[rgba(46,125,84,0.12)] text-ok' : 'bg-[rgba(154,74,63,0.1)] text-err'}`}>
      <Arrow strokeWidth={2.2} aria-hidden="true" />
      {lowerIsBetter ? `${up ? '+' : ''}${change.toFixed(1)}` : `${up ? '+' : ''}${Math.round(change * 100)}%`}
    </span>
  );
}

// Single series, one axis, inline SVG (no chart library in this app - it has
// four dependencies and a line does not need a fifth). Hover = crosshair plus
// a tooltip naming the day and the value; the hit area is the whole column.
function TrendChart({ daily, metric }) {
  const m = METRICS.find((x) => x.id === metric);
  const box = useRef(null);
  const [w, setW] = useState(640);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    if (!box.current) return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  const H = 220;
  const PAD = { l: 44, r: 12, t: 12, b: 26 };
  const pts = daily.map((d) => d[metric]);
  const vals = pts.filter((v) => v != null);
  let lo = m.lowerIsBetter ? Math.max(1, Math.floor(Math.min(...vals, 1))) : 0;
  let hi = vals.length ? Math.max(...vals) : 1;
  if (m.lowerIsBetter) hi = Math.ceil(hi);
  if (hi === lo) hi = lo + 1;
  const iw = w - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const x = (i) => PAD.l + (daily.length === 1 ? iw / 2 : (i / (daily.length - 1)) * iw);
  // Position is drawn inverted, top = rank 1, so "up" means better on all four.
  const y = (v) => (m.lowerIsBetter
    ? PAD.t + ((v - lo) / (hi - lo)) * ih
    : PAD.t + ih - ((v - lo) / (hi - lo)) * ih);

  // A day with no data breaks the line rather than being joined across.
  const segs = [];
  let cur = [];
  pts.forEach((v, i) => {
    if (v == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push([x(i), y(v)]);
  });
  if (cur.length) segs.push(cur);
  const line = segs.map((s) => `M${s.map((p) => p.map((n) => n.toFixed(1)).join(',')).join('L')}`).join('');
  const area = m.lowerIsBetter ? '' : segs.filter((s) => s.length > 1)
    .map((s) => `M${s[0][0].toFixed(1)},${(PAD.t + ih).toFixed(1)}L${s.map((p) => p.map((n) => n.toFixed(1)).join(',')).join('L')}L${s[s.length - 1][0].toFixed(1)},${(PAD.t + ih).toFixed(1)}Z`)
    .join('');

  const ticks = [0, 0.5, 1].map((t) => lo + (hi - lo) * t);
  const every = Math.max(1, Math.ceil(daily.length / Math.max(2, Math.floor(iw / 70))));

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * w;
    const i = Math.round(((px - PAD.l) / iw) * (daily.length - 1));
    setHover(i >= 0 && i < daily.length ? i : null);
  };

  const hv = hover != null ? daily[hover] : null;

  return (
    <div ref={box} className="relative" data-gsc-chart>
      <svg
        width="100%" height={H} viewBox={`0 0 ${w} ${H}`} role="img"
        aria-label={`${m.label} per day, ${daily[0]?.date} to ${daily[daily.length - 1]?.date}`}
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}
        className="block font-body"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={w - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="var(--color-muted)">
              {metric === 'ctr' ? pct(t) : metric === 'position' ? t.toFixed(0) : int(Math.round(t))}
            </text>
          </g>
        ))}
        {daily.map((d, i) => (i % every === 0 || i === daily.length - 1) && (i === daily.length - 1 || daily.length - 1 - i >= every / 2) ? (
          <text key={d.date} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === daily.length - 1 ? 'end' : 'middle'} fontSize="10.5" fill="var(--color-muted)">{day(d.date)}</text>
        ) : null)}
        {area && <path d={area} fill="var(--color-cta)" opacity="0.08" />}
        <path d={line} fill="none" stroke="var(--color-cta)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hv && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--color-muted)" strokeWidth="1" strokeDasharray="3 3" />
            {hv[metric] != null && (
              <circle cx={x(hover)} cy={y(hv[metric])} r="4.5" fill="var(--color-cta)" stroke="#fff" strokeWidth="2" />
            )}
          </g>
        )}
      </svg>
      {hv && (
        <div
          className="absolute top-0 pointer-events-none px-[0.6rem] py-[0.4rem] rounded-sm bg-white [border:1px_solid_var(--line)] font-body text-small text-green whitespace-nowrap [box-shadow:0_4px_14px_rgba(0,0,0,0.08)]"
          style={{ left: Math.min(Math.max(x(hover) - 60, 0), w - 140) }}
          role="status"
        >
          <span className="text-muted">{day(hv.date)}</span>
          {' · '}
          <strong className="text-gold tabular-nums">{hv[metric] == null ? 'no data' : m.fmt(hv[metric])}</strong>
          {' '}{m.label.toLowerCase()}
        </div>
      )}
    </div>
  );
}

function Table({ title, rows, first, render, limit = 10, empty }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, limit);
  return (
    <section className={CARD}>
      <h2 className={H2}>{title}</h2>
      {rows.length === 0 ? <p className={NOTE}>{empty}</p> : (
        <div className="overflow-x-auto">
          <table className={TABLE}>
            <thead>
              <tr>
                <th className={TH} scope="col">{first}</th>
                <th className={THN} scope="col">Clicks</th>
                <th className={THN} scope="col">Impr.</th>
                <th className={THN} scope="col">CTR</th>
                <th className={THN} scope="col">Pos.</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.key}>
                  <td className={TD}>{render ? render(r) : r.key}</td>
                  <td className={TDN}>{int(r.clicks)}</td>
                  <td className={TDN}>{int(r.impressions)}</td>
                  <td className={TDN}>{pct(r.ctr)}</td>
                  <td className={TDN}>{r.position == null ? '-' : r.position.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > limit && (
        <button type="button" className={MORE} onClick={() => setAll((v) => !v)}>
          {all ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      )}
    </section>
  );
}

// ---- the panel --------------------------------------------------------------

export default function SearchPanel({ onExpired }) {
  const [days, setDays] = useState(28);
  const [metric, setMetric] = useState('clicks');
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (refresh = false) => {
    setBusy(true);
    setErr(null);
    try {
      setData(await fetchReport(days, refresh));
    } catch (e) {
      if (e instanceof Unauthorized) return onExpired();
      setErr(e);
    } finally {
      setBusy(false);
    }
  }, [days, onExpired]);

  useEffect(() => { load(false); }, [load]);

  const range = data?.range;
  const stale = data && data.range?.days !== days;

  const metaLine = useMemo(() => {
    if (!data) return '';
    const bits = [
      data.site,
      `${day(data.range.start)} - ${day(data.range.end)}, vs the ${data.range.days} days before`,
    ];
    return bits.join(' · ');
  }, [data]);

  return (
    <div data-gsc>
      <div className={TOOLS}>
        <div className={SEG} role="radiogroup" aria-label="Period">
          {PERIODS.map((p) => (
            <button
              key={p.days} type="button" role="radio" aria-checked={days === p.days}
              className={SEG_BTN} onClick={() => setDays(p.days)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button type="button" className={GHOST} onClick={() => load(true)} disabled={busy}>
          <RefreshCw strokeWidth={1.7} aria-hidden="true" />
          {busy ? 'Loading' : 'Refresh'}
        </button>
      </div>

      {err && (
        <div className={BANNER} role="alert">
          <AlertTriangle strokeWidth={1.7} aria-hidden="true" />
          <span>
            <strong>{err.notConnected ? 'Not connected yet.' : 'Could not read Search Console.'}</strong>{' '}
            {err.message}
            {err.hint && <><br />{err.hint}</>}
          </span>
        </div>
      )}

      {!data && !err && <p className={NOTE}>Loading Search Console...</p>}

      {data && (
        <div className={stale || busy ? 'opacity-60 [transition:opacity_var(--dur)_var(--ease)]' : ''}>
          <p className={META}>
            {metaLine}.{' '}
            Google&apos;s data runs about 3 days behind, so the window ends on {day(range.end)}.
            {data.cached && ' Saved copy from the last hour - Refresh to ask Google again.'}
          </p>

          <div className={SHELL}><div className={GRID}>
            {METRICS.map((m) => {
              const v = data.totals[m.id];
              return (
                <button
                  key={m.id} type="button" className={TILE} aria-pressed={metric === m.id}
                  onClick={() => setMetric(m.id)} data-gsc-tile={m.id}
                >
                  <span className={LABEL}><m.Icon strokeWidth={1.7} aria-hidden="true" />{m.label}</span>
                  <span className="flex items-baseline gap-[0.5rem] flex-wrap">
                    <span className={VALUE}>{m.fmt(v)}</span>
                    <Delta now={v} before={data.prevTotals[m.id]} lowerIsBetter={m.lowerIsBetter} />
                  </span>
                  <span className={FOOT}>
                    {m.foot} Before: {m.fmt(data.prevTotals[m.id])}.
                  </span>
                </button>
              );
            })}
          </div></div>

          <section className={CARD}>
            <h2 className={H2}>{METRICS.find((m) => m.id === metric).label} per day</h2>
            <TrendChart daily={data.daily} metric={metric} />
          </section>

          <div className={TWO}>
            <Table title="Top searches" first="Query" rows={data.queries}
              empty="No searches yet in this period. Google hides very rare queries for privacy." />
            <Table title="Top pages" first="Page" rows={data.pages}
              empty="No page had a click or impression in this period."
              render={(r) => (
                <a href={r.key} target="_blank" rel="noreferrer" className="text-green no-underline hover:underline inline-flex items-center gap-[0.3rem] [&>svg]:w-[0.8rem] [&>svg]:h-[0.8rem] [&>svg]:shrink-0">
                  {r.path || r.key.replace(SITE, '') || '/'}
                  <ExternalLink strokeWidth={1.7} aria-hidden="true" />
                </a>
              )} />
            <Table title="Countries" first="Country" rows={data.countries} render={(r) => country(r.key)}
              empty="No country data in this period." />
            <Table title="Devices" first="Device" rows={data.devices} render={(r) => DEVICE[r.key] || r.key}
              empty="No device data in this period." />
          </div>

          <section className={CARD}>
            <h2 className={H2}>Sitemaps</h2>
            {data.sitemapsError ? (
              <p className={NOTE}>Could not read sitemaps: {data.sitemapsError}</p>
            ) : !data.sitemaps || data.sitemaps.length === 0 ? (
              <p className={NOTE}>
                No sitemap submitted yet. In Search Console: Sitemaps, add <strong>{SITE}/sitemap.xml</strong>.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className={TABLE}>
                  <thead>
                    <tr>
                      <th className={TH} scope="col">Sitemap</th>
                      <th className={THN} scope="col">URLs</th>
                      <th className={THN} scope="col">Last read</th>
                      <th className={THN} scope="col">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sitemaps.map((s) => (
                      <tr key={s.path}>
                        <td className={TD}>{s.path.replace(SITE, '')}{s.isPending && <span className="text-muted"> (pending)</span>}</td>
                        <td className={TDN}>{int(s.submitted)}</td>
                        <td className={TDN}>{s.lastDownloaded ? day(s.lastDownloaded.slice(0, 10)) : 'not yet'}</td>
                        <td className={`${TDN} ${s.errors ? 'text-err' : ''}`}>
                          {s.errors || s.warnings ? `${s.errors} errors, ${s.warnings} warnings` : 'none'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
