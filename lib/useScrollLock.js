'use client';

import { useEffect } from 'react';

// Standing rule (DASHBOARD BRIEF #9): while ANY popup / dialog / drawer is
// open, the page behind it must not scroll. Every overlay calls this hook.
//
// A counter, not a boolean: two overlays can be open at once (a dialog over the
// drawer). The first one locks, only the last one to close releases - closing
// one must not unlock the page under the other.
let locks = 0;
let saved = null;

function lock() {
  if (locks++ > 0) return;
  const b = document.body;
  saved = { overflow: b.style.overflow, overscroll: b.style.overscrollBehavior };
  b.style.overflow = 'hidden';
  b.style.overscrollBehavior = 'contain';
  document.documentElement.setAttribute('data-scroll-locked', '');
}

function unlock() {
  if (--locks > 0) return;
  locks = 0;
  const b = document.body;
  b.style.overflow = saved ? saved.overflow : '';
  b.style.overscrollBehavior = saved ? saved.overscroll : '';
  document.documentElement.removeAttribute('data-scroll-locked');
  saved = null;
}

export default function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return undefined;
    lock();
    return unlock;
  }, [active]);
}
