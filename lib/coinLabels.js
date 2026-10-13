// Words for the coin screens (Coins panel and the coin block on a booking card).
// The API speaks in ledger keys (source, status); the owner reads these instead.

// Same order as cahyana-api coins.js REDEEM_CATEGORIES.
export const COIN_CATEGORIES = ['tour', 'experience', 'transfer', 'charter', 'villa'];

export const EARN_LABEL = {
  tour: 'Tour (per booking line)',
  experience: 'Experience (per booking line)',
  transfer: 'Transfer (per booking line)',
  charter: 'Charter (per booking line)',
  villa: 'Villa (per night)',
};

export const PCT_LABEL = {
  tour: 'Tour',
  experience: 'Experience',
  transfer: 'Transfer',
  charter: 'Charter',
  villa: 'Villa stay (returning guests only)',
};

// The two villas the API accepts (villa-rules.js isVilla).
export const COIN_VILLAS = ['Cahyana House', 'Cahyana Tibuah'];

const SOURCE_WORD = {
  cue_booking: 'Earned on a booking',
  villa_night: 'Earned on villa nights',
  package: 'Package bonus',
  referral: 'Referral',
  referral_bonus: 'Referral bonus',
  redemption: 'Used at checkout',
  villa_perk: 'Villa perk',
  adjust: 'Manual adjustment',
};

const STATUS_WORD = {
  held: 'on hold until paid',
  posted: '',
  released: 'given back',
  reversed: 'removed (refund)',
};

export function sourceWord(source) {
  return SOURCE_WORD[source] || source || 'Coins';
}

export function statusWord(status) {
  return Object.prototype.hasOwnProperty.call(STATUS_WORD, status) ? STATUS_WORD[status] : status || '';
}

// A row still counts toward the balance only while held or posted.
export function isLive(status) {
  return status === 'held' || status === 'posted';
}

export function signed(delta) {
  const count = Number(delta) || 0;
  return count > 0 ? `+${count}` : String(count);
}

export const COVERED = 'Covered by coin:';

// "Check-out 2026-10-20 (3 nights); Covered by coin: Breakfast" -> the coin parts on their own.
export function splitCovered(items) {
  const parts = String(items || '').split(';').map((part) => part.trim()).filter(Boolean);
  return {
    plain: parts.filter((part) => !part.startsWith(COVERED)),
    covered: parts.filter((part) => part.startsWith(COVERED)),
  };
}
