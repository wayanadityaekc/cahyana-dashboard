// The owner's live connection to the guest chats.
//
// Same bargain as the guest's side in CUE: the socket is a notification channel,
// not a write path and not a delivery guarantee. Replies still go over HTTP
// through this app's /api routes, and every connect triggers a re-read, so a
// dropped socket costs one request rather than a message nobody ever sees.
//
// The difference here is the door. A WebSocket cannot carry a header and the
// admin token is in an httpOnly cookie, so each connect starts by asking this
// app's own server for a one-shot ticket. That is why the ticket is fetched
// again on every reconnect - it is spent the moment it is used.
const PING_MS = 25000;
const PONG_GRACE_MS = 10000;
const BACKOFF_MS = [1000, 2000, 4000, 8000, 15000, 20000];

export function openAdminSocket({ onMessage, onThread, onTyping, onOpen, onLive, onExpired } = {}) {
  if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
    if (onLive) onLive(false);
    return { close() {}, typing() {}, live: () => false };
  }

  let ws = null;
  let closedByUs = false;
  let tries = 0;
  let live = false;
  let pingTimer = null;
  let pongTimer = null;
  let retryTimer = null;

  const setLive = (v) => { if (live !== v) { live = v; if (onLive) onLive(v); } };

  function stopTimers() {
    clearInterval(pingTimer); pingTimer = null;
    clearTimeout(pongTimer); pongTimer = null;
  }

  function beat() {
    stopTimers();
    pingTimer = setInterval(() => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      try { ws.send(JSON.stringify({ type: 'ping' })); } catch { return; }
      // A socket that looks open and answers nothing is the normal way these
      // die. Closing it is what starts a reconnect, and the reconnect is what
      // re-reads the conversation.
      clearTimeout(pongTimer);
      pongTimer = setTimeout(() => { try { ws.close(); } catch { /* gone */ } }, PONG_GRACE_MS);
    }, PING_MS);
  }

  async function connect() {
    if (closedByUs) return;
    let url = null;
    try {
      const res = await fetch('/api/ws-ticket', { method: 'POST', cache: 'no-store' });
      if (res.status === 401) { if (onExpired) onExpired(); return; }
      const body = await res.json().catch(() => ({}));
      // Demo has no API to be live with, and saying so once is better than
      // retrying forever against something that does not exist.
      if (body.demo) { setLive(false); return; }
      url = body.url;
    } catch { /* fall through to the retry */ }
    if (!url) { schedule(); return; }
    if (closedByUs) return;

    let sock;
    try { sock = new WebSocket(url); } catch { schedule(); return; }
    ws = sock;

    sock.onopen = () => { tries = 0; setLive(true); beat(); if (onOpen) onOpen(); };
    sock.onmessage = (ev) => {
      let msg = null;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (!msg || typeof msg.type !== 'string') return;
      if (msg.type === 'pong') { clearTimeout(pongTimer); pongTimer = null; return; }
      if (msg.type === 'typing') { if (onTyping) onTyping(Number(msg.threadId), msg.expiresIn || 4000); return; }
      if (msg.type === 'thread') { if (onThread) onThread(Number(msg.threadId), msg); return; }
      if (msg.type === 'message' && msg.message && onMessage) onMessage(Number(msg.threadId), msg.message);
    };
    sock.onerror = () => {};
    sock.onclose = () => { stopTimers(); setLive(false); schedule(); };
  }

  function schedule() {
    if (closedByUs) return;
    const wait = BACKOFF_MS[Math.min(tries, BACKOFF_MS.length - 1)];
    tries += 1;
    clearTimeout(retryTimer);
    retryTimer = setTimeout(connect, wait + Math.floor(Math.random() * 400));
  }

  connect();

  return {
    close() {
      closedByUs = true;
      stopTimers();
      clearTimeout(retryTimer);
      setLive(false);
      if (ws) { ws.onclose = null; try { ws.close(); } catch { /* gone */ } }
    },
    // Best-effort and never queued: a "typing" that arrives after the reply
    // would be nonsense.
    typing(threadId) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: 'typing', threadId })); } catch { /* dropped */ }
      }
    },
    live: () => live,
  };
}
