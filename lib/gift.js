import { GIFT_CARD_DAYS } from './config.js';

// Gift card numbers look like EYC-AMO-7K2M9Q: a three-letter code for the affiliate, then a random serial.
// The serial alphabet leaves out 0, 1, I and O so a number read aloud or copied by hand is not misread.
export const GIFT_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const GIFT_SERIAL_LENGTH = 6;
export const HIDDEN_SERIAL = '••••••';

// Six characters from a cryptographic random source. The alphabet has exactly 32 characters, so taking the
// low five bits of each random byte picks every character with equal probability.
export function giftSerial() {
  const bytes = crypto.getRandomValues(new Uint8Array(GIFT_SERIAL_LENGTH));
  return Array.from(bytes, b => GIFT_ALPHABET[b & 31]).join('');
}

// A new card for a referral booking: a serial no other booking has, valid for GIFT_CARD_DAYS from the moment of issue.
export function issueGiftCard(isTaken = () => false, now = new Date()) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const serial = giftSerial();
    if (isTaken(serial)) continue;
    return { serial, issuedAt: now.toISOString(), expiresAt: new Date(now.getTime() + GIFT_CARD_DAYS * 86400000).toISOString(), status: 'Issued' };
  }
  throw new Error('A gift card number could not be issued. Please try again.');
}

// The affiliate's three-letter code: the one set for them, or else their initials plus the next letter of their
// last name (Alex Morgan becomes AMO), padded with X for very short names.
export function giftCode(affiliate) {
  const set = String(affiliate?.code || '').toUpperCase();
  if (/^[A-Z]{3}$/.test(set)) return set;
  const words = String(affiliate?.name || '').normalize('NFD').replace(/[^A-Za-z\s]/g, '').toUpperCase().split(/\s+/).filter(Boolean);
  if (!words.length) return 'XXX';
  const first = words[0], last = words[words.length - 1];
  const letters = words.length > 1 ? first[0] + last[0] + (last[1] || first[1] || '') : first.slice(0, 3);
  return (letters + 'XXX').slice(0, 3);
}

export function giftNumber(affiliate, serial) { return 'EYC-' + giftCode(affiliate) + '-' + (serial || HIDDEN_SERIAL); }
