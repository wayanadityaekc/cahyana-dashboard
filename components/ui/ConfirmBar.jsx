'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { DANGER, GHOST } from '@/components/ui/panelClasses';

// An inline "are you sure" for an action that takes something away (coins off a
// guest, a refund). Not window.confirm: the global rules ban native dialogs. It
// sits where the action was pressed, takes focus, and Escape cancels it.
const BOX =
  'flex flex-col gap-[var(--space-1)] p-[0.7rem_0.9rem] rounded-[var(--r-md)] bg-white ' +
  '[border:1px_solid_var(--color-err)] font-body text-small text-green';
const MSG = 'flex items-start gap-[0.5rem] m-0 [&>svg]:w-[var(--icon-sm)] [&>svg]:h-[var(--icon-sm)] [&>svg]:shrink-0 [&>svg]:mt-[0.15rem] [&>svg]:text-err';
const ROW = 'flex flex-wrap items-center gap-[var(--space-1)]';

export default function ConfirmBar({ message = 'Are you sure?', confirmLabel = 'Yes', busy = false, onConfirm, onCancel, children }) {
  const boxRef = useRef(null);

  useEffect(() => {
    const first = boxRef.current && boxRef.current.querySelector('[data-confirm-yes]');
    if (first) first.focus();
  }, []);

  return (
    <div
      ref={boxRef}
      className={BOX}
      role="alertdialog"
      aria-label={message}
      data-confirm-bar
      onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
    >
      <p className={MSG}><AlertTriangle strokeWidth={1.7} aria-hidden="true" /><span>{message}</span></p>
      {children}
      <div className={ROW}>
        <button type="button" className={DANGER} onClick={onConfirm} disabled={busy} data-confirm-yes>
          {busy ? 'Working' : confirmLabel}
        </button>
        <button type="button" className={GHOST} onClick={onCancel} disabled={busy} data-confirm-no>Cancel</button>
      </div>
    </div>
  );
}
