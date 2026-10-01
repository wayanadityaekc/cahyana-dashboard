// "Share" for a driver's login (DASHBOARD BRIEF #12): the driver app link plus
// the username and password as plain text, through the phone's own share sheet.
// Plain text on purpose (Wayan: no extra wrapping) - the owner picks who gets it.
//
// The password is only known right after it is typed or set: the server keeps a
// hash, so it can never be read back. A card with no known password shares the
// link and username only, and says so.

export function driverLink() {
  return `${window.location.origin}/driver`;
}

export function loginText({ username, password }) {
  const lines = ['Cahyana driver app', `Link: ${driverLink()}`, `Username: ${username}`];
  if (password) lines.push(`Password: ${password}`);
  return lines.join('\n');
}

// -> 'shared' | 'copied' | 'cancelled' | 'failed'
export async function shareLogin({ name, username, password }) {
  const text = loginText({ username, password });
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: `Cahyana driver login${name ? ` - ${name}` : ''}`, text });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';   // closed the sheet: not an error
      // any other refusal falls through to copying
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
