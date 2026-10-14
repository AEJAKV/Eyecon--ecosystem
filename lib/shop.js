import { collections, money } from './config.js';
import { withAffiliate } from './affiliate.js';

// The Shop Frames page's rules, kept apart from the components so they can be tested.

export function frameBrand(frame) { return collections.find(c => c.slug === frame.brand) || null; }

// A frame's price as shown: nothing while it is blank; a plain number is shown in dollars, anything else as written.
export function framePrice(price) {
  const text = String(price ?? '').trim();
  if (!text) return '';
  return /^\d+(\.\d+)?$/.test(text) ? money(text) : text;
}

// "Reserve to try": a styling visit with the frame's brand already chosen, keeping the affiliate's referral.
export function reserveHref(frame, affiliate) {
  const brand = frameBrand(frame);
  return withAffiliate('/booking?service=styling' + (brand ? '&brand=' + encodeURIComponent(brand.name) : ''), affiliate);
}

// Saved (hearted) frames live in this browser only. Reading and writing never throw: a private window, blocked storage
// or a damaged value simply means nothing is saved.
export const SAVED_FRAMES_KEY = 'eyecon-saved-frames';
export function readSavedFrames(storage) {
  try {
    const list = JSON.parse(storage?.getItem(SAVED_FRAMES_KEY) || '[]');
    return Array.isArray(list) ? list.filter(s => typeof s === 'string') : [];
  } catch { return []; }
}
export function writeSavedFrames(storage, list) {
  try { storage.setItem(SAVED_FRAMES_KEY, JSON.stringify(list)); return true; } catch { return false; }
}
export function toggleSaved(list, slug) { return list.includes(slug) ? list.filter(s => s !== slug) : [...list, slug]; }
