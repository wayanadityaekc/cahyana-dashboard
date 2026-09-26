'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { FIELD_INPUT } from '@/components/ui/formClasses';
import { BTN_SM } from '@/components/ui/btnClasses';
import { getJson, postJson, Unauthorized } from '@/lib/api';
import { openAdminSocket } from '@/lib/chatSocket';
import { fmtTime, fmtDate } from '@/lib/time';

// The owner's side of the guest chat.
//
// Two columns on a desktop - the threads, then the conversation - and one at a
// time on a phone, which is where a reply actually gets typed when a guest is
// waiting. Whoever is waiting longest with something unread sits at the top.

const WRAP = 'flex gap-[var(--space-2)] min-[769px]:h-[min(620px,calc(100dvh-260px))]';
const LIST = 'flex flex-col gap-[0.4rem] overflow-y-auto min-[769px]:w-[280px] min-[769px]:flex-none flex-1';
const listRow = (on, unread) =>
  'w-full text-left p-[0.6rem_0.7rem] rounded-[var(--r-md)] cursor-pointer ' +
  '[transition:background-color_var(--dur)_var(--ease),scale_var(--dur-fast)_var(--ease)] ' +
  (on ? 'bg-white [border:1px_solid_var(--line)] [box-shadow:var(--shadow-sm)]'
      : `bg-transparent border-none hover:bg-cream ${unread ? '' : ''}`);
const ROW_TOP = 'flex items-baseline gap-[0.4rem]';
const ROW_WHO = 'flex-1 min-w-0 font-body text-small font-semibold text-gold truncate';
const ROW_WHEN = 'flex-none font-body text-label text-muted tabular-nums';
const ROW_LAST = 'block mt-[0.15rem] font-body text-label text-muted truncate';
const BADGE =
  'inline-flex items-center justify-center min-w-[18px] h-[18px] px-[5px] rounded-[var(--r-pill)] ' +
  'bg-cta text-white font-body text-label font-semibold tabular-nums';

const CONV = 'flex-1 min-w-0 flex flex-col rounded-[var(--r-md)] [border:1px_solid_var(--line)] overflow-hidden';
const CONV_HEAD = 'flex items-center gap-[0.5rem] flex-none px-[0.8rem] py-[0.6rem] [border-bottom:1px_solid_var(--line)] bg-cream';
const CONV_WHO = 'flex-1 min-w-0 font-body text-small font-semibold text-gold truncate';
const CONV_MAIL = 'block font-body text-label font-normal text-muted truncate';
const CONV_BODY =
  'flex-[1_1_auto] min-h-[220px] overflow-y-auto p-[0.8rem] flex flex-col gap-[0.5rem] bg-white';
const BUB_GUEST =
  'self-start max-w-[80%] px-[0.75rem] py-[0.5rem] rounded-[var(--r-md)] bg-cream [border:1px_solid_var(--line)] ' +
  'font-body text-body leading-[var(--lh-body)] text-ink [overflow-wrap:anywhere]';
const BUB_OWNER =
  'self-end max-w-[80%] px-[0.75rem] py-[0.5rem] rounded-[var(--r-md)] bg-cta ' +
  'font-body text-body leading-[var(--lh-body)] text-white [overflow-wrap:anywhere]';
const STAMP = 'font-body text-label text-muted mt-[0.1rem]';
const FOOT = 'flex-none flex items-center gap-[0.5rem] p-[0.6rem] [border-top:1px_solid_var(--line)] bg-white';
const SEND_BTN =
  'flex-none inline-flex items-center justify-center w-[var(--btn-h)] h-[var(--btn-h)] rounded-[var(--r-sm)] ' +
  'bg-cta text-white border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ' +
  '[&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)] ' +
  '[transition:background-color_var(--dur)_var(--ease),scale_var(--dur-fast)_var(--ease)] hover:bg-cta-d';
const GHOST =
  `inline-flex ${BTN_SM} gap-[0.4rem] bg-white text-gold [border:1px_solid_var(--line)] cursor-pointer ` +
  '[&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)] [&>svg]:shrink-0 ' +
  '[transition:background-color_var(--dur)_var(--ease),scale_var(--dur-fast)_var(--ease)] hover:bg-cream';
