'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { FIELD_INPUT } from '@/components/ui/formClasses';
import { getJson, postJson, Unauthorized } from '@/lib/api';
import { openAdminSocket } from '@/lib/chatSocket';

// The owner's side of the guest chat.
//
// Two columns on a desktop - the threads, then the conversation - and one at a
// time on a phone, which is where a reply actually gets typed when a guest is
// waiting. Whoever is waiting longest with something unread sits at the top.

import {
  WRAP, LIST, listRow, ROW_TOP, ROW_WHO, ROW_WHEN, ROW_LAST, BADGE, CONV, CONV_HEAD, CONV_WHO, CONV_MAIL, CONV_BODY, BUB_GUEST, BUB_OWNER, STAMP, FOOT, SEND_BTN, GHOST, EMPTY, TYPING, TDOT, when,
} from '@/components/chat/chatClasses';

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
