// The visitor's released gift card, kept in their browser per affiliate so a returning visitor sees the same card
// (and the same expiry). Every read and write is wrapped: private windows and blocked storage throw, and then the site
// falls back to issuing the card at booking.
const PREFIX = 'eyecon-gift-v1:';
const key = slug => PREFIX + slug;

// A stored card is only trusted if it has the shape the server returns.
export function validStoredGift(card) {
  return !!card && typeof card === 'object' && /^[2-9A-HJ-NP-Z]{6}$/.test(card.serial) && typeof card.token === 'string' && card.token.length > 0
    && Number.isFinite(new Date(card.releasedAt).getTime()) && Number.isFinite(new Date(card.expiresAt).getTime());
}
export function readStoredGift(slug) {
  try { const card = JSON.parse(localStorage.getItem(key(slug)) || 'null'); return validStoredGift(card) ? card : null; } catch { return null; }
}
export function writeStoredGift(slug, card) {
  try { localStorage.setItem(key(slug), JSON.stringify({ serial: card.serial, releasedAt: card.releasedAt, expiresAt: card.expiresAt, token: card.token })); return true; } catch { return false; }
}
// Whether this browser can keep a card at all; checked before asking the server to release one.
export function giftStorageWorks() {
  try { const probe = PREFIX + 'probe'; localStorage.setItem(probe, '1'); localStorage.removeItem(probe); return true; } catch { return false; }
}
// Resetting the demo forgets the cards it released.
export function clearStoredGifts() {
  try { Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k)); } catch { /* nothing to clear */ }
}

// What the visitor gets for an affiliate's link, in one place so the fallback can be tested. A stored card is reused.
// Otherwise a card is requested, and ANY reason it cannot be had (browser storage unavailable, the request refused by
// the rate limit, a network or server error, an unusable reply, or the card not being savable) gives 'fallback': no
// token is sent with the booking and the card is issued at booking, exactly as before. { status, card }.
export const GIFT_FALLBACK = { status: 'fallback', card: null };
export async function resolveGift(slug, { release, read = readStoredGift, write = writeStoredGift, storageWorks = giftStorageWorks }) {
  const stored = read(slug);
  if (stored) return { status: 'ready', card: stored };
  if (!storageWorks()) return GIFT_FALLBACK;
  let card;
  try { card = await release(slug); } catch { return GIFT_FALLBACK; }
  if (!validStoredGift(card)) return GIFT_FALLBACK;
  return write(slug, card) ? { status: 'ready', card } : GIFT_FALLBACK;
}
