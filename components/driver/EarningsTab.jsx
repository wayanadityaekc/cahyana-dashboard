'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CARD, STACK, HEAD, NOTE, ERR, EMPTY, rupiah, dayLabel } from '@/components/ui/panelClasses';
import { getJson, Unauthorized } from '@/lib/api';

// Earnings (DASHBOARD BRIEF #7): per month, as a chart, not just a number.
//
// The figure is the FULL program price of every job (Wayan, Q1: no cut for
// now). A job still assigned to this driver whose date has passed counts as
// EARNED; one still ahead is SCHEDULED. Both come from cahyana-api - this page
// only draws them.
//
// Drawn by hand in SVG rather than pulling in a chart library: twelve bars do
// not need 100 KB. Shape follows shadcn's bar chart (rounded tops, hairline
// grid, a tooltip on hover/tap) in the site's colours:
//   earned    = --color-cta (the brand green)
//   scheduled = a lighter step of the same green, stacked on top with a 2px
//               white gap. Same hue on purpose: it is the same money, later.
// Identity never rides on colour alone - there is a legend, the tooltip names
// both, and the month list below is the table view of every bar.

const EARNED = 'var(--color-cta)';
const SCHEDULED = '#a9bfae';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = (ym, long = false) => {
  const [y, m] = ym.split('-').map(Number);
  return long ? `${MONTHS[m - 1]} ${y}` : MONTHS[m - 1];
};

const STATS = 'grid grid-cols-3 max-[560px]:grid-cols-1 gap-[var(--space-2)]';
const STAT = 'p-[0.8rem_0.9rem] rounded-[var(--r-md)] bg-white [border:1px_solid_var(--line)]';
const STAT_K = 'block font-body text-label font-medium tracking-[0.08em] uppercase text-muted';
const STAT_V = 'block font-body text-h2 font-semibold text-green tabular-nums mt-[0.2rem]';
const KEY = 'inline-flex items-center gap-[0.4rem] font-body text-small text-muted';
const SW = 'inline-block w-[10px] h-[10px] rounded-[3px]';
const TIP =
  'absolute z-10 pointer-events-none -translate-x-1/2 px-[0.65rem] py-[0.45rem] rounded-[var(--r-sm)] bg-white ' +
  '[border:1px_solid_var(--line)] font-body text-small text-green whitespace-nowrap';
const ROW = 'flex items-baseline gap-[0.5rem] py-[0.45rem] font-body text-body text-green [&+&]:[border-top:1px_solid_var(--line)]';

// Clean y ticks: a round step (1 / 2 / 2.5 / 5 x 10^n), four of them at most,
// so the labels read 500rb / 1jt / 1,5jt - never 667rb.
function niceStep(max) {
  const raw = Math.max(max, 1) / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p;
  return 10 * p;
}
const shortRp = (n) => (n >= 1e6 ? `${String(+(n / 1e6).toFixed(2)).replace('.', ',')}jt` : n >= 1e3 ? `${Math.round(n / 1e3)}rb` : `${n}`);

// A bar with a 4px rounded top and a square base.
function topRounded(x, y, w, h, r = 4) {
  if (h <= 0) return '';
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

function Chart({ months }) {
  const box = useRef(null);
  const [w, setW] = useState(600);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const H = 220, PADL = 44, PADB = 24, PADT = 10;
  const step = niceStep(Math.max(...months.map((m) => m.earned + m.scheduled)));
  const top = step * Math.max(1, Math.ceil(Math.max(...months.map((m) => m.earned + m.scheduled)) / step));
  const plotW = Math.max(w - PADL - 4, 100), plotH = H - PADB - PADT;
  const band = plotW / months.length;
  const bw = Math.min(24, band * 0.6);
  const y = (v) => PADT + plotH - (v / top) * plotH;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  return (
    <div ref={box} className="relative" data-earnings-chart>
      <svg width={w} height={H} role="img" aria-label="Earnings per month, last 12 months" className="block overflow-visible">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PADL} x2={PADL + plotW} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={PADL - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize="10.5" fill="var(--color-muted)" fontFamily="var(--font-body)">{shortRp(t)}</text>
          </g>
        ))}
        {months.map((m, i) => {
          const cx = PADL + band * i + band / 2;
          const x = cx - bw / 2;
          const he = (m.earned / top) * plotH;
          const hs = (m.scheduled / top) * plotH;
          const base = PADT + plotH;
          const gap = he > 0 && hs > 0 ? 2 : 0;
          return (
            <g key={m.month}>
              {/* earned: square base; rounded top only when nothing sits on it */}
              {he > 0 && (hs > 0
                ? <rect x={x} y={base - he} width={bw} height={he} fill={EARNED} data-bar-earned={m.month} />
                : <path d={topRounded(x, base - he, bw, he)} fill={EARNED} data-bar-earned={m.month} />)}
              {hs > 0 && <path d={topRounded(x, base - he - gap - hs, bw, hs)} fill={SCHEDULED} data-bar-scheduled={m.month} />}
              <text x={cx} y={H - 6} textAnchor="middle" fontSize="10.5" fill={hover === i ? 'var(--color-green)' : 'var(--color-muted)'} fontFamily="var(--font-body)">{monthName(m.month)}</text>
              {/* hit target: the whole column, bigger than the bar */}
              <rect
                x={PADL + band * i} y={PADT} width={band} height={plotH + PADB} fill="transparent"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(hover === i ? null : i)}
                data-bar-hit={m.month}
              />
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div className={TIP} style={{ left: PADL + band * hover + band / 2, top: Math.max(0, y(months[hover].earned + months[hover].scheduled) - 64) }} role="status" data-chart-tip>
          <b className="block">{monthName(months[hover].month, true)}</b>
          <span className="flex items-center gap-[0.35rem]"><i className={SW} style={{ background: EARNED }} />Earned {rupiah(months[hover].earned)}</span>
          {months[hover].scheduled > 0 && <span className="flex items-center gap-[0.35rem]"><i className={SW} style={{ background: SCHEDULED }} />Scheduled {rupiah(months[hover].scheduled)}</span>}
        </div>
      )}
    </div>
  );
}

