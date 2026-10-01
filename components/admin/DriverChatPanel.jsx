'use client';

import { useCallback, useEffect, useState } from 'react';
import { getJson, Unauthorized } from '@/lib/api';
import SimpleThread from '@/components/chat/SimpleThread';
import { WRAP, LIST, listRow, ROW_TOP, ROW_WHO, ROW_WHEN, ROW_LAST, BADGE, EMPTY, when } from '@/components/chat/chatClasses';

// Chat > Drivers (DASHBOARD BRIEF #7): one private thread per driver. Same two
// columns as the guest chat on a desktop, one at a time on a phone.
export default function DriverChatPanel({ onExpired, onUnread }) {
  const [threads, setThreads] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const t = (await getJson('/api/driver-chats')).threads || [];
      setThreads(t);
      if (onUnread) onUnread(t.reduce((s, x) => s + (x.unread || 0), 0));
    } catch (e) { if (e instanceof Unauthorized) onExpired(); else setErr(e.message || 'Could not load driver chats.'); }
  }, [onExpired, onUnread]);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 10000);
    return () => clearInterval(t);
  }, [load]);

  if (err) return <p className="font-body text-body text-err m-0 py-[var(--space-3)]">{err}</p>;
  if (!threads) return <p className={EMPTY}>Loading driver chats...</p>;
  if (!threads.length) return <p className={EMPTY}>No drivers yet. Add them in Drivers - each one gets a private thread with you here.</p>;

  const open = threads.find((t) => t.id === openId);

  return (
    <div className={WRAP} data-driver-chats>
      <div className={`${LIST} ${openId ? 'max-[768px]:hidden' : ''}`}>
        {threads.map((t) => (
          <button key={t.id} type="button" className={listRow(t.id === openId, t.unread)} onClick={() => { setOpenId(t.id); setTimeout(load, 300); }} data-driver-thread={t.id}>
            <span className={ROW_TOP}>
              <span className={ROW_WHO}>{t.name}{t.active ? '' : ' (deactivated)'}</span>
              {t.unread > 0 && <span className={BADGE}>{t.unread}</span>}
              <span className={ROW_WHEN}>{when(t.lastAt)}</span>
            </span>
            <small className={ROW_LAST}>{t.last || 'No messages yet'}</small>
          </button>
        ))}
      </div>
      {open ? (
        <SimpleThread
          key={open.id}
          url={`/api/driver-chats/${open.id}`}
          mine="admin"
          title={open.name}
          subtitle="Driver"
          onExpired={onExpired}
          onBack={() => setOpenId(null)}
          placeholder={`Message ${open.name}`}
        />
      ) : (
        <p className={`${EMPTY} max-[768px]:hidden`}>Pick a driver to read and reply.</p>
      )}
    </div>
  );
}
