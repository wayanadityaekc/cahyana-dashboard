'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Plus, X } from 'lucide-react';
import { FIELD_INPUT, FIELD_LABEL, FIELD_AREA } from '@/components/ui/formClasses';
import { BTN_SM } from '@/components/ui/btnClasses';
import { getJson, postJson, Unauthorized } from '@/lib/api';

// Editing the site's words.
//
// A change here is a COMMIT to the site's repo, and the site rebuilds - so it is
// a few minutes, not instant, and the panel says so rather than leaving the owner
// refreshing the site wondering. Drafts live on the server, so closing this tab
// or picking the phone up later keeps them.
//
// WHAT CAN AND CANNOT BE TYPED IS THE SERVER'S RULE, NOT THIS FILE'S. The API
// refuses a draft whose structure differs from the live file, and refuses any
// field outside its allowlist. This panel only shows the fields it knows are
// allowed - but it is the second line, not the first. Never "fix" a refusal by
// widening what the form shows; widen the allowlist in cahyana-api/content.js,
// on purpose, with a reason.
//
// TWO KINDS, TWO SMALL RENDERERS (LegalBody / TourBody), one shell. They are
// genuinely different documents - a legal page is a run of prose blocks, a tour
// is a blurb plus stops plus two lists - and a single renderer clever enough for
// both would be harder to read than either. The shell (banners, draft/publish,
// change counting) is shared, because THAT part must not drift.

const KINDS = [
  { id: 'legal', label: 'Legal' },
  { id: 'tours', label: 'Tours' },
  { id: 'experiences', label: 'Experiences' },
  { id: 'destinations', label: 'Destinations' },
  { id: 'guides', label: 'Guides' },
  { id: 'charter', label: 'Charter' },
  { id: 'transfer', label: 'Transfer' },
  { id: 'airport', label: 'Airport' },
];

// Charter, transfer and airport are ONE page each, not a map of pages, so they
// have no page picker and their field paths have no page key in front.
const SINGLE = new Set(['charter', 'transfer', 'airport']);

// Same normalisation cahyana-api/content.js does, and it has to stay the same:
// this decides which boxes appear, that decides which writes are accepted, and
// a disagreement shows up as a field the owner can type into and cannot save.
function fieldPathOf(at, single) {
  const clean = at.replace(/\[\d+\]/g, '');
  if (single) return clean;
  const i = clean.indexOf('.');
  return i === -1 ? clean : clean.slice(i + 1);
}

