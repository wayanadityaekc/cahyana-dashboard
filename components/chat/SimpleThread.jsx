'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { FIELD_INPUT } from '@/components/ui/formClasses';
import { getJson, postJson, Unauthorized } from '@/lib/api';
import {
  CONV, CONV_HEAD, CONV_WHO, CONV_MAIL, CONV_BODY, BUB_GUEST, BUB_OWNER, STAMP, FOOT, SEND_BTN, GHOST, EMPTY, when,
} from './chatClasses';

// One owner <-> driver conversation (DASHBOARD BRIEF #7). Used on BOTH sides:
// the owner's Chat > Drivers, and the driver app's Chat tab. `mine` is the
// sender id whose bubbles sit on the right ('admin' or 'driver').
//
// Polled every 5 s while open, with `?after=<last id>` so a poll only carries
// what is new. Driver threads are not on the guest chat's WebSocket: there is
// one conversation per driver, both people have push for a new message, and a
// poll that only runs while the thread is on screen is cheap.
const POLL_MS = 5000;

export default function SimpleThread({ url, postUrl, mine, title, subtitle, onExpired, onBack, placeholder = 'Write a message', heightClass = '' }) {
  const [msgs, setMsgs] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const lastId = useRef(0);
  const bodyRef = useRef(null);

  const pull = useCallback(async () => {
    try {
      const j = await getJson(`${url}${lastId.current ? `?after=${lastId.current}` : ''}`);
      const add = j.messages || [];
      if (add.length) lastId.current = add[add.length - 1].id;
      setMsgs((prev) => {
        const seen = new Set((prev || []).map((m) => m.id));
        return [...(prev || []), ...add.filter((m) => !seen.has(m.id))];
      });
    } catch (e) {
      if (e instanceof Unauthorized) onExpired();
      else setErr(e.message || 'Could not load messages.');
    }
  }, [url, onExpired]);

  useEffect(() => {
    lastId.current = 0;
    setMsgs(null);
    pull();
    const t = setInterval(() => { if (document.visibilityState === 'visible') pull(); }, POLL_MS);
    return () => clearInterval(t);
  }, [pull]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [msgs]);

  const send = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true); setErr('');
    try {
      const { status, json } = await postJson(postUrl || url, { body: text });
      if (status !== 200) setErr(json.detail || `Server answered ${status}.`);
      else { setDraft(''); await pull(); }
    } catch (x) { if (x instanceof Unauthorized) onExpired(); else setErr(x.message); }
    setBusy(false);
  };

  return (
    <div className={`${CONV} ${heightClass}`} data-thread>
      <div className={CONV_HEAD}>
        <MessageCircle strokeWidth={1.7} className="w-[var(--icon-sm)] h-[var(--icon-sm)] text-gold flex-none" aria-hidden="true" />
        <span className={CONV_WHO}>
          {title}
          {subtitle && <small className={CONV_MAIL}>{subtitle}</small>}
        </span>
        {onBack && <button type="button" className={GHOST} onClick={onBack}>Back</button>}
      </div>
      <div className={CONV_BODY} ref={bodyRef} data-chatbody>
        {!msgs && <p className={EMPTY}>Loading...</p>}
        {msgs && msgs.length === 0 && <p className={EMPTY}>No messages yet.</p>}
        {msgs && msgs.map((m) => (
          <span key={m.id} className={m.from === mine ? BUB_OWNER : BUB_GUEST} data-from={m.from}>
            {m.body}
            <small className={STAMP} style={{ display: 'block', opacity: 0.75 }}>{when(m.at)}</small>
          </span>
        ))}
      </div>
      {err && <p className="font-body text-small text-err m-0 px-[0.8rem] py-[0.4rem]" role="alert">{err}</p>}
      <form className={FOOT} onSubmit={send}>
        <input
          className={`${FIELD_INPUT} flex-1`}
          value={draft}
          maxLength={2000}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Message"
          data-thread-input
        />
        <button type="submit" className={SEND_BTN} disabled={!draft.trim() || busy} aria-label="Send">
          <Send strokeWidth={1.8} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
