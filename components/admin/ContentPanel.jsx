'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';
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
// The editor only ever retypes what is already there: the API refuses a draft
// whose structure differs from the live file. That is why there is no "add a
// paragraph" button - adding one is a change to the page, not to its words, and
// it needs a different (and more careful) piece of work.

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
const PRIMARY = `inline-flex ${BTN_SM} bg-cta text-white border-0 cursor-pointer hover:bg-cta-d disabled:opacity-50`;
const GHOST = `inline-flex ${BTN_SM} bg-white text-gold [border:1px_solid_var(--line)] cursor-pointer hover:bg-cream`;
const CHANGED = '[border-color:var(--color-cta)]';

// What each block is, in words rather than in schema.
const KIND = { para: 'Paragraph', heading: 'Heading', list: 'List', crumb: 'Breadcrumb' };

export default function ContentPanel({ onExpired }) {
  const [data, setData] = useState(null);
  const [page, setPage] = useState('');
  const [doc, setDoc] = useState(null);      // the working copy
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState('');

  const load = useCallback(async () => {
    try {
      const j = await getJson('/api/content?kind=legal');
      setData(j);
      setDoc(j.draft || j.live);
      setPage((p) => p || Object.keys(j.live || {})[0] || '');
    } catch (e) {
      if (e instanceof Unauthorized) return onExpired();
      setErr(e.message || 'Could not load the content.');
    }
    return undefined;
  }, [onExpired]);

  useEffect(() => { load(); }, [load]);

  // Which fields differ from what is live, as dotted paths - the same shape the
  // API reports, so "unpublished" means one thing on both sides.
  const changed = useMemo(() => {
    if (!data || !doc) return [];
    const out = [];
    const walk = (a, b, at) => {
      if (typeof a === 'string') { if (a !== b) out.push(at); return; }
      if (Array.isArray(a)) { a.forEach((v, i) => walk(v, (b || [])[i], `${at}[${i}]`)); return; }
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
      const { status, json: out } = await postJson('/api/content?kind=legal', { action, json });
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

  if (!data || !doc) return <p className={NOTE}>{err || 'Loading...'}</p>;

  const pages = Object.keys(data.live);
  const cur = doc[page];
  if (!cur) return <p className={NOTE}>Nothing to edit.</p>;
  const isChanged = (at) => changed.some((c) => c === at);

  const field = (key, label, area = false) => {
    const at = `${page}.${key}`;
    const Tag = area ? 'textarea' : 'input';
    return (
      <span key={key}>
        <label className={FIELD_LABEL} htmlFor={`c-${key}`}>{label}</label>
        <Tag
          id={`c-${key}`}
          className={`${area ? FIELD_AREA : FIELD_INPUT} ${isChanged(at) ? CHANGED : ''}`}
          value={cur[key] ?? ''}
          rows={area ? 2 : undefined}
          onChange={(e) => set([page, key], e.target.value)}
        />
      </span>
    );
  };

  return (
    <div className={WRAP}>
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

      {data.build && (
        <p className={INFO}>
          {data.build.state === 'success' ? <CheckCircle2 aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
          <span>
            Last publish: <strong>{data.build.state}</strong>
            {data.build.state === 'success' ? ' - the site has it.' : ' - the site is still on the previous text.'}
            {data.build.url && (
              <>
                {' '}
                <a href={data.build.url} target="_blank" rel="noopener" className="text-gold">
                  build log <ExternalLink aria-hidden="true" style={{ display: 'inline', width: 12, height: 12 }} />
                </a>
              </>
            )}
          </span>
        </p>
      )}

      <div className={TABS}>
        {pages.map((p) => (
          <button key={p} type="button" className={p === page ? TAB_ON : TAB} data-page={p} onClick={() => setPage(p)}>
            {data.live[p].title}
          </button>
        ))}
      </div>

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
                <p className={BLOCK_LABEL}>{KIND.list}</p>
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
              <p className={BLOCK_LABEL}>{KIND[b.type] || b.type}</p>
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
            if (await send('publish')) { setSaved('Publishing. The site rebuilds in about three minutes.'); load(); }
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