export default function EarningsTab({ onExpired }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    (async () => {
      try { setData(await getJson('/api/driver/earnings')); }
      catch (e) { if (e instanceof Unauthorized) onExpired(); else setErr(e.message || 'Could not load earnings.'); }
    })();
  }, [onExpired]);

  const sums = useMemo(() => {
    if (!data) return null;
    const ms = data.months || [];
    const now = ms[ms.length - 1] || { earned: 0, scheduled: 0 };
    return { month: now, year: ms.reduce((s, m) => s + m.earned, 0) };
  }, [data]);

  if (err) return <p className={ERR} role="alert">{err}</p>;
  if (!data) return <p className={EMPTY}>Loading earnings...</p>;

  const months = data.months || [];
  const any = months.some((m) => m.earned + m.scheduled > 0);

  return (
    <div className={`${STACK} max-w-[760px]`} data-earnings>
      <div className={STATS}>
        <div className={STAT}><span className={STAT_K}>Earned this month</span><span className={STAT_V} data-stat-month>{rupiah(sums.month.earned)}</span></div>
        <div className={STAT}><span className={STAT_K}>Still to drive this month</span><span className={STAT_V}>{rupiah(sums.month.scheduled)}</span></div>
        <div className={STAT}><span className={STAT_K}>Earned, last 12 months</span><span className={STAT_V} data-stat-year>{rupiah(sums.year)}</span></div>
      </div>

      <section className={CARD} aria-labelledby="earn-chart">
        <div className="flex flex-wrap items-center gap-x-[var(--space-2)] gap-y-[0.3rem]">
          <h2 id="earn-chart" className={HEAD}>Per month</h2>
          <span className={`${KEY} ml-auto`}><i className={SW} style={{ background: EARNED }} />Earned</span>
          <span className={KEY}><i className={SW} style={{ background: SCHEDULED }} />Scheduled</span>
        </div>
        {any ? <Chart months={months} /> : <p className={NOTE}>No jobs in the last 12 months yet.</p>}
        <p className={NOTE}>Full program price of each job, in rupiah. A job counts as earned once its date has passed.</p>
      </section>

      <section className={CARD} aria-labelledby="earn-list">
        <h2 id="earn-list" className={HEAD}>Month by month</h2>
        <div>
          {[...months].reverse().filter((m) => m.jobs.length).map((m) => (
            <div key={m.month}>
              <button
                type="button"
                className={`${ROW} w-full bg-transparent border-none p-0 cursor-pointer text-left`}
                aria-expanded={open === m.month}
                onClick={() => setOpen(open === m.month ? null : m.month)}
                data-month-row={m.month}
              >
                <span className="font-semibold">{monthName(m.month, true)}</span>
                <span className="text-muted text-small">{m.jobs.length} job{m.jobs.length === 1 ? '' : 's'}</span>
                <span className="ml-auto tabular-nums">{rupiah(m.earned + m.scheduled)}</span>
              </button>
              {open === m.month && (
                <ul className="list-none m-0 p-0 pl-[var(--space-2)] pb-[0.4rem]">
                  {m.jobs.map((j) => (
                    <li key={j.id} className="flex gap-[0.5rem] py-[0.25rem] font-body text-small text-green">
                      <span className="whitespace-nowrap">{dayLabel(j.date)}</span>
                      <span className="flex-1 min-w-0">{j.service}{j.done ? '' : ' (scheduled)'}</span>
                      <span className="tabular-nums">{rupiah(j.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {!any && <p className={NOTE}>Nothing yet.</p>}
        </div>
      </section>
    </div>
  );
}
