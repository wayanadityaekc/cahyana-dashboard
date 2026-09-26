'use client';

import { useEffect } from 'react';

// Twin of the site's. Registers the worker and marks app mode for the phones
// that cannot report it in CSS (iOS before 16.4 has navigator.standalone and no
// display-mode query). Renders nothing.
export default function PwaRegister() {
  useEffect(() => {
    const app = window.navigator.standalone === true
      || window.matchMedia('(display-mode: standalone)').matches;
    if (app) document.documentElement.dataset.standalone = '1';

    if (!('serviceWorker' in navigator)) return undefined;
    const go = () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); };
    if (document.readyState === 'complete') go();
    else window.addEventListener('load', go, { once: true });
    return () => window.removeEventListener('load', go);
  }, []);

  return null;
}
