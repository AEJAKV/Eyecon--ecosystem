import { GIFT_CARD_DAYS, clinic } from './config.js';

// Gift card numbers look like EYC-AMO-7K2M9Q: a three-letter code for the affiliate, then a random serial.
// The serial alphabet leaves out 0, 1, I and O so a number read aloud or copied by hand is not misread.
export const GIFT_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const GIFT_SERIAL_LENGTH = 6;
export const HIDDEN_SERIAL = '••••••';

// Characters from a cryptographic random source. The alphabet has exactly 32 characters, so taking the
// low five bits of each random byte picks every character with equal probability.
export function giftSerial(length = GIFT_SERIAL_LENGTH) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, b => GIFT_ALPHABET[b & 31]).join('');
}
// Booking references use the same alphabet, 8 characters long (for example 7K2M9QXB). In live mode the database
// assigns them (migration 006); the demo uses this.
export const REFERENCE_LENGTH = 8;
export const REFERENCE_PATTERN = /^[2-9A-HJ-NP-Z]{8}$/;
export function bookingReference(isTaken = () => false) {
  for (let attempt = 0; attempt < 20; attempt++) { const ref = giftSerial(REFERENCE_LENGTH); if (!isTaken(ref)) return ref; }
  throw new Error('A booking reference could not be issued. Please try again.');
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

// A card released to a visitor when they open an affiliate's link. Its days start now. (No longer used: cards are issued at booking or claim.)
export function releaseGiftCard(isTaken = () => false, now = new Date()) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const serial = giftSerial();
    if (isTaken(serial)) continue;
    return { serial, releasedAt: now.toISOString(), expiresAt: new Date(now.getTime() + GIFT_CARD_DAYS * 86400000).toISOString(), status: 'Released' };
  }
  throw new Error('A gift card number could not be issued. Please try again.');
}

// Calendar days in clinic time. A card is good through the whole of its last day, so it counts as expired only once
// that day is over; the website and the server use the same rule.
function clinicDay(date, timeZone) {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}
export function giftDaysLeft(expiresAt, now = new Date(), timeZone = clinic.timezone) {
  return clinicDay(new Date(expiresAt), timeZone) - clinicDay(now, timeZone);
}
export function giftExpired(expiresAt, now = new Date(), timeZone = clinic.timezone) { return giftDaysLeft(expiresAt, now, timeZone) < 0; }
// "12 days left", "1 day left", "Last day" on the day it expires, "Expired" after that.
export function giftCountdown(expiresAt, now = new Date(), timeZone = clinic.timezone) {
  const days = giftDaysLeft(expiresAt, now, timeZone);
  if (days < 0) return { state: 'expired', days, label: 'Expired' };
  if (days === 0) return { state: 'last', days, label: 'Last day' };
  return { state: 'days', days, label: days + (days === 1 ? ' day left' : ' days left') };
}

// Whether a released card may be claimed by a booking: it must belong to the booking's affiliate, be unexpired, and
// not already be claimed (or redeemed or void). card is { affiliateId, expiresAt, status, bookingId }.
export function checkGiftClaim(card, affiliateId, now = new Date()) {
  if (!card) return { ok: false, reason: 'unknown' };
  if (!affiliateId || card.affiliateId !== affiliateId) return { ok: false, reason: 'wrong-affiliate' };
  if (card.status !== 'Released' || card.bookingId) return { ok: false, reason: card.status === 'Void' ? 'void' : 'claimed' };
  if (giftExpired(card.expiresAt, now)) return { ok: false, reason: 'expired' };
  return { ok: true };
}

// A card number as typed or scanned: the full number (EYC-AMO-7K2M9Q, any case, with or without dashes) or just the
// six-character serial. Returns the serial, or null when it is not a card number.
export function parseGiftNumber(text) {
  const s = String(text || '').toUpperCase().replace(/[\s-]/g, '');
  const m = /^(?:EYC[A-Z]{3})?([2-9A-HJ-NP-Z]{6})$/.exec(s);
  return m ? m[1] : null;
}
// The card's own page: the QR code on every card opens it. Anyone sees the card; signed-in staff also see whose it is.
export function giftCardPath(number) { return '/gift/' + encodeURIComponent(number); }

// What staff see when they scan a card. Only these fields, for either kind of card:
// booking: name, email and the appointment (reference, service, optometrist, time, booking status).
// prescription: name, email and the card number; there is no appointment.
// Never the phone, insurance, health card, policy, documents or any amounts.
export const SCAN_KEYS = ['booking', 'email', 'expired', 'expiresAt', 'issuedAt', 'kind', 'name', 'number', 'redeemedAt', 'status'];
export const SCAN_BOOKING_KEYS = ['doctor', 'reference', 'service', 'start', 'status'];
export function giftScanView({ kind, number, status, issuedAt, expiresAt, redeemedAt = null, name, email, booking = null }, now = new Date()) {
  return {
    kind, number, status, issuedAt, expiresAt, redeemedAt: redeemedAt || null, expired: giftExpired(expiresAt, now), name, email,
    booking: kind === 'booking' && booking ? { reference: booking.reference || null, service: booking.service, doctor: booking.doctor || null, start: booking.start, status: booking.status } : null
  };
}

// A card's state for staff, in words: 'Redeemed', 'Void', 'Expired' or 'Not redeemed'. A redeemed card stays
// 'Redeemed' after its expiry date. card is { status, expiresAt }.
export function giftState(card, now = new Date()) {
  if (card.status === 'Redeemed') return 'Redeemed';
  if (card.status === 'Void') return 'Void';
  if (giftExpired(card.expiresAt, now)) return 'Expired';
  return 'Not redeemed';
}
// Whether staff may mark a card redeemed (redeem = true) or undo that (redeem = false). Only an issued (or claimed),
// unexpired card can be redeemed, once. Undo is for a mistake at the counter and puts the card back as it was.
export function checkRedeem(card, redeem, now = new Date()) {
  if (!card) return { ok: false, message: 'No gift card has this number. Check it and try again.' };
  if (!redeem) return card.status === 'Redeemed' ? { ok: true } : { ok: false, message: 'This gift card has not been redeemed.' };
  if (card.status === 'Redeemed') return { ok: false, message: 'This gift card has already been redeemed.' };
  if (card.status === 'Void') return { ok: false, message: 'This gift card is void and cannot be redeemed.' };
  if (giftExpired(card.expiresAt, now)) return { ok: false, message: 'This gift card has expired and cannot be redeemed.' };
  if (!['Issued', 'Claimed'].includes(card.status)) return { ok: false, message: 'This gift card cannot be redeemed.' };
  return { ok: true };
}

// The card page's public status, for anyone holding the card's link: only its state and dates, never whose card it is.
// The full number must match, affiliate code included (EYC-AMO-7K2M9Q), so a guessed serial alone shows nothing.
// card is { status, expiresAt, redeemedAt, affiliate } or null. Returns { state, expiresAt, redeemedAt } or null.
export const PUBLIC_STATUS_KEYS = ['expiresAt', 'redeemedAt', 'state'];
export function giftPublicStatus(number, card, now = new Date()) {
  const serial = parseGiftNumber(number);
  if (!serial || !card) return null;
  if (String(number).toUpperCase().replace(/\s/g, '') !== giftNumber(card.affiliate, serial)) return null;
  return { state: giftState(card, now), expiresAt: card.expiresAt, redeemedAt: card.redeemedAt || null };
}
