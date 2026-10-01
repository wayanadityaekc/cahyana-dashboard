// Browser-side push helpers, shared by the owner's Settings and the driver app
// (DASHBOARD BRIEF #5 / #7).

export function urlB64ToUint8Array(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function deviceLabel() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad/.test(ua)) return 'iPhone / iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  return 'Browser';
}


// What this browser can do about push, read after mount (never during render:
// the first paint must match the server's HTML).
// iPhone: Safari only allows web push for an app added to the Home Screen
// (iOS 16.4+), so a Safari TAB is its own state with its own instruction.
export function pushEnv() {
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const installed = document.documentElement.dataset.standalone === '1' || navigator.standalone === true
    || window.matchMedia('(display-mode: standalone)').matches;
  return { supported, permission: supported ? Notification.permission : 'unsupported', ios, installed, iosTab: ios && !installed };
}