const EMPTY = 'font-body text-body text-muted m-0 py-[var(--space-3)]';
// The guest is typing. Same bubble shape as theirs, on their side of the
// conversation, so it reads as coming from them.
const TYPING =
  'self-start flex items-center gap-[0.45rem] px-[0.75rem] py-[0.5rem] rounded-[var(--r-md)] ' +
  'bg-cream [border:1px_solid_var(--line)] font-body text-label text-muted';
const TDOT = (i) =>
  'w-[5px] h-[5px] rounded-[50%] bg-muted motion-safe:animate-[chatdot_1.1s_ease-in-out_infinite] ' +
  `[animation-delay:${i * 0.15}s]`;

const when = (v) => {
  if (!v) return '';
  const d = new Date(v);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay ? fmtTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`) : fmtDate(v);
};

export default function ChatPanel({ onExpired, onUnread }) {
  const [threads, setThreads] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [thread, setThread] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // Live rather than polled. `live` is the switch back to polling, not something
  // shown: a network that will not carry a WebSocket should behave exactly as
  // this panel did before, not quietly stop updating.
  const [live, setLive] = useState(false);
  const [typingOn, setTypingOn] = useState(0);
  const bodyRef = useRef(null);
  const openRef = useRef(null);

  const loadList = useCallback(async () => {
    try {
      const d = await getJson('/api/chats');
      setThreads(d.threads || []);
      if (onUnread) onUnread((d.threads || []).reduce((n, t) => n + (t.unread || 0), 0));
    } catch (e) {
      if (e instanceof Unauthorized) onExpired();
      else setErr(e.message || 'Could not load chats.');
    }
  }, [onExpired, onUnread]);

  const loadThread = useCallback(async (id) => {
    try {
      const d = await getJson(`/api/chats/${id}`);
      setThread(d.thread);
    } catch (e) {
      if (e instanceof Unauthorized) onExpired();
      else setErr(e.message || 'Could not open that chat.');
    }
  }, [onExpired]);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { if (openId) loadThread(openId); }, [openId, loadThread]);
  // Read inside the socket handlers. Putting openId in their dependency list
  // would tear down and rebuild the socket - and a new socket needs a new
  // ticket - every time a conversation is opened.
  useEffect(() => { openRef.current = openId; }, [openId]);

  // One socket for the whole panel, not one per conversation: the list has to
  // move when a guest writes into a thread that is not open.
  useEffect(() => {
    const s = openAdminSocket({
      onLive: setLive,
      onExpired,
      // Every connect, including every reconnect. Anything said while the socket
      // was down is read back here rather than missed.
      onOpen: () => { loadList(); if (openRef.current) loadThread(openRef.current); },
      onMessage: (threadId, message) => {
        loadList();
        if (threadId !== openRef.current) return;
        // Deduped by id: this also fires for a reply typed in another tab, and
        // for the echo of the one just sent from this one.
        setThread((t) => {
          if (!t || t.messages.some((m) => m.id === message.id)) return t;
          return { ...t, messages: [...t.messages, message] };
        });
      },
      onThread: () => loadList(),
      onTyping: (threadId) => { if (threadId === openRef.current) setTypingOn(Date.now() + 4000); },
    });
    sockTyping.current = s.typing;
    return () => { sockTyping.current = null; s.close(); };
  }, [loadList, loadThread, onExpired]);

  // The fallback. Slower than the old eight seconds on purpose: this now only
  // runs when the socket is down, and a panel that has fallen back is better off
  // being cheap than being nearly-live.
  useEffect(() => {
    if (live) return undefined;
    const t = setInterval(() => { loadList(); if (openRef.current) loadThread(openRef.current); }, 8000);
    return () => clearInterval(t);
  }, [live, loadList, loadThread]);

  // Typing expires on its own; one left on screen would claim a guest is still
  // writing when they have gone.
  const guestTyping = typingOn > Date.now();
  useEffect(() => {
    const ms = typingOn - Date.now();
    if (ms <= 0) return undefined;
    const t = setTimeout(() => setTypingOn(0), ms);
    return () => clearTimeout(t);
  }, [typingOn]);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread]);

  async function send(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || busy || !openId) return;
    setBusy(true);
    try {
      const { status, json } = await postJson(`/api/chats/${openId}/reply`, { body });
      if (status === 200) {
        setDraft('');
        // Shown straight away rather than waiting for a round trip. Deduped by
        // id, because the socket echoes this same reply back - the server
        // publishes it while the POST is still in flight, so the echo can land
        // FIRST and this append would then be the second copy. Measured: without
        // the guard the reply appeared twice, every time.
        setThread((t) => {
          if (!t) return t;
          if (json.message && t.messages.some((m) => m.id === json.message.id)) return t;
          return { ...t, messages: [...t.messages, json.message] };
        });
        loadList();
      } else {
        setErr(json.detail || `Server answered ${status}.`);
      }
    } catch (e2) {
      if (e2 instanceof Unauthorized) onExpired();
      else setErr(e2.message || 'Could not send that.');
    }
    setBusy(false);
  }

  // Announced at most every two seconds while a reply is being written, so the
  // guest can see somebody is actually there.
  const lastTyped = useRef(0);
  const sockTyping = useRef(null);
  function onDraft(v) {
    setDraft(v);
    if (!openId) return;
    const t = Date.now();
    if (t - lastTyped.current < 2000) return;
    lastTyped.current = t;
    if (sockTyping.current) sockTyping.current(openId);
  }

  if (err) return <p className="font-body text-body text-err m-0 py-[var(--space-3)]">{err}</p>;
  if (!threads) return <p className={EMPTY}>Loading chats...</p>;
  if (!threads.length) {
    return (
      <p className={EMPTY}>
        No chats yet. The support panel on the site answers most questions by itself;
        a conversation only lands here when a guest asks for you.
      </p>
    );
  }

  const showList = !openId || typeof window === 'undefined';

  return (
    <div className={WRAP} data-live={live ? '1' : '0'}>
      <div className={`${LIST} ${openId ? 'max-[768px]:hidden' : ''}`}>
        {threads.map((t) => (
          <button
            key={t.id}
            type="button"
            className={listRow(t.id === openId, t.unread)}
            onClick={() => setOpenId(t.id)}
          >
            <span className={ROW_TOP}>
              <span className={ROW_WHO}>{t.guest_name || 'Guest'}</span>
              {t.unread > 0 && <span className={BADGE}>{t.unread}</span>}
              <span className={ROW_WHEN}>{when(t.last_message_at)}</span>
            </span>
            <small className={ROW_LAST}>
              {t.last_sender === 'owner' ? 'You: ' : ''}{t.last_body || ''}
            </small>
          </button>
        ))}
      </div>

      {openId && (
        <div className={`${CONV} ${openId ? '' : 'max-[768px]:hidden'}`}>
          <div className={CONV_HEAD}>
            <MessageCircle strokeWidth={1.7} className="w-[var(--icon-sm)] h-[var(--icon-sm)] text-gold flex-none" aria-hidden="true" />
            <span className={CONV_WHO}>
              {(thread && thread.guest_name) || 'Guest'}
              <small className={CONV_MAIL}>
                {(thread && thread.guest_email) || 'no email left'}
                {thread && thread.page ? ` · from ${thread.page}` : ''}
              </small>
            </span>
            <button type="button" className={GHOST} onClick={() => { setOpenId(null); setThread(null); }}>
              Close
            </button>
          </div>

          <div className={CONV_BODY} ref={bodyRef} data-chatbody>
            {!thread && <p className={EMPTY}>Loading...</p>}
            {thread && thread.messages.map((m) => (
              <span key={m.id} className={m.sender === 'owner' ? BUB_OWNER : BUB_GUEST}>
                {m.body}
                <small className={STAMP} style={{ display: 'block', opacity: 0.75 }}>{when(m.created_at)}</small>
              </span>
            ))}
            {guestTyping && (
              <span className={TYPING} data-typing aria-live="polite">
                {`${((thread && thread.guest_name) || 'Guest').trim().split(/\s+/)[0]} is typing`}
                <i className={TDOT(0)} /><i className={TDOT(1)} /><i className={TDOT(2)} />
              </span>
            )}
          </div>

          <form className={FOOT} onSubmit={send}>
            <input
              className={`${FIELD_INPUT} flex-1`}
              value={draft}
              onChange={(e) => onDraft(e.target.value)}
              placeholder="Reply to the guest..."
              aria-label="Your reply"
              maxLength={2000}
            />
            <button type="submit" className={SEND_BTN} disabled={!draft.trim() || busy} aria-label="Send reply">
              <Send strokeWidth={1.8} aria-hidden="true" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