// "tinfo.included" -> "Included", "routes.name" -> "Name", "metaDesc" -> "Google
// description". The few that deserve a real sentence get one; the rest are
// humanised from the key, which reads well because the keys were named for
// people in the first place.
const NICE = {
  metaDesc: 'Google description (110-170 characters)',
  metaTitle: 'Google title (up to 65 characters)',
  heading: 'Page heading (the big one)',
  desc: 'Line under the title (25-40 words)',
  sub: 'Line under the title (25-40 words)',
  descHtml: 'Story',
  html: 'Paragraph',
  boxTitle: 'Form heading',
  routesNote: 'Note under the routes',
  routesTitle: 'Routes heading',
  stopsTitle: 'Section heading',
  cta: 'Button label',
};
function labelFor(key) {
  if (NICE[key]) return NICE[key];
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

// Must match EDITABLE.tours.lists in cahyana-api/content.js. Mirrored here only
// so the buttons can grey out instead of the server refusing after the fact; the
// server is what actually holds the line.
const LIST_MIN = 1;
const LIST_MAX = 20;

const WRAP = 'flex flex-col gap-[var(--space-3)]';
const TABS = 'flex gap-[0.4rem] flex-wrap mb-[var(--space-2)]';
const TAB = `inline-flex ${BTN_SM} bg-white text-gold [border:1px_solid_var(--line)] cursor-pointer hover:bg-cream`;
const TAB_ON = `inline-flex ${BTN_SM} bg-cream text-gold [border:1px_solid_var(--line)] cursor-pointer font-semibold`;
const CARD =
  'flex flex-col gap-[var(--space-2)] p-[var(--space-3)] rounded-[var(--r-md)] bg-white [border:1px_solid_var(--line)]';
const BANNER =
  'flex items-start gap-[0.5rem] p-[0.7rem_0.9rem] rounded-[var(--r-md)] font-body text-small ' +
  '[&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)] [&>svg]:shrink-0 [&>svg]:mt-[0.15rem]';
const INFO = `${BANNER} bg-cream [border:1px_solid_var(--line)] text-green`;
const WARN = `${BANNER} bg-white [border:1px_solid_var(--color-err)] text-err`;
const NOTE = 'font-body text-small text-muted m-0';
const BLOCK_LABEL = 'font-body text-label font-medium tracking-[0.14em] uppercase text-muted m-0';
const ROW = 'flex items-center gap-[var(--space-2)] flex-wrap';
const LINE = 'flex items-start gap-[0.4rem] mb-[0.4rem]';
const PRIMARY = `inline-flex ${BTN_SM} bg-cta text-white border-0 cursor-pointer hover:bg-cta-d disabled:opacity-50`;
const GHOST = `inline-flex ${BTN_SM} bg-white text-gold [border:1px_solid_var(--line)] cursor-pointer hover:bg-cream disabled:opacity-50`;
const ICON_BTN =
  'inline-flex items-center justify-center w-[2.1rem] h-[2.1rem] shrink-0 rounded-[var(--r-sm)] bg-white ' +
  '[border:1px_solid_var(--line)] text-muted cursor-pointer hover:bg-cream hover:text-gold disabled:opacity-40 ' +
  '[&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)]';
const CHANGED = '[border-color:var(--color-cta)]';

// What each block is, in words rather than in schema.
const KIND_NAME = { para: 'Paragraph', heading: 'Heading', list: 'List', crumb: 'Breadcrumb' };

export default function ContentPanel({ onExpired }) {
  const [kind, setKind] = useState('legal');
  const [data, setData] = useState(null);
  const [page, setPage] = useState('');
  const [doc, setDoc] = useState(null);      // the working copy
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState('');

  const load = useCallback(async () => {
    try {
      const j = await getJson(`/api/content?kind=${kind}`);
      setData(j);
      setDoc(j.draft || j.live);
      setPage(j.single ? '' : Object.keys(j.live || {})[0] || '');
    } catch (e) {
      if (e instanceof Unauthorized) return onExpired();
      setErr(e.message || 'Could not load the content.');
    }
    return undefined;
  }, [kind, onExpired]);

  // Switching kind throws the old document away rather than leaving last kind's
  // text on screen under this kind's heading while the fetch is in flight.
  useEffect(() => { setData(null); setDoc(null); setErr(''); setSaved(''); load(); }, [load]);

  // Which fields differ from what is live, as dotted paths - the same shape the
  // API reports, so "unpublished" means one thing on both sides. Arrays are
  // walked to the LONGER side, because a line the owner ADDED to an included
  // list has no live counterpart and would otherwise count as no change at all.
  const changed = useMemo(() => {
    if (!data || !doc) return [];
    const out = [];
    const walk = (a, b, at) => {
      if (typeof a === 'string' || typeof b === 'string') { if (a !== b) out.push(at); return; }
      if (Array.isArray(a) || Array.isArray(b)) {
        const x = Array.isArray(a) ? a : [];
        const y = Array.isArray(b) ? b : [];
        for (let i = 0; i < Math.max(x.length, y.length); i += 1) walk(x[i], y[i], `${at}[${i}]`);
        return;
      }
      if (a && typeof a === 'object') {
        for (const k of Object.keys(a)) walk(a[k], (b || {})[k], at ? `${at}.${k}` : k);
      }
    };
    walk(data.live, doc, '');
    return out;
  }, [data, doc]);

  const set = (path, value) => {
    setSaved('');
    setDoc((d) => {
      const next = JSON.parse(JSON.stringify(d));
      let node = next;
      for (let i = 0; i < path.length - 1; i += 1) node = node[path[i]];
      node[path[path.length - 1]] = value;
      return next;
    });
  };

  const send = async (action, json) => {
    setBusy(true);
    setErr('');
    try {
      const { status, json: out } = await postJson(`/api/content?kind=${kind}`, { action, json });
      if (status !== 200) { setErr(out.detail || `Server answered ${status}.`); return false; }
      return true;
    } catch (e) {
      if (e instanceof Unauthorized) { onExpired(); return false; }
      setErr(e.message || 'Could not save.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const kindTabs = (
    <div className={TABS} data-kinds>
      {KINDS.map((k) => (
        <button
          key={k.id}
          type="button"
          className={k.id === kind ? TAB_ON : TAB}
          data-kind={k.id}
          onClick={() => setKind(k.id)}
        >
          {k.label}
        </button>
      ))}
    </div>
  );

  if (!data || !doc) return <div className={WRAP}>{kindTabs}<p className={NOTE}>{err || 'Loading...'}</p></div>;

  const single = SINGLE.has(kind);
  const pages = single ? [] : Object.keys(data.live);
  const cur = single ? doc : doc[page];
  const isChanged = (at) => changed.some((c) => c === at);

  // "atv-ride.stops[0].name" -> ['atv-ride','stops',0,'name'], which is what
  // set() walks. Numbers stay numbers or the array index becomes a key.
  const toPath = (at) => (at.match(/[^.[\]]+/g) || []).map((v) => (/^\d+$/.test(v) ? Number(v) : v));
  const valueAt = (at) => toPath(at).reduce((n, k) => (n == null ? n : n[k]), doc);

  const field = (key, label, area = false, rows = 2) => {
    const at = `${page}.${key}`;
    const Tag = area ? 'textarea' : 'input';
    return (
      <span key={key}>
        <label className={FIELD_LABEL} htmlFor={`c-${key}`}>{label}</label>
        <Tag
          id={`c-${key}`}
          className={`${area ? FIELD_AREA : FIELD_INPUT} ${isChanged(at) ? CHANGED : ''}`}
          value={cur[key] ?? ''}
          rows={area ? rows : undefined}
          onChange={(e) => set([page, key], e.target.value)}
        />
      </span>
    );
  };

  // A list of plain lines the owner may add to and remove from. The only place
  // in this editor where the document can change size - see content.js for why
  // these two lists are the exception and stops are not.
  const editableList = (key, label, note) => {
    const lines = cur[key] || [];
    const replace = (next) => set([page, key], next);
    return (
      <span key={key}>
        <p className={BLOCK_LABEL}>{label}</p>
        {lines.map((line, i) => (
          <span className={LINE} key={i}>
            <textarea
              className={`${FIELD_AREA} ${isChanged(`${page}.${key}[${i}]`) ? CHANGED : ''}`}
              rows={2}
              data-line={`${key}-${i}`}
              value={line}
              onChange={(e) => replace(lines.map((v, j) => (j === i ? e.target.value : v)))}
            />
            <button
              type="button"
              className={ICON_BTN}
              data-remove={`${key}-${i}`}
              aria-label={`Remove line ${i + 1}`}
              disabled={lines.length <= LIST_MIN}
              onClick={() => replace(lines.filter((v, j) => j !== i))}
            >
              <X aria-hidden="true" />
            </button>
          </span>
        ))}
        <span className={ROW}>
          <button
            type="button"
            className={GHOST}
            data-add={key}
            disabled={lines.length >= LIST_MAX}
            onClick={() => replace([...lines, ''])}
          >
            <Plus aria-hidden="true" style={{ width: 14, height: 14, marginRight: 4 }} />
            Add a line
          </button>
          <span className={NOTE}>{note}</span>
        </span>
      </span>
    );
  };

  // ONE renderer for the six kinds that do not have a hand-made one, driven by
  // the allowlist THE SERVER SENT. Legal and tours keep their own because they
  // read better hand-arranged; everything else would need six more renderers
  // that could each drift from the rule that actually decides what saves.
  //
  // So the rule here is: if the server says a field is editable, a box appears;
  // if it does not, nothing appears. A field can never be typed into and then
  // refused, and a new editable field needs no change in this file.
  const genericCards = () => {
    const fields = data.fields || [];
    const lists = data.lists || {};
    const base = single ? '' : page;
    const editable = (at) => fields.includes(fieldPathOf(at, single));
    const leaves = [];

    const walk = (node, at) => {
      if (typeof node === 'string') {
        if (editable(at)) leaves.push({ at, type: 'text' });
        return;
      }
      if (Array.isArray(node)) {
        const key = fieldPathOf(at, single).split('.').pop();
        // A list the server lets grow, holding only lines of text, is rendered
        // as ONE add/remove block rather than N boxes.
        if (Object.prototype.hasOwnProperty.call(lists, key) && node.every((v) => typeof v === 'string') && editable(at + '[0]')) {
          leaves.push({ at, type: 'list', key });
          return;
        }
        node.forEach((v, i) => walk(v, at + '[' + i + ']'));
        return;
      }
      if (node && typeof node === 'object') {
        Object.keys(node).forEach((k) => walk(node[k], at ? at + '.' + k : k));
      }
    };
    walk(cur, base);

    // Grouped by the first part of the field path, so "routes" boxes sit
    // together rather than being one long column of unrelated fields.
    const order = [];
    const byGroup = {};
    for (const leaf of leaves) {
      const g = fieldPathOf(leaf.at, single).split('.')[0];
      if (!byGroup[g]) { byGroup[g] = []; order.push(g); }
      byGroup[g].push(leaf);
    }
    if (!order.length) return <p className={NOTE}>Nothing on this page can be edited from here.</p>;

    const leafLabel = (at) => {
      const parts = fieldPathOf(at, single).split('.');
      const idx = (at.match(/\[(\d+)\]/g) || []).map((m) => Number(m.slice(1, -1)) + 1);
      const n = idx.length ? idx.join('.') + '. ' : '';
      return n + labelFor(parts[parts.length - 1]);
    };

    const textBox = (at) => (
      <span key={at}>
        <label className={FIELD_LABEL} htmlFor={'g-' + at}>{leafLabel(at)}</label>
        <textarea
          id={'g-' + at}
          data-gfield={at}
          className={FIELD_AREA + ' ' + (isChanged(at) ? CHANGED : '')}
          rows={(valueAt(at) || '').length > 120 ? 4 : 2}
          value={valueAt(at) ?? ''}
          onChange={(e) => set(toPath(at), e.target.value)}
        />
      </span>
    );

    const listBox = (at, key) => {
      const lines = valueAt(at) || [];
      const replace = (next) => set(toPath(at), next);
      return (
        <span key={at}>
          <p className={BLOCK_LABEL}>{labelFor(key)}</p>
          {lines.map((line, i) => (
            <span className={LINE} key={i}>
              <textarea
                className={FIELD_AREA + ' ' + (isChanged(at + '[' + i + ']') ? CHANGED : '')}
                rows={2}
                data-line={key + '-' + i}
                value={line}
                onChange={(e) => replace(lines.map((v, j) => (j === i ? e.target.value : v)))}
              />
              <button
                type="button"
                className={ICON_BTN}
                data-remove={key + '-' + i}
                aria-label={'Remove line ' + (i + 1)}
                disabled={lines.length <= LIST_MIN}
                onClick={() => replace(lines.filter((v, j) => j !== i))}
              >
                <X aria-hidden="true" />
              </button>
            </span>
          ))}
          <span className={ROW}>
            <button
              type="button"
              className={GHOST}
              data-add={key}
              disabled={lines.length >= LIST_MAX}
              onClick={() => replace([...lines, ''])}
            >
              <Plus aria-hidden="true" style={{ width: 14, height: 14, marginRight: 4 }} />
              Add a line
            </button>
            <span className={NOTE}>{lines.length} lines, up to {LIST_MAX}.</span>
          </span>
        </span>
      );
    };

    return order.map((g) => (
      <div className={CARD} key={g} data-group={g}>
        <p className={BLOCK_LABEL}>{labelFor(g)}</p>
        {byGroup[g].map((leaf) => (leaf.type === 'list' ? listBox(leaf.at, leaf.key) : textBox(leaf.at)))}
      </div>
    ));
  };

  return (
    <div className={WRAP}>
      {kindTabs}

      {data.demo && (
        <p className={INFO}>
          <AlertTriangle aria-hidden="true" />
          <span>Demo: you can type here, but nothing is saved and nothing can be published.</span>
        </p>
      )}

      {data.stale && (
        <p className={WARN}>
          <AlertTriangle aria-hidden="true" />
          <span>The file changed on the site since you started editing. Reload before publishing.</span>
        </p>
      )}

      {data.deploys === false && (
        <p className={INFO} data-draftbranch>
          <AlertTriangle aria-hidden="true" />
          <span>
            Publishing saves to <strong>{data.branch}</strong>, not to the live site.
            Nothing reaches the site until you review and merge it.
            {data.compareUrl && (
              <>
                {' '}
                <a href={data.compareUrl} target="_blank" rel="noopener" className="text-gold" data-compare>
                  review the changes <ExternalLink aria-hidden="true" style={{ display: 'inline', width: 12, height: 12 }} />
                </a>
              </>
            )}
          </span>
        </p>
      )}

      {data.build && (
        <p className={INFO}>
          {data.build.state === 'success' ? <CheckCircle2 aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
          <span>
            {data.build.state === 'awaiting-merge' ? (
              <>Last publish: <strong>saved to the draft branch</strong> - waiting for you to merge it.</>
            ) : (
              <>
                Last publish: <strong>{data.build.state}</strong>
                {data.build.state === 'success' ? ' - the site has it.' : ' - the site is still on the previous text.'}
              </>
            )}
            {data.build.url && (
              <>
                {' '}
                <a href={data.build.url} target="_blank" rel="noopener" className="text-gold">
                  {data.build.state === 'awaiting-merge' ? 'review the diff' : 'build log'} <ExternalLink aria-hidden="true" style={{ display: 'inline', width: 12, height: 12 }} />
                </a>
              </>
            )}
          </span>
        </p>
      )}

      {/* Three legal pages fit on a row of tabs; seventeen tours do not, and a
          row that wraps to four lines is worse than a list. */}
      {single ? null : pages.length > 6 ? (
        <span>
          <label className={FIELD_LABEL} htmlFor="c-page">Which page</label>
          <select
            id="c-page"
            className={FIELD_INPUT}
            data-pagepick
            value={page}
            onChange={(e) => setPage(e.target.value)}
          >
            {pages.map((p) => <option key={p} value={p}>{data.live[p].title || p}</option>)}
          </select>
        </span>
      ) : (
        <div className={TABS}>
          {pages.map((p) => (
            <button key={p} type="button" className={p === page ? TAB_ON : TAB} data-page={p} onClick={() => setPage(p)}>
              {data.live[p].title}
            </button>
          ))}
        </div>
      )}

      {!cur ? <p className={NOTE}>Nothing to edit.</p> : (kind !== 'legal' && kind !== 'tours') ? genericCards() : kind === 'tours' ? (
        <>
          <div className={CARD}>
            {/* The tour's NAME is not here on purpose: the breadcrumb, the
                listing card, the review key and the JSON-LD all read it, and
                the pricing catalog is looked up by `bookItem`. The API refuses
                both - this just does not offer them. */}
            <p className={NOTE}>
              Editing <strong>{cur.title}</strong>. The tour name and its price are set elsewhere.
            </p>
            {field('desc', 'Line under the title on the tour page (25-40 words)', true, 3)}
            {field('metaDesc', 'Google description (110-170 characters)', true)}
            <p className={NOTE}>{(cur.metaDesc || '').length} characters.</p>
          </div>

          <div className={CARD}>
            <p className={BLOCK_LABEL}>What you&apos;ll do</p>
            {(cur.items || []).map((it, i) => (
              <span key={i}>
                <label className={FIELD_LABEL} htmlFor={`c-stop-${i}`}>{it.num || `Stop ${i + 1}`}</label>
                <input
                  id={`c-stop-${i}`}
                  className={`${FIELD_INPUT} ${isChanged(`${page}.items[${i}].name`) ? CHANGED : ''} mb-[0.4rem]`}
                  data-stopname={String(i)}
                  value={it.name ?? ''}
                  onChange={(e) => set([page, 'items', i, 'name'], e.target.value)}
                />
                <textarea
                  className={`${FIELD_AREA} ${isChanged(`${page}.items[${i}].highlight`) ? CHANGED : ''}`}
                  rows={3}
                  data-stoptext={String(i)}
                  value={it.highlight ?? ''}
                  onChange={(e) => set([page, 'items', i, 'highlight'], e.target.value)}
                />
              </span>
            ))}
            <p className={NOTE}>
              Stops can be reworded here. Adding or removing one changes the photos and the
              programme too, so that is still a job for the repo.
            </p>
          </div>

          <div className={CARD}>
            {editableList('included', "What's included", `${(cur.included || []).length} lines, up to ${LIST_MAX}.`)}
          </div>
          <div className={CARD}>
            {editableList('excluded', 'Not included', `${(cur.excluded || []).length} lines, up to ${LIST_MAX}.`)}
          </div>
        </>
      ) : (
        <>
          <div className={CARD}>
            {field('title', 'Page title')}
            {field('text', 'Short line under the title', true)}
            {field('metaDesc', 'Google description (110-170 characters)', true)}
            <p className={NOTE}>{(cur.metaDesc || '').length} characters.</p>
          </div>

          <div className={CARD}>
            {(cur.body || []).map((b, i) => {
              if (b.type === 'crumb') return null;    // navigation, not words
              if (b.type === 'list') {
                return (
                  <span key={i}>
                    <p className={BLOCK_LABEL}>{KIND_NAME.list}</p>
                    {(b.items || []).map((item, j) => (
                      <textarea
                        key={j}
                        className={`${FIELD_AREA} ${isChanged(`${page}.body[${i}].items[${j}]`) ? CHANGED : ''} mb-[0.4rem]`}
                        rows={2}
                        data-block={`${i}-${j}`}
                        value={item}
                        onChange={(e) => set([page, 'body', i, 'items', j], e.target.value)}
                      />
                    ))}
                  </span>
                );
              }
              return (
                <span key={i}>
                  <p className={BLOCK_LABEL}>{KIND_NAME[b.type] || b.type}</p>
                  <textarea
                    className={`${FIELD_AREA} ${isChanged(`${page}.body[${i}].html`) ? CHANGED : ''}`}
                    rows={b.type === 'heading' ? 1 : 4}
                    data-block={String(i)}
                    value={b.html ?? ''}
                    onChange={(e) => set([page, 'body', i, 'html'], e.target.value)}
                  />
                </span>
              );
            })}
          </div>
        </>
      )}

      {err && <p className={WARN}><AlertTriangle aria-hidden="true" /><span>{err}</span></p>}
      {saved && <p className={INFO}><CheckCircle2 aria-hidden="true" /><span>{saved}</span></p>}

      <div className={ROW}>
        <button
          type="button"
          className={GHOST}
          disabled={busy || !changed.length}
          data-savedraft
          onClick={async () => { if (await send('draft', doc)) { setSaved('Saved. Not on the site yet.'); load(); } }}
        >
          Save draft
        </button>
        <button
          type="button"
          className={PRIMARY}
          disabled={busy || !changed.length}
          data-publish
          onClick={async () => {
            if (!(await send('draft', doc))) return;
            if (await send('publish')) {
              setSaved(data.deploys === false
                ? `Saved to ${data.branch}. Review and merge it to put it on the site.`
                : 'Publishing. The site rebuilds in about three minutes.');
              load();
            }
          }}
        >
          Publish{changed.length ? ` (${changed.length})` : ''}
        </button>
        {(changed.length > 0 || data.draft) && (
          <button
            type="button"
            className={GHOST}
            disabled={busy}
            data-discard
            onClick={async () => { if (await send('discard')) { setDoc(data.live); setSaved('Draft thrown away.'); load(); } }}
          >
            Discard
          </button>
        )}
        <span className={NOTE} data-count>
          {changed.length ? `${changed.length} unpublished change${changed.length > 1 ? 's' : ''}` : 'No changes'}
        </span>
      </div>
    </div>
  );
}
