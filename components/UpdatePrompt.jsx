'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

// "Update available" for the installed app (DASHBOARD BRIEF #11), owner
// dashboard and driver app alike - it is mounted once in the root layout.
//
// WHY NOT THE SERVICE WORKER ALONE. public/sw.js only changes when its own
// bytes change, and a normal deploy leaves them alone, so the browser never sees
// "a new worker". What actually changes is the page's JS. So the app compares
// the build id it is RUNNING (inlined at build time) with the one the server is
// serving now (/api/build), and asks again each time it comes back to the
// foreground - which is when a home-screen app has been sitting on an old copy.
//
// It asks first instead of reloading on its own: a driver mid-reply or the
// owner mid-edit would lose what they typed. Tapping Refresh reloads.
const RUNNING = process.env.NEXT_PUBLIC_BUILD_ID || '';
const EVERY_MS = 5 * 60 * 1000;

export default function UpdatePrompt() {
  const [stale, setStale] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    if (!RUNNING) return undefined;     // dev server: no build id, nothing to compare
    let dead = false;

    const check = async () => {
      if (busy.current || dead || document.visibilityState === 'hidden') return;
      busy.current = true;
      try {
        // Also let the browser look for a newer worker file while we are here.
        navigator.serviceWorker?.getRegistration().then((r) => r && r.update()).catch(() => {});
        const res = await fetch('/api/build', { cache: 'no-store' });
        if (res.ok) {
          const { id } = await res.json();
          if (!dead && id && id !== RUNNING) setStale(true);
        }
      } catch { /* offline: ask again later */ }
      busy.current = false;
    };

    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    check();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', check);
    const timer = setInterval(check, EVERY_MS);
    return () => {
      dead = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', check);
      clearInterval(timer);
    };
  }, []);

  if (!stale) return null;
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[150] bottom-[calc(80px+env(safe-area-inset-bottom,0px))] min-[994px]:bottom-4 w-[calc(100%-2rem)] max-w-[420px] flex items-center gap-[var(--space-2)] p-[0.6rem_0.6rem_0.6rem_1rem] rounded-[var(--r-md)] bg-gold text-white [box-shadow:var(--shadow-lg)]"
      role="status"
      data-update-prompt
    >
      <span className="flex-1 font-body text-small leading-[1.4]">Update available. Refresh to get the latest version.</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex items-center justify-center gap-[0.4rem] h-[var(--btn-h)] px-4 rounded-sm bg-white text-gold border-none cursor-pointer font-body text-small font-semibold leading-none [&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)]"
        data-update-refresh
      >
        <RefreshCw strokeWidth={1.7} aria-hidden="true" />Refresh
      </button>
    </div>
  );
}
